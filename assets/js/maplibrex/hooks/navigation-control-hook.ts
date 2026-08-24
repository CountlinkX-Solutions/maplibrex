/**
 * NavigationControlHook - Hook for the NavigationControl component
 * 
 * Manages MapLibre's native navigation controls (zoom and compass).
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, NavigationControlConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface NavigationControlHookState {
  config: NavigationControlConfig;
  map: maplibregl.Map;
  control: maplibregl.NavigationControl;
}

export const NavigationControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on navigation control element');
        return;
      }

      const config: NavigationControlConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for navigation control "${config.id}"`);
        return;
      }

      // Create navigation control with options
      const controlOptions: maplibregl.NavigationControlOptions = {
        showCompass: config.showCompass !== false,
        showZoom: config.showZoom !== false,
        visualizePitch: config.visualizePitch || false
      };

      const control = new maplibregl.NavigationControl(controlOptions);

      // Add control to map at specified position
      const position = (config.position || 'top-right') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      map.addControl(control, position);

      // Save state
      (this as any)._maplibrex_navigation_control = {
        config,
        map,
        control
      };

      logger.debug(`[MaplibreX] Navigation Control "${config.id}" added at ${position}`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting navigation control:', error);
    }
  },

  destroyed(this: any) {
    const state: NavigationControlHookState | undefined = (this as any)._maplibrex_navigation_control;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Navigation Control "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying navigation control:', error);
    }
  }
};
