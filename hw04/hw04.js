import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

let isInitialized = false;
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let vao;
let axes;

const DEG2RAD = Math.PI / 180;
let sunAngle = 0;
let earthRevolution = 0;
let earthRotation = 0;
let moonRevolution = 0;
let moonRotation = 0;
let lastTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
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
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    
    return true;
}

function setupBuffers() {
    const vertices = new Float32Array([
        0.0,  0.0, // 중심점
       -0.5, -0.5, // 좌하단
        0.5, -0.5, // 우하단
        0.5,  0.5, // 우상단
       -0.5,  0.5, // 좌상단
       -0.5, -0.5  // 좌하단
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0);

    return vao;
}

function drawObject(modelMatrix, color) {
    shader.use();
    shader.setMat4("u_transform", modelMatrix);
    shader.setVec4("u_color", color);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 6);
}

function render(currentTime) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    const now = currentTime / 1000;
    const deltaTime = lastTime ? now - lastTime : 0;
    lastTime = now;

    sunAngle         += 45   * DEG2RAD * deltaTime;
    earthRevolution  += 30   * DEG2RAD * deltaTime;
    earthRotation    += 180  * DEG2RAD * deltaTime;
    moonRevolution   += 360  * DEG2RAD * deltaTime;
    moonRotation     += 180  * DEG2RAD * deltaTime;


    axes.draw(mat4.create(), mat4.create());

    // Sun
    let sunMatrix = mat4.create();
    mat4.rotateZ(sunMatrix, sunMatrix, sunAngle);
    mat4.scale(sunMatrix, sunMatrix, [0.2, 0.2, 1.0]);
    drawObject(sunMatrix, [1.0, 0.0, 0.0, 1.0]); // Red

    // Earth
    let earthMatrix = mat4.create();
    mat4.rotateZ(earthMatrix, earthMatrix, earthRevolution);
    mat4.translate(earthMatrix, earthMatrix, [0.7, 0.0, 0.0]); // 공전
    mat4.rotateZ(earthMatrix, earthMatrix, earthRotation); // 자전
    mat4.scale(earthMatrix, earthMatrix, [0.1, 0.1, 1.0]); // 크기
    drawObject(earthMatrix, [0.0, 1.0, 1.0, 1.0]); // Cyan

    // Moon
    let moonMatrix = mat4.create();
    mat4.rotateZ(moonMatrix, moonMatrix, earthRevolution); // 공전 원점은 Sun 기준
    mat4.translate(moonMatrix, moonMatrix, [0.7, 0.0, 0.0]); // Earth 위치
    mat4.rotateZ(moonMatrix, moonMatrix, moonRevolution); // Moon 공전
    mat4.translate(moonMatrix, moonMatrix, [0.2, 0.0, 0.0]); // Earth 기준 공전
    mat4.rotateZ(moonMatrix, moonMatrix, moonRotation); // Moon 자전
    mat4.scale(moonMatrix, moonMatrix, [0.05, 0.05, 1.0]);
    drawObject(moonMatrix, [1.0, 1.0, 0.0, 1.0]); // Yellow
}

function animate(currentTime) {
    render(currentTime);
    requestAnimationFrame(animate);
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
        }
        
        await initShader();

        setupBuffers();
        axes = new Axes(gl, 1.0); 

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
