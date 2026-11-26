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
import { type Camera, CameraReports } from './camera-reports';
import { type PushOutcome, push, settle } from './push';

/** The map event names MapLibre accepts. */
type MapEventName = keyof MapEventType;

/**
 * The options that were actually sent. MapLibre treats a key that is present
 * as set, so `{ bearing: undefined }` would rotate the map to NaN.
 */
function given<T extends Record<string, unknown>>(options: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

export class EventDispatcher {
  private hook: HookContext;
  private map: MapLibreMap;
  private mapId: string;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private mapEventListeners: Map<string, any> = new Map();
  /** The camera values `map:moved` and `map:zoom_changed` sent that the server has not answered yet (#49). */
  readonly cameraReports = new CameraReports();

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

      this.reportCamera('map:moved', payload, {
        center: payload.center,
        zoom: payload.zoom,
        bearing: payload.bearing,
        pitch: payload.pitch
      });
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
      const zoom = this.map.getZoom();
      const payload: MapEventPayload = {
        mapId: this.mapId,
        type: 'zoomend',
        zoom
      };

      this.reportCamera('map:zoom_changed', payload, { zoom });
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
    this.onMapCommand('map:fly_to', (payload: any) => {
      const { center, zoom, duration, bearing, pitch } = payload;
      
      this.map.flyTo({
        ...given({ center, zoom, bearing, pitch }),
        duration: duration || 1000,
        essential: true
      });
    });

    // Jump straight to a location, no animation
    this.onMapCommand('map:jump_to', (payload: any) => {
      const { center, zoom, bearing, pitch } = payload;
      
      this.map.jumpTo(given({ center, zoom, bearing, pitch }));
    });

    // Fit the map to bounds
    this.onMapCommand('map:fit_bounds', (payload: any) => {
      const { bounds, padding, maxZoom, duration } = payload;
      
      this.map.fitBounds(bounds, {
        ...given({ maxZoom }),
        padding: padding || 50,
        duration: duration || 1000
      });
    });

    // Update the map style
    this.onMapCommand('map:set_style', (payload: any) => {
      const { style } = payload;
      this.map.setStyle(style);
    });

    // Change the bearing
    this.onMapCommand('map:set_bearing', (payload: any) => {
      const { bearing, duration } = payload;
      this.map.rotateTo(bearing, { duration: duration || 1000 });
    });

    // Change the pitch
    this.onMapCommand('map:set_pitch', (payload: any) => {
      const { pitch } = payload;
      this.map.setPitch(pitch);
    });

    // Reset to north
    this.onMapCommand('map:reset_north', () => {
      this.map.resetNorth();
    });

    // Zoom in/out
    this.onMapCommand('map:zoom_in', () => {
      this.map.zoomIn();
    });

    this.onMapCommand('map:zoom_out', () => {
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
   * Subscribe to a server-pushed map command.
   *
   * The payload may carry an optional `id`. When present and different from
   * this map's id the command is meant for another map and is ignored; when
   * absent the command applies to every map, as before.
   */
  private onMapCommand(event: string, handler: EventHandler): void {
    this.onLiveViewEvent(event, (payload: any) => {
      const target = payload?.id;
      if (target !== undefined && target !== null && target !== this.mapId) {
        return;
      }
      handler(payload);
    });
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
   * Push an event to LiveView, through `push` (core/push.ts): only if the
   * map's `events` list, when it has one, names it, and dropped quietly if it
   * cannot be delivered. With `callback` it is a request, always sent.
   */
  pushToLiveView(event: string, payload: any, callback?: () => void): PushOutcome {
    return push(this.hook, event, payload, callback);
  }

  /**
   * Push an event that tells the server where the map is, and remember the
   * camera values it sent until the server has answered, so that MapHook does
   * not apply them back to the map (#49). Nothing is remembered when nothing
   * was sent.
   */
  private reportCamera(event: string, payload: any, camera: Partial<Camera>): void {
    const outcome = this.pushToLiveView(event, payload);
    if (outcome === false) return;
    this.cameraReports.record(camera, outcome === true ? undefined : outcome);
  }

  /**
   * Push an event to a specific target selector in LiveView; dropped quietly
   * if it cannot be delivered.
   */
  pushToLiveViewTarget(selector: string, event: string, payload: any, callback?: () => void): void {
    try {
      settle(this.hook.pushEventTo(selector, event, payload, callback), event);
    } catch {
      // The view is gone: there is nobody left to tell.
    }
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
