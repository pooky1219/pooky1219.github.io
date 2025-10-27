import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";
import {
  initRenderer,
  initCamera,
  initDefaultDirectionalLighting,
  initOrbitControls,
} from "./util.js";

const scene = new THREE.Scene();
const camera = initCamera(new THREE.Vector3(50, 50, 50));
const renderer = initRenderer({ antialias: true });
renderer.setClearColor(0x87ceeb); // 하늘색
initDefaultDirectionalLighting(scene);
const controls = initOrbitControls(camera, renderer);
const aiCars = [];
let player; // 전역 변수로 선언
const cameraOffset = new THREE.Vector3(0, 4, -7);
const mapBounds = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
};
let rapierReady = false;
let world;
let playerBody;
let colliderMap = []; // static collider 저장
let score = 0;
let deliveryTarget;
let currentCity = null;
const scoreDisplay = document.createElement("div");
scoreDisplay.textContent = "📦 배달: 0건";
scoreDisplay.style.position = "absolute";
scoreDisplay.style.top = "20px";
scoreDisplay.style.left = "20px";
scoreDisplay.style.fontSize = "30px";
scoreDisplay.style.fontFamily = "monospace";
scoreDisplay.style.backgroundColor = "rgba(0,0,0,0.7)";
scoreDisplay.style.color = "white";
scoreDisplay.style.padding = "10px 20px";
scoreDisplay.style.borderRadius = "8px";
scoreDisplay.style.zIndex = "1000";
document.body.appendChild(scoreDisplay);

// 모델 로더 클래스
class CityBuilder {
  constructor(scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.models = new Map();
    this.roadPositions = new Set(); // 도로 위치 추적
    this.deliveryCandidates = [];
  }

  async loadModel(name, path) {
    try {
      const gltf = await this.loader.loadAsync(path);
      this.models.set(name, gltf.scene);
    } catch (err) {
      console.error(`모델 로딩 실패: ${name}`, err);
    }
  }

  addBuilding(
    name,
    pos,
    rot = { x: 0, y: 0, z: 0 },
    scale = 3,
    isRoad = false
  ) {
    const original = this.models.get(name);
    if (!original) return;

    const clone = original.clone();
    clone.rotation.set(rot.x, rot.y, rot.z);

    // scale이 객체면 각 축별로, 숫자면 setScalar
    if (typeof scale === "object") {
      clone.scale.set(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1);
    } else {
      clone.scale.setScalar(scale);
    }

    const box = new THREE.Box3().setFromObject(clone);
    const yOffset = -box.min.y;

    clone.position.set(pos.x, pos.y + yOffset, pos.z);

    clone.traverse((obj) => {
      if (obj.isMesh) {
        // 구름이면 그림자 비활성화 및 머티리얼 흰색 적용
        if (name === "cloud") {
          obj.castShadow = false;
          obj.receiveShadow = false;
          obj.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.62, // 약간 투명하게
            roughness: 0.7,
            metalness: 0.0,
          });
        } else {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      }
    });

    // 도로 위치 기록
    if (isRoad) {
      this.roadPositions.add(`${pos.x},${pos.z}`);
    }
    // 건물이면 좌표 저장
    if (name.startsWith("building_")) {
      this.deliveryCandidates.push({ x: pos.x, z: pos.z });
    }

    this.scene.add(clone);
    if (rapierReady) {
      this.addStaticColliderFromMesh(clone);
    }
  }

  addStaticColliderFromMesh(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    ).setTranslation(center.x, center.y, center.z);
    const collider = world.createCollider(colliderDesc);
    colliderMap.push(collider);
  }

  // 도로 근처인지 확인하는 함수
  isNearRoad(x, z, tileSize, maxDistance = 2) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dz = -maxDistance; dz <= maxDistance; dz++) {
        const checkX = Math.round((x + dx * tileSize) / tileSize) * tileSize;
        const checkZ = Math.round((z + dz * tileSize) / tileSize) * tileSize;
        if (this.roadPositions.has(`${checkX},${checkZ}`)) {
          return true;
        }
      }
    }
    return false;
  }
}

class AICar {
  constructor(model, pathPoints, speed = 0.002) {
    this.mesh = model.clone();

    // 모든 차량 스케일 동일하게 설정
    const fixedScale = 1.5;
    this.mesh.scale.setScalar(fixedScale);

    this.pathPoints = pathPoints;
    this.speed = speed;
    this.currentIndex = 0;
    this.progress = 0;

    // 초기 위치 설정
    const pos = this.pathPoints[0];
    this.mesh.position.set(pos.x, pos.y, pos.z);
    scene.add(this.mesh);

    // Rapier 고정 물리 바디 생성
    if (rapierReady) {
      const bodyDesc =
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          pos.x,
          pos.y + 0.1,
          pos.z
        );
      this.body = world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(0.7, 0.2, 1.0)
        .setFriction(1.0)
        .setRestitution(0.1); // AI차 크기 맞게 조절
      world.createCollider(colliderDesc, this.body);
    }
  }

  update() {
    if (this.pathPoints.length < 2) return;

    const curr = this.pathPoints[this.currentIndex];
    const next =
      this.pathPoints[(this.currentIndex + 1) % this.pathPoints.length];

    const dir = new THREE.Vector3(
      next.x - curr.x,
      next.y - curr.y,
      next.z - curr.z
    );
    dir.normalize();

    this.progress += this.speed;

    if (this.progress >= 1) {
      this.progress = 0;
      this.currentIndex = (this.currentIndex + 1) % this.pathPoints.length;
    }

    const pos = new THREE.Vector3().lerpVectors(curr, next, this.progress);
    this.mesh.position.set(pos.x, pos.y, pos.z);

    // 차 방향을 회전
    const angle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = angle;

    if (rapierReady && this.body) {
      this.body.setNextKinematicTranslation(
        { x: pos.x, y: pos.y + 0.1, z: pos.z },
        true
      );
      this.body.setNextKinematicRotation(
        { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
        true
      );
    }
  }
}

// 모델 경로
const modelPaths = {
  base: "./Assets/gltf/base.gltf",

  // 건물 (전체 추가)
  building_A: "./Assets/gltf/building_A.gltf",
  building_B: "./Assets/gltf/building_B.gltf",
  building_C: "./Assets/gltf/building_C.gltf",
  building_D: "./Assets/gltf/building_D.gltf",
  building_E: "./Assets/gltf/building_E.gltf",
  building_F: "./Assets/gltf/building_F.gltf",
  building_G: "./Assets/gltf/building_G.gltf",
  building_H: "./Assets/gltf/building_H.gltf",

  // 도로
  road_straight: "./Assets/gltf/road_straight.gltf",
  road_junction: "./Assets/gltf/road_junction.gltf",
  road_corner: "./Assets/gltf/road_corner.gltf",
  road_corner_curved: "./Assets/gltf/road_corner_curved.gltf",
  road_straight_crossing: "./Assets/gltf/road_straight_crossing.gltf",
  road_tsplit: "./Assets/gltf/road_tsplit.gltf",

  // 차량
  car_sedan: "./Assets/gltf/car_sedan.gltf",
  car_taxi: "./Assets/gltf/car_taxi.gltf",
  car_police: "./Assets/gltf/car_police.gltf",
  car_stationwagon: "./Assets/gltf/car_stationwagon.gltf",
  car_hatchback: "./Assets/gltf/car_hatchback.gltf",
  Bike: "./Assets/gltf/Bike.glb",

  // 장식
  bench: "./Assets/gltf/bench.gltf",
  box_A: "./Assets/gltf/box_A.gltf",
  box_B: "./Assets/gltf/box_B.gltf",
  bush: "./Assets/gltf/bush.gltf",
  dumpster: "./Assets/gltf/dumpster.gltf",
  firehydrant: "./Assets/gltf/firehydrant.gltf",
  streetlight: "./Assets/gltf/streetlight.gltf",
  trash_A: "./Assets/gltf/trash_A.gltf",
  trash_B: "./Assets/gltf/trash_B.gltf",
  trafficlight_A: "./Assets/gltf/trafficlight_A.gltf",
  trafficlight_B: "./Assets/gltf/trafficlight_B.gltf",
  trafficlight_C: "./Assets/gltf/trafficlight_C.gltf",
  watertower: "./Assets/gltf/watertower.gltf",
  cloud: "./Assets/gltf/scene.gltf",
  speed_bump: "./Assets/gltf/speed_bump/scene.gltf",
};

async function createCity() {
  await RAPIER.init();
  world = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
  rapierReady = true;

  const city = new CityBuilder(scene);

  // 모델 로드
  for (const [name, path] of Object.entries(modelPaths)) {
    await city.loadModel(name, path);
  }

  const tileSize = 6;
  const gridSize = 8;

  // 맵 가장자리 도로 직접 배치 (꼭짓점: corner, 가장자리: straight)
  for (let i = -gridSize; i <= gridSize; i++) {
    for (let j = -gridSize; j <= gridSize; j++) {
      const x = i * tileSize;
      const z = j * tileSize;

      // 꼭짓점 (vertex)
      if (
        (i === -gridSize || i === gridSize) &&
        (j === -gridSize || j === gridSize)
      ) {
        // 각 꼭짓점에 맞는 회전값 지정
        let rotY = 0;
        if (i === -gridSize && j === -gridSize) rotY = 0;
        if (i === gridSize && j === -gridSize) rotY = -Math.PI / 2;
        if (i === gridSize && j === gridSize) rotY = Math.PI;
        if (i === -gridSize && j === gridSize) rotY = Math.PI / 2;

        city.addBuilding(
          "road_corner",
          { x, y: 0, z },
          { x: 0, y: rotY, z: 0 },
          3,
          true
        );
        continue;
      }

      // 상하 가장자리 (꼭짓점 제외)
      if (
        (j === -gridSize || j === gridSize) &&
        i > -gridSize &&
        i < gridSize
      ) {
        // 맵 안쪽을 향하도록 회전 (위쪽은 0, 아래쪽은 PI) + 왼쪽 90도 추가
        const rotY = (j === -gridSize ? 0 : Math.PI) - Math.PI / 2;
        city.addBuilding(
          "road_tsplit",
          { x, y: 0, z },
          { x: 0, y: rotY, z: 0 },
          3,
          true
        );
        continue;
      }

      // 좌우 가장자리 (꼭짓점 제외)
      if (
        (i === -gridSize || i === gridSize) &&
        j > -gridSize &&
        j < gridSize
      ) {
        // 맵 안쪽을 향하도록 회전 (왼쪽은 -PI/2, 오른쪽은 PI/2) + 왼쪽 90도 추가
        const rotY =
          (i === -gridSize ? -Math.PI / 2 : Math.PI / 2) + Math.PI / 2;
        city.addBuilding(
          "road_tsplit",
          { x, y: 0, z },
          { x: 0, y: rotY, z: 0 },
          3,
          true
        );
        continue;
      }
    }
  }

  // 내부 도로 배치 (가장자리는 제외)
  for (let i = -gridSize + 1; i <= gridSize - 1; i++) {
    for (let j = -gridSize + 1; j <= gridSize - 1; j++) {
      const x = i * tileSize;
      const z = j * tileSize;

      // 교차로
      if (i % 2 === 0 && j % 2 === 0) {
        city.addBuilding(
          "road_junction",
          { x, y: 0, z },
          { x: 0, y: 0, z: 0 },
          3,
          true
        );

        // 신호등 배치 (교차로 네 귀퉁이)
        const trafficlights = ["trafficlight_A", "trafficlight_B"];
        for (let d = 0; d < 4; d++) {
          if (Math.random() < 0.5) {
            // 50% 확률로 각 귀퉁이에 신호등
            const angle = (d * Math.PI) / 2;
            const offset = tileSize * 0.45;
            const lx = x + Math.cos(angle + Math.PI / 4) * offset;
            const lz = z + Math.sin(angle + Math.PI / 4) * offset;
            const rotY = angle + Math.PI; // 도로 방향을 바라보게
            // 도로 중심에 너무 가까우면 스킵
            const centerDist = Math.hypot(lx - x, lz - z);
            if (centerDist < tileSize * 0.2) continue;

            const lightType =
              trafficlights[Math.floor(Math.random() * trafficlights.length)];
            city.addBuilding(
              lightType,
              { x: lx, y: 0, z: lz },
              { x: 0, y: rotY, z: 0 },
              2.5
            );
          }
        }
      }
      // 횡단보도 포함 직선 도로
      else if (i % 2 === 0 && j % 2 !== 0 && Math.random() < 0.2) {
        city.addBuilding(
          "road_straight_crossing",
          { x, y: 0, z },
          { x: 0, y: 0, z: 0 },
          3,
          true
        );

        // 도로 폭 기준 방지턱 위치 고정 (횡단보도 타일의 도로 폭 양쪽 끝)
        const roadWidth = tileSize * 0.8; // 도로 모델 폭에 맞게 조정
        const bumpHalfWidth = 0.5; // speed_bump 모델의 절반 폭(모델에 맞게 조정)
        const bumpOffset = roadWidth / 2 - bumpHalfWidth; // 도로 중심에서 방지턱 중심까지 거리
        const bumpY = 0.15; // 도로 위에 보이도록 높이 조정
        const bumpScale = { x: 0.3, y: 1, z: 1 }; // x축(길이)만 0.3배로 줄임
        const crosswalkGap = tileSize * 0.4; // 횡단보도에서 방지턱까지의 거리

        // 도로가 가로 방향이므로 x축으로 이동 (횡단보도 타일의 양쪽 끝에서 일정 거리만큼 z축으로 띄움)
        city.addBuilding(
          "speed_bump",
          { x: x - bumpOffset, y: bumpY, z: z - crosswalkGap },
          { x: 0, y: 0, z: 0 },
          bumpScale
        );
      }
      // 기본 도로
      else if (i % 2 === 0) {
        city.addBuilding(
          "road_straight",
          { x, y: 0, z },
          { x: 0, y: 0, z: 0 },
          3,
          true
        );
      } else if (j % 2 === 0) {
        city.addBuilding(
          "road_straight",
          { x, y: 0, z },
          { x: 0, y: Math.PI / 2, z: 0 },
          3,
          true
        );
      }
    }
  }

  // 건물 배치 (A~H 모든 타입 사용 - 랜덤 선택으로 개선!)
  const buildings = [
    "building_A",
    "building_B",
    "building_C",
    "building_D",
    "building_E",
    "building_F",
    "building_G",
    "building_H",
  ];

  const decorations = ["bench", "box_A", "box_B", "bush"];

  for (let i = -gridSize + 1; i <= gridSize - 1; i += 2) {
    for (let j = -gridSize + 1; j <= gridSize - 1; j += 2) {
      const x = i * tileSize;
      const z = j * tileSize;

      if (Math.random() < 0.2) {
        // 25% 확률로 base 배치 + 장식 추가
        city.addBuilding("base", { x, y: 0, z }, { x: 0, y: 0, z: 0 }, 3);

        const decoCount = Math.floor(Math.random() * 3) + 1; // 1~3개 장식 배치

        for (let k = 0; k < decoCount; k++) {
          const decoName =
            decorations[Math.floor(Math.random() * decorations.length)];
          const offsetX = (Math.random() - 0.5) * tileSize * 0.6;
          const offsetZ = (Math.random() - 0.5) * tileSize * 0.6;
          const rotationY = Math.random() * Math.PI * 2;
          const scale = 3.0;

          city.addBuilding(
            decoName,
            { x: x + offsetX, y: 0.3, z: z + offsetZ },
            { x: 0, y: rotationY, z: 0 },
            scale
          );
        }
      } else {
        // 나머지 칸은 건물 배치
        const name = buildings[Math.floor(Math.random() * buildings.length)];
        const scale = 3;
        city.addBuilding(name, { x, y: 0, z }, { x: 0, y: 0, z: 0 }, scale);
      }
    }
  }

  // 하늘에 구름 배치
  const cloudCount = 20; // 구름 개수
  for (let i = 0; i < cloudCount; i++) {
    // 도시 전체를 덮는 넓은 범위에 랜덤 배치
    const angle = Math.random() * Math.PI * 2;
    const radius = gridSize * tileSize * (0.7 + Math.random() * 0.5); // 도시 위쪽 원형 범위
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 20 + Math.random() * 10; // 하늘 높이 랜덤 (20~30)으로 더 낮춤

    const scale = 0.015 + Math.random() * 0.002; // 구름 크기를 0.25~0.4로 대폭 축소
    const rotY = Math.random() * Math.PI * 2;

    city.addBuilding("cloud", { x, y, z }, { x: 0, y: rotY, z: 0 }, scale);
  }

  const carModel = city.models.get("car_police");
  if (carModel) {
    // 경로 (교차로 중심 기반으로 구성)
    const carPath = [
      new THREE.Vector3(-11, 0.3, -11),
      new THREE.Vector3(11, 0.3, -11),
      new THREE.Vector3(11, 0.3, 11),
      new THREE.Vector3(-11, 0.3, 11),
    ];

    const aiCar = new AICar(carModel, carPath, 0.005);
    aiCars.push(aiCar);
  }

  const carModel2 = city.models.get("car_taxi");
  if (carModel2) {
    const carPath2 = [
      new THREE.Vector3(47, 0.3, -47),
      new THREE.Vector3(47, 0.3, -13),
      new THREE.Vector3(13, 0.3, -13),
      new THREE.Vector3(13, 0.3, -47),
    ];

    const aiCar2 = new AICar(carModel2, carPath2, 0.004);
    aiCars.push(aiCar2);
  }

  const carModel3 = city.models.get("car_police");
  if (carModel3) {
    const carPath3 = [
      new THREE.Vector3(49, 0.3, -49),
      new THREE.Vector3(-49, 0.3, -49),
      new THREE.Vector3(-49, 0.3, 49),
      new THREE.Vector3(49, 0.3, 49),
    ];

    const aiCar3 = new AICar(carModel3, carPath3, 0.002);
    aiCars.push(aiCar3);
  }

  const carModel4 = city.models.get("car_stationwagon");
  if (carModel4) {
    const carPath4 = [
      new THREE.Vector3(13, 0.3, -11),
      new THREE.Vector3(47, 0.3, -11),
      new THREE.Vector3(47, 0.3, 11),
      new THREE.Vector3(13, 0.3, 11),
    ];

    const aiCar4 = new AICar(carModel4, carPath4, 0.003);
    aiCars.push(aiCar4);
  }

  const carModel5 = city.models.get("car_taxi");
  if (carModel5) {
    const carPath5 = [
      new THREE.Vector3(-47, 0.3, 13),
      new THREE.Vector3(-13, 0.3, 13),
      new THREE.Vector3(-13, 0.3, 47),
      new THREE.Vector3(-47, 0.3, 47),
    ];

    const aiCar5 = new AICar(carModel5, carPath5, 0.004);
    aiCars.push(aiCar5);
  }

  const carModel6 = city.models.get("car_hatchback");
  if (carModel6) {
    const carPath6 = [
      new THREE.Vector3(-11, 0.3, 13),
      new THREE.Vector3(11, 0.3, 13),
      new THREE.Vector3(11, 0.3, 47),
      new THREE.Vector3(-11, 0.3, 47),
    ];

    const aiCar6 = new AICar(carModel6, carPath6, 0.003);
    aiCars.push(aiCar6);
  }

  const carModel7 = city.models.get("car_sedan");
  if (carModel7) {
    const carPath7 = [
      new THREE.Vector3(47, 0.3, 13),
      new THREE.Vector3(47, 0.3, 47),
      new THREE.Vector3(13, 0.3, 47),
      new THREE.Vector3(13, 0.3, 13),
    ];

    const aiCar7 = new AICar(carModel7, carPath7, 0.003);
    aiCars.push(aiCar7);
  }

  const carModel8 = city.models.get("car_hatchback");
  if (carModel8) {
    const carPath8 = [
      new THREE.Vector3(-13, 0.3, -13),
      new THREE.Vector3(-47, 0.3, -13),
      new THREE.Vector3(-47, 0.3, -47),
      new THREE.Vector3(-13, 0.3, -47),
    ];

    const aiCar8 = new AICar(carModel8, carPath8, 0.004);
    aiCars.push(aiCar8);
  }

  const carModel9 = city.models.get("car_stationwagon");
  if (carModel9) {
    const carPath9 = [
      new THREE.Vector3(-11, 0.3, -13),
      new THREE.Vector3(-11, 0.3, -47),
      new THREE.Vector3(11, 0.3, -47),
      new THREE.Vector3(11, 0.3, -13),
    ];

    const aiCar9 = new AICar(carModel9, carPath9, 0.003);
    aiCars.push(aiCar9);
  }

  const carModel10 = city.models.get("car_sedan");
  if (carModel10) {
    const carPath10 = [
      new THREE.Vector3(-47, 0.3, -11),
      new THREE.Vector3(-13, 0.3, -11),
      new THREE.Vector3(-13, 0.3, 11),
      new THREE.Vector3(-47, 0.3, 11),
    ];

    const aiCar10 = new AICar(carModel10, carPath10, 0.004);
    aiCars.push(aiCar10);
  }

  const carModel11 = city.models.get("car_taxi");
  if (carModel11) {
    const carPath11 = [
      new THREE.Vector3(-37, 0.3, -37),
      new THREE.Vector3(-37, 0.3, -23),
      new THREE.Vector3(-23, 0.3, -23),
      new THREE.Vector3(-23, 0.3, -37),
    ];

    const aiCar11 = new AICar(carModel11, carPath11, 0.007);
    aiCars.push(aiCar11);
  }

  const carModel12 = city.models.get("car_sedan");
  if (carModel12) {
    const carPath12 = [
      new THREE.Vector3(37, 0.3, -37),
      new THREE.Vector3(23, 0.3, -37),
      new THREE.Vector3(23, 0.3, -23),
      new THREE.Vector3(37, 0.3, -23),
    ];

    const aiCar12 = new AICar(carModel12, carPath12, 0.006);
    aiCars.push(aiCar12);
  }

  const carModel13 = city.models.get("car_hatchback");
  if (carModel13) {
    const carPath13 = [
      new THREE.Vector3(37, 0.3, 37),
      new THREE.Vector3(37, 0.3, 23),
      new THREE.Vector3(23, 0.3, 23),
      new THREE.Vector3(23, 0.3, 37),
    ];

    const aiCar13 = new AICar(carModel13, carPath13, 0.007);
    aiCars.push(aiCar13);
  }

  const carModel14 = city.models.get("car_stationwagon");
  if (carModel14) {
    const carPath14 = [
      new THREE.Vector3(-37, 0.3, 37),
      new THREE.Vector3(-23, 0.3, 37),
      new THREE.Vector3(-23, 0.3, 23),
      new THREE.Vector3(-37, 0.3, 23),
    ];

    const aiCar14 = new AICar(carModel14, carPath14, 0.006);
    aiCars.push(aiCar14);
  }

  const groundDesc = RAPIER.ColliderDesc.cuboid(200, 0.1, 200).setTranslation(
    0,
    -0.1,
    0
  );
  world.createCollider(groundDesc);

  return city;
}

createCity().then((city) => {
  console.log("도시 생성 완료 - 랜덤 건물 배치 적용");
  currentCity = city;
  const bikeModel = city.models.get("Bike");
  if (bikeModel) {
    addPlayer(bikeModel);
  }

  // 배달 타겟 원판 생성
  deliveryTarget = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  deliveryTarget.rotation.x = -Math.PI / 2;
  scene.add(deliveryTarget);

  // 첫 배달 위치 설정
  setRandomDeliveryTarget(city);

  //controls.enabled = false; // 마우스 카메라 비활성화

  animate();
});

function addPlayer(model) {
  player = model.clone();
  player.scale.setScalar(0.1);
  player.position.set(0, 0.3, 0);
  player.rotation.y = Math.PI;
  scene.add(player);

  if (rapierReady) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.15, 0)
      .setLinearDamping(1.5)
      .setAngularDamping(2.0);
    playerBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      0.3,
      0.05,
      0.2
    ).setRestitution(0.9);
    world.createCollider(colliderDesc, playerBody);
  }
}

function setRandomDeliveryTarget(city) {
  const candidates = city.deliveryCandidates;
  if (!candidates || candidates.length === 0) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  deliveryTarget.position.set(target.x, 0.5, target.z);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // AI 차량 이동
  for (const car of aiCars) {
    car.update();
  }

  // 플레이어 이동
  if (player && playerBody) {
    const speed = 10;
    const rotationSpeed = 1.2;

    const isForward = keysPressed["ArrowUp"];
    const isBackward = keysPressed["ArrowDown"];

    // 회전: 전진/후진에 따라 좌우 반전
    if (isForward) {
      if (keysPressed["ArrowLeft"]) {
        player.rotation.y += THREE.MathUtils.degToRad(rotationSpeed);
      }
      if (keysPressed["ArrowRight"]) {
        player.rotation.y -= THREE.MathUtils.degToRad(rotationSpeed);
      }
    } else if (isBackward) {
      if (keysPressed["ArrowLeft"]) {
        player.rotation.y -= THREE.MathUtils.degToRad(rotationSpeed);
      }
      if (keysPressed["ArrowRight"]) {
        player.rotation.y += THREE.MathUtils.degToRad(rotationSpeed);
      }
    }

    // 방향 벡터 계산
    const dir = new THREE.Vector3(
      Math.sin(player.rotation.y),
      0,
      Math.cos(player.rotation.y)
    );

    // 속도 벡터 적용
    if (isForward || isBackward) {
      const moveDir = isBackward ? dir.clone().multiplyScalar(-0.5) : dir;
      const vel = moveDir.multiplyScalar(speed);
      playerBody.setLinvel(vel, true);
    }

    // 물리 시뮬레이션
    world.step();

    // 물리 위치를 Three.js에 반영
    const pos = playerBody.translation();
    // x, z만 클램프 (y는 물리가 결정)
    const clampedX = THREE.MathUtils.clamp(
      pos.x,
      mapBounds.minX,
      mapBounds.maxX
    );
    const clampedZ = THREE.MathUtils.clamp(
      pos.z,
      mapBounds.minZ,
      mapBounds.maxZ
    );

    // 맵 밖으로 나가려 하면 위치 강제 수정 (y는 그대로!)
    if (clampedX !== pos.x || clampedZ !== pos.z) {
      playerBody.setTranslation({ x: clampedX, y: pos.y, z: clampedZ }, true);
      playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true); // 속도도 제거
    }
    player.position.set(pos.x, pos.y - 0.15, pos.z);

    // 배달 성공 체크
    if (!window.isGameOver && deliveryTarget && player) {
      const dx = player.position.x - deliveryTarget.position.x;
      const dz = player.position.z - deliveryTarget.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 4.0) {
        score++;
        window.score = score;
        scoreDisplay.textContent = `📦 배달: ${score}건`;
        setRandomDeliveryTarget(currentCity);
      }
    }

    // 카메라 추적
    const behindOffset = cameraOffset.clone();
    behindOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
    const cameraPos = player.position.clone().add(behindOffset);
    camera.position.lerp(cameraPos, 0.1);

    const target = player.position.clone();
    target.y += 1.5;
    camera.lookAt(target);
  }

  renderer.render(scene, camera);
}

// 조명 설정 부분
// 예시: DirectionalLight 생성 및 그림자 설정
const light = new THREE.DirectionalLight(0xffffff, 1.2); // 기존보다 intensity를 약간 낮추거나 그대로
light.position.set(50, 100, 50);
light.castShadow = true;

// 그림자 맵 해상도(부드럽게)
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;

// 그림자 bias(그림자 경계 밝기/옅음 조절)
light.shadow.bias = -0.002; // 기본값보다 약간 더 밝게(옅게) 하고 싶으면 -0.001 ~ 0.001 사이로 조정

scene.add(light);

// 그림자 타입을 부드럽게
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 조명 설정 부분 아래에 AmbientLight 추가
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); // 색상, 밝기(0.2~0.5 사이에서 조절)
scene.add(ambientLight);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const keysPressed = {};

window.addEventListener("keydown", (e) => {
  keysPressed[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  keysPressed[e.key] = false;
});


