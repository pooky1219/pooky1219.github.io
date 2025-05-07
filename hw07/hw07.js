import { resizeAspectRatio, setupText, updateText} from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { Cone } from './cone.js';
import { Cube } from '../util/cube.js';
import { Arcball } from '../util/arcball.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let lampShader;
let textOverlay2;
let textOverlay3;
let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();
let lampModelMatrix = mat4.create();
let arcBallMode = 'CAMERA';     // 'CAMERA' or 'MODEL'
let shadingMode = 'FLAT';       // 'FLAT' or 'SMOOTH'
let renderingMode = "PHONG";    // 'PHONG' or 'GOURAUD'

const cone = new Cone(gl);
const lamp = new Cube(gl);

const cameraPos = vec3.fromValues(0, 0, 3);
const lightPos = vec3.fromValues(1.0, 0.7, 1.0);
const lightSize = vec3.fromValues(0.1, 0.1, 0.1);

// Arcball object: initial distance 5.0, rotation sensitivity 2.0, zoom sensitivity 0.0005
const arcball = new Arcball(canvas, 5.0, { rotation: 2.0, zoom: 0.0005 });

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

function setupKeyboardEvents() {
    document.addEventListener('keydown', async (event) => {
        if (event.key == 'a') {
            arcBallMode = (arcBallMode === 'CAMERA') ? 'MODEL' : 'CAMERA';
            updateText(textOverlay2, "arcball mode: " + arcBallMode);
        } else if (event.key == 'r') {
            arcball.reset();
            modelMatrix = mat4.create();
            arcBallMode = 'CAMERA';
            updateText(textOverlay2, "arcball mode: " + arcBallMode);
        } else if (event.key == 's') {
            cone.copyVertexNormalsToNormals();
            cone.updateNormals();
            shadingMode = 'SMOOTH';
            updateText(textOverlay3, "shading mode: " + shadingMode + " (" + renderingMode + ")");
            render();
        } else if (event.key == 'f') {
            cone.copyFaceNormalsToNormals();
            cone.updateNormals();
            shadingMode = 'FLAT';
            updateText(textOverlay3, "shading mode: " + shadingMode + " (" + renderingMode + ")");
            render();
        } else if (event.key == 'g') {
            renderingMode = 'GOURAUD';
            await initShader();
            shader.use();
            setLightingUniforms();
            shader.setMat4("u_projection", projMatrix);
            updateText(textOverlay3, "shading mode: " + shadingMode + " (" + renderingMode + ")");
            render();
        } else if (event.key == 'p') {
            renderingMode = 'PHONG';
            await initShader();
            shader.use();
            setLightingUniforms();
            shader.setMat4("u_projection", projMatrix);
            updateText(textOverlay3, "shading mode: " + shadingMode + " (" + renderingMode + ")");
            render();
        }
    });
}

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);

    return true;
}

async function initShader() {
    const vsFile = (renderingMode === 'PHONG') ? 'shVert.glsl' : 'gouraudVert.glsl';
    const fsFile = (renderingMode === 'PHONG') ? 'shFrag.glsl' : 'gouraudFrag.glsl';
    const vertexShaderSource = await readShaderFile(vsFile);
    const fragmentShaderSource = await readShaderFile(fsFile);
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function initLampShader() {
    const vertexShaderSource = await readShaderFile('shLampVert.glsl');
    const fragmentShaderSource = await readShaderFile('shLampFrag.glsl');
    lampShader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    if (arcBallMode == 'CAMERA') {
        viewMatrix = arcball.getViewMatrix();
    } else {
        modelMatrix = arcball.getModelRotMatrix();
        viewMatrix = arcball.getViewCamDistanceMatrix();
    }

    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setVec3('u_viewPos', cameraPos);
    cone.draw(shader);

    lampShader.use();
    lampShader.setMat4('u_view', viewMatrix);
    lamp.draw(lampShader);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }

        mat4.lookAt(
            viewMatrix,
            cameraPos,
            vec3.fromValues(0.0, 0.0, 0.0),
            vec3.fromValues(0.0, 1.0, 0.0)
        );

        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),
            canvas.width / canvas.height,
            0.1,
            100.0
        );

        await initShader();
        await initLampShader();

        shader.use();
        shader.setMat4("u_projection", projMatrix);
        shader.setVec3("material.diffuse", vec3.fromValues(1.0, 0.5, 0.31));
        shader.setVec3("material.specular", vec3.fromValues(0.5, 0.5, 0.5));
        shader.setFloat("material.shininess", 32);
        shader.setVec3("light.position", lightPos);
        shader.setVec3("light.ambient", vec3.fromValues(0.2, 0.2, 0.2));
        shader.setVec3("light.diffuse", vec3.fromValues(0.7, 0.7, 0.7));
        shader.setVec3("light.specular", vec3.fromValues(1.0, 1.0, 1.0));
        shader.setVec3("u_viewPos", cameraPos);

        lampShader.use();
        lampShader.setMat4("u_projection", projMatrix);
        mat4.translate(lampModelMatrix, lampModelMatrix, lightPos);
        mat4.scale(lampModelMatrix, lampModelMatrix, lightSize);
        lampShader.setMat4('u_model', lampModelMatrix);

        setupText(canvas, "Cone with Lighting", 1);
        textOverlay2 = setupText(canvas, "arcball mode: " + arcBallMode, 2);
        textOverlay3 = setupText(canvas, "shading mode: " + shadingMode + "(" + renderingMode + ")", 3);
        setupText(canvas, "press 'a' to change arcball mode", 4);
        setupText(canvas, "press 'r' to reset arcball", 5);
        setupText(canvas, "press 's' to switch to smooth shading", 6);
        setupText(canvas, "press 'f' to switch to flat shading", 7);
        setupText(canvas, "press 'g' to switch to Gouraud shading", 8);
        setupText(canvas, "press 'p' to switch to Phong shading", 9);
        setupKeyboardEvents();

        requestAnimationFrame(render);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}

function setLightingUniforms() {
    shader.setVec3("material.diffuse", vec3.fromValues(1.0, 0.5, 0.31));
    shader.setVec3("material.specular", vec3.fromValues(0.5, 0.5, 0.5));
    shader.setFloat("material.shininess", 32);
    shader.setVec3("light.position", lightPos);
    shader.setVec3("light.ambient", vec3.fromValues(0.2, 0.2, 0.2));
    shader.setVec3("light.diffuse", vec3.fromValues(0.7, 0.7, 0.7));
    shader.setVec3("light.specular", vec3.fromValues(1.0, 1.0, 1.0));
    shader.setVec3("u_viewPos", cameraPos);
}

