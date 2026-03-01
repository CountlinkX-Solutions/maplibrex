/**
 * VideoSourceHook - Hook para el componente VideoSource
 * 
 * Este hook gestiona una fuente de video georreferenciado en MapLibre GL JS,
 * utilizada para overlays de drones, cámaras de vigilancia, time-lapse, etc.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface VideoSourceConfig {
  id: string;
  mapId: string;
  urls: string[];
  coordinates: number[][];
}

interface VideoSourceHookState {
  config: VideoSourceConfig;
}

export const VideoSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on video source element');
        return;
      }

      const config: VideoSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for video source "${config.id}"`);
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
            type: 'video',
            urls: config.urls,
            coordinates: config.coordinates
          };

          // Agregar el source al mapa
          map.addSource(config.id, sourceSpec);

          // Guardar estado
          (this as any)._maplibrex_video_source = {
            config
          };

          // Emitir evento de source agregado
          this.pushEvent('source:added', { source_id: config.id });

          console.log(`[MaplibreX] Video source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding video source "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting video source:', error);
    }
  },

  destroyed(this: any) {
    const state: VideoSourceHookState | undefined = (this as any)._maplibrex_video_source;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
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

      console.log(`[MaplibreX] Video source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying video source:', error);
    }
  }
};
