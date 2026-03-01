/**
 * VectorTileSourceHook - Hook para el componente VectorTileSource
 * 
 * Este hook gestiona una fuente de tiles vectoriales en MapLibre GL JS,
 * que puede ser usada por múltiples capas para renderizar datos.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface VectorTileSourceConfig {
  id: string;
  mapId: string;
  url?: string;
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  bounds?: number[];
  scheme?: string;
  promoteId?: any;
  volatile?: boolean;
}

interface VectorTileSourceHookState {
  config: VectorTileSourceConfig;
  dataHandler?: (e: any) => void;
  errorHandler?: (e: any) => void;
}

export const VectorTileSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on vector tile source element');
        return;
      }

      const config: VectorTileSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for vector tile source "${config.id}"`);
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
            type: 'vector'
          };

          // Agregar propiedades opcionales
          if (config.url) {
            sourceSpec.url = config.url;
          }

          if (config.tiles) {
            sourceSpec.tiles = config.tiles;
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

          if (config.promoteId) {
            sourceSpec.promoteId = config.promoteId;
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
          (this as any)._maplibrex_vector_tile_source = {
            config,
            dataHandler,
            errorHandler
          };

          // Emitir evento de source agregado
          this.pushEvent('source:added', { source_id: config.id });

          console.log(`[MaplibreX] Vector tile source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding vector tile source "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting vector tile source:', error);
    }
  },

  destroyed(this: any) {
    const state: VectorTileSourceHookState | undefined = (this as any)._maplibrex_vector_tile_source;
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
          // Nota: Solo podemos remover el source si no hay capas usándolo
          // MapLibre lanzará un error si intentamos remover un source en uso
          try {
            map.removeSource(state.config.id);
            this.pushEvent('source:removed', { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
            // El source probablemente está siendo usado por capas
            // Las capas deberían removerse primero
          }
        }
      }

      console.log(`[MaplibreX] Vector tile source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying vector tile source:', error);
    }
  }
};
