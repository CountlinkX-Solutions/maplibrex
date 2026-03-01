/**
 * AttributionControlHook - Hook para el componente AttributionControl
 * 
 * Este hook gestiona un control de atribución de MapLibre GL JS,
 * mostrando información de atribución del mapa y fuentes de datos.
 */

import maplibregl from 'maplibre-gl';
import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

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
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on attribution control element');
        return;
      }

      const config: AttributionControlConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for attribution control "${config.id}"`);
        return;
      }

      // Crear opciones del control
      const controlOptions: maplibregl.AttributionControlOptions = {
        compact: config.compact
      };

      // Agregar atribución personalizada si existe
      if (config.customAttribution) {
        controlOptions.customAttribution = config.customAttribution;
      }

      // Crear control de atribución
      const control = new maplibregl.AttributionControl(controlOptions);

      // Agregar control al mapa en la posición especificada
      map.addControl(control, config.position);

      // Guardar estado
      (this as any)._maplibrex_attribution = {
        control,
        config
      };

      console.log(`[MaplibreX] Attribution control "${config.id}" mounted on map "${mapId}"`);

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
        // Remover el control del mapa
        map.removeControl(state.control);
      }

      console.log(`[MaplibreX] Attribution control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying attribution control:', error);
    }
  }
};
