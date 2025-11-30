/**
 * GeoJSONLayerHook - Hook para el componente GeoJSONLayer
 * 
 * Gestiona layers de GeoJSON con soporte para múltiples tipos de layer,
 * clustering, eventos de click en features, y actualización dinámica de datos.
 */

import maplibregl from 'maplibre-gl';
import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface GeoJSONLayerConfig {
  id: string;
  mapId: string;
  source: {
    type: 'geojson';
    data: GeoJSON.GeoJSON;
    generateId?: boolean;
    cluster?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
    clusterProperties?: Record<string, any>;
  };
  layer: {
    id: string;
    type: 'fill' | 'line' | 'circle' | 'symbol' | 'heatmap' | 'fill-extrusion';
    source: string;
    paint?: Record<string, any>;
    layout?: Record<string, any>;
    filter?: any[];
    minzoom?: number;
    maxzoom?: number;
    'source-layer'?: string;
  };
  beforeId?: string;
}

interface GeoJSONLayerHookState {
  config: GeoJSONLayerConfig;
  map: maplibregl.Map;
  sourceId: string;
  layerId: string;
}

export const GeoJSONLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on GeoJSON layer element');
        return;
      }

      const config: GeoJSONLayerConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for layer "${config.id}"`);
        return;
      }

      const sourceId = `${config.id}-source`;
      const layerId = config.id;

      // Wait for map to be loaded before adding source and layer
      const addLayer = () => {
        // Add source
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, config.source as any);
        }

        // Add layer
        if (!map.getLayer(layerId)) {
          const layerSpec: any = {
            ...config.layer,
            source: sourceId
          };

          if (config.beforeId) {
            map.addLayer(layerSpec, config.beforeId);
          } else {
            map.addLayer(layerSpec);
          }
        }

        // Setup click event handler
        map.on('click', layerId, (e: any) => {
          if (e.features && e.features.length > 0) {
            this.pushEvent('layer:feature_clicked', {
              layerId: layerId,
              feature: e.features[0],
              lngLat: e.lngLat.toArray(),
              point: [e.point.x, e.point.y]
            });
          }
        });

        // Setup mouse enter/leave handlers for cursor change
        map.on('mouseenter', layerId, (e: any) => {
          map.getCanvas().style.cursor = 'pointer';
          
          if (e.features && e.features.length > 0) {
            this.pushEvent('layer:feature_mouseenter', {
              layerId: layerId,
              feature: e.features[0]
            });
          }
        });

        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
          
          this.pushEvent('layer:feature_mouseleave', {
            layerId: layerId
          });
        });

        // Emit source loaded event
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
        if (source) {
          map.once('sourcedata', (e: any) => {
            if (e.sourceId === sourceId && e.isSourceLoaded) {
              this.pushEvent('layer:source_loaded', {
                layerId: layerId,
                sourceId: sourceId
              });
            }
          });
        }
      };

      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once('load', addLayer);
      }

      // Handle commands from LiveView
      this.handleEvent('layer:set_paint_property', (payload: any) => {
        if (payload.layer_id === layerId) {
          map.setPaintProperty(layerId, payload.property, payload.value);
        }
      });

      this.handleEvent('layer:set_layout_property', (payload: any) => {
        if (payload.layer_id === layerId) {
          map.setLayoutProperty(layerId, payload.property, payload.value);
        }
      });

      this.handleEvent('layer:set_filter', (payload: any) => {
        if (payload.layer_id === layerId) {
          map.setFilter(layerId, payload.filter);
        }
      });

      this.handleEvent('layer:set_data', (payload: any) => {
        if (payload.layer_id === layerId) {
          const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          if (source) {
            source.setData(payload.data);
          }
        }
      });

      // Save state
      (this as any)._maplibrex_geojson_layer = {
        config,
        map,
        sourceId,
        layerId
      };

      console.log(`[MaplibreX] GeoJSON Layer "${layerId}" created`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting GeoJSON layer:', error);
    }
  },

  updated(this: any) {
    const state: GeoJSONLayerHookState | undefined = (this as any)._maplibrex_geojson_layer;
    if (!state) return;

    try {
      const el = this.el as HTMLElement;
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: GeoJSONLayerConfig = JSON.parse(configStr);
      
      // Update source data if it changed
      const source = state.map.getSource(state.sourceId) as maplibregl.GeoJSONSource;
      if (source && newConfig.source.data) {
        // Check if data actually changed (simple comparison)
        const oldData = JSON.stringify(state.config.source.data);
        const newData = JSON.stringify(newConfig.source.data);
        
        if (oldData !== newData) {
          source.setData(newConfig.source.data);
        }
      }

      // Update paint properties if they changed
      if (newConfig.layer.paint) {
        Object.entries(newConfig.layer.paint).forEach(([key, value]) => {
          const oldValue = state.config.layer.paint?.[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            state.map.setPaintProperty(state.layerId, key, value);
          }
        });
      }

      // Update layout properties if they changed
      if (newConfig.layer.layout) {
        Object.entries(newConfig.layer.layout).forEach(([key, value]) => {
          const oldValue = state.config.layer.layout?.[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            state.map.setLayoutProperty(state.layerId, key, value);
          }
        });
      }

      // Update filter if it changed
      if (JSON.stringify(newConfig.layer.filter) !== JSON.stringify(state.config.layer.filter)) {
        state.map.setFilter(state.layerId, (newConfig.layer.filter || null) as any);
      }

      // Update configuration
      state.config = newConfig;

    } catch (error) {
      console.error('[MaplibreX] Error updating GeoJSON layer:', error);
    }
  },

  destroyed(this: any) {
    const state: GeoJSONLayerHookState | undefined = (this as any)._maplibrex_geojson_layer;
    if (!state) return;

    try {
      // Remove layer
      if (state.map.getLayer(state.layerId)) {
        state.map.removeLayer(state.layerId);
      }

      // Remove source
      if (state.map.getSource(state.sourceId)) {
        state.map.removeSource(state.sourceId);
      }

      console.log(`[MaplibreX] GeoJSON Layer "${state.layerId}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying GeoJSON layer:', error);
    }
  }
};
