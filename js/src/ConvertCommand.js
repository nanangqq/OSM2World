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
        // Placeholder - would integrate with actual GLTF generation
        return {
            format: format,
            filename: filename,
            data: {
                asset: { version: "2.0", generator: "OSM2World-JS" },
                scenes: [{ nodes: [] }],
                nodes: [],
                meshes: [],
                materials: [],
                textures: [],
                buffers: [],
                bufferViews: [],
                accessors: []
            }
        };
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
        // Placeholder for actual conversion logic
        // In a real implementation, this would:
        // 1. Parse OSM data
        // 2. Create map data structures
        // 3. Apply rules and generate 3D geometry
        // 4. Return a scene object

        return {
            mapProjection: null,
            boundary: bounds,
            objects: [],
            meshes: [],
            materials: [],
            metadata: {
                bounds: bounds,
                timestamp: new Date().toISOString(),
                config: this.config
            }
        };
    }
}

// Default export
export default ConvertCommand;