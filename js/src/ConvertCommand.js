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
            asset: { version: "2.0", generator: "OSM2World-JS" },
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            textures: [],
            buffers: [],
            bufferViews: [],
            accessors: []
        };

        // Add actual scene data if available
        if (this.scene && this.scene.objects) {
            this.scene.objects.forEach((obj, index) => {
                // 노드 추가
                gltfData.nodes.push({
                    name: obj.id || `object_${index}`,
                    mesh: index
                });
                
                // 메시 추가
                if (obj.coordinates && obj.coordinates.length > 0) {
                    const mesh = {
                        name: obj.id || `mesh_${index}`,
                        primitives: [{
                            attributes: {
                                POSITION: index * 2,
                                NORMAL: index * 2 + 1
                            },
                            mode: 4 // TRIANGLES
                        }]
                    };
                    
                    if (obj.material) {
                        mesh.primitives[0].material = index;
                        
                        // 재질 추가
                        gltfData.materials.push({
                            name: obj.material.name || `material_${index}`,
                            pbrMetallicRoughness: {
                                baseColorFactor: obj.material.color || [0.5, 0.5, 0.5, 1.0],
                                metallicFactor: 0.0,
                                roughnessFactor: 0.8
                            }
                        });
                    }
                    
                    gltfData.meshes.push(mesh);
                }
            });
            
            // 씬에 노드 추가
            gltfData.scenes[0].nodes = gltfData.nodes.map((_, index) => index);
        }

        if (format === 'GLB') {
            // GLB 바이너리 형식으로 변환
            return {
                format: format,
                filename: filename,
                data: this.generateGLBBinary(gltfData),
                isBinary: true
            };
        } else {
            // GLTF JSON 형식
            return {
                format: format,
                filename: filename,
                data: gltfData,
                isBinary: false
            };
        }
    }

    /**
     * Generate GLB binary format
     */
    generateGLBBinary(gltfData) {
        const jsonString = JSON.stringify(gltfData);
        const jsonBuffer = new TextEncoder().encode(jsonString);
        
        // JSON 청크 크기를 4바이트 정렬
        const jsonLength = Math.ceil(jsonBuffer.length / 4) * 4;
        const alignedJsonBuffer = new Uint8Array(jsonLength);
        alignedJsonBuffer.set(jsonBuffer);
        
        // GLB 헤더 생성
        const header = new ArrayBuffer(12);
        const headerView = new DataView(header);
        
        // GLB 매직 넘버 (0x46546C67 = "glTF")
        headerView.setUint32(0, 0x46546C67, true);
        // 버전 (2)
        headerView.setUint32(4, 2, true);
        // 총 길이 (헤더 + JSON 청크 헤더 + JSON 데이터)
        headerView.setUint32(8, 12 + 8 + jsonLength, true);
        
        // JSON 청크 헤더
        const jsonChunkHeader = new ArrayBuffer(8);
        const jsonChunkView = new DataView(jsonChunkHeader);
        // JSON 청크 길이
        jsonChunkView.setUint32(0, jsonLength, true);
        // JSON 청크 타입 (0x4E4F534A = "JSON")
        jsonChunkView.setUint32(4, 0x4E4F534A, true);
        
        // 모든 버퍼 결합
        const totalLength = header.byteLength + jsonChunkHeader.byteLength + alignedJsonBuffer.byteLength;
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        result.set(new Uint8Array(header), offset);
        offset += header.byteLength;
        
        result.set(new Uint8Array(jsonChunkHeader), offset);
        offset += jsonChunkHeader.byteLength;
        
        result.set(alignedJsonBuffer, offset);
        
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