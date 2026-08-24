/**
 * ImageSourceHook - Hook for the ImageSource component
 * 
 * This hook manages a georeferenced image source in MapLibre GL JS,
 * used for radar overlays, historical maps, scanned imagery, and similar.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ImageSourceConfig {
  id: string;
  mapId: string;
  url: string;
  coordinates: number[][];
}

interface ImageSourceHookState {
  config: ImageSourceConfig;
}

export const ImageSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on image source element');
        return;
      }

      const config: ImageSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for image source "${config.id}"`);
        return;
      }

      // Wait until the map is fully loaded
      const addSource = () => {
        try {
          // Make sure the source is not already registered
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }

          // Build the source specification
          const sourceSpec: any = {
            type: 'image',
            url: config.url,
            coordinates: config.coordinates
          };

          // Add the source to the map
          map.addSource(config.id, sourceSpec);

          // Guardar estado
          (this as any)._maplibrex_image_source = {
            config
          };

          // Emit the source-added event once the image has loaded
          // Note: MapLibre loads the image asynchronously
          const source = map.getSource(config.id) as any;
          if (source && source.onAdd) {
            // The image loads in the background
            this.pushEvent('source:added', { source_id: config.id });
          }

          logger.debug(`[MaplibreX] Image source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding image source "${config.id}":`, error);
          this.pushEvent('source:error', {
            source_id: config.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      };

      // If the map has already loaded, add the source immediately
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        // Wait for the style to load
        map.once('load', addSource);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting image source:', error);
    }
  },

  destroyed(this: any) {
    const state: ImageSourceHookState | undefined = (this as any)._maplibrex_image_source;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remove the source if present
        if (map.getSource(state.config.id)) {
          // Note: a source can only be removed once no layer references it
          // MapLibre raises if we try to remove a source that is still in use
          try {
            map.removeSource(state.config.id);
            this.pushEvent('source:removed', { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
            // The source is probably still in use by a layer
            // Layers must be removed first
          }
        }
      }

      logger.debug(`[MaplibreX] Image source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying image source:', error);
    }
  }
};
