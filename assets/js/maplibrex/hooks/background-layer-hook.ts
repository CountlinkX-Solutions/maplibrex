/**
 * BackgroundLayerHook - Hook for the BackgroundLayer component
 * 
 * This hook manages a background layer in MapLibre GL JS,
 * rendering a solid colour or pattern as the map's base.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface BackgroundLayerConfig {
  id: string;
  mapId: string;
  paint: any;
  layout?: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface BackgroundLayerHookState {
  config: BackgroundLayerConfig;
}

export const BackgroundLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on background layer element');
        return;
      }

      const config: BackgroundLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for background layer "${config.id}"`);
        return;
      }

      // Wait until the map is fully loaded
      const addLayer = () => {
        try {
          // Build the layer specification
          const layerSpec: any = {
            id: config.id,
            type: 'background',
            paint: config.paint || {},
            layout: config.layout || {}
          };

          // Agregar propiedades opcionales
          if (config.minZoom !== undefined) {
            layerSpec.minzoom = config.minZoom;
          }

          if (config.maxZoom !== undefined) {
            layerSpec.maxzoom = config.maxZoom;
          }

          // Add the layer to the map
          map.addLayer(layerSpec, config.beforeId);

          // Guardar estado
          (this as any)._maplibrex_background_layer = {
            config
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          logger.debug(`[MaplibreX] Background layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding background layer "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting background layer:', error);
    }
  },

  destroyed(this: any) {
    const state: BackgroundLayerHookState | undefined = (this as any)._maplibrex_background_layer;
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

      logger.debug(`[MaplibreX] Background layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying background layer:', error);
    }
  }
};
