/**
 * Factory para crear layers de deck.gl
 * 
 * Este factory toma una configuración y crea la instancia apropiada
 * del layer de deck.gl correspondiente.
 */

import {
  ScatterplotLayer,
  ArcLayer,
  LineLayer,
  ColumnLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  TextLayer,
  IconLayer
} from '@deck.gl/layers';
import {
  HexagonLayer,
  GridLayer,
  ScreenGridLayer,
  HeatmapLayer,
  ContourLayer
} from '@deck.gl/aggregation-layers';
import type { Layer } from '@deck.gl/core';
import type { DeckGLLayerConfig } from '../types/deckgl';

// Mapa de constructores de layers
const LAYER_CONSTRUCTORS: Record<string, any> = {
  ScatterplotLayer,
  ArcLayer,
  LineLayer,
  HexagonLayer,
  GridLayer,
  ColumnLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  ScreenGridLayer,
  HeatmapLayer,
  ContourLayer,
  TextLayer,
  IconLayer
};

/**
 * Crea una instancia de deck.gl layer desde una configuración
 * 
 * @param config - Configuración del layer
 * @returns Instancia del layer de deck.gl
 * @throws Error si el tipo de layer no es válido
 */
export function createDeckLayer(config: DeckGLLayerConfig): Layer {
  const LayerConstructor = LAYER_CONSTRUCTORS[config.layerType];
  
  if (!LayerConstructor) {
    throw new Error(
      `Unknown deck.gl layer type: ${config.layerType}. ` +
      `Available types: ${Object.keys(LAYER_CONSTRUCTORS).join(', ')}`
    );
  }
  
  // Procesar accessors - convertir atoms/strings de Elixir a funciones JS
  const processedProps = processAccessors(config.props);
  
  return new LayerConstructor({
    ...processedProps,
    id: config.id,
    data: config.data,
    updateTriggers: config.updateTriggers || {}
  });
}

/**
 * Procesa accessors para convertir atoms/strings de Elixir a funciones JS
 * 
 * Ejemplos:
 * - :position -> d => d.position
 * - "coordinates" -> d => d.coordinates  
 * - ["get", "coords"] -> d => d.coords
 */
function processAccessors(props: Record<string, any>): Record<string, any> {
  const processed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(props)) {
    // Si es un accessor (empieza con "get")
    if (key.startsWith('get')) {
      processed[key] = createAccessor(value);
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

/**
 * Crea una función accessor desde diferentes formatos
 */
function createAccessor(value: any): any {
  // Si ya es una función, retornarla
  if (typeof value === 'function') {
    return value;
  }
  
  // Si es un string/atom (nombre de property)
  if (typeof value === 'string') {
    return (d: any) => d[value];
  }
  
  // Si es array tipo ["get", "propName"]
  if (Array.isArray(value) && value[0] === 'get' && value.length === 2) {
    const propName = value[1];
    return (d: any) => d[propName];
  }
  
  // Si es un array (valor constante)
  if (Array.isArray(value)) {
    return value;
  }
  
  // Valor constante
  return value;
}

/**
 * Valida si un tipo de layer es soportado
 */
export function isValidLayerType(layerType: string): boolean {
  return layerType in LAYER_CONSTRUCTORS;
}

/**
 * Obtiene la lista de tipos de layers soportados
 */
export function getSupportedLayerTypes(): string[] {
  return Object.keys(LAYER_CONSTRUCTORS);
}
