/**
 * JavaScript port of OSM2World ConvertCommand functionality
 * This class provides similar functionality to the Java ConvertCommand
 * but designed to work in browser environments.
 */

/**
 * Configuration object for OSM2World conversion
 */
export class O2WConfig {
    constructor(options = {}) {
        this.lod = options.lod || 0; // Level of detail (0-4)
        this.canvasLimit = options.canvasLimit || 2048;
        this.primitiveThresholdOBJ = options.primitiveThresholdOBJ || null;
        this.forceUnbufferedPNGRendering = options.forceUnbufferedPNGRendering || false;
        this.extraProperties = options.extraProperties || {};
    }

    getInteger(key, defaultValue) {
        return this.extraProperties[key] !== undefined ? this.extraProperties[key] : defaultValue;
    }

    getBoolean(key, defaultValue) {
        return this.extraProperties[key] !== undefined ? this.extraProperties[key] : defaultValue;
    }
}

/**
 * Geographic bounds representation
 */
export class LatLonBounds {
    constructor(minLat, minLon, maxLat, maxLon) {
        this.minLat = minLat;
        this.minLon = minLon;
        this.maxLat = maxLat;
        this.maxLon = maxLon;
    }

    static fromString(boundsStr) {
        // Parse bounds from string format "minLat,minLon maxLat,maxLon"
        const parts = boundsStr.split(/\s+/);
        if (parts.length >= 2) {
            const [minLat, minLon] = parts[0].split(',').map(parseFloat);
            const [maxLat, maxLon] = parts[1].split(',').map(parseFloat);
            return new LatLonBounds(minLat, minLon, maxLat, maxLon);
        }
        throw new Error('Invalid bounds format');
    }
}

/**
 * Resolution specification
 */
export class Resolution {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    getAspectRatio() {
        return this.width / this.height;
    }

    static fromString(resolutionStr) {
        const [width, height] = resolutionStr.split(',').map(str => parseInt(str.trim()));
        return new Resolution(width, height);
    }
}

/**
 * Tile number representation for slippy map tiles
 */
export class TileNumber {
    constructor(zoom, x, y) {
        this.zoom = zoom;
        this.x = x;
        this.y = y;
    }

    static fromString(tileStr) {
        const [zoom, x, y] = tileStr.split(',').map(str => parseInt(str.trim()));
        return new TileNumber(zoom, x, y);
    }

    /**
     * Get the lat/lon bounds for this tile
     */
    latLonBounds() {
        const n = Math.pow(2, this.zoom);
        const lonDeg = (this.x / n) * 360.0 - 180.0;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * this.y / n)));
        const latDeg = latRad * 180.0 / Math.PI;
        
        const lonDeg2 = ((this.x + 1) / n) * 360.0 - 180.0;
        const latRad2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (this.y + 1) / n)));
        const latDeg2 = latRad2 * 180.0 / Math.PI;

        return new LatLonBounds(
            Math.min(latDeg, latDeg2),
            Math.min(lonDeg, lonDeg2),
            Math.max(latDeg, latDeg2),
            Math.max(lonDeg, lonDeg2)
        );
    }
}

/**
 * Output format enumeration
 */
export const OutputFormat = {
    GLTF: 'GLTF',
    GLB: 'GLB',
    OBJ: 'OBJ',
    JSON: 'JSON' // Custom format for browser consumption
};

/**
 * Level of Detail enumeration
 */
export const LevelOfDetail = {
    LOD0: 0,
    LOD1: 1,
    LOD2: 2,
    LOD3: 3,
    LOD4: 4
};

/**
 * Main converter command class - JavaScript equivalent of ConvertCommand.java
 */
export class ConvertCommand {
    constructor() {
        this.outputFiles = [];
        this.tile = null;
        this.lod = null;
        this.resolution = null;
        this.inputBbox = null;
        this.config = new O2WConfig();
        this.osmData = null;
        this.scene = null;
    }

    /**
     * Set output file paths/names
     */
    setOutputFiles(files) {
        this.outputFiles = Array.isArray(files) ? files : [files];
        return this;
    }

    /**
     * Set tile to convert
     */
    setTile(zoom, x, y) {
        if (typeof zoom === 'string') {
            this.tile = TileNumber.fromString(zoom);
        } else {
            this.tile = new TileNumber(zoom, x, y);
        }
        return this;
    }

    /**
     * Set level of detail
     */
    setLevelOfDetail(lod) {
        this.lod = typeof lod === 'number' ? lod : LevelOfDetail[lod];
        return this;
    }

    /**
     * Set output resolution
     */
    setResolution(width, height) {
        if (typeof width === 'string') {
            this.resolution = Resolution.fromString(width);
        } else {
            this.resolution = new Resolution(width, height);
        }
        return this;
    }

    /**
     * Set input bounding box
     */
    setInputBounds(minLat, minLon, maxLat, maxLon) {
        if (typeof minLat === 'string') {
            this.inputBbox = LatLonBounds.fromString(minLat);
        } else {
            this.inputBbox = new LatLonBounds(minLat, minLon, maxLat, maxLon);
        }
        return this;
    }

    /**
     * Set configuration options
     */
    setConfig(config) {
        this.config = config instanceof O2WConfig ? config : new O2WConfig(config);
        return this;
    }

    /**
     * Set OSM data directly (for browser use)
     */
    setOSMData(osmData) {
        this.osmData = osmData;
        return this;
    }

    /**
     * Validate the configuration
     */
    validate() {
        const errors = [];

        if (!this.osmData && !this.inputBbox && !this.tile) {
            errors.push('Either OSM data, input bounding box, or tile must be specified');
        }

        if (this.outputFiles.length === 0) {
            errors.push('At least one output file must be specified');
        }

        return errors;
    }

    /**
     * Determine output format from filename
     */
    getOutputFormat(filename) {
        const ext = filename.toUpperCase().split('.').pop();
        
        // Handle compressed formats
        if (ext === 'GZ' || ext === 'ZIP') {
            const parts = filename.toUpperCase().split('.');
            if (parts.length >= 2) {
                return parts[parts.length - 2];
            }
        }
        
        return ext;
    }

    /**
     * Determine the resolution to use
     */
    determineResolution() {
        if (this.resolution) {
            return this.resolution;
        }

        // Default resolution based on output type
        const aspectRatio = 1.0; // Default for orthographic
        return new Resolution(800, Math.round(800 / aspectRatio));
    }

    /**
     * Convert OSM data to 3D scene
     */
    async convert() {
        // Validate inputs
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error('Validation failed: ' + errors.join(', '));
        }

        try {
            // Create converter instance
            const converter = new O2WConverter();
            converter.setConfig(this.config);

            // Get bounds for conversion
            let bounds = this.inputBbox;
            if (this.tile && !bounds) {
                bounds = this.tile.latLonBounds();
            }

            // Convert to scene
            this.scene = await converter.convert(this.osmData, bounds);

            // Generate outputs
            const results = {};
            for (const outputFile of this.outputFiles) {
                const format = this.getOutputFormat(outputFile);
                const result = await this.generateOutput(format, outputFile);
                results[outputFile] = result;
            }

            return {
                scene: this.scene,
                outputs: results,
                success: true
            };

        } catch (error) {
            return {
                scene: null,
                outputs: {},
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate output in specified format
     */
    async generateOutput(format, filename) {
        if (!this.scene) {
            throw new Error('No scene available for output');
        }

        switch (format) {
            case 'GLTF':
            case 'GLB':
                return this.generateGLTFOutput(format, filename);
            
            case 'OBJ':
                return this.generateOBJOutput(filename);
            
            case 'JSON':
                return this.generateJSONOutput(filename);
            
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }

    /**
     * Generate GLTF/GLB output
     */
    generateGLTFOutput(format, filename) {
        const gltfData = {
            asset: { version: "2.0", generator: "OSM2World JavaScript 1.0" },
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            buffers: [],
            bufferViews: [],
            accessors: []
        };

        const bufferData = []; // 모든 바이너리 데이터를 저장
        let bufferOffset = 0;

        // 기본 재질들 추가
        this.addDefaultMaterials(gltfData);

        // OSM 객체들을 실제 3D 메시로 변환
        if (this.scene && this.scene.objects) {
            this.scene.objects.forEach((obj, objIndex) => {
                const meshData = this.generateMeshGeometry(obj);
                if (meshData && meshData.vertices.length > 0) {
                    // 버퍼와 accessor 생성
                    const positionAccessor = this.createAccessor(gltfData, bufferData, meshData.vertices, 'VEC3', bufferOffset);
                    bufferOffset += meshData.vertices.byteLength;

                    const normalAccessor = this.createAccessor(gltfData, bufferData, meshData.normals, 'VEC3', bufferOffset);
                    bufferOffset += meshData.normals.byteLength;

                    let colorAccessor = null;
                    if (meshData.colors) {
                        colorAccessor = this.createAccessor(gltfData, bufferData, meshData.colors, 'VEC3', bufferOffset);
                        bufferOffset += meshData.colors.byteLength;
                    }

                    // 메시 생성
                    const primitive = {
                        attributes: {
                            POSITION: positionAccessor,
                            NORMAL: normalAccessor
                        },
                        material: this.getMaterialIndexForObject(obj),
                        mode: 4 // TRIANGLES
                    };

                    if (colorAccessor !== null) {
                        primitive.attributes.COLOR_0 = colorAccessor;
                    }

                    gltfData.meshes.push({
                        name: obj.id || `mesh_${objIndex}`,
                        primitives: [primitive]
                    });

                    // 노드 생성
                    gltfData.nodes.push({
                        name: obj.id || `object_${objIndex}`,
                        mesh: gltfData.meshes.length - 1
                    });
                }
            });

            // 루트 노드에 모든 노드 추가
            gltfData.scenes[0].nodes = gltfData.nodes.map((_, index) => index);
        }

        // 버퍼 생성
        if (bufferData.length > 0) {
            const totalBuffer = this.concatenateBuffers(bufferData);
            
            if (format === 'GLB') {
                // GLB용 - buffer는 BIN 청크에 저장
                gltfData.buffers.push({
                    byteLength: totalBuffer.byteLength
                });
                
                return {
                    format: format,
                    filename: filename,
                    data: this.generateGLBBinary(gltfData, totalBuffer),
                    isBinary: true
                };
            } else {
                // GLTF용 - buffer를 base64로 인코딩
                const base64Data = this.arrayBufferToBase64(totalBuffer);
                gltfData.buffers.push({
                    uri: `data:application/gltf-buffer;base64,${base64Data}`,
                    byteLength: totalBuffer.byteLength
                });
                
                return {
                    format: format,
                    filename: filename,
                    data: gltfData,
                    isBinary: false
                };
            }
        }

        // 빈 씬인 경우
        return {
            format: format,
            filename: filename,
            data: gltfData,
            isBinary: format === 'GLB'
        };
    }

    /**
     * Generate GLB binary format with proper BIN chunk
     */
    generateGLBBinary(gltfData, binBuffer = null) {
        const jsonString = JSON.stringify(gltfData);
        const jsonBuffer = new TextEncoder().encode(jsonString);
        
        // JSON 청크 크기를 4바이트 정렬
        const jsonLength = Math.ceil(jsonBuffer.length / 4) * 4;
        const alignedJsonBuffer = new Uint8Array(jsonLength);
        alignedJsonBuffer.set(jsonBuffer);
        // 남은 공간을 공백으로 채움
        for (let i = jsonBuffer.length; i < jsonLength; i++) {
            alignedJsonBuffer[i] = 0x20; // ASCII 공백
        }

        // BIN 청크 처리
        let binLength = 0;
        let alignedBinBuffer = null;
        if (binBuffer && binBuffer.byteLength > 0) {
            binLength = Math.ceil(binBuffer.byteLength / 4) * 4;
            alignedBinBuffer = new Uint8Array(binLength);
            alignedBinBuffer.set(new Uint8Array(binBuffer));
            // 남은 공간을 0으로 채움
            for (let i = binBuffer.byteLength; i < binLength; i++) {
                alignedBinBuffer[i] = 0x00;
            }
        }

        // GLB 헤더 생성
        const header = new ArrayBuffer(12);
        const headerView = new DataView(header);
        
        // GLB 매직 넘버 (0x46546C67 = "glTF")
        headerView.setUint32(0, 0x46546C67, true);
        // 버전 (2)
        headerView.setUint32(4, 2, true);
        // 총 길이 (헤더 + JSON 청크 + BIN 청크)
        const totalLength = 12 + 8 + jsonLength + (binLength > 0 ? 8 + binLength : 0);
        headerView.setUint32(8, totalLength, true);
        
        // JSON 청크 헤더
        const jsonChunkHeader = new ArrayBuffer(8);
        const jsonChunkView = new DataView(jsonChunkHeader);
        jsonChunkView.setUint32(0, jsonLength, true);
        jsonChunkView.setUint32(4, 0x4E4F534A, true); // "JSON"

        // 결과 버퍼 생성
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        // 헤더 추가
        result.set(new Uint8Array(header), offset);
        offset += header.byteLength;
        
        // JSON 청크 헤더 + 데이터 추가
        result.set(new Uint8Array(jsonChunkHeader), offset);
        offset += jsonChunkHeader.byteLength;
        result.set(alignedJsonBuffer, offset);
        offset += alignedJsonBuffer.byteLength;

        // BIN 청크 추가 (있는 경우)
        if (binLength > 0) {
            const binChunkHeader = new ArrayBuffer(8);
            const binChunkView = new DataView(binChunkHeader);
            binChunkView.setUint32(0, binLength, true);
            binChunkView.setUint32(4, 0x004E4942, true); // "BIN\0"
            
            result.set(new Uint8Array(binChunkHeader), offset);
            offset += binChunkHeader.byteLength;
            result.set(alignedBinBuffer, offset);
        }
        
        return result;
    }

    /**
     * Generate OBJ output
     */
    generateOBJOutput(filename) {
        // Placeholder - would integrate with actual OBJ generation
        return {
            format: 'OBJ',
            filename: filename,
            data: {
                vertices: [],
                faces: [],
                materials: []
            }
        };
    }

    /**
     * Generate JSON output (custom format for easy browser consumption)
     */
    generateJSONOutput(filename) {
        return {
            format: 'JSON',
            filename: filename,
            data: {
                metadata: {
                    generator: 'OSM2World-JS',
                    version: '0.5.0',
                    bounds: this.inputBbox,
                    tile: this.tile,
                    lod: this.lod,
                    resolution: this.resolution
                },
                scene: this.scene
            }
        };
    }

    /**
     * OSM 객체를 실제 3D 메시 지오메트리로 변환
     */
    generateMeshGeometry(obj) {
        if (!obj.coordinates || obj.coordinates.length === 0) {
            return null;
        }

        const vertices = [];
        const normals = [];
        const colors = [];
        
        // OSM 태그에 따른 높이 결정
        const height = this.getObjectHeight(obj);
        const color = this.getObjectColor(obj);

        if (obj.type === 'building' || (obj.tags && obj.tags.building)) {
            // 건물: 돌출된 폴리곤 생성
            return this.generateBuildingGeometry(obj.coordinates, height, color);
        } else if (obj.type === 'highway' || (obj.tags && obj.tags.highway)) {
            // 도로: 선형 지오메트리를 폭이 있는 메시로 변환
            return this.generateRoadGeometry(obj.coordinates, obj.tags, color);
        } else if (obj.type === 'area' || obj.coordinates[0] === obj.coordinates[obj.coordinates.length - 1]) {
            // 폴리곤 영역: 평면 메시 생성
            return this.generateAreaGeometry(obj.coordinates, color);
        } else {
            // 기본: 선형 지오메트리
            return this.generateLineGeometry(obj.coordinates, color);
        }
    }

    /**
     * 건물 지오메트리 생성 (높이가 있는 폴리곤)
     */
    generateBuildingGeometry(coordinates, height, color) {
        const vertices = [];
        const normals = [];
        const colors = [];

        // 바닥과 천장 생성
        const groundVertices = [];
        const roofVertices = [];
        
        for (let i = 0; i < coordinates.length - 1; i++) {
            const [lon, lat] = coordinates[i];
            // 간단한 좌표 변환 (실제로는 더 복잡한 지리 좌표 변환 필요)
            const x = (lon - 126.97) * 100000; // 임시 변환
            const z = -(lat - 37.56) * 100000; // 임시 변환
            
            groundVertices.push(x, 0, z);
            roofVertices.push(x, height, z);
        }

        // 삼각형 분할 (간단한 팬 방식)
        for (let i = 2; i < groundVertices.length / 3; i++) {
            // 바닥 삼각형
            vertices.push(
                groundVertices[0], groundVertices[1], groundVertices[2],
                groundVertices[(i-1)*3], groundVertices[(i-1)*3+1], groundVertices[(i-1)*3+2],
                groundVertices[i*3], groundVertices[i*3+1], groundVertices[i*3+2]
            );
            normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
            colors.push(...color, ...color, ...color);

            // 천장 삼각형 (역순)
            vertices.push(
                roofVertices[0], roofVertices[1], roofVertices[2],
                roofVertices[i*3], roofVertices[i*3+1], roofVertices[i*3+2],
                roofVertices[(i-1)*3], roofVertices[(i-1)*3+1], roofVertices[(i-1)*3+2]
            );
            normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
            colors.push(...color, ...color, ...color);
        }

        // 벽면 생성
        for (let i = 0; i < groundVertices.length / 3; i++) {
            const nextI = (i + 1) % (groundVertices.length / 3);
            
            const x1 = groundVertices[i*3], z1 = groundVertices[i*3+2];
            const x2 = groundVertices[nextI*3], z2 = groundVertices[nextI*3+2];
            
            // 벽면의 두 삼각형
            vertices.push(
                x1, 0, z1,     x2, 0, z2,     x1, height, z1,
                x2, 0, z2,     x2, height, z2, x1, height, z1
            );
            
            // 법선 계산 (간단한 벽면 법선)
            const dx = x2 - x1, dz = z2 - z1;
            const len = Math.sqrt(dx*dx + dz*dz);
            const nx = -dz / len, nz = dx / len;
            
            for (let j = 0; j < 6; j++) {
                normals.push(nx, 0, nz);
                colors.push(...color);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors)
        };
    }

    /**
     * 도로 지오메트리 생성
     */
    generateRoadGeometry(coordinates, tags, color) {
        const width = this.getRoadWidth(tags);
        const vertices = [];
        const normals = [];
        const colors = [];

        for (let i = 0; i < coordinates.length - 1; i++) {
            const [lon1, lat1] = coordinates[i];
            const [lon2, lat2] = coordinates[i + 1];
            
            const x1 = (lon1 - 126.97) * 100000;
            const z1 = -(lat1 - 37.56) * 100000;
            const x2 = (lon2 - 126.97) * 100000;
            const z2 = -(lat2 - 37.56) * 100000;
            
            // 도로 세그먼트의 방향과 수직 방향 계산
            const dx = x2 - x1, dz = z2 - z1;
            const len = Math.sqrt(dx*dx + dz*dz);
            const perpX = -dz / len * width / 2;
            const perpZ = dx / len * width / 2;
            
            // 도로 세그먼트의 사각형 메시
            vertices.push(
                x1 + perpX, 0, z1 + perpZ,
                x1 - perpX, 0, z1 - perpZ,
                x2 + perpX, 0, z2 + perpZ,
                x1 - perpX, 0, z1 - perpZ,
                x2 - perpX, 0, z2 - perpZ,
                x2 + perpX, 0, z2 + perpZ
            );
            
            for (let j = 0; j < 6; j++) {
                normals.push(0, 1, 0);
                colors.push(...color);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors)
        };
    }

    /**
     * 평면 영역 지오메트리 생성
     */
    generateAreaGeometry(coordinates, color) {
        const vertices = [];
        const normals = [];
        const colors = [];

        // 간단한 삼각형 분할
        for (let i = 2; i < coordinates.length; i++) {
            const [lon1, lat1] = coordinates[0];
            const [lon2, lat2] = coordinates[i-1];
            const [lon3, lat3] = coordinates[i];
            
            const x1 = (lon1 - 126.97) * 100000;
            const z1 = -(lat1 - 37.56) * 100000;
            const x2 = (lon2 - 126.97) * 100000;
            const z2 = -(lat2 - 37.56) * 100000;
            const x3 = (lon3 - 126.97) * 100000;
            const z3 = -(lat3 - 37.56) * 100000;
            
            vertices.push(x1, 0, z1, x2, 0, z2, x3, 0, z3);
            normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
            colors.push(...color, ...color, ...color);
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors)
        };
    }

    /**
     * 선형 지오메트리 생성 (기본)
     */
    generateLineGeometry(coordinates, color) {
        const vertices = [];
        const normals = [];
        const colors = [];

        for (let i = 0; i < coordinates.length - 1; i++) {
            const [lon1, lat1] = coordinates[i];
            const [lon2, lat2] = coordinates[i + 1];
            
            const x1 = (lon1 - 126.97) * 100000;
            const z1 = -(lat1 - 37.56) * 100000;
            const x2 = (lon2 - 126.97) * 100000;
            const z2 = -(lat2 - 37.56) * 100000;
            
            // 선을 얇은 사각형으로 표현
            const width = 0.5;
            const dx = x2 - x1, dz = z2 - z1;
            const len = Math.sqrt(dx*dx + dz*dz);
            const perpX = -dz / len * width;
            const perpZ = dx / len * width;
            
            vertices.push(
                x1 + perpX, 0, z1 + perpZ,
                x1 - perpX, 0, z1 - perpZ,
                x2 + perpX, 0, z2 + perpZ,
                x1 - perpX, 0, z1 - perpZ,
                x2 - perpX, 0, z2 - perpZ,
                x2 + perpX, 0, z2 + perpZ
            );
            
            for (let j = 0; j < 6; j++) {
                normals.push(0, 1, 0);
                colors.push(...color);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors)
        };
    }

    /**
     * Accessor 생성 (GLTF 버퍼 접근자)
     */
    createAccessor(gltfData, bufferData, typedArray, type, offset) {
        // BufferView 생성
        const bufferView = {
            buffer: 0,
            byteOffset: offset,
            byteLength: typedArray.byteLength,
            target: 34962 // ARRAY_BUFFER
        };
        gltfData.bufferViews.push(bufferView);
        const bufferViewIndex = gltfData.bufferViews.length - 1;

        // Min/Max 계산
        const components = type === 'VEC3' ? 3 : (type === 'VEC2' ? 2 : 1);
        const min = new Array(components).fill(Infinity);
        const max = new Array(components).fill(-Infinity);
        
        for (let i = 0; i < typedArray.length; i += components) {
            for (let j = 0; j < components; j++) {
                min[j] = Math.min(min[j], typedArray[i + j]);
                max[j] = Math.max(max[j], typedArray[i + j]);
            }
        }

        // Accessor 생성
        const accessor = {
            bufferView: bufferViewIndex,
            componentType: 5126, // FLOAT
            count: typedArray.length / components,
            type: type,
            min: min,
            max: max
        };
        gltfData.accessors.push(accessor);
        
        // 버퍼 데이터에 추가
        bufferData.push(typedArray.buffer);
        
        return gltfData.accessors.length - 1;
    }

    /**
     * 기본 재질들 추가
     */
    addDefaultMaterials(gltfData) {
        const materials = [
            {
                name: "건물_콘크리트",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.7, 0.7, 0.7, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.8
                },
                alphaMode: "OPAQUE",
                doubleSided: false
            },
            {
                name: "도로_아스팔트",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.3, 0.3, 0.3, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.9
                },
                alphaMode: "OPAQUE",
                doubleSided: false
            },
            {
                name: "자연_녹지",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.2, 0.6, 0.2, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.7
                },
                alphaMode: "OPAQUE",
                doubleSided: false
            },
            {
                name: "물_표면",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.1, 0.3, 0.8, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.1
                },
                alphaMode: "OPAQUE",
                doubleSided: false
            }
        ];

        gltfData.materials.push(...materials);
    }

    /**
     * 객체의 재질 인덱스 결정
     */
    getMaterialIndexForObject(obj) {
        if (obj.type === 'building' || (obj.tags && obj.tags.building)) {
            return 0; // 건물_콘크리트
        } else if (obj.type === 'highway' || (obj.tags && obj.tags.highway)) {
            return 1; // 도로_아스팔트
        } else if (obj.tags && (obj.tags.natural === 'water' || obj.tags.waterway)) {
            return 3; // 물_표면
        } else {
            return 2; // 자연_녹지
        }
    }

    /**
     * 객체의 높이 결정
     */
    getObjectHeight(obj) {
        if (obj.tags) {
            if (obj.tags.height) {
                return parseFloat(obj.tags.height.replace('m', ''));
            }
            if (obj.tags['building:levels']) {
                return parseInt(obj.tags['building:levels']) * 3; // 층당 3m
            }
            if (obj.tags.building) {
                return 9; // 기본 건물 높이
            }
        }
        return 0;
    }

    /**
     * 객체의 색상 결정
     */
    getObjectColor(obj) {
        if (obj.tags) {
            if (obj.tags.building) return [0.7, 0.7, 0.7];
            if (obj.tags.highway) return [0.3, 0.3, 0.3];
            if (obj.tags.natural === 'water') return [0.1, 0.3, 0.8];
            if (obj.tags.landuse === 'forest') return [0.2, 0.6, 0.2];
        }
        return [0.5, 0.5, 0.5]; // 기본 색상
    }

    /**
     * 도로 폭 결정
     */
    getRoadWidth(tags) {
        if (!tags || !tags.highway) return 4; // 기본값
        
        switch (tags.highway) {
            case 'motorway': return 12;
            case 'trunk': return 10;
            case 'primary': return 8;
            case 'secondary': return 6;
            case 'residential': return 4;
            case 'footway': return 2;
            default: return 4;
        }
    }

    /**
     * 여러 버퍼를 하나로 결합
     */
    concatenateBuffers(buffers) {
        const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        const result = new ArrayBuffer(totalLength);
        const view = new Uint8Array(result);
        
        let offset = 0;
        for (const buffer of buffers) {
            view.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }
        
        return result;
    }

    /**
     * ArrayBuffer를 Base64로 변환
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

/**
 * Core converter class - simplified version of O2WConverter.java
 */
export class O2WConverter {
    constructor() {
        this.config = new O2WConfig();
    }

    setConfig(config) {
        this.config = config;
    }

    async convert(osmData, bounds) {
        try {
            // 1. Parse OSM data
            const parsedData = await this.parseOSMData(osmData);
            
            // 2. Create map data structures
            const mapData = this.createMapDataStructures(parsedData, bounds);
            
            // 3. Apply rules and generate 3D geometry
            const geometry = this.generate3DGeometry(mapData);
            
            // 4. Return a scene object
            return {
                mapProjection: this.determineProjection(bounds),
                boundary: bounds,
                objects: geometry.objects,
                meshes: geometry.meshes,
                materials: geometry.materials,
                metadata: {
                    bounds: bounds,
                    timestamp: new Date().toISOString(),
                    config: this.config,
                    osmDataSize: osmData ? osmData.length : 0,
                    elementCounts: parsedData.stats
                }
            };
        } catch (error) {
            throw new Error(`OSM 데이터 변환 실패: ${error.message}`);
        }
    }

    /**
     * OSM 데이터를 파싱합니다 (XML 또는 JSON 형식)
     */
    async parseOSMData(osmData) {
        if (!osmData) {
            return { nodes: [], ways: [], relations: [], stats: { nodes: 0, ways: 0, relations: 0 } };
        }

        const parsedData = { nodes: [], ways: [], relations: [], stats: { nodes: 0, ways: 0, relations: 0 } };

        try {
            // JSON 형식인지 확인
            if (osmData.trim().startsWith('{') || osmData.trim().startsWith('[')) {
                const jsonData = JSON.parse(osmData);
                this.parseJSONData(jsonData, parsedData);
            } else {
                // XML 형식으로 가정하고 파싱
                this.parseXMLData(osmData, parsedData);
            }
        } catch (error) {
            throw new Error(`OSM 데이터 파싱 오류: ${error.message}`);
        }

        return parsedData;
    }

    /**
     * JSON 형식의 OSM 데이터를 파싱합니다
     */
    parseJSONData(jsonData, parsedData) {
        if (jsonData.elements) {
            // Overpass API 형식
            jsonData.elements.forEach(element => {
                this.addElement(element, parsedData);
            });
        } else if (jsonData.osm && jsonData.osm.node) {
            // osmtogeojson 형식
            if (jsonData.osm.node) jsonData.osm.node.forEach(node => this.addElement({...node, type: 'node'}, parsedData));
            if (jsonData.osm.way) jsonData.osm.way.forEach(way => this.addElement({...way, type: 'way'}, parsedData));
            if (jsonData.osm.relation) jsonData.osm.relation.forEach(rel => this.addElement({...rel, type: 'relation'}, parsedData));
        }
    }

    /**
     * XML 형식의 OSM 데이터를 파싱합니다
     */
    parseXMLData(xmlData, parsedData) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
        
        if (xmlDoc.documentElement.nodeName === 'parsererror') {
            throw new Error('유효하지 않은 XML 형식');
        }

        // 노드 파싱
        const nodes = xmlDoc.getElementsByTagName('node');
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const element = {
                type: 'node',
                id: parseInt(node.getAttribute('id')),
                lat: parseFloat(node.getAttribute('lat')),
                lon: parseFloat(node.getAttribute('lon')),
                tags: this.parseXMLTags(node)
            };
            this.addElement(element, parsedData);
        }

        // 웨이 파싱
        const ways = xmlDoc.getElementsByTagName('way');
        for (let i = 0; i < ways.length; i++) {
            const way = ways[i];
            const nds = way.getElementsByTagName('nd');
            const nodeRefs = [];
            for (let j = 0; j < nds.length; j++) {
                nodeRefs.push(parseInt(nds[j].getAttribute('ref')));
            }
            
            const element = {
                type: 'way',
                id: parseInt(way.getAttribute('id')),
                nodes: nodeRefs,
                tags: this.parseXMLTags(way)
            };
            this.addElement(element, parsedData);
        }

        // 관계 파싱
        const relations = xmlDoc.getElementsByTagName('relation');
        for (let i = 0; i < relations.length; i++) {
            const relation = relations[i];
            const members = relation.getElementsByTagName('member');
            const memberList = [];
            for (let j = 0; j < members.length; j++) {
                const member = members[j];
                memberList.push({
                    type: member.getAttribute('type'),
                    ref: parseInt(member.getAttribute('ref')),
                    role: member.getAttribute('role') || ''
                });
            }
            
            const element = {
                type: 'relation',
                id: parseInt(relation.getAttribute('id')),
                members: memberList,
                tags: this.parseXMLTags(relation)
            };
            this.addElement(element, parsedData);
        }
    }

    /**
     * XML 요소에서 태그를 파싱합니다
     */
    parseXMLTags(element) {
        const tags = {};
        const tagElements = element.getElementsByTagName('tag');
        for (let i = 0; i < tagElements.length; i++) {
            const tag = tagElements[i];
            tags[tag.getAttribute('k')] = tag.getAttribute('v');
        }
        return tags;
    }

    /**
     * 파싱된 데이터에 요소를 추가합니다
     */
    addElement(element, parsedData) {
        switch (element.type) {
            case 'node':
                parsedData.nodes.push(element);
                parsedData.stats.nodes++;
                break;
            case 'way':
                parsedData.ways.push(element);
                parsedData.stats.ways++;
                break;
            case 'relation':
                parsedData.relations.push(element);
                parsedData.stats.relations++;
                break;
        }
    }

    /**
     * 맵 데이터 구조를 생성합니다
     */
    createMapDataStructures(parsedData, bounds) {
        // 노드를 ID로 인덱싱
        const nodeIndex = new Map();
        parsedData.nodes.forEach(node => {
            nodeIndex.set(node.id, node);
        });

        // 웨이를 처리하여 실제 좌표로 변환
        const processedWays = parsedData.ways.map(way => {
            const coordinates = way.nodes.map(nodeId => {
                const node = nodeIndex.get(nodeId);
                return node ? [node.lon, node.lat] : null;
            }).filter(coord => coord !== null);

            return {
                ...way,
                coordinates: coordinates,
                isValid: coordinates.length >= 2
            };
        }).filter(way => way.isValid);

        return {
            nodes: parsedData.nodes,
            ways: processedWays,
            relations: parsedData.relations,
            nodeIndex: nodeIndex,
            bounds: bounds
        };
    }

    /**
     * 3D 지오메트리를 생성합니다
     */
    generate3DGeometry(mapData) {
        const objects = [];
        const meshes = [];
        const materials = [];

        // 건물 생성
        const buildings = this.generateBuildings(mapData);
        objects.push(...buildings.objects);
        meshes.push(...buildings.meshes);
        materials.push(...buildings.materials);

        // 도로 생성
        const roads = this.generateRoads(mapData);
        objects.push(...roads.objects);
        meshes.push(...roads.meshes);
        materials.push(...roads.materials);

        // 자연 지형 생성
        const natural = this.generateNaturalFeatures(mapData);
        objects.push(...natural.objects);
        meshes.push(...natural.meshes);
        materials.push(...natural.materials);

        return { objects, meshes, materials };
    }

    /**
     * 건물 3D 객체를 생성합니다
     */
    generateBuildings(mapData) {
        const buildingWays = mapData.ways.filter(way => 
            way.tags && way.tags.building && way.tags.building !== 'no'
        );

        const objects = [];
        const meshes = [];
        const materials = [];

        buildingWays.forEach((way, index) => {
            const height = this.getBuildingHeight(way.tags);
            const levels = this.getBuildingLevels(way.tags);
            
            const building = {
                id: `building_${way.id}`,
                type: 'building',
                wayId: way.id,
                coordinates: way.coordinates,
                height: height,
                levels: levels,
                tags: way.tags,
                geometry: this.createBuildingGeometry(way.coordinates, height)
            };

            objects.push(building);
            
            // 메시와 재질 생성
            meshes.push({
                id: `building_mesh_${way.id}`,
                objectId: building.id,
                vertices: building.geometry.vertices,
                faces: building.geometry.faces,
                material: `building_material_${index % 3}` // 3가지 재질 순환
            });
        });

        // 기본 건물 재질들
        materials.push(
            { id: 'building_material_0', color: '#cccccc', type: 'concrete' },
            { id: 'building_material_1', color: '#dddddd', type: 'brick' },
            { id: 'building_material_2', color: '#eeeeee', type: 'modern' }
        );

        return { objects, meshes, materials };
    }

    /**
     * 도로 3D 객체를 생성합니다
     */
    generateRoads(mapData) {
        const roadWays = mapData.ways.filter(way => 
            way.tags && way.tags.highway
        );

        const objects = [];
        const meshes = [];
        const materials = [];

        roadWays.forEach((way, index) => {
            const roadType = way.tags.highway;
            const width = this.getRoadWidth(roadType);
            
            const road = {
                id: `road_${way.id}`,
                type: 'road',
                wayId: way.id,
                coordinates: way.coordinates,
                roadType: roadType,
                width: width,
                tags: way.tags,
                geometry: this.createRoadGeometry(way.coordinates, width)
            };

            objects.push(road);
            
            meshes.push({
                id: `road_mesh_${way.id}`,
                objectId: road.id,
                vertices: road.geometry.vertices,
                faces: road.geometry.faces,
                material: `road_material_${this.getRoadMaterialType(roadType)}`
            });
        });

        // 도로 재질들
        materials.push(
            { id: 'road_material_primary', color: '#333333', type: 'asphalt' },
            { id: 'road_material_secondary', color: '#444444', type: 'asphalt' },
            { id: 'road_material_residential', color: '#555555', type: 'asphalt' },
            { id: 'road_material_footway', color: '#888888', type: 'concrete' }
        );

        return { objects, meshes, materials };
    }

    /**
     * 자연 지형 3D 객체를 생성합니다
     */
    generateNaturalFeatures(mapData) {
        const naturalWays = mapData.ways.filter(way => 
            way.tags && (way.tags.natural || way.tags.landuse || way.tags.leisure)
        );

        const objects = [];
        const meshes = [];
        const materials = [];

        naturalWays.forEach((way, index) => {
            const featureType = way.tags.natural || way.tags.landuse || way.tags.leisure;
            
            const feature = {
                id: `natural_${way.id}`,
                type: 'natural',
                wayId: way.id,
                coordinates: way.coordinates,
                featureType: featureType,
                tags: way.tags,
                geometry: this.createNaturalGeometry(way.coordinates, featureType)
            };

            objects.push(feature);
            
            meshes.push({
                id: `natural_mesh_${way.id}`,
                objectId: feature.id,
                vertices: feature.geometry.vertices,
                faces: feature.geometry.faces,
                material: `natural_material_${this.getNaturalMaterialType(featureType)}`
            });
        });

        // 자연 지형 재질들
        materials.push(
            { id: 'natural_material_water', color: '#4444ff', type: 'water' },
            { id: 'natural_material_grass', color: '#44ff44', type: 'grass' },
            { id: 'natural_material_forest', color: '#228822', type: 'forest' },
            { id: 'natural_material_park', color: '#66ff66', type: 'park' }
        );

        return { objects, meshes, materials };
    }

    // 헬퍼 메서드들
    getBuildingHeight(tags) {
        if (tags.height) {
            const height = parseFloat(tags.height.replace(/[^\d.]/g, ''));
            return isNaN(height) ? 10 : height;
        }
        const levels = this.getBuildingLevels(tags);
        return levels * 3; // 층당 3미터로 가정
    }

    getBuildingLevels(tags) {
        if (tags['building:levels']) {
            const levels = parseInt(tags['building:levels']);
            return isNaN(levels) ? 3 : levels;
        }
        return 3; // 기본 3층
    }

    getRoadWidth(roadType) {
        const widths = {
            'motorway': 12,
            'trunk': 10,
            'primary': 8,
            'secondary': 6,
            'tertiary': 5,
            'residential': 4,
            'footway': 2,
            'path': 1.5
        };
        return widths[roadType] || 3;
    }

    getRoadMaterialType(roadType) {
        if (['motorway', 'trunk', 'primary'].includes(roadType)) return 'primary';
        if (['secondary', 'tertiary'].includes(roadType)) return 'secondary';
        if (['footway', 'path'].includes(roadType)) return 'footway';
        return 'residential';
    }

    getNaturalMaterialType(featureType) {
        if (['water', 'river', 'lake'].includes(featureType)) return 'water';
        if (['forest', 'wood'].includes(featureType)) return 'forest';
        if (['park', 'recreation_ground'].includes(featureType)) return 'park';
        return 'grass';
    }

    createBuildingGeometry(coordinates, height) {
        // 간단한 돌출 지오메트리 생성
        const vertices = [];
        const faces = [];
        
        // 바닥 정점들
        coordinates.forEach(coord => {
            vertices.push([coord[0], coord[1], 0]);
        });
        
        // 상단 정점들
        coordinates.forEach(coord => {
            vertices.push([coord[0], coord[1], height]);
        });
        
        // 간단한 면 생성 (실제로는 더 복잡한 삼각분할이 필요)
        const numPoints = coordinates.length;
        for (let i = 0; i < numPoints - 1; i++) {
            // 측면 사각형을 두 개의 삼각형으로 분할
            faces.push([i, i + 1, i + numPoints]);
            faces.push([i + 1, i + numPoints + 1, i + numPoints]);
        }
        
        return { vertices, faces };
    }

    createRoadGeometry(coordinates, width) {
        const vertices = [];
        const faces = [];
        
        // 간단한 도로 스트립 생성
        for (let i = 0; i < coordinates.length; i++) {
            const coord = coordinates[i];
            // 좌측과 우측 가장자리 정점
            vertices.push([coord[0] - width/2, coord[1], 0.1]);
            vertices.push([coord[0] + width/2, coord[1], 0.1]);
        }
        
        // 도로 스트립 면 생성
        for (let i = 0; i < coordinates.length - 1; i++) {
            const base = i * 2;
            faces.push([base, base + 1, base + 2]);
            faces.push([base + 1, base + 3, base + 2]);
        }
        
        return { vertices, faces };
    }

    createNaturalGeometry(coordinates, featureType) {
        const vertices = [];
        const faces = [];
        
        // 간단한 평면 지오메트리
        coordinates.forEach(coord => {
            vertices.push([coord[0], coord[1], 0]);
        });
        
        // 간단한 팬 삼각분할
        for (let i = 1; i < coordinates.length - 1; i++) {
            faces.push([0, i, i + 1]);
        }
        
        return { vertices, faces };
    }

    determineProjection(bounds) {
        if (!bounds) return null;
        
        // 간단한 Web Mercator 투영 정보 반환
        return {
            type: 'WebMercator',
            bounds: bounds,
            centerLat: (bounds.minLat + bounds.maxLat) / 2,
            centerLon: (bounds.minLon + bounds.maxLon) / 2
        };
    }
}

// Default export
export default ConvertCommand;