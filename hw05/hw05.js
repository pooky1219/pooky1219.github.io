import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { SquarePyramid } from '../hw05/squarePyramid.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let startTime;
let lastFrameTime;
let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create(); 

const cameraCircleRadius = 3;
const cameraCircleSpeed = 90;
const Y_SPEED_DEG = 45;
const pyramid = new SquarePyramid(gl);
const axes = new Axes(gl, 1.8);

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('program terminated');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('program terminated with error:', error);
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
    gl.enable(gl.DEPTH_TEST);
    
    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    const currentTime = Date.now();
    // deltaTime: elapsed time from the last frame
    const deltaTime = (currentTime - lastFrameTime) / 1000.0; // convert to second

    // elapsed time from the start time
    const elapsedTime = (currentTime - startTime) / 1000.0; // convert to second

    lastFrameTime = currentTime;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 회전 각도 (90 deg/sec)
    const angle = glMatrix.toRadian(cameraCircleSpeed * elapsedTime);

    const camX = cameraCircleRadius * Math.sin(angle);
    const camZ = cameraCircleRadius * Math.cos(angle);

    // y = 0 ~ 10 반복: sin(θ) → (5 * sin(θ) + 5)
    // 여기선 1초에 1파이/5 라디안씩 = 10초에 한 사이클;
    const camY = 5 * Math.sin((Y_SPEED_DEG * Math.PI / 180) * elapsedTime) + 5;

    mat4.lookAt(viewMatrix,
        vec3.fromValues(camX, camY, camZ),
        vec3.fromValues(0, 0, 0), // always look at center
        vec3.fromValues(0, 1, 0)
    );

    mat4.identity(modelMatrix); // 피라미드는 고정

    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    pyramid.draw(shader);
    
    axes.draw(viewMatrix, projMatrix);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }
        
        await initShader();

        // Projection transformation matrix
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),  // field of view (fov, degree)
            canvas.width / canvas.height, // aspect ratio
            0.1, // near
            100.0 // far
        );

        // starting time (global variable) for animation
        startTime = lastFrameTime = Date.now();

        // call the render function the first time for animation
        requestAnimationFrame(render);

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}