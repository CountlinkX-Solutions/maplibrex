/**
 * EventDispatcher - Bidirectional event plumbing between MapLibre and LiveView
 * 
 * This module handles communication in both directions:
 * 1. Map events → LiveView (via pushEvent)
 * 2. LiveView events → map (via handleEvent)
 */

import type { Map as MapLibreMap, MapEventType } from 'maplibre-gl';
import type { 
  HookContext, 
  MapEventPayload, 
  MapMoveEventPayload, 
  MapClickEventPayload,
  EventHandler
} from '../types';
import { debounce } from '../utils/debounce';

/** The map event names MapLibre accepts. */
type MapEventName = keyof MapEventType;

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
   * Wires up the standard map events that get pushed to LiveView
   */
  setupDefaultMapEvents(): void {
    // Movement events, debounced (150ms)
    // Cuts LiveView round-trips during continuous pan/zoom
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

    // Click events
    this.onMapEvent('click', (e: any) => {
      const payload: MapClickEventPayload = {
        mapId: this.mapId,
        type: 'click',
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        point: [e.point.x, e.point.y]
      };

      this.pushToLiveView('map:clicked', payload);
    });

    // Load event
    this.onMapEvent('load', () => {
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'load'
      };

      this.pushToLiveView('map:loaded', payload);
    });

    // Zoom events
    this.onMapEvent('zoomend', () => {
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'zoomend',
        zoom: this.map.getZoom()
      };

      this.pushToLiveView('map:zoom_changed', payload);
    });

    // Error events
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
   * Wires up the handlers for events coming from LiveView into the map
   */
  setupLiveViewHandlers(): void {
    // Move the map to a location
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

    // Jump straight to a location, no animation
    this.onLiveViewEvent('map:jump_to', (payload: any) => {
      const { center, zoom, bearing, pitch } = payload;
      
      this.map.jumpTo({
        center: center as [number, number],
        zoom: zoom,
        bearing: bearing,
        pitch: pitch
      });
    });

    // Fit the map to bounds
    this.onLiveViewEvent('map:fit_bounds', (payload: any) => {
      const { bounds, padding, maxZoom, duration } = payload;
      
      this.map.fitBounds(bounds, {
        padding: padding || 50,
        maxZoom: maxZoom,
        duration: duration || 1000
      });
    });

    // Update the map style
    this.onLiveViewEvent('map:set_style', (payload: any) => {
      const { style } = payload;
      this.map.setStyle(style);
    });

    // Change the bearing
    this.onLiveViewEvent('map:set_bearing', (payload: any) => {
      const { bearing, duration } = payload;
      this.map.rotateTo(bearing, { duration: duration || 1000 });
    });

    // Change the pitch
    this.onLiveViewEvent('map:set_pitch', (payload: any) => {
      const { pitch } = payload;
      this.map.setPitch(pitch);
    });

    // Reset to north
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
   * Subscribe to a map event
   */
  onMapEvent(event: string, handler: (e: any) => void): void {
    // Event names arrive as plain strings from the component layer, so they
    // cannot be narrowed to MapLibre's `keyof MapEventType` at compile time.
    this.map.on(event as MapEventName, handler);
    this.mapEventListeners.set(event, handler);
  }

  /**
   * Subscribe to an event coming from LiveView
   */
  onLiveViewEvent(event: string, handler: EventHandler): void {
    this.hook.handleEvent(event, handler);
    
    // Keep a reference for cleanup
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Push an event to LiveView
   */
  pushToLiveView(event: string, payload: any, callback?: () => void): void {
    this.hook.pushEvent(event, payload, callback);
  }

  /**
   * Push an event to a specific target selector in LiveView
   */
  pushToLiveViewTarget(selector: string, event: string, payload: any, callback?: () => void): void {
    this.hook.pushEventTo(selector, event, payload, callback);
  }

  /**
   * Remove every event listener
   */
  cleanup(): void {
    // Remove the map's listeners
    this.mapEventListeners.forEach((handler, event) => {
      this.map.off(event as MapEventName, handler);
    });
    this.mapEventListeners.clear();

    // Remove the LiveView handlers
    this.eventHandlers.clear();
  }

  /**
   * Event statistics, useful when debugging
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
 * Creates a dispatcher wired with the default event set
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
