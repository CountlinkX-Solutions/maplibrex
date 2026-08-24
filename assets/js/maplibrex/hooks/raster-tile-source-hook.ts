/**
 * RasterTileSourceHook - Hook for the RasterTileSource component
 * 
 * This hook manages a raster tile source in MapLibre GL JS,
 * used for satellite imagery, terrain and other raster overlays.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface RasterTileSourceConfig {
  id: string;
  mapId: string;
  url?: string;
  tiles?: string[];
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  bounds?: number[];
  scheme?: string;
  tms?: boolean;
  volatile?: boolean;
}

interface RasterTileSourceHookState {
  config: RasterTileSourceConfig;
  dataHandler?: (e: any) => void;
  errorHandler?: (e: any) => void;
}

export const RasterTileSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on raster tile source element');
        return;
      }

      const config: RasterTileSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster tile source "${config.id}"`);
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
            type: 'raster'
          };

          // Agregar propiedades opcionales
          if (config.url) {
            sourceSpec.url = config.url;
          }

          if (config.tiles) {
            sourceSpec.tiles = config.tiles;
          }

          if (config.tileSize !== undefined) {
            sourceSpec.tileSize = config.tileSize;
          }

          if (config.minzoom !== undefined) {
            sourceSpec.minzoom = config.minzoom;
          }

          if (config.maxzoom !== undefined) {
            sourceSpec.maxzoom = config.maxzoom;
          }

          if (config.attribution) {
            sourceSpec.attribution = config.attribution;
          }

          if (config.bounds) {
            sourceSpec.bounds = config.bounds;
          }

          if (config.scheme) {
            sourceSpec.scheme = config.scheme;
          }

          if (config.tms !== undefined) {
            sourceSpec.tms = config.tms;
          }

          if (config.volatile !== undefined) {
            sourceSpec.volatile = config.volatile;
          }

          // Add the source to the map
          map.addSource(config.id, sourceSpec);

          // Wire up the source's event handlers
          const dataHandler = (e: any) => {
            if (e.sourceId === config.id) {
              this.pushEvent('source:data', {
                source_id: config.id,
                data_type: e.dataType,
                source_data_type: e.sourceDataType,
                tile: e.tile ? {
                  coord: e.tile.tileID.canonical,
                  isSourceLoaded: e.isSourceLoaded
                } : undefined
              });
            }
          };

          const errorHandler = (e: any) => {
            if (e.sourceId === config.id) {
              this.pushEvent('source:error', {
                source_id: config.id,
                error: e.error ? e.error.message : 'Unknown error',
                tile: e.tile
              });
            }
          };

          // Registrar event listeners
          map.on('sourcedata', dataHandler);
          map.on('sourcedataloading', dataHandler);
          map.on('error', errorHandler);

          // Guardar estado
          (this as any)._maplibrex_raster_tile_source = {
            config,
            dataHandler,
            errorHandler
          };

          // Emitir evento de source agregado
          this.pushEvent('source:added', { source_id: config.id });

          logger.debug(`[MaplibreX] Raster tile source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding raster tile source "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting raster tile source:', error);
    }
  },

  destroyed(this: any) {
    const state: RasterTileSourceHookState | undefined = (this as any)._maplibrex_raster_tile_source;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remover event listeners
        if (state.dataHandler) {
          map.off('sourcedata', state.dataHandler);
          map.off('sourcedataloading', state.dataHandler);
        }
        if (state.errorHandler) {
          map.off('error', state.errorHandler);
        }

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

      logger.debug(`[MaplibreX] Raster tile source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying raster tile source:', error);
    }
  }
};
