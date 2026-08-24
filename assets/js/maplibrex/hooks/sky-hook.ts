/**
 * SkyHook - Hook for the Sky component
 * 
 * This hook adds an atmospheric sky layer to the map for
 * mejorar visualizaciones 3D.
 */

import type { LiveViewHook, PaintPropertyName } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface SkyConfig {
  mapId: string;
  paint: {
    [key: string]: any;
  };
}

interface SkyHookState {
  config: SkyConfig;
}

export const SkyHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on sky element');
        return;
      }

      const config: SkyConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for sky`);
        return;
      }

      // Wait until the map is fully loaded
      const addSky = () => {
        try {
          // Agregar capa de cielo
          // @ts-ignore - sky type is valid in MapLibre but not in current type definitions
          map.addLayer({
            id: 'sky',
            type: 'sky' as any,
            paint: config.paint
          });

          // Guardar estado
          (this as any)._maplibrex_sky = {
            config
          };

          // Emitir evento
          this.pushEvent('sky:added', {});

          logger.debug(`[MaplibreX] Sky layer added to map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding sky:`, error);
        }
      };

      // If the map has already loaded, add the sky immediately
      if (map.isStyleLoaded()) {
        addSky();
      } else {
        // Wait for the style to load
        map.once('load', addSky);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting sky:', error);
    }
  },

  updated(this: any) {
    const el = this.el as HTMLElement;

    try {
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: SkyConfig = JSON.parse(configStr);
      const state: SkyHookState | undefined = (this as any)._maplibrex_sky;
      
      if (!state) return;

      // Update the sky when the configuration changed
      const map = MapManager.get(newConfig.mapId);
      if (map && map.getLayer('sky')) {
        try {
          // Update paint properties
          for (const [key, value] of Object.entries(newConfig.paint)) {
            map.setPaintProperty('sky', key as PaintPropertyName, value);
          }

          // Store the new configuration
          state.config = newConfig;

          logger.debug(`[MaplibreX] Sky layer updated`);
        } catch (error) {
          console.error('[MaplibreX] Error updating sky:', error);
        }
      }
    } catch (error) {
      console.error('[MaplibreX] Error in sky updated:', error);
    }
  },

  destroyed(this: any) {
    const state: SkyHookState | undefined = (this as any)._maplibrex_sky;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map && map.getLayer('sky')) {
        // Remove the sky layer
        try {
          map.removeLayer('sky');
          this.pushEvent('sky:removed', {});
          logger.debug(`[MaplibreX] Sky layer removed`);
        } catch (e) {
          console.warn(`[MaplibreX] Could not remove sky layer: ${e}`);
        }
      }
    } catch (error) {
      console.error('[MaplibreX] Error destroying sky:', error);
    }
  }
};
