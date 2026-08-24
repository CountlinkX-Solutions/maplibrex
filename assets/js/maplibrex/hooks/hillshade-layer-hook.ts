/**
 * HillshadeLayerHook - Hook for the HillshadeLayer component
 * 
 * This hook manages a terrain hillshade layer in MapLibre GL JS,
 * rendering 3D relief from a raster-dem source.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface HillshadeLayerConfig {
  id: string;
  mapId: string;
  sourceId: string;
  sourceLayer?: string;
  paint: any;
  layout?: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface HillshadeLayerHookState {
  config: HillshadeLayerConfig;
}

export const HillshadeLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on hillshade layer element');
        return;
      }

      const config: HillshadeLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for hillshade layer "${config.id}"`);
        return;
      }

      // Wait until the map is fully loaded
      const addLayer = () => {
        try {
          // Make sure the source exists
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for hillshade layer "${config.id}". Layer will be added when source is available.`);
            return;
          }

          // Build the layer specification
          const layerSpec: any = {
            id: config.id,
            type: 'hillshade',
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };

          // Agregar propiedades opcionales
          if (config.sourceLayer) {
            layerSpec['source-layer'] = config.sourceLayer;
          }

          if (config.minZoom !== undefined) {
            layerSpec.minzoom = config.minZoom;
          }

          if (config.maxZoom !== undefined) {
            layerSpec.maxzoom = config.maxZoom;
          }

          // Add the layer to the map
          map.addLayer(layerSpec, config.beforeId);

          // Guardar estado
          (this as any)._maplibrex_hillshade_layer = {
            config
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          logger.debug(`[MaplibreX] Hillshade layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding hillshade layer "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting hillshade layer:', error);
    }
  },

  destroyed(this: any) {
    const state: HillshadeLayerHookState | undefined = (this as any)._maplibrex_hillshade_layer;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remove the layer if present
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }

        // Emitir evento de capa removida
        this.pushEvent('layer:removed', { layer_id: state.config.id });
      }

      logger.debug(`[MaplibreX] Hillshade layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying hillshade layer:', error);
    }
  }
};
