/**
 * EventDispatcher - Gestión bidireccional de eventos entre MapLibre y LiveView
 * 
 * Este módulo maneja la comunicación entre:
 * 1. Eventos del mapa → LiveView (via pushEvent)
 * 2. Eventos de LiveView → Mapa (via handleEvent)
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { 
  HookContext, 
  MapEventPayload, 
  MapMoveEventPayload, 
  MapClickEventPayload,
  EventHandler
} from '../types';
import { debounce } from '../utils/debounce';

export class EventDispatcher {
  private hook: HookContext;
  private map: MapLibreMap;
  private mapId: string;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private mapEventListeners: Map<string, any> = new Map();

  constructor(hook: HookContext, map: MapLibreMap, mapId: string) {
    this.hook = hook;
    this.map = map;
    this.mapId = mapId;
  }

  /**
   * Configura los eventos estándar del mapa que se envían a LiveView
   */
  setupDefaultMapEvents(): void {
    // Eventos de movimiento con debouncing (150ms)
    // Reduce round-trips a LiveView durante pan/zoom continuo
    const debouncedMoveEnd = debounce(() => {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing();
      const pitch = this.map.getPitch();

      const payload: MapMoveEventPayload = {
        mapId: this.mapId,
        type: 'moveend',
        center: [center.lng, center.lat],
        zoom: Math.round(zoom * 100) / 100,
        bearing: Math.round(bearing * 100) / 100,
        pitch: Math.round(pitch * 100) / 100
      };

      this.pushToLiveView('map:moved', payload);
    }, 150);
    
    this.onMapEvent('moveend', debouncedMoveEnd);

    // Eventos de click
    this.onMapEvent('click', (e: any) => {
      const payload: MapClickEventPayload = {
        mapId: this.mapId,
        type: 'click',
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        point: [e.point.x, e.point.y]
      };

      this.pushToLiveView('map:clicked', payload);
    });

    // Evento de carga
    this.onMapEvent('load', () => {
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'load'
      };

      this.pushToLiveView('map:loaded', payload);
    });

    // Eventos de zoom
    this.onMapEvent('zoomend', () => {
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'zoomend',
        zoom: this.map.getZoom()
      };

      this.pushToLiveView('map:zoom_changed', payload);
    });

    // Eventos de error
    this.onMapEvent('error', (e: any) => {
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'error',
        error: e.error?.message || 'Unknown error'
      };

      this.pushToLiveView('map:error', payload);
    });
  }

  /**
   * Configura los manejadores de eventos desde LiveView hacia el mapa
   */
  setupLiveViewHandlers(): void {
    // Mover el mapa a una ubicación
    this.onLiveViewEvent('map:fly_to', (payload: any) => {
      const { center, zoom, duration, bearing, pitch } = payload;
      
      this.map.flyTo({
        center: center as [number, number],
        zoom: zoom,
        duration: duration || 1000,
        bearing: bearing,
        pitch: pitch,
        essential: true
      });
    });

    // Saltar directamente a una ubicación (sin animación)
    this.onLiveViewEvent('map:jump_to', (payload: any) => {
      const { center, zoom, bearing, pitch } = payload;
      
      this.map.jumpTo({
        center: center as [number, number],
        zoom: zoom,
        bearing: bearing,
        pitch: pitch
      });
    });

    // Ajustar el mapa a bounds
    this.onLiveViewEvent('map:fit_bounds', (payload: any) => {
      const { bounds, padding, maxZoom, duration } = payload;
      
      this.map.fitBounds(bounds, {
        padding: padding || 50,
        maxZoom: maxZoom,
        duration: duration || 1000
      });
    });

    // Actualizar el estilo del mapa
    this.onLiveViewEvent('map:set_style', (payload: any) => {
      const { style } = payload;
      this.map.setStyle(style);
    });

    // Cambiar bearing
    this.onLiveViewEvent('map:set_bearing', (payload: any) => {
      const { bearing, duration } = payload;
      this.map.rotateTo(bearing, { duration: duration || 1000 });
    });

    // Cambiar pitch
    this.onLiveViewEvent('map:set_pitch', (payload: any) => {
      const { pitch } = payload;
      this.map.setPitch(pitch);
    });

    // Resetear norte
    this.onLiveViewEvent('map:reset_north', () => {
      this.map.resetNorth();
    });

    // Zoom in/out
    this.onLiveViewEvent('map:zoom_in', () => {
      this.map.zoomIn();
    });

    this.onLiveViewEvent('map:zoom_out', () => {
      this.map.zoomOut();
    });
  }

  /**
   * Suscribirse a un evento del mapa
   */
  onMapEvent(event: string, handler: (e: any) => void): void {
    this.map.on(event as any, handler);
    this.mapEventListeners.set(event, handler);
  }

  /**
   * Suscribirse a un evento desde LiveView
   */
  onLiveViewEvent(event: string, handler: EventHandler): void {
    this.hook.handleEvent(event, handler);
    
    // Guardar para cleanup
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Enviar un evento a LiveView
   */
  pushToLiveView(event: string, payload: any, callback?: () => void): void {
    this.hook.pushEvent(event, payload, callback);
  }

  /**
   * Enviar un evento a un selector específico en LiveView
   */
  pushToLiveViewTarget(selector: string, event: string, payload: any, callback?: () => void): void {
    this.hook.pushEventTo(selector, event, payload, callback);
  }

  /**
   * Limpiar todos los event listeners
   */
  cleanup(): void {
    // Limpiar listeners del mapa
    this.mapEventListeners.forEach((handler, event) => {
      this.map.off(event, handler);
    });
    this.mapEventListeners.clear();

    // Limpiar handlers de LiveView
    this.eventHandlers.clear();
  }

  /**
   * Obtener estadísticas de eventos (útil para debugging)
   */
  getStats(): {
    mapEventListeners: number;
    liveViewHandlers: number;
    events: string[];
  } {
    return {
      mapEventListeners: this.mapEventListeners.size,
      liveViewHandlers: Array.from(this.eventHandlers.values())
        .reduce((acc, handlers) => acc + handlers.length, 0),
      events: Array.from(this.eventHandlers.keys())
    };
  }
}

/**
 * Helper para crear un dispatcher con configuración por defecto
 */
export function createEventDispatcher(
  hook: HookContext, 
  map: MapLibreMap, 
  mapId: string,
  setupDefaults: boolean = true
): EventDispatcher {
  const dispatcher = new EventDispatcher(hook, map, mapId);
  
  if (setupDefaults) {
    dispatcher.setupDefaultMapEvents();
    dispatcher.setupLiveViewHandlers();
  }
  
  return dispatcher;
}
