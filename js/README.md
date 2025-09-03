# OSM2World JavaScript

A browser-compatible JavaScript port of the OSM2World ConvertCommand functionality, enabling OSM to 3D conversion directly in web browsers.

## Overview

This JavaScript implementation provides similar functionality to the Java `ConvertCommand.java` but is designed to work in browser environments. It offers a clean API for converting OpenStreetMap data to 3D models with support for multiple output formats.

## Features

- **Browser Compatible**: Runs directly in modern web browsers without build steps
- **Multiple Output Formats**: Support for GLTF, GLB, OBJ, and custom JSON formats
- **Flexible Input**: Handle OSM data, bounding boxes, or slippy map tiles
- **Level of Detail**: Configurable LOD from 0 (highest detail) to 4 (lowest detail)
- **Camera Configuration**: Support for different projections and viewpoints
- **Validation**: Built-in input validation and error handling

## Quick Start

### Basic Usage

```javascript
import { ConvertCommand } from './src/ConvertCommand.js';

// Create a converter
const converter = new ConvertCommand();

// Configure the conversion
converter
  .setOutputFiles(['output.gltf'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)  // Berlin area
  .setLevelOfDetail(2)
  .setResolution(800, 600);

// Perform conversion
const result = await converter.convert();

if (result.success) {
  console.log('Conversion successful!', result.outputs);
} else {
  console.error('Conversion failed:', result.error);
}
```

### Using Convenience Functions

```javascript
import { createConverter, convertOSM } from './src/index.js';

// Quick setup
const converter = createConverter({
  outputFiles: ['model.glb'],
  tile: { zoom: 15, x: 17602, y: 10747 },
  lod: 2
});

// Or one-liner conversion
const result = await convertOSM(osmData, {
  outputFiles: ['output.json'],
  bounds: { minLat: 52.5, minLon: 13.3, maxLat: 52.6, maxLon: 13.4 }
});
```

## API Reference

### ConvertCommand

Main converter class that mimics the Java ConvertCommand functionality.

#### Methods

- `setOutputFiles(files)` - Set output file paths/names
- `setTile(zoom, x, y)` - Set slippy map tile to convert
- `setLevelOfDetail(lod)` - Set level of detail (0-4)
- `setResolution(width, height)` - Set output resolution
- `setInputBounds(minLat, minLon, maxLat, maxLon)` - Set bounding box
- `setConfig(config)` - Set conversion configuration
- `setOSMData(osmData)` - Set OSM data directly
- `convert()` - Perform the conversion (async)

### Helper Classes

#### LatLonBounds
```javascript
const bounds = new LatLonBounds(52.5, 13.3, 52.6, 13.4);
// or
const bounds = LatLonBounds.fromString('52.5,13.3 52.6,13.4');
```

#### TileNumber
```javascript
const tile = new TileNumber(15, 17602, 10747);
// or
const tile = TileNumber.fromString('15,17602,10747');
const bounds = tile.latLonBounds(); // Get geographic bounds
```

#### Resolution
```javascript
const resolution = new Resolution(800, 600);
// or
const resolution = Resolution.fromString('800,600');
```

#### O2WConfig
```javascript
const config = new O2WConfig({
  lod: 2,
  canvasLimit: 2048,
  extraProperties: { customSetting: 'value' }
});
```

### Output Formats

- **JSON**: Custom format optimized for browser consumption
- **GLTF**: Standard GLTF 2.0 format
- **GLB**: Binary GLTF format
- **OBJ**: Wavefront OBJ format

## Examples

### Converting a Specific Area
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['berlin.gltf'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)  // Berlin city center
  .setLevelOfDetail(1)
  .setResolution(1024, 768);

const result = await converter.convert();
```

### Converting a Map Tile
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['tile.glb'])
  .setTile(15, 17602, 10747)  // Berlin tile at zoom 15
  .setLevelOfDetail(2);

const result = await converter.convert();
```

### Multiple Output Formats
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['model.gltf', 'model.obj', 'data.json'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)
  .setLevelOfDetail(2);

const result = await converter.convert();
// result.outputs will contain all three formats
```

## Running the Demo

1. Start a local server:
   ```bash
   cd js
   npm run demo
   ```

2. Open your browser to: `http://localhost:8000/examples/demo.html`

## Testing

Run the test suite:
```bash
cd js
npm test
```

## Development Notes

This is a JavaScript port of the core OSM2World conversion functionality. The current implementation provides:

1. **API Structure**: Complete API that mirrors the Java ConvertCommand
2. **Input Handling**: Support for various input types (bounds, tiles, direct data)
3. **Output Management**: Framework for multiple output formats
4. **Configuration**: Flexible configuration system
5. **Validation**: Input validation and error handling

### Current Limitations

- **OSM Parsing**: Full OSM XML/PBF parsing needs implementation
- **3D Generation**: Core 3D geometry generation needs implementation
- **Output Serialization**: Actual GLTF/OBJ file generation needs implementation
- **Map Projection**: Geographic coordinate transformation needs implementation

### Integration Points

To complete the implementation, you would integrate:

1. **OSM Parser**: A JavaScript OSM XML/PBF parser
2. **3D Engine**: Geometry generation from map data
3. **Format Writers**: GLTF/OBJ/etc. serialization libraries
4. **Map Projection**: Coordinate transformation library

## Architecture

The implementation follows the same patterns as the Java version:

```
ConvertCommand (main API)
├── O2WConverter (core conversion logic)
├── O2WConfig (configuration management)
├── Input handling (bounds, tiles, data)
├── Output generation (GLTF, OBJ, JSON)
└── Validation and error handling
```

## License

This JavaScript port maintains the same LGPL-2.1 license as the original OSM2World project.