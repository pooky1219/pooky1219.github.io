export class RegularOctahedron {
    constructor(gl, options = {}) {
        this.gl = gl;

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        const h = Math.SQRT1_2;

        const v = [
            [ 0,  h,  0],       // v0 top
            [-0.5, 0, -0.5],    // v1
            [ 0.5, 0, -0.5],    // v2
            [ 0.5, 0,  0.5],    // v3
            [-0.5, 0,  0.5],    // v4
            [ 0, -h,  0]        // v5 bottom
        ];

        const vertexData = [
            ...v[0], ...v[1], ...v[2],  // top-front
            ...v[0], ...v[2], ...v[3],  // top-right
            ...v[0], ...v[3], ...v[4],  // top-back
            ...v[0], ...v[4], ...v[1],  // top-left
            ...v[5], ...v[2], ...v[1],  // bottom-front
            ...v[5], ...v[3], ...v[2],  // bottom-right
            ...v[5], ...v[4], ...v[3],  // bottom-back
            ...v[5], ...v[1], ...v[4]   // bottom-left
        ];
        this.vertices = new Float32Array(vertexData);

        // normal vector(실사용x 대강 계산)
        const normals = [
            [0, 1, -1], [1, 1, 0], [0, 1, 1], [-1, 1, 0],
            [0, -1, -1], [1, -1, 0], [0, -1, 1], [-1, -1, 0],
        ].flatMap(n => {
            const len = Math.hypot(...n);
            const unit = n.map(x => x / len);
            return [...unit, ...unit, ...unit]; // 각 face당 3개 정점
        });
        this.normals = new Float32Array(normals);

        // color
        const faceColors = Array(8).fill([1, 1, 1, 1]);
        this.colors = new Float32Array(faceColors.flatMap(c => [...c, ...c, ...c]));

        // 텍스처 좌표
        this.texCoords = new Float32Array([
            // top 4 faces
            0.5, 1.0,    0.0, 0.5,     0.25, 0.5,   // top-front
            0.5, 1.0,    0.25,  0.5,   0.5, 0.5,    // top-right
            0.5, 1.0,    0.5, 0.5,     0.75, 0.5,   // top-back
            0.5, 1.0,    0.75,  0.5,   1.0, 0.5,   // top-left
        
            // bottom 4 faces
            0.5, 0.0,    0.25,  0.5,  0.0, 0.5,   // bottom-front
            0.5, 0.0,    0.5, 0.5,    0.25, 0.5,    // bottom-right
            0.5, 0.0,    0.75, 0.5,   0.5, 0.5,  // bottom-back
            0.5, 0.0,    1.0, 0.5,    0.75, 0.5   // bottom-left
        ]);

        // 인덱스: 24개
        this.indices = new Uint16Array([
            0, 1, 2,
            3, 4, 5,
            6, 7, 8,
            9, 10, 11,
            12, 13, 14,
            15, 16, 17,
            18, 19, 20,
            21, 22, 23
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
