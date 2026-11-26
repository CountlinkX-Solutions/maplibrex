/**
 * createLayerHook - the LiveView hook shared by the layer components with a
 * fixed layer type
 *
 * The circle, line, fill, symbol, fill-extrusion, heatmap, hillshade, raster
 * and background layer components render the same kind of `data-config`. This
 * hook turns it into a layer specification and hands it to a `ManagedLayer`
 * (core/managed-layer.ts), which keeps the layer on the map: it is added once
 * the map, its style and its source are ready, follows `updated()`, comes back
 * after a style change and is removed by `destroyed()`. A layer with its id
 * that was already on the map is taken over and left there (#46).
 *
 * Each component's hook only declares what is its own: the layer type, the
 * spec keys its component does not have, and whether and how it reports
 * clicks and hovers.
 *
 * Events pushed to the server, all with both `layer_id` and `layerId`:
 * - `layer:added`, once, the first time the layer is on the map (not again
 *   when a style change puts it back);
 * - `layer:removed`, from `destroyed()`, if `layer:added` was pushed;
 * - `layer:feature_clicked`, `layer:feature_mouseenter` and
 *   `layer:feature_mouseleave`, for layers that report clicks and hovers.
 */

import type { HookContext, LiveViewHook } from '../types';
import { type DesiredLayer, type LayerListener, type LayerSpec, ManagedLayer } from '../core/managed-layer';

/** The `data-config` of a layer component; keys whose assign is nil are left out. */
export interface LayerConfig {
  id: string;
  mapId: string;
  sourceId?: string;
  sourceLayer?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

/** A layer spec key that some layer components do not have. */
export type OptionalLayerKey = 'source' | 'sourceLayer' | 'layout' | 'filter';

export interface LayerHookDefinition {
  /** The MapLibre layer type. */
  type: string;
  /** Names the layer in console messages, e.g. "circle layer". */
  name: string;
  /** The spec keys this layer type does not take from its config. */
  without?: OptionalLayerKey[];
  /**
   * The feature part of the click and hover payloads, from the MapLibre
   * event. A layer without it reports no clicks or hovers.
   */
  featurePayload?: (event: any) => Record<string, unknown>;
}

/** Click and hover payloads carry the first feature under the pointer. */
export const firstFeature = (event: any): Record<string, unknown> => ({ feature: event.features[0] });

/** Click and hover payloads carry every feature under the pointer, and where it is. */
export const allFeaturesAndLngLat = (event: any): Record<string, unknown> => ({
  features: event.features,
  lngLat: event.lngLat
});

interface LayerHookContext extends HookContext {
  _maplibrex_layer?: ManagedLayer;
}

export function createLayerHook(definition: LayerHookDefinition): LiveViewHook {
  const without = new Set(definition.without);

  function desiredLayer(config: LayerConfig): DesiredLayer {
    const spec: LayerSpec = { type: definition.type };
    if (!without.has('source') && config.sourceId !== undefined) spec.source = config.sourceId;
    if (!without.has('sourceLayer') && config.sourceLayer) spec['source-layer'] = config.sourceLayer;
    spec.paint = config.paint || {};
    if (!without.has('layout')) spec.layout = config.layout || {};
    if (!without.has('filter') && config.filter) spec.filter = config.filter;
    if (config.minZoom != null) spec.minzoom = config.minZoom;
    if (config.maxZoom != null) spec.maxzoom = config.maxZoom;
    return { spec, beforeId: config.beforeId ?? undefined };
  }

  function readConfig(el: HTMLElement): LayerConfig | undefined {
    const config = el.dataset.config;
    return config ? JSON.parse(config) : undefined;
  }

  function featureListeners(hook: HookContext, id: string): Record<string, LayerListener> | undefined {
    const featurePayload = definition.featurePayload;
    if (!featurePayload) return undefined;
    const ids = { layer_id: id, layerId: id };

    return {
      click: (e) => {
        if (e.features && e.features.length > 0) {
          hook.pushEvent('layer:feature_clicked', { ...ids, ...featurePayload(e) });
        }
      },
      mouseenter: (e, map) => {
        if (e.features && e.features.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          hook.pushEvent('layer:feature_mouseenter', { ...ids, ...featurePayload(e) });
        }
      },
      mouseleave: (_e, map) => {
        map.getCanvas().style.cursor = '';
        hook.pushEvent('layer:feature_mouseleave', ids);
      }
    };
  }

  return {
    mounted(this: LayerHookContext) {
      try {
        const config = readConfig(this.el);
        if (!config) {
          console.error(`[MaplibreX] No config found on ${definition.name} element`);
          return;
        }

        this._maplibrex_layer = new ManagedLayer(config.mapId, config.id, desiredLayer(config), {
          label: `${definition.name} "${config.id}"`,
          onFirstAdd: () => this.pushEvent('layer:added', { layer_id: config.id, layerId: config.id }),
          listeners: featureListeners(this, config.id)
        });
      } catch (error) {
        console.error(`[MaplibreX] Error mounting ${definition.name}:`, error);
      }
    },

    updated(this: LayerHookContext) {
      const layer = this._maplibrex_layer;
      if (!layer) return;

      try {
        const config = readConfig(this.el);
        if (config) layer.update(desiredLayer(config));
      } catch (error) {
        console.error(`[MaplibreX] Error updating ${definition.name}:`, error);
      }
    },

    destroyed(this: LayerHookContext) {
      const layer = this._maplibrex_layer;
      if (!layer) return;
      this._maplibrex_layer = undefined;

      try {
        layer.destroy();
      } catch (error) {
        console.error(`[MaplibreX] Error destroying ${definition.name}:`, error);
      }
      if (layer.added) {
        this.pushEvent('layer:removed', { layer_id: layer.id, layerId: layer.id });
      }
    }
  };
}
