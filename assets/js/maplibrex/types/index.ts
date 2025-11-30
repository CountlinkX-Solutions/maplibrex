/**
 * MaplibreX Type Definitions
 * 
 * Comprehensive type definitions for MapLibre GL JS integration with Phoenix LiveView
 */

import type { Map } from 'maplibre-gl';

/**
 * Phoenix LiveView Hook interface
 */
export interface LiveViewHook {
  mounted(this: HookContext): void;
  updated?(this: HookContext): void;
  destroyed?(this: HookContext): void;
  disconnected?(this: HookContext): void;
  reconnected?(this: HookContext): void;
}

/**
 * Context available within LiveView hooks
 */
export interface HookContext {
  el: HTMLElement;
  pushEvent(event: string, payload: Record<string, any>, callback?: () => void): void;
  pushEventTo(selector: string, event: string, payload: Record<string, any>, callback?: () => void): void;
  handleEvent(event: string, callback: (payload: any) => void): void;
  upload(name: string, files: FileList): void;
  uploadTo(selector: string, name: string, files: FileList): void;
}

/**
 * Base configuration for MaplibreX components
 */
export interface MaplibreXConfig {
  id: string;
  mapId?: string;
  debug?: boolean;
}

/**
 * Map component configuration
 */
export interface MapConfig extends MaplibreXConfig {
  center: [number, number];
  zoom: number;
  style: string | object;
  minZoom?: number;
  maxZoom?: number;
  bearing?: number;
  pitch?: number;
  bounds?: [[number, number], [number, number]];
  maxBounds?: [[number, number], [number, number]];
  controls?: string[];
  interactive?: boolean;
  attributionControl?: boolean;
}

/**
 * Marker configuration
 */
export interface MarkerConfig extends MaplibreXConfig {
  lngLat: [number, number];
  color?: string;
  scale?: number;
  rotation?: number;
  draggable?: boolean;
  pitchAlignment?: 'map' | 'viewport' | 'auto';
  rotationAlignment?: 'map' | 'viewport' | 'auto';
  popup?: PopupConfig;
  offset?: [number, number];
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Popup configuration
 */
export interface PopupConfig extends MaplibreXConfig {
  lngLat?: [number, number];
  text?: string;
  html?: string;
  maxWidth?: string;
  closeButton?: boolean;
  closeOnClick?: boolean;
  closeOnMove?: boolean;
  offset?: number | [number, number];
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'auto';
  className?: string;
  open?: boolean;
}

/**
 * Layer configuration
 */
export interface LayerConfig extends MaplibreXConfig {
  type: 'fill' | 'line' | 'symbol' | 'circle' | 'heatmap' | 'fill-extrusion' | 'raster' | 'hillshade' | 'background';
  sourceId: string;
  sourceLayer?: string;
  paint?: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
  minzoom?: number;
  maxzoom?: number;
  beforeId?: string;
}

/**
 * GeoJSON Source configuration
 */
export interface GeoJSONSourceConfig extends MaplibreXConfig {
  data: GeoJSON.GeoJSON | string;
  maxzoom?: number;
  attribution?: string;
  buffer?: number;
  tolerance?: number;
  cluster?: boolean;
  clusterRadius?: number;
  clusterMaxZoom?: number;
  clusterMinPoints?: number;
  clusterProperties?: Record<string, any>;
  lineMetrics?: boolean;
  generateId?: boolean;
}

/**
 * Control configuration
 */
export interface ControlConfig extends MaplibreXConfig {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Navigation Control configuration
 */
export interface NavigationControlConfig extends ControlConfig {
  showCompass?: boolean;
  showZoom?: boolean;
  visualizePitch?: boolean;
}

/**
 * Scale Control configuration
 */
export interface ScaleControlConfig extends ControlConfig {
  maxWidth?: number;
  unit?: 'imperial' | 'metric' | 'nautical';
}

/**
 * Fullscreen Control configuration
 */
export interface FullscreenControlConfig extends ControlConfig {
  container?: HTMLElement;
}

/**
 * Geolocate Control configuration
 */
export interface GeolocateControlConfig extends ControlConfig {
  positionOptions?: PositionOptions;
  fitBoundsOptions?: {
    maxZoom?: number;
    padding?: number | { top: number; bottom: number; left: number; right: number };
  };
  trackUserLocation?: boolean;
  showAccuracyCircle?: boolean;
  showUserLocation?: boolean;
  showUserHeading?: boolean;
}

/**
 * Map event payload sent to LiveView
 */
export interface MapEventPayload {
  mapId: string;
  type: string;
  [key: string]: any;
}

/**
 * Map move event payload
 */
export interface MapMoveEventPayload extends MapEventPayload {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

/**
 * Map click event payload
 */
export interface MapClickEventPayload extends MapEventPayload {
  lngLat: [number, number];
  point: [number, number];
}

/**
 * Marker drag event payload
 */
export interface MarkerDragEventPayload extends MapEventPayload {
  markerId: string;
  lngLat: [number, number];
}

/**
 * Utility types
 */
export type Position = [number, number];
export type Bounds = [[number, number], [number, number]];
export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

/**
 * Map instance registry
 */
export interface MapRegistry {
  [mapId: string]: Map;
}

/**
 * Component registry for tracking markers, popups, etc.
 */
export interface ComponentRegistry<T = any> {
  [componentId: string]: T;
}

/**
 * Event handler type
 */
export type EventHandler<T = any> = (payload: T) => void;

/**
 * Cleanup function type
 */
export type CleanupFn = () => void;
