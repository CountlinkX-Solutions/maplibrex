/**
 * SkyHook - Hook para el componente Sky
 * 
 * Este hook agrega una capa de cielo atmosférico al mapa para
 * mejorar visualizaciones 3D.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

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
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on sky element');
        return;
      }

      const config: SkyConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for sky`);
        return;
      }

      // Esperar a que el mapa esté completamente cargado
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

          console.log(`[MaplibreX] Sky layer added to map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding sky:`, error);
        }
      };

      // Si el mapa ya está cargado, agregar cielo inmediatamente
      if (map.isStyleLoaded()) {
        addSky();
      } else {
        // Esperar a que el estilo se cargue
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

      // Si la configuración cambió, actualizar el cielo
      const map = MapManager.get(newConfig.mapId);
      if (map && map.getLayer('sky')) {
        try {
          // Actualizar paint properties
          for (const [key, value] of Object.entries(newConfig.paint)) {
            map.setPaintProperty('sky', key, value);
          }

          // Actualizar estado
          state.config = newConfig;

          console.log(`[MaplibreX] Sky layer updated`);
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
        // Remover la capa de cielo
        try {
          map.removeLayer('sky');
          this.pushEvent('sky:removed', {});
          console.log(`[MaplibreX] Sky layer removed`);
        } catch (e) {
          console.warn(`[MaplibreX] Could not remove sky layer: ${e}`);
        }
      }
    } catch (error) {
      console.error('[MaplibreX] Error destroying sky:', error);
    }
  }
};
