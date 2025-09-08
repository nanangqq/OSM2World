/**
 * OSM2World JavaScript API
 * Browser-compatible port of OSM2World functionality
 */

import ConvertCommandClass, { 
    ConvertCommand,
    O2WConverter,
    O2WConfig,
    LatLonBounds,
    Resolution,
    TileNumber,
    OutputFormat,
    LevelOfDetail
} from './ConvertCommand.js';

export { 
    ConvertCommand,
    O2WConverter,
    O2WConfig,
    LatLonBounds,
    Resolution,
    TileNumber,
    OutputFormat,
    LevelOfDetail
};

// Re-export default
export default ConvertCommandClass;

/**
 * Convenience function to create a new ConvertCommand instance
 */
export function createConverter(options = {}) {
    const converter = new ConvertCommand();
    
    if (options.config) {
        converter.setConfig(options.config);
    }
    
    if (options.outputFiles) {
        converter.setOutputFiles(options.outputFiles);
    }
    
    if (options.tile) {
        const { zoom, x, y } = options.tile;
        converter.setTile(zoom, x, y);
    }
    
    if (options.bounds) {
        const { minLat, minLon, maxLat, maxLon } = options.bounds;
        converter.setInputBounds(minLat, minLon, maxLat, maxLon);
    }
    
    if (options.resolution) {
        const { width, height } = options.resolution;
        converter.setResolution(width, height);
    }
    
    if (options.lod !== undefined) {
        converter.setLevelOfDetail(options.lod);
    }
    
    if (options.osmData) {
        converter.setOSMData(options.osmData);
    }
    
    return converter;
}

/**
 * Quick conversion function for simple use cases
 */
export async function convertOSM(osmData, options = {}) {
    const converter = createConverter({
        ...options,
        osmData,
        outputFiles: options.outputFiles || ['output.json']
    });
    
    return await converter.convert();
}