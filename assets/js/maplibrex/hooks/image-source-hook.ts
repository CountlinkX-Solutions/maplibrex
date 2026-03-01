/**
 * ImageSourceHook - Hook para el componente ImageSource
 * 
 * Este hook gestiona una fuente de imagen georreferenciada en MapLibre GL JS,
 * utilizada para overlays de radar, mapas históricos, imágenes escaneadas, etc.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface ImageSourceConfig {
  id: string;
  mapId: string;
  url: string;
  coordinates: number[][];
}

interface ImageSourceHookState {
  config: ImageSourceConfig;
}

export const ImageSourceHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on image source element');
        return;
      }

      const config: ImageSourceConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for image source "${config.id}"`);
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
            type: 'image',
            url: config.url,
            coordinates: config.coordinates
          };

          // Agregar el source al mapa
          map.addSource(config.id, sourceSpec);

          // Guardar estado
          (this as any)._maplibrex_image_source = {
            config
          };

          // Emitir evento de source agregado (cuando la imagen se carga)
          // Nota: MapLibre carga la imagen asíncronamente
          const source = map.getSource(config.id) as any;
          if (source && source.onAdd) {
            // La imagen se cargará en background
            this.pushEvent('source:added', { source_id: config.id });
          }

          console.log(`[MaplibreX] Image source "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding image source "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting image source:', error);
    }
  },

  destroyed(this: any) {
    const state: ImageSourceHookState | undefined = (this as any)._maplibrex_image_source;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
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

      console.log(`[MaplibreX] Image source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying image source:', error);
    }
  }
};
