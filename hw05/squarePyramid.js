export class SquarePyramid {
    constructor(gl, options = {}) {
        this.gl = gl;

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // 정점 좌표: bottom face (4개) + apex (1개)
        this.vertices = new Float32Array([
            // --- bottom face (y = 0) ---
            -0.5, 0, -0.5,   // v0
             0.5, 0, -0.5,   // v1
             0.5, 0,  0.5,   // v2
            -0.5, 0,  0.5,   // v3

            // --- front face ---
            -0.5, 0, -0.5,   // v0
             0.5, 0, -0.5,   // v1
             0.0, 1,  0.0,   // v4

            // --- right face ---
             0.5, 0, -0.5,   // v1
             0.5, 0,  0.5,   // v2
             0.0, 1,  0.0,   // v4

            // --- back face ---
             0.5, 0,  0.5,   // v2
            -0.5, 0,  0.5,   // v3
             0.0, 1,  0.0,   // v4

            // --- left face ---
            -0.5, 0,  0.5,   // v3
            -0.5, 0, -0.5,   // v0
             0.0, 1,  0.0    // v4
        ]);

        // 노멀 (간단하게 flat shading용 평균벡터)
        this.normals = new Float32Array([
            // bottom face (down)
            0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
            // front
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            // right
            1, 0, 0,   1, 0, 0,   1, 0, 0,
            // back
            0, 0, 1,   0, 0, 1,   0, 0, 1,
            // left
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0                               // apex (dummy)
        ]);

        // 색상: flat shading용, 바닥: blue, 옆면: red, yellow, cyan, magenta
        this.colors = new Float32Array([
            // bottom face
            0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
            // side
            1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, // red
            1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, // yellow
            0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, // cyan
            1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1  // magenta
        ]);

        // 텍스처 좌표 (단순 매핑)
        this.texCoords = new Float32Array([
            // bottom
            0, 0,  1, 0,  1, 1,  0, 1,
            // front
            0, 0,  1, 0,  0.5, 1,
            // right
            0, 0,  1, 0,  0.5, 1,
            // back
            0, 0,  1, 0,  0.5, 1,
            // left
            0, 0,  1, 0,  0.5, 1
        ]);

        // 인덱스: bottom face (2개) + 4 side faces (4개)
        this.indices = new Uint16Array([
            // bottom
            0, 1, 2,   0, 2, 3,
            // front
            4, 5, 6,
            // right
            7, 8, 9,
            // back
            10, 11, 12,
            // left
            13, 14, 15
        ]);

        this.initBuffers();
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

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);                         // position
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);                     // normal
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);             // color
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);     // texCoord

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
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
