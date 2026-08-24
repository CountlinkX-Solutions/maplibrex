/**
 * AttributionControlHook - Hook for the AttributionControl component
 * 
 * This hook manages a MapLibre GL JS attribution control,
 * showing attribution for the map and its data sources.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface AttributionControlConfig {
  id: string;
  mapId: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact: boolean;
  customAttribution: string | null;
}

interface AttributionControlHookState {
  control: maplibregl.AttributionControl;
  config: AttributionControlConfig;
}

export const AttributionControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on attribution control element');
        return;
      }

      const config: AttributionControlConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for attribution control "${config.id}"`);
        return;
      }

      // Build the control options
      const controlOptions: maplibregl.AttributionControlOptions = {
        compact: config.compact
      };

      // Add custom attribution when provided
      if (config.customAttribution) {
        controlOptions.customAttribution = config.customAttribution;
      }

      // Create the attribution control
      const control = new maplibregl.AttributionControl(controlOptions);

      // Add the control to the map at the given position
      map.addControl(control, config.position);

      // Guardar estado
      (this as any)._maplibrex_attribution = {
        control,
        config
      };

      logger.debug(`[MaplibreX] Attribution control "${config.id}" mounted on map "${mapId}"`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting attribution control:', error);
    }
  },

  destroyed(this: any) {
    const state: AttributionControlHookState | undefined = (this as any)._maplibrex_attribution;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        // Remove the control from the map
        map.removeControl(state.control);
      }

      logger.debug(`[MaplibreX] Attribution control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying attribution control:', error);
    }
  }
};
