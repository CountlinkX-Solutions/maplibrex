/**
 * TerrainHook - Hook for the Terrain component
 * 
 * This hook enables 3D terrain rendering in MapLibre GL JS
 * using a RasterDEMSource for elevation data.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface TerrainConfig {
  mapId: string;
  sourceId: string;
  exaggeration: number;
}

interface TerrainHookState {
  config: TerrainConfig;
}

export const TerrainHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on terrain element');
        return;
      }

      const config: TerrainConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for terrain`);
        return;
      }

      // Wait until the map is fully loaded
      const enableTerrain = () => {
        try {
          // Make sure the source exists
          const source = map.getSource(config.sourceId);
          if (!source) {
            console.error(`[MaplibreX] Source "${config.sourceId}" not found for terrain`);
            this.pushEvent('terrain:error', {
              error: `Source "${config.sourceId}" not found`
            });
            return;
          }

          // Enable terrain with the given source
          map.setTerrain({
            source: config.sourceId,
            exaggeration: config.exaggeration
          });

          // Guardar estado
          (this as any)._maplibrex_terrain = {
            config
          };

          // Emitir evento de terreno habilitado
          this.pushEvent('terrain:enabled', {
            source_id: config.sourceId,
            exaggeration: config.exaggeration
          });

          logger.debug(`[MaplibreX] Terrain enabled with source "${config.sourceId}" and exaggeration ${config.exaggeration}`);

        } catch (error) {
          console.error(`[MaplibreX] Error enabling terrain:`, error);
          this.pushEvent('terrain:error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      };

      // If the map has already loaded, enable terrain immediately
      if (map.isStyleLoaded()) {
        enableTerrain();
      } else {
        // Wait for the style to load
        map.once('load', enableTerrain);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting terrain:', error);
    }
  },

  updated(this: any) {
    const el = this.el as HTMLElement;

    try {
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: TerrainConfig = JSON.parse(configStr);
      const state: TerrainHookState | undefined = (this as any)._maplibrex_terrain;
      
      if (!state) return;

      // Update the terrain when the configuration changed
      if (
        newConfig.sourceId !== state.config.sourceId ||
        newConfig.exaggeration !== state.config.exaggeration
      ) {
        const map = MapManager.get(newConfig.mapId);
        if (map && map.isStyleLoaded()) {
          try {
            map.setTerrain({
              source: newConfig.sourceId,
              exaggeration: newConfig.exaggeration
            });

            // Actualizar estado
            state.config = newConfig;

            logger.debug(`[MaplibreX] Terrain updated: source="${newConfig.sourceId}", exaggeration=${newConfig.exaggeration}`);
          } catch (error) {
            console.error('[MaplibreX] Error updating terrain:', error);
          }
        }
      }
    } catch (error) {
      console.error('[MaplibreX] Error in terrain updated:', error);
    }
  },

  destroyed(this: any) {
    const state: TerrainHookState | undefined = (this as any)._maplibrex_terrain;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Deshabilitar terreno
        try {
          map.setTerrain(null);
          this.pushEvent('terrain:disabled', {});
          logger.debug(`[MaplibreX] Terrain disabled`);
        } catch (e) {
          console.warn(`[MaplibreX] Could not disable terrain: ${e}`);
        }
      }
    } catch (error) {
      console.error('[MaplibreX] Error destroying terrain:', error);
    }
  }
};
