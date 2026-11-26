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
import { isEqual } from '../core/managed-item';
import { CAMERA_FIELDS, type CameraField, cameraOf, sameCameraValue } from '../core/camera-reports';

import { logger } from '../core/logger';

interface MapHookState {
  map: maplibregl.Map;
  dispatcher: ReturnType<typeof createEventDispatcher>;
  config: MapConfig;
  cleanup?: () => void;
}

/**
 * Move the map to the camera values of `newConfig` that the server changed
 * since `oldConfig` (#49). A changed value is left alone when it is
 * - one the map itself reported in `map:moved` or `map:zoom_changed` and the
 *   server has not answered yet: the echo of a LiveView that keeps the
 *   camera in its assigns, which may arrive while the user is still moving
 *   the map (see core/camera-reports.ts);
 * - where the map already is, within the tolerance of `sameCameraValue`:
 *   moving it there would only fire another `map:moved`.
 * A value the server did not change is left alone too, even when the map is
 * elsewhere: a LiveView that sets only some of the camera (a zoom, say) and
 * leaves the rest to the user re-renders the others unchanged.
 */
function applyCamera(state: MapHookState, newConfig: MapConfig, oldConfig: MapConfig): void {
  const camera = cameraOf(state.map);
  const set: Record<CameraField, (value: any) => unknown> = {
    center: (center) => state.map.setCenter(center),
    zoom: (zoom) => state.map.setZoom(zoom),
    bearing: (bearing) => state.map.setBearing(bearing),
    pitch: (pitch) => state.map.setPitch(pitch)
  };

  for (const field of CAMERA_FIELDS) {
    const value = newConfig[field];
    if (value === undefined || value === null) continue;
    if (isEqual(value, oldConfig[field])) continue;
    if (state.dispatcher.cameraReports.isEcho(field, value)) continue;
    if (sameCameraValue(field, value, camera[field])) continue;
    set[field](value);
  }
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
        minPitch: config.minPitch,
        maxPitch: config.maxPitch,
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

      applyCamera(state, newConfig, oldConfig);

      // Update the style if it changed. Both configs come from JSON.parse, so
      // a style object is a new object on every update: compare by value, or
      // every update re-applies it and the style diff drops what components
      // added (#16).
      if (!isEqual(newConfig.style, oldConfig.style)) {
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
