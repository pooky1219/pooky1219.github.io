import * as THREE from 'three';  
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

// Camera를 perspective와 orthographic 두 가지로 switching 해야 해서 const가 아닌 let으로 선언
let camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.x = 120;
camera.position.y = 60;
camera.position.z = 180;
camera.lookAt(scene.position);
scene.add(camera);

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(new THREE.Color(0x000000));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

// Camera가 바뀔 때 orbitControls도 바뀌어야 해서 let으로 선언
let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// Sun
const sunMaterial = new THREE.MeshBasicMaterial({color: 0xffff00});
const sunGeometry = new THREE.SphereGeometry(10);
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Mercury
const mercuryTexture = textureLoader.load('Mercury.jpg');
const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture,
    roughness: 0.8,
    metalness: 0.2
});
const mercuryGeometry = new THREE.SphereGeometry(1.5);
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);

// Mercury 궤도 설정
const mercuryOrbit = new THREE.Object3D();
mercuryOrbit.add(mercury);
scene.add(mercuryOrbit);

// Mercury 거리 설정
mercury.position.x = 20;

// Venus
const venusTexture = textureLoader.load('Venus.jpg');
const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture,
    roughness: 0.8,
    metalness: 0.2
});
const venusGeometry = new THREE.SphereGeometry(3, 32, 32);
const venus = new THREE.Mesh(venusGeometry, venusMaterial);

// Venus 궤도 설정
const venusOrbit = new THREE.Object3D();
venusOrbit.add(venus);
scene.add(venusOrbit);

// Venus 거리 설정
venus.position.x = 35;

// Earth
const earthTexture = textureLoader.load('Earth.jpg');
const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthTexture,
    roughness: 0.8,
    metalness: 0.2
});
const earthGeometry = new THREE.SphereGeometry(3.5, 32, 32);
const earth = new THREE.Mesh(earthGeometry, earthMaterial);

// Earth 궤도 설정
const earthOrbit = new THREE.Object3D();
earthOrbit.add(earth);
scene.add(earthOrbit);

// Earth 거리 설정
earth.position.x = 50;

// Mars
const marsTexture = textureLoader.load('Mars.jpg');
const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture,
    roughness: 0.8,
    metalness: 0.2
});
const marsGeometry = new THREE.SphereGeometry(2.5);
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
const marsOrbit = new THREE.Object3D();

// Mars 궤도 설정
marsOrbit.add(mars);
scene.add(marsOrbit);

// Mars 거리 설정
mars.position.x = 65;

// light 설정
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(-20, 40, 60);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x292929);
scene.add(ambientLight);

// 애니메이션용 변수
const planetControls = {
    mercury: { rotationSpeed: 0.02, orbitSpeed: 0.02 },
    venus: { rotationSpeed: 0.015, orbitSpeed: 0.015 },
    earth: { rotationSpeed: 0.01, orbitSpeed: 0.01 },
    mars: { rotationSpeed: 0.008, orbitSpeed: 0.008 }
};
let mercuryAngle = 0;
let venusAngle = 0;
let earthAngle = 0;
let marsAngle = 0;


// GUI
const gui = new GUI();
const controls = new function () {
    this.currentCamera = "Perspective";
    this.switchCameraType = function () {
        if (camera instanceof THREE.PerspectiveCamera) {
            scene.remove(camera);
            camera = null; // 기존의 camera 제거    
            // OrthographicCamera(left, right, top, bottom, near, far)
            camera = new THREE.OrthographicCamera(window.innerWidth / -16, 
                window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / -16, -200, 500);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.currentCamera = "Orthographic";
        } else {
            scene.remove(camera);
            camera = null; 
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.currentCamera = "Perspective";
        }
    };
};
const cameraFolder = gui.addFolder("Camera");
cameraFolder.add(controls, 'switchCameraType').name("Switch Camera Type");
cameraFolder.add(controls, 'currentCamera').name("Current Camera").listen();

const mercuryFolder = gui.addFolder("Mercury");
mercuryFolder.add(planetControls.mercury, 'rotationSpeed', 0, 0.1).step(0.001).name("Rotation Speed");
mercuryFolder.add(planetControls.mercury, 'orbitSpeed', 0, 0.1).step(0.001).name("Orbit Speed");

const venusFolder = gui.addFolder("Venus");
venusFolder.add(planetControls.venus, 'rotationSpeed', 0, 0.1).step(0.001).name("Rotation Speed");
venusFolder.add(planetControls.venus, 'orbitSpeed', 0, 0.1).step(0.001).name("Orbit Speed");

const earthFolder = gui.addFolder("Earth");
earthFolder.add(planetControls.earth, 'rotationSpeed', 0, 0.1).step(0.001).name("Rotation Speed");
earthFolder.add(planetControls.earth, 'orbitSpeed', 0, 0.1).step(0.001).name("Orbit Speed");

const marsFolder = gui.addFolder("Mars");
marsFolder.add(planetControls.mars, 'rotationSpeed', 0, 0.1).step(0.001).name("Rotation Speed");
marsFolder.add(planetControls.mars, 'orbitSpeed', 0, 0.1).step(0.001).name("Orbit Speed");


render();

function render() {
    orbitControls.update();
    stats.update();

    // 수성 자전
    mercury.rotation.y += planetControls.mercury.rotationSpeed;
    // 수성 공전
    mercuryAngle += planetControls.mercury.orbitSpeed;
    mercury.position.x = Math.sin(mercuryAngle) * 20;
    mercury.position.z = Math.cos(mercuryAngle) * 20;

    // 금성 자전
    venus.rotation.y += planetControls.venus.rotationSpeed;
    // 금성 공전
    venusAngle += planetControls.venus.orbitSpeed;
    venus.position.x = Math.sin(venusAngle) * 35;
    venus.position.z = Math.cos(venusAngle) * 35;

    // 지구 자전
    earth.rotation.y += planetControls.earth.rotationSpeed;
    // 지구 공전
    earthAngle += planetControls.earth.orbitSpeed;
    earth.position.x = Math.sin(earthAngle) * 50;
    earth.position.z = Math.cos(earthAngle) * 50;

    // 화성 자전
    mars.rotation.y += planetControls.mars.rotationSpeed;
    // 화성 공전
    marsAngle += planetControls.mars.orbitSpeed;
    mars.position.x = Math.sin(marsAngle) * 65;
    mars.position.z = Math.cos(marsAngle) * 65;


    // render using requestAnimationFrame
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}