/**
 * Factory for building deck.gl layers
 * 
 * This factory takes a configuration object and creates the matching
 * deck.gl layer instance.
 */

import type { Layer } from '@deck.gl/core';
import type { DeckGLLayerConfig } from '../types/deckgl';
import { requireDeckGL } from './deckgl-lazy-loader';

// The layer types this component supports, split by the package that provides
// them. The constructors themselves are resolved at call time from the
// lazily-loaded modules — importing them here would defeat the code split.
const LAYER_PACKAGES = {
  layers: [
    'ScatterplotLayer',
    'ArcLayer',
    'LineLayer',
    'ColumnLayer',
    'PathLayer',
    'PolygonLayer',
    'GeoJsonLayer',
    'TextLayer',
    'IconLayer'
  ],
  aggregation: ['HexagonLayer', 'GridLayer', 'ScreenGridLayer', 'HeatmapLayer', 'ContourLayer']
} as const;

const SUPPORTED_LAYER_TYPES: string[] = [
  ...LAYER_PACKAGES.layers,
  ...LAYER_PACKAGES.aggregation
];

/**
 * Look up a layer constructor in the loaded deck.gl modules.
 *
 * Requires `loadDeckGL()` to have resolved — the DeckGlLayerHook awaits it
 * before any layer is created.
 */
function layerConstructor(layerType: string): any {
  const deck = requireDeckGL();

  const modules: Record<string, any> =
    (LAYER_PACKAGES.aggregation as readonly string[]).includes(layerType)
      ? deck.aggregation
      : deck.layers;

  return modules[layerType];
}

/**
 * Create a deck.gl layer instance from a configuration object
 * 
 * @param config - Layer configuration
 * @returns The deck.gl layer instance
 * @throws Error if the layer type is not supported
 */
export function createDeckLayer(config: DeckGLLayerConfig): Layer {
  const LayerConstructor = layerConstructor(config.layerType);

  if (!LayerConstructor) {
    throw new Error(
      `Unknown deck.gl layer type: ${config.layerType}. ` +
      `Available types: ${SUPPORTED_LAYER_TYPES.join(', ')}`
    );
  }

  // Turn Elixir atoms/strings into JS accessor functions
  const processedProps = processAccessors(config.props);
  
  return new LayerConstructor({
    ...processedProps,
    id: config.id,
    data: config.data,
    updateTriggers: config.updateTriggers || {}
  });
}

/**
 * Turn Elixir atoms/strings into JS accessor functions
 * 
 * Examples:
 * - :position          -> d => d.position
 * - "coordinates"      -> d => d.coordinates
 * - ["get", "coords"]  -> d => d.coords
 */
function processAccessors(props: Record<string, any>): Record<string, any> {
  const processed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(props)) {
    // An accessor: starts with "get"
    if (key.startsWith('get')) {
      processed[key] = createAccessor(value);
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

/**
 * Build an accessor function from any of the supported formats
 */
function createAccessor(value: any): any {
  // Already a function: pass it through
  if (typeof value === 'function') {
    return value;
  }
  
  // A string/atom: a property name
  if (typeof value === 'string') {
    return (d: any) => d[value];
  }
  
  // An array of the form ["get", "propName"]
  if (Array.isArray(value) && value[0] === 'get' && value.length === 2) {
    const propName = value[1];
    return (d: any) => d[propName];
  }
  
  // An array: a constant value
  if (Array.isArray(value)) {
    return value;
  }
  
  // A constant value
  return value;
}

/**
 * Whether a layer type is supported
 */
export function isValidLayerType(layerType: string): boolean {
  return SUPPORTED_LAYER_TYPES.includes(layerType);
}

/**
 * The list of supported layer types
 */
export function getSupportedLayerTypes(): string[] {
  return [...SUPPORTED_LAYER_TYPES];
}
