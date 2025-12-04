/**
 * MapHook - Hook principal para el componente Map
 * 
 * Este hook es el punto de entrada principal para integrar MapLibre con LiveView.
 * Gestiona el ciclo de vida completo del mapa: creación, actualización y destrucción.
 */

import maplibregl from 'maplibre-gl';
import type { LiveViewHook, MapConfig } from '../types';
import { MapManager } from '../core/map-manager';
import { createEventDispatcher } from '../core/event-dispatcher';

interface MapHookState {
  map: maplibregl.Map;
  dispatcher: ReturnType<typeof createEventDispatcher>;
  config: MapConfig;
  cleanup?: () => void;
}

export const MapHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      // Obtener configuración del elemento
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on map element');
        return;
      }

      const config: MapConfig = JSON.parse(configStr);
      const mapId = config.id;

      // Crear instancia del mapa
      const map = new maplibregl.Map({
        container: el,
        center: config.center,
        zoom: config.zoom,
        style: config.style as any,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        bearing: config.bearing || 0,
        pitch: config.pitch || 0,
        bounds: config.bounds as any,
        maxBounds: config.maxBounds as any,
        interactive: config.interactive !== false,
        attributionControl: config.attributionControl !== false ? {} as any : false
      });

      // Registrar mapa en el manager
      MapManager.register(mapId, map);
      MapManager.setDebug(config.debug || false);

      // Crear event dispatcher
      const dispatcher = createEventDispatcher(this, map, mapId, true);

      // Guardar estado en el hook
      (this as any)._maplibrex = {
        map,
        dispatcher,
        config
      };

      // Agregar event listeners para comandos JS
      el.addEventListener('maplibrex:fly_to', ((e: CustomEvent) => {
        const { center, zoom, duration, bearing, pitch } = e.detail;
        map.flyTo({
          center: center as [number, number],
          zoom: zoom,
          duration: duration || 1000,
          ...(bearing !== undefined && { bearing }),
          ...(pitch !== undefined && { pitch }),
          essential: true
        });
      }) as EventListener);

      el.addEventListener('maplibrex:jump_to', ((e: CustomEvent) => {
        const { center, zoom, bearing, pitch } = e.detail;
        map.jumpTo({
          center: center as [number, number],
          zoom: zoom,
          ...(bearing !== undefined && { bearing }),
          ...(pitch !== undefined && { pitch })
        });
      }) as EventListener);

      el.addEventListener('maplibrex:fit_bounds', ((e: CustomEvent) => {
        const { bounds, padding, duration, maxZoom } = e.detail;
        map.fitBounds(bounds as [[number, number], [number, number]], {
          padding: padding || 50,
          duration: duration || 1000,
          ...(maxZoom !== undefined && { maxZoom }),
          essential: true
        });
      }) as EventListener);

      el.addEventListener('maplibrex:set_style', ((e: CustomEvent) => {
        const { style } = e.detail;
        map.setStyle(style);
      }) as EventListener);

      el.addEventListener('maplibrex:zoom_in', () => {
        map.zoomIn({ duration: 300 });
      });

      el.addEventListener('maplibrex:zoom_out', () => {
        map.zoomOut({ duration: 300 });
      });

      el.addEventListener('maplibrex:reset_north', () => {
        map.resetNorth({ duration: 300 });
      });

      // Notificar que el mapa está listo
      map.once('load', () => {
        console.log(`[MaplibreX] Map "${mapId}" loaded and ready`);
      });

      // Manejar errores
      map.on('error', (e) => {
        console.error(`[MaplibreX] Map error:`, e);
      });

    } catch (error) {
      console.error('[MaplibreX] Error mounting map:', error);
    }
  },

  updated(this: any) {
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (!state) return;

    try {
      const el = this.el as HTMLElement;
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: MapConfig = JSON.parse(configStr);
      const oldConfig: MapConfig = state.config;

      // Actualizar centro si cambió
      if (
        newConfig.center[0] !== oldConfig.center[0] ||
        newConfig.center[1] !== oldConfig.center[1]
      ) {
        state.map.setCenter(newConfig.center);
      }

      // Actualizar zoom si cambió
      if (newConfig.zoom !== oldConfig.zoom) {
        state.map.setZoom(newConfig.zoom);
      }

      // Actualizar bearing si cambió
      if (newConfig.bearing !== undefined && newConfig.bearing !== oldConfig.bearing) {
        state.map.setBearing(newConfig.bearing);
      }

      // Actualizar pitch si cambió
      if (newConfig.pitch !== undefined && newConfig.pitch !== oldConfig.pitch) {
        state.map.setPitch(newConfig.pitch);
      }

      // Actualizar estilo si cambió
      if (newConfig.style !== oldConfig.style) {
        state.map.setStyle(newConfig.style as any);
      }

      // Actualizar configuración guardada
      (state as any).config = newConfig;

    } catch (error) {
      console.error('[MaplibreX] Error updating map:', error);
    }
  },

  destroyed(this: any) {
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (!state) return;

    try {
      const mapId = state.config.id;

      // Limpiar event dispatcher
      state.dispatcher.cleanup();

      // Remover el mapa
      if (state.map && typeof state.map.remove === 'function') {
        state.map.remove();
      }

      // Desregistrar del manager
      MapManager.unregister(mapId);

      console.log(`[MaplibreX] Map "${mapId}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying map:', error);
    }
  },

  disconnected(this: any) {
    // Cuando se desconecta temporalmente (como durante un live navigation)
    console.log('[MaplibreX] Map disconnected (temporary)');
  },

  reconnected(this: any) {
    // Cuando se reconecta después de una desconexión temporal
    const state: MapHookState | undefined = (this as any)._maplibrex;
    if (state && state.map) {
      // Resize map por si el contenedor cambió de tamaño
      state.map.resize();
      console.log('[MaplibreX] Map reconnected');
    }
  }
};
