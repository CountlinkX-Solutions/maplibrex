/**
 * ScaleControlHook - Hook for the ScaleControl component
 * 
 * Gestiona controles de escala nativos de MapLibre.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, ScaleControlConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ScaleControlHookState {
  config: ScaleControlConfig;
  map: maplibregl.Map;
  control: maplibregl.ScaleControl;
}

export const ScaleControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on scale control element');
        return;
      }

      const config: ScaleControlConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for scale control "${config.id}"`);
        return;
      }

      // Create scale control with options
      const controlOptions: maplibregl.ScaleControlOptions = {
        maxWidth: config.maxWidth || 100,
        unit: (config.unit || 'metric') as 'imperial' | 'metric' | 'nautical'
      };

      const control = new maplibregl.ScaleControl(controlOptions);

      // Add control to map at specified position
      const position = (config.position || 'bottom-left') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      map.addControl(control, position);

      // Save state
      (this as any)._maplibrex_scale_control = {
        config,
        map,
        control
      };

      logger.debug(`[MaplibreX] Scale Control "${config.id}" added at ${position} (${config.unit})`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting scale control:', error);
    }
  },

  destroyed(this: any) {
    const state: ScaleControlHookState | undefined = (this as any)._maplibrex_scale_control;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Scale Control "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying scale control:', error);
    }
  }
};
