/**
 * GeoJSONLayerHook - Hook for the GeoJSONLayer component
 *
 * The component owns a GeoJSON source, `<id>-source`, and a layer `<id>`
 * drawing it. The source is kept by a ManagedSource and the layer by a
 * ManagedLayer, the same machinery as the source and layer components: both
 * wait for the map and its style (#17, #12), follow `updated()` (#3), come
 * back after a style change (#4) and are removed by `destroyed()`, the source
 * once no other layer uses it (#18).
 *
 * New data goes to the source with `setData` and new cluster radius or max
 * zoom with `setClusterOptions`; any other source change (turning clustering
 * off, cluster properties, `generateId`) replaces the source under the layer.
 *
 * Server commands. `layer:set_paint_property`, `layer:set_layout_property`,
 * `layer:set_filter` and `layer:set_data` change the layer's desired state on
 * top of the rendered config, so what they set survives style changes and
 * re-renders. A commanded value holds until the rendered value of the same
 * property (the same paint or layout property, the filter, the data) changes:
 * whichever changed last wins. A `null` value resets the property to its
 * default.
 *
 * Events pushed to the server, all with both `layer_id` and `layerId`:
 * - `layer:feature_clicked`, `layer:feature_mouseenter`,
 *   `layer:feature_mouseleave`;
 * - `layer:source_loaded` (also with `sourceId`), once, the first time the
 *   layer's own source reports that it has loaded (#20).
 */

import type { HookContext, LiveViewHook } from '../types';
import { type DesiredLayer, type LayerListener, type LayerSpec, ManagedLayer } from '../core/managed-layer';
import { type InPlaceUpdate, type InPlaceUpdates, ManagedSource, type SourceSpec } from '../core/managed-source';
import { isEqual } from '../core/managed-item';
import { logger } from '../core/logger';

interface GeoJSONLayerConfig {
  id: string;
  mapId: string;
  source: {
    type: 'geojson';
    data: unknown;
    generateId?: boolean;
    cluster?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
    clusterProperties?: Record<string, unknown>;
  };
  layer: {
    id: string;
    type: string;
    source: string;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    filter?: unknown;
    minzoom?: number;
    maxzoom?: number;
    'source-layer'?: string;
  };
  beforeId?: string | null;
}

/** What server commands set, over the rendered config. A command for the filter or data is kept as `{ value }`. */
interface Commanded {
  paint: Record<string, unknown>;
  layout: Record<string, unknown>;
  filter?: { value: unknown };
  data?: { value: unknown };
}

interface GeoJSONLayerHookState {
  config: GeoJSONLayerConfig;
  commanded: Commanded;
  source: ManagedSource;
  layer: ManagedLayer;
}

interface GeoJSONLayerHookContext extends HookContext {
  _maplibrex_geojson_layer?: GeoJSONLayerHookState;
}

const CLUSTER_OPTIONS: InPlaceUpdate = {
  method: 'setClusterOptions',
  args: (spec) => [{ cluster: spec.cluster, clusterMaxZoom: spec.clusterMaxZoom, clusterRadius: spec.clusterRadius }]
};

const GEOJSON_UPDATES: InPlaceUpdates = {
  data: { method: 'setData', args: (spec) => [spec.data] },
  cluster: CLUSTER_OPTIONS,
  clusterMaxZoom: CLUSTER_OPTIONS,
  clusterRadius: CLUSTER_OPTIONS
};

const sourceIdOf = (config: GeoJSONLayerConfig) => `${config.id}-source`;

/** `rendered` with the commanded properties on top; a commanded `null` removes the property. */
function withCommanded(rendered: Record<string, unknown> | undefined, commanded: Record<string, unknown>) {
  const properties = { ...rendered };
  for (const [name, value] of Object.entries(commanded)) {
    if (value == null) {
      delete properties[name];
    } else {
      properties[name] = value;
    }
  }
  return properties;
}

function desiredSource(config: GeoJSONLayerConfig, commanded: Commanded): SourceSpec {
  const spec: SourceSpec = { ...config.source };
  if (commanded.data) spec.data = commanded.data.value;
  return spec;
}

function desiredLayer(config: GeoJSONLayerConfig, commanded: Commanded): DesiredLayer {
  const { id: _id, ...layer } = config.layer;
  const spec: LayerSpec = {
    ...layer,
    source: sourceIdOf(config),
    paint: withCommanded(layer.paint, commanded.paint),
    layout: withCommanded(layer.layout, commanded.layout)
  };
  if (commanded.filter) {
    if (commanded.filter.value == null) {
      delete spec.filter;
    } else {
      spec.filter = commanded.filter.value;
    }
  }
  return { spec, beforeId: config.beforeId ?? undefined };
}

/** Drop the commands whose property the new config renders differently: the re-render is newer. */
function dropOutdated(commanded: Commanded, previous: GeoJSONLayerConfig, next: GeoJSONLayerConfig): void {
  for (const kind of ['paint', 'layout'] as const) {
    for (const name of Object.keys(commanded[kind])) {
      if (!isEqual(previous.layer[kind]?.[name], next.layer[kind]?.[name])) delete commanded[kind][name];
    }
  }
  if (!isEqual(previous.layer.filter, next.layer.filter)) commanded.filter = undefined;
  if (!isEqual(previous.source.data, next.source.data)) commanded.data = undefined;
}

function readConfig(el: HTMLElement): GeoJSONLayerConfig | undefined {
  const config = el.dataset.config;
  return config ? JSON.parse(config) : undefined;
}

function featureListeners(hook: HookContext, layerId: string): Record<string, LayerListener> {
  const ids = { layer_id: layerId, layerId };

  return {
    click: (e) => {
      if (e.features && e.features.length > 0) {
        hook.pushEvent('layer:feature_clicked', {
          ...ids,
          feature: e.features[0],
          lngLat: e.lngLat.toArray(),
          point: [e.point.x, e.point.y]
        });
      }
    },
    mouseenter: (e, map) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        hook.pushEvent('layer:feature_mouseenter', { ...ids, feature: e.features[0] });
      }
    },
    mouseleave: (_e, map) => {
      map.getCanvas().style.cursor = '';
      hook.pushEvent('layer:feature_mouseleave', ids);
    }
  };
}

export const GeoJSONLayerHook: LiveViewHook = {
  mounted(this: GeoJSONLayerHookContext) {
    try {
      const config = readConfig(this.el);
      if (!config) {
        console.error('[MaplibreX] No config found on GeoJSON layer element');
        return;
      }

      const mapId = config.mapId || 'default';
      const layerId = config.id;
      const sourceId = sourceIdOf(config);
      const commanded: Commanded = { paint: {}, layout: {} };
      let sourceLoaded = false;

      const source = new ManagedSource(mapId, sourceId, desiredSource(config, commanded), {
        label: `GeoJSON source "${sourceId}"`,
        inPlace: GEOJSON_UPDATES,
        listeners: {
          sourcedata: (e, map) => {
            // The `sourcedata` of a removal carries the source id too.
            if (sourceLoaded || !e.isSourceLoaded || !map.getSource(sourceId)) return;
            sourceLoaded = true;
            this.pushEvent('layer:source_loaded', { layer_id: layerId, layerId, sourceId });
          }
        }
      });
      const layer = new ManagedLayer(mapId, layerId, desiredLayer(config, commanded), {
        label: `GeoJSON layer "${layerId}"`,
        listeners: featureListeners(this, layerId)
      });
      const state: GeoJSONLayerHookState = { config, commanded, source, layer };
      this._maplibrex_geojson_layer = state;

      const command = (event: string, apply: (payload: any) => void) =>
        this.handleEvent(event, (payload: any) => {
          if (payload.layer_id !== layerId || this._maplibrex_geojson_layer !== state) return;
          apply(payload);
        });
      const updateLayer = () => layer.update(desiredLayer(state.config, commanded));

      command('layer:set_paint_property', (payload) => {
        commanded.paint[payload.property] = payload.value;
        updateLayer();
      });
      command('layer:set_layout_property', (payload) => {
        commanded.layout[payload.property] = payload.value;
        updateLayer();
      });
      command('layer:set_filter', (payload) => {
        commanded.filter = { value: payload.filter };
        updateLayer();
      });
      command('layer:set_data', (payload) => {
        commanded.data = { value: payload.data };
        source.update(desiredSource(state.config, commanded));
      });

      logger.debug(`[MaplibreX] GeoJSON Layer "${layerId}" created`);
    } catch (error) {
      console.error('[MaplibreX] Error mounting GeoJSON layer:', error);
    }
  },

  updated(this: GeoJSONLayerHookContext) {
    const state = this._maplibrex_geojson_layer;
    if (!state) return;

    try {
      const config = readConfig(this.el);
      if (!config) return;

      dropOutdated(state.commanded, state.config, config);
      state.config = config;
      state.source.update(desiredSource(config, state.commanded));
      state.layer.update(desiredLayer(config, state.commanded));
    } catch (error) {
      console.error('[MaplibreX] Error updating GeoJSON layer:', error);
    }
  },

  destroyed(this: GeoJSONLayerHookContext) {
    const state = this._maplibrex_geojson_layer;
    if (!state) return;
    this._maplibrex_geojson_layer = undefined;

    try {
      // The layer first: its source cannot go while it uses it.
      state.layer.destroy();
      state.source.destroy();
      logger.debug(`[MaplibreX] GeoJSON Layer "${state.layer.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying GeoJSON layer:', error);
    }
  }
};
