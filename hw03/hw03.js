import { resizeAspectRatio, setupText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let mode = 'circle';
let isDrawing = false;
let drawingFinished = false;
let circleCenter = null;
let circleRadius = 0;
let startPoint = null; // 선분의 시작점
let tempPoint = null;
let line = []; // 그려진 선분을 저장하는 array
let intersections = []; // intersection points 
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        if (drawingFinished) return;
        if (isDrawing) return;

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표

        let [glX, glY] = convertToWebGLCoordinates(x, y);

        if (mode === 'circle') {
            circleCenter = [glX, glY];
        } else if (mode === 'line') {
            startPoint = [glX, glY];
        }

        isDrawing = true;
    }

    function handleMouseMove(event) {
        if (drawingFinished) return;
        if (isDrawing) { // 1번 또는 2번 선분을 그리고 있는 도중인 경우
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            tempPoint = [glX, glY]; // 임시 선분의 끝 point

            if (mode === 'circle') {
                const dx = tempPoint[0] - circleCenter[0];
                const dy = tempPoint[1] - circleCenter[1];
                circleRadius = Math.sqrt(dx * dx + dy * dy);
            } else if (mode === 'line') {
                tempPoint = tempPoint;
            }

            render();
        }
    }

    function handleMouseUp() {
        if (drawingFinished) return;
        if (isDrawing && tempPoint) {
            if (mode === 'circle') {
                setupText(canvas, "Circle: center (" + circleCenter[0].toFixed(2) + ", " + circleCenter[1].toFixed(2) + 
                    ") radius = " + circleRadius.toFixed(2), 1);
                mode = 'line';
            } else if (mode === 'line') {
                line.push([...startPoint, ...tempPoint]); 
                setupText(canvas,"Line segment: (" + line[0][0].toFixed(2) + ", " + line[0][1].toFixed(2) + 
                    ") ~ (" + line[0][2].toFixed(2) + ", " + line[0][3].toFixed(2) + ")", 2);
                computeIntersection();
                drawingFinished = true;
            }

            isDrawing = false;
            tempPoint = null;

            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function computeIntersection() {
    intersections = [];

    const [cx, cy] = circleCenter;
    const r = circleRadius;
    const [x1, y1] = [line[0][0], line[0][1]];
    const [x2, y2] = [line[0][2], line[0][3]];

    const dx = x2 - x1;
    const dy = y2 - y1;

    const A = dx * dx + dy * dy; // a^2 + c^2
    const B = 2 * (dx * (x1 - cx) + dy * (y1 - cy)); // 2( a(b-e) + c(d-f) )
    const C = (x1 - cx) ** 2 + (y1 - cy) ** 2 - r * r; // (b-e)^2 + (d-f)^2 - r^2
    const D = B * B - 4 * A * C; // 판별식 사용

    if (D < 0) {
        setupText(canvas, 'No intersection', 3);
        return;
    }

    const sqrtD = Math.sqrt(D);
    const t1 = (-B + sqrtD) / (2 * A);
    const t2 = (-B - sqrtD) / (2 * A);

    [t1, t2].forEach(t => {
        if (t >= 0 && t <= 1) {
            const ix = x1 + t * dx;
            const iy = y1 + t * dy;
            intersections.push([ix, iy]);
        }
    });

    if (intersections.length === 0) {
        setupText(canvas, 'No intersection', 3);
    } else if (intersections.length === 1) {
        setupText(canvas, 'Intersection Points: 1 Point 1: (' + intersections[0][0].toFixed(2) + ', ' + 
            intersections[0][1].toFixed(2) + ')', 3);
    } else { // 교차점 2개
        setupText(canvas, 'Intersection Points: 2 Point 1: (' + intersections[0][0].toFixed(2) + ', ' + 
            intersections[0][1].toFixed(2) + ') Point 2: (' + intersections[1][0].toFixed(2) + ', ' + intersections[1][1].toFixed(2) + ')', 3);
    }
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.use()

    // 원 그리기
    if (circleCenter && circleRadius > 0) {
        const points = []
        const seg = 100;
        for (let i = 0; i <= seg; ++i) {
            const theta = (2 * Math.PI * i) / seg;
            const x = circleCenter[0] + circleRadius * Math.cos(theta);
            const y = circleCenter[1] + circleRadius * Math.sin(theta);
            points.push([x, y]);
        }

        const color = (mode === 'circle' && isDrawing) ? [0.5, 0.5, 0.5, 1.0] : [1, 0, 1, 1];
        shader.setVec4("u_color", color);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points.flat()), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_LOOP, 0, points.length);
    }

    // 임시로 선분 그리기
    if (isDrawing && startPoint && tempPoint) {
        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempPoint]), 
                      gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 선분 그리기
    if (line.flat().length > 0) {
        shader.setVec4("u_color", [0, 1, 1, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line.flat()), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 교차점 그리기
    if (intersections.length > 0) {
        shader.setVec4("u_color", [1, 1, 0, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intersections.flat()), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, intersections.length)
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();
        
        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}