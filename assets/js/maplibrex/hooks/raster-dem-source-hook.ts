/**
 * RasterDEMSourceHook - Hook para el componente RasterDEMSource
 * 
 * Este hook gestiona una fuente de DEM (Digital Elevation Model) en MapLibre GL JS,
 * utilizada para datos de elevación del terreno, hillshading y renderizado 3D.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface RasterDEMSourceConfig {
  id: string;
  mapId: string;
  url?: string;
  tiles?: string[];
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  bounds?: number[];
  encoding?: string;
  volatile?: boolean;
}

interface RasterDEMSourceHookState {
  config: RasterDEMSourceConfig;
  dataHandler?: (e: any) => void;
  errorHandler?: (e: any) => void;
}

export const RasterDEMSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on raster DEM source element');
        return;
      }

      const config: RasterDEMSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster DEM source "${config.id}"`);
        return;
      }

      // Esperar a que el mapa esté completamente cargado
      const addSource = () => {
        try {
          // Verificar que el source no existe ya
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }

          // Construir especificación del source
          const sourceSpec: any = {
            type: 'raster-dem'
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

          if (config.encoding) {
            sourceSpec.encoding = config.encoding;
          }

          if (config.volatile !== undefined) {
            sourceSpec.volatile = config.volatile;
          }

          // Agregar el source al mapa
          map.addSource(config.id, sourceSpec);

          // Configurar event handlers para el source
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
          (this as any)._maplibrex_raster_dem_source = {
            config,
            dataHandler,
            errorHandler
          };

          // Emitir evento de source agregado
          this.pushEvent('source:added', { source_id: config.id });

          console.log(`[MaplibreX] Raster DEM source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding raster DEM source "${config.id}":`, error);
          this.pushEvent('source:error', {
            source_id: config.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      };

      // Si el mapa ya está cargado, agregar el source inmediatamente
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        // Esperar a que el estilo se cargue
        map.once('load', addSource);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting raster DEM source:', error);
    }
  },

  destroyed(this: any) {
    const state: RasterDEMSourceHookState | undefined = (this as any)._maplibrex_raster_dem_source;
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

        // Remover el source si existe
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent('source:removed', { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }

      console.log(`[MaplibreX] Raster DEM source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying raster DEM source:', error);
    }
  }
};
