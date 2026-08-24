/**
 * MapHook - Primary hook for the Map component
 * 
 * This hook is the main entry point for integrating MapLibre with LiveView.
 * It manages the full map lifecycle: creation, updates and teardown.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, MapConfig } from '../types';
import { MapManager } from '../core/map-manager';
import { createEventDispatcher } from '../core/event-dispatcher';

import { logger } from '../core/logger';

interface MapHookState {
  map: maplibregl.Map;
  dispatcher: ReturnType<typeof createEventDispatcher>;
  config: MapConfig;
  cleanup?: () => void;
}

export const MapHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      // Read the configuration off the element
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on map element');
        return;
      }

      const config: MapConfig = JSON.parse(configStr);
      const mapId = config.id;

      // Create the map instance
      const map = new maplibregl.Map({
        container: el,
        center: config.center,
        zoom: config.zoom,
        style: config.style as any,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        bearing: config.bearing || 0,
        pitch: config.pitch || 0,
        bounds: config.bounds as any,
        maxBounds: config.maxBounds as any,
        interactive: config.interactive !== false,
        attributionControl: config.attributionControl !== false ? {} as any : false
      });

      // Register the map with the manager
      MapManager.register(mapId, map);
      MapManager.setDebug(config.debug || false);

      // Create the event dispatcher
      const dispatcher = createEventDispatcher(this, map, mapId, true);

      // Stash state on the hook
      (this as any)._maplibrex = {
        map,
        dispatcher,
        config
      };

      // Listen for JS command events
      el.addEventListener('maplibrex:fly_to', ((e: CustomEvent) => {
        const { center, zoom, duration, bearing, pitch } = e.detail;
        map.flyTo({
          center: center as [number, number],
          zoom: zoom,
          duration: duration || 1000,
          ...(bearing !== undefined && { bearing }),
          ...(pitch !== undefined && { pitch }),
          essential: true
        });
      }) as EventListener);

      el.addEventListener('maplibrex:jump_to', ((e: CustomEvent) => {
        const { center, zoom, bearing, pitch } = e.detail;
        map.jumpTo({
          center: center as [number, number],
          zoom: zoom,
          ...(bearing !== undefined && { bearing }),
          ...(pitch !== undefined && { pitch })
        });
      }) as EventListener);

      el.addEventListener('maplibrex:fit_bounds', ((e: CustomEvent) => {
        const { bounds, padding, duration, maxZoom } = e.detail;
        map.fitBounds(bounds as [[number, number], [number, number]], {
          padding: padding || 50,
          duration: duration || 1000,
          ...(maxZoom !== undefined && { maxZoom }),
          essential: true
        });
      }) as EventListener);

      el.addEventListener('maplibrex:set_style', ((e: CustomEvent) => {
        const { style } = e.detail;
        map.setStyle(style);
      }) as EventListener);

      el.addEventListener('maplibrex:zoom_in', () => {
        map.zoomIn({ duration: 300 });
      });

      el.addEventListener('maplibrex:zoom_out', () => {
        map.zoomOut({ duration: 300 });
      });

      el.addEventListener('maplibrex:reset_north', () => {
        map.resetNorth({ duration: 300 });
      });

      // Report that the map is ready
      map.once('load', () => {
        logger.debug(`[MaplibreX] Map "${mapId}" loaded and ready`);
      });

      // Handle errors
      map.on('error', (e) => {
        console.error(`[MaplibreX] Map error:`, e);
      });

    } catch (error) {
      console.error('[MaplibreX] Error mounting map:', error);
    }
  },

  updated(this: any) {
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (!state) return;

    try {
      const el = this.el as HTMLElement;
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: MapConfig = JSON.parse(configStr);
      const oldConfig: MapConfig = state.config;

      // Update the centre if it changed
      if (
        newConfig.center[0] !== oldConfig.center[0] ||
        newConfig.center[1] !== oldConfig.center[1]
      ) {
        state.map.setCenter(newConfig.center);
      }

      // Update the zoom if it changed
      if (newConfig.zoom !== oldConfig.zoom) {
        state.map.setZoom(newConfig.zoom);
      }

      // Update the bearing if it changed
      if (newConfig.bearing !== undefined && newConfig.bearing !== oldConfig.bearing) {
        state.map.setBearing(newConfig.bearing);
      }

      // Update the pitch if it changed
      if (newConfig.pitch !== undefined && newConfig.pitch !== oldConfig.pitch) {
        state.map.setPitch(newConfig.pitch);
      }

      // Update the style if it changed
      if (newConfig.style !== oldConfig.style) {
        state.map.setStyle(newConfig.style as any);
      }

      // Store the new configuration
      (state as any).config = newConfig;

    } catch (error) {
      console.error('[MaplibreX] Error updating map:', error);
    }
  },

  destroyed(this: any) {
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (!state) return;

    try {
      const mapId = state.config.id;

      // Tear down the event dispatcher
      state.dispatcher.cleanup();

      // Remove the map
      if (state.map && typeof state.map.remove === 'function') {
        state.map.remove();
      }

      // Unregister from the manager
      MapManager.unregister(mapId);

      logger.debug(`[MaplibreX] Map "${mapId}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying map:', error);
    }
  },

  disconnected(this: any) {
    // Temporary disconnect, e.g. during live navigation
    logger.debug('[MaplibreX] Map disconnected (temporary)');
  },

  reconnected(this: any) {
    // Reconnected after a temporary disconnect
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (state && state.map) {
      // Resize in case the container changed size while disconnected
      state.map.resize();
      logger.debug('[MaplibreX] Map reconnected');
    }
  }
};
