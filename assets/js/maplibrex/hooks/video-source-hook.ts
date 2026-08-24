/**
 * VideoSourceHook - Hook for the VideoSource component
 * 
 * This hook manages a georeferenced video source in MapLibre GL JS,
 * used for drone overlays, surveillance cameras, time-lapse, and similar.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface VideoSourceConfig {
  id: string;
  mapId: string;
  urls: string[];
  coordinates: number[][];
}

interface VideoSourceHookState {
  config: VideoSourceConfig;
}

export const VideoSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on video source element');
        return;
      }

      const config: VideoSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for video source "${config.id}"`);
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
            type: 'video',
            urls: config.urls,
            coordinates: config.coordinates
          };

          // Add the source to the map
          map.addSource(config.id, sourceSpec);

          // Guardar estado
          (this as any)._maplibrex_video_source = {
            config
          };

          // Emitir evento de source agregado
          this.pushEvent('source:added', { source_id: config.id });

          logger.debug(`[MaplibreX] Video source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding video source "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting video source:', error);
    }
  },

  destroyed(this: any) {
    const state: VideoSourceHookState | undefined = (this as any)._maplibrex_video_source;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remove the source if present
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent('source:removed', { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }

      logger.debug(`[MaplibreX] Video source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying video source:', error);
    }
  }
};
