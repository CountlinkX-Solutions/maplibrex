/**
 * FillExtrusionLayerHook - Hook for the FillExtrusionLayer component
 * 
 * This hook manages an extruded 3D polygon layer in MapLibre GL JS,
 * commonly used for buildings and height-based data visualisations.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface FillExtrusionLayerConfig {
  id: string;
  mapId: string;
  sourceId: string;
  sourceLayer?: string;
  paint: any;
  layout?: any;
  filter?: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface FillExtrusionLayerHookState {
  config: FillExtrusionLayerConfig;
  clickHandler?: (e: any) => void;
  mouseenterHandler?: (e: any) => void;
  mouseleaveHandler?: (e: any) => void;
}

export const FillExtrusionLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on fill extrusion layer element');
        return;
      }

      const config: FillExtrusionLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for fill extrusion layer "${config.id}"`);
        return;
      }

      // Wait until the map is fully loaded
      const addLayer = () => {
        try {
          // Make sure the source exists
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for fill extrusion layer "${config.id}". Layer will be added when source is available.`);
            return;
          }

          // Build the layer specification
          const layerSpec: any = {
            id: config.id,
            type: 'fill-extrusion',
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };

          // Agregar propiedades opcionales
          if (config.sourceLayer) {
            layerSpec['source-layer'] = config.sourceLayer;
          }

          if (config.filter) {
            layerSpec.filter = config.filter;
          }

          if (config.minZoom !== undefined) {
            layerSpec.minzoom = config.minZoom;
          }

          if (config.maxZoom !== undefined) {
            layerSpec.maxzoom = config.maxZoom;
          }

          // Add the layer to the map
          map.addLayer(layerSpec, config.beforeId);

          // Configurar event handlers
          const clickHandler = (e: any) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent('layer:feature_clicked', {
                layer_id: config.id,
                features: e.features,
                lngLat: e.lngLat
              });
            }
          };

          const mouseenterHandler = (e: any) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = 'pointer';
              this.pushEvent('layer:feature_mouseenter', {
                layer_id: config.id,
                features: e.features,
                lngLat: e.lngLat
              });
            }
          };

          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = '';
            this.pushEvent('layer:feature_mouseleave', {
              layer_id: config.id
            });
          };

          // Registrar event listeners
          map.on('click', config.id, clickHandler);
          map.on('mouseenter', config.id, mouseenterHandler);
          map.on('mouseleave', config.id, mouseleaveHandler);

          // Guardar estado
          (this as any)._maplibrex_fill_extrusion_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          logger.debug(`[MaplibreX] Fill extrusion layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding fill extrusion layer "${config.id}":`, error);
        }
      };

      // If the map has already loaded, add the layer immediately
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        // Wait for the style to load
        map.once('load', addLayer);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting fill extrusion layer:', error);
    }
  },

  destroyed(this: any) {
    const state: FillExtrusionLayerHookState | undefined = (this as any)._maplibrex_fill_extrusion_layer;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remover event listeners
        if (state.clickHandler) {
          map.off('click', state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off('mouseenter', state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off('mouseleave', state.config.id, state.mouseleaveHandler);
        }

        // Remove the layer if present
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }

        // Emitir evento de capa removida
        this.pushEvent('layer:removed', { layer_id: state.config.id });
      }

      logger.debug(`[MaplibreX] Fill extrusion layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying fill extrusion layer:', error);
    }
  }
};
