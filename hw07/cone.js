export class Cone {
    constructor(gl, segments = 32, options = {}) {
        this.gl = gl;

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        this.radius = 0.5;
        this.height = 1.0;
        const halfH = this.height / 2;
        const angleStep = (2 * Math.PI) / segments;
        this.segments = segments;

        const positions = [];
        const normals = [];
        const colors = [];
        const texCoords = [];
        const indices = [];

        const defaultColor = [1.0, 0.5, 0.0, 1.0];
        const colorOption = options.color || defaultColor;

        for (let i = 0; i < segments; i++) {
            const angle0 = i * angleStep;
            const angle1 = (i + 1) * angleStep;

            const x0 = this.radius * Math.cos(angle0);
            const z0 = this.radius * Math.sin(angle0);
            const x1 = this.radius * Math.cos(angle1);
            const z1 = this.radius * Math.sin(angle1);

            const top = [0, halfH, 0];
            const v0 = [x0, -halfH, z0];
            const v1 = [x1, -halfH, z1];

            const baseIndex = positions.length / 3;

            positions.push(...v0, ...top, ...v1);

            const a = [top[0] - v0[0], top[1] - v0[1], top[2] - v0[2]];
            const b = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            const n = [
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0]
            ];
            const len = Math.hypot(...n);
            const norm = n.map(v => v / len);

            for (let j = 0; j < 3; j++) {
                normals.push(...norm);
                colors.push(...colorOption);
            }

            texCoords.push(0, 0, 0.5, 1, 1, 0);

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }

        this.vertices = new Float32Array(positions);
        this.normals = new Float32Array(normals);
        this.colors = new Float32Array(colors);
        this.texCoords = new Float32Array(texCoords);
        this.indices = new Uint16Array(indices);

        this.faceNormals = new Float32Array(this.normals);
        this.vertexNormals = new Float32Array(this.normals);
        this.computeVertexNormals();

        this.initBuffers();
    }

    computeVertexNormals() {
        const vCount = this.vertices.length / 3;
        this.vertexNormals = new Float32Array(this.vertices.length);

        for (let i = 0; i < vCount; i++) {
            const x = this.vertices[i * 3 + 0];
            const y = this.vertices[i * 3 + 1];
            const z = this.vertices[i * 3 + 2];

            const len = Math.sqrt(x * x + z * z);
            if (len > 0) {
                this.vertexNormals[i * 3 + 0] = x / len;
                this.vertexNormals[i * 3 + 1] = 0;
                this.vertexNormals[i * 3 + 2] = z / len;
            } else {
                this.vertexNormals[i * 3 + 0] = 0;
                this.vertexNormals[i * 3 + 1] = 1;
                this.vertexNormals[i * 3 + 2] = 0;
            }
        }
    }

    copyFaceNormalsToNormals() {
        this.normals.set(this.faceNormals);
    }

    copyVertexNormalsToNormals() {
        this.normals.set(this.vertexNormals);
    }

    updateNormals() {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

        const vSize = this.vertices.byteLength;
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    initBuffers() {
        const gl = this.gl;

        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
}
