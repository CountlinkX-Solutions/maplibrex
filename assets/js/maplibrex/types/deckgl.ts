/**
 * Type definitions for deck.gl integration with MaplibreX
 */

export interface DeckGLLayerConfig {
  id: string;
  mapId: string;
  layerType: string;
  data: any[];
  props: Record<string, any>;
  beforeId?: string | null;
  updateTriggers?: Record<string, any>;
}

export type DeckGLLayerType =
  | 'ScatterplotLayer'
  | 'ArcLayer'
  | 'LineLayer'
  | 'HexagonLayer'
  | 'GridLayer'
  | 'ColumnLayer'
  | 'PathLayer'
  | 'PolygonLayer'
  | 'GeoJsonLayer'
  | 'ScreenGridLayer'
  | 'HeatmapLayer'
  | 'ContourLayer'
  | 'TextLayer'
  | 'IconLayer';

export interface DeckGLEventData {
  layerId?: string;
  object?: any;
  x?: number;
  y?: number;
  coordinate?: [number, number];
}
