#version 300 es

layout (location = 0) in vec2 aPos;

uniform vec2 uPos;

void main() {
    gl_Position = vec4(aPos+uPos, 0.0, 1.0);
} 