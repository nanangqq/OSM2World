#!/usr/bin/env node

/**
 * Simple test for OSM2World JavaScript API
 * Run with: node test/test.js
 */

import { 
    ConvertCommand, 
    O2WConverter, 
    O2WConfig, 
    LatLonBounds, 
    TileNumber, 
    Resolution,
    createConverter,
    convertOSM
} from '../src/index.js';

// Test helper
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function log(message) {
    console.log(`✓ ${message}`);
}

async function runTests() {
    console.log('Running OSM2World JavaScript API tests...\n');

    // Test 1: Basic class instantiation
    try {
        const converter = new ConvertCommand();
        assert(converter instanceof ConvertCommand, 'ConvertCommand instantiation');
        log('ConvertCommand instantiation works');
    } catch (error) {
        console.error('❌ ConvertCommand instantiation failed:', error.message);
    }

    // Test 2: Configuration
    try {
        const config = new O2WConfig({
            lod: 2,
            canvasLimit: 1024,
            extraProperties: { test: 'value' }
        });
        assert(config.lod === 2, 'Config lod setting');
        assert(config.getInteger('test', null) === 'value', 'Config extra properties');
        log('Configuration works');
    } catch (error) {
        console.error('❌ Configuration failed:', error.message);
    }

    // Test 3: LatLonBounds
    try {
        const bounds = new LatLonBounds(52.5, 13.3, 52.6, 13.4);
        assert(bounds.minLat === 52.5, 'LatLonBounds construction');
        
        const boundsFromString = LatLonBounds.fromString('52.5,13.3 52.6,13.4');
        assert(boundsFromString.minLat === 52.5, 'LatLonBounds from string');
        log('LatLonBounds works');
    } catch (error) {
        console.error('❌ LatLonBounds failed:', error.message);
    }

    // Test 4: TileNumber
    try {
        const tile = new TileNumber(15, 17602, 10747);
        assert(tile.zoom === 15, 'TileNumber construction');
        
        const bounds = tile.latLonBounds();
        assert(bounds instanceof LatLonBounds, 'TileNumber bounds calculation');
        log('TileNumber works');
    } catch (error) {
        console.error('❌ TileNumber failed:', error.message);
    }

    // Test 5: Resolution
    try {
        const resolution = new Resolution(800, 600);
        assert(Math.abs(resolution.getAspectRatio() - 4/3) < 0.01, 'Resolution aspect ratio');
        
        const resFromString = Resolution.fromString('1024,768');
        assert(resFromString.width === 1024, 'Resolution from string');
        log('Resolution works');
    } catch (error) {
        console.error('❌ Resolution failed:', error.message);
    }

    // Test 6: ConvertCommand configuration
    try {
        const converter = new ConvertCommand();
        converter
            .setOutputFiles(['test.gltf', 'test.obj'])
            .setTile(15, 17602, 10747)
            .setResolution(800, 600)
            .setLevelOfDetail(2);
        
        assert(converter.outputFiles.length === 2, 'Output files setting');
        assert(converter.tile.zoom === 15, 'Tile setting');
        assert(converter.resolution.width === 800, 'Resolution setting');
        assert(converter.lod === 2, 'LOD setting');
        log('ConvertCommand configuration works');
    } catch (error) {
        console.error('❌ ConvertCommand configuration failed:', error.message);
    }

    // Test 7: Validation
    try {
        const converter = new ConvertCommand();
        const errors = converter.validate();
        assert(errors.length > 0, 'Validation catches missing requirements');
        
        converter.setOutputFiles(['test.json']).setOSMData('<osm></osm>');
        const errors2 = converter.validate();
        assert(errors2.length === 0, 'Validation passes with requirements met');
        log('Validation works');
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
    }

    // Test 8: Convenience functions
    try {
        const converter = createConverter({
            outputFiles: ['test.json'],
            tile: { zoom: 15, x: 17602, y: 10747 },
            resolution: { width: 800, height: 600 },
            lod: 2
        });
        assert(converter instanceof ConvertCommand, 'createConverter returns ConvertCommand');
        assert(converter.outputFiles[0] === 'test.json', 'createConverter sets options');
        log('Convenience functions work');
    } catch (error) {
        console.error('❌ Convenience functions failed:', error.message);
    }

    // Test 9: Basic conversion (will use placeholder data)
    try {
        const converter = new ConvertCommand();
        converter
            .setOutputFiles(['test.json'])
            .setOSMData('<osm><node id="1" lat="52.5" lon="13.3"/></osm>')
            .setInputBounds(52.5, 13.3, 52.6, 13.4);
        
        const result = await converter.convert();
        assert(result.success === true, 'Conversion succeeds');
        assert(result.outputs['test.json'] !== undefined, 'Output generated');
        log('Basic conversion works');
    } catch (error) {
        console.error('❌ Basic conversion failed:', error.message);
    }

    // Test 10: Quick conversion function
    try {
        const result = await convertOSM('<osm></osm>', {
            outputFiles: ['quick.json'],
            bounds: { minLat: 52.5, minLon: 13.3, maxLat: 52.6, maxLon: 13.4 }
        });
        assert(result.success === true, 'Quick conversion succeeds');
        log('Quick conversion function works');
    } catch (error) {
        console.error('❌ Quick conversion failed:', error.message);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\nTo see the demo in action:');
    console.log('1. cd js');
    console.log('2. npm run demo');
    console.log('3. Open http://localhost:8000/examples/demo.html');
}

// Run tests
runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});