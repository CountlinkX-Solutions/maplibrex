/**
 * MaplibreX - MapLibre GL JS Components for Phoenix LiveView
 * 
 * @module maplibrex
 * @version 0.1.0
 * 
 * Entry point for MaplibreX. This module provides Phoenix LiveView hooks
 * for integrating MapLibre GL JS maps into your LiveView applications.
 * 
 * @example
 * ```javascript
 * // In your app.js
 * import { MapHooks } from "../deps/maplibrex/priv/static/assets/js/maplibrex"
 * 
 * let liveSocket = new LiveSocket("/live", Socket, {
 *   hooks: MapHooks,
 *   params: {_csrf_token: csrfToken}
 * })
 * ```
 */

// Import MapLibre CSS
import 'maplibre-gl/dist/maplibre-gl.css';

// Export hooks
import { MapHook, MarkerHook } from './maplibrex/hooks';

/**
 * Hooks object to be passed to LiveSocket
 * Contains all MaplibreX hooks
 */
export const MapHooks = {
  MapHook,
  MarkerHook
};

// Export individual hooks for advanced usage
export { MapHook, MarkerHook } from './maplibrex/hooks';

// Export core utilities
export { MapManager, useMap, requireMap } from './maplibrex/core/map-manager';
export { EventDispatcher, createEventDispatcher } from './maplibrex/core/event-dispatcher';

// Export types
export type {
  LiveViewHook,
  HookContext,
  MapConfig,
  MarkerConfig,
  PopupConfig,
  LayerConfig,
  GeoJSONSourceConfig,
  ControlConfig,
  NavigationControlConfig,
  ScaleControlConfig,
  FullscreenControlConfig,
  GeolocateControlConfig,
  MapEventPayload,
  MapMoveEventPayload,
  MapClickEventPayload,
  MarkerDragEventPayload,
  Position,
  Bounds
} from './maplibrex/types';

// Default export
export default MapHooks;
