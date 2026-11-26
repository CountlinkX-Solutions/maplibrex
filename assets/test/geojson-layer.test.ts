/**
 * GeoJSONLayerHook keeps a GeoJSON source (`<id>-source`) and a layer drawing
 * it. It shares the source and layer lifecycle of the other components (#17,
 * #12, #3, #4, #18) and keeps what is its own: `setData` for new data, the
 * server commands, its click and hover payloads and `layer:source_loaded`
 * (#20).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { GeoJSONLayerHook } from '../js/maplibrex/hooks';
import { FakeMap } from './mocks/maplibre-gl';
import { type MountedHook, mountHook, registerMap, renderLiveView, resetEnvironment } from './helpers';

const ID = 'points';
const SOURCE_ID = 'points-source';
const IDS = { layer_id: ID, layerId: ID };
const STYLEDATA = { type: 'styledata', dataType: 'style' };

const EMPTY = { type: 'FeatureCollection', features: [] };
const feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } };
const DATA = { type: 'FeatureCollection', features: [feature] };
const clickEvent = { features: [feature], lngLat: { toArray: () => [1, 2] }, point: { x: 3, y: 4 } };

const config = {
  id: ID,
  mapId: 'map',
  source: { type: 'geojson', data: EMPTY },
  layer: { id: ID, type: 'circle', source: SOURCE_ID }
};

interface Options {
  data?: unknown;
  type?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  beforeId?: string | null;
  cluster?: Record<string, unknown>;
}

/** The `data-config` the geojson_layer component renders (paint and layout always set, nil assigns left out). */
function configWith(options: Options = {}): Record<string, unknown> {
  const layer: Record<string, unknown> = {
    id: ID,
    type: options.type ?? 'circle',
    source: SOURCE_ID,
    paint: options.paint ?? { 'circle-radius': 6, 'circle-color': '#e55e5e' },
    layout: options.layout ?? {}
  };
  if (options.filter !== undefined) layer.filter = options.filter;
  if (options.minzoom !== undefined) layer.minzoom = options.minzoom;
  if (options.maxzoom !== undefined) layer.maxzoom = options.maxzoom;
  return {
    id: ID,
    mapId: 'map',
    source: { type: 'geojson', data: options.data ?? EMPTY, generateId: false, ...options.cluster },
    layer,
    beforeId: options.beforeId ?? null
  };
}

const CLUSTERED = { cluster: true, clusterMaxZoom: 14, clusterRadius: 50 };

function register(map = new FakeMap()): FakeMap {
  MapManager.register('map', map as never);
  return map;
}

/** The names of the events the hook pushed, in order. */
function pushed(m: MountedHook): string[] {
  return m.hook.pushEvent.mock.calls.map(([name]: [string]) => name);
}

let warn: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvironment();
});

describe('GeoJSONLayerHook', () => {
  it('removes its click, mouseenter and mouseleave listeners when destroyed (#6)', () => {
    const map = registerMap('map');
    const m = mountHook(GeoJSONLayerHook, config);

    expect(map.listenerCount('click', 'points')).toBe(1);
    expect(map.listenerCount('mouseenter', 'points')).toBe(1);
    expect(map.listenerCount('mouseleave', 'points')).toBe(1);

    m.destroy();

    expect(map.listenerCount('click', 'points')).toBe(0);
    expect(map.listenerCount('mouseenter', 'points')).toBe(0);
    expect(map.listenerCount('mouseleave', 'points')).toBe(0);
  });

  it('pushes one feature_clicked per click after being mounted again (#6)', () => {
    const map = registerMap('map');
    mountHook(GeoJSONLayerHook, config).destroy();
    const second = mountHook(GeoJSONLayerHook, config);

    map.emit('click', 'points', clickEvent);

    const clicks = second.hook.pushEvent.mock.calls.filter(
      ([name]: [string]) => name === 'layer:feature_clicked'
    );
    expect(clicks).toHaveLength(1);
    expect(map.listenerCount('click', 'points')).toBe(1);
  });

  // Until 0.2.0 this test stubbed isStyleLoaded() to false on a loaded style
  // and fired `load`; the hook now adds its source and layer whenever the
  // style document has loaded (#12), so "before the style has loaded" is a
  // map whose style document is still loading.
  it('does not add anything when destroyed before the style has loaded', () => {
    const map = registerMap('map', undefined, { loaded: false });
    const m = mountHook(GeoJSONLayerHook, config);

    m.destroy();
    map.finishStyleLoad();

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual([]);
  });
});

describe('a geojson layer mounted before its map is registered (#17)', () => {
  it('adds its source and layer once the map registers', () => {
    const m = mountHook(GeoJSONLayerHook, configWith({ data: DATA }));

    const map = register();

    expect(map.getSource(SOURCE_ID).serialize()).toEqual({ type: 'geojson', data: DATA, generateId: false });
    expect(map.getLayer(ID)).toEqual({
      id: ID, type: 'circle', source: SOURCE_ID, paint: { 'circle-radius': 6, 'circle-color': '#e55e5e' }, layout: {}
    });
    expect(map.listenerCount('click', ID)).toBe(1);
    expect(pushed(m)).toEqual(['layer:source_loaded']);
  });

  it('destroyed before the map registers leaves nothing behind', () => {
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.destroy();

    const map = register();

    expect(map.getSource(SOURCE_ID)).toBeUndefined();
    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });
});

describe('a geojson layer is added as soon as the style can accept it (#12)', () => {
  it('mounted after load while tiles are loading is added right away', () => {
    const map = register();
    map.setTilesLoading(true);

    mountHook(GeoJSONLayerHook, configWith());

    expect(map.getSource(SOURCE_ID)).toBeDefined();
    expect(map.getLayer(ID)).toMatchObject({ type: 'circle', source: SOURCE_ID });
  });

  it('mounted while the style document loads is added when it arrives', () => {
    const map = register(new FakeMap(undefined, { loaded: false }));
    mountHook(GeoJSONLayerHook, configWith());

    map.finishStyleLoad();

    expect(map.getSource(SOURCE_ID)).toBeDefined();
    expect(map.getLayer(ID)).toMatchObject({ type: 'circle', source: SOURCE_ID });
  });
});

describe('updated() applies the new config (#3)', () => {
  it('gives the source new data with setData, in place', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());
    const source = map.getSource(SOURCE_ID);

    m.update(configWith({ data: DATA }));

    expect(source.setData).toHaveBeenCalledWith(DATA);
    expect(map.getSource(SOURCE_ID)).toBe(source);
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it('changes paint and layout in place and resets removed properties', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith({ layout: { visibility: 'none' } }));

    m.update(configWith({ paint: { 'circle-radius': 9 }, layout: {} }));

    expect(map.getLayer(ID)).toMatchObject({ paint: { 'circle-radius': 9 }, layout: {} });
    expect(map.setPaintProperty).toHaveBeenCalledWith(ID, 'circle-color', undefined);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(ID, 'visibility', undefined);
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it('changes and clears the filter in place', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith({ filter: ['has', 'name'] }));

    m.update(configWith({ filter: ['==', ['get', 'kind'], 'cafe'] }));
    expect(map.getLayer(ID).filter).toEqual(['==', ['get', 'kind'], 'cafe']);

    m.update(configWith());
    expect(map.getLayer(ID).filter).toBeUndefined();
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it('applies min_zoom and max_zoom', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith({ minzoom: 2, maxzoom: 10 }));

    m.update(configWith({ minzoom: 4, maxzoom: 12 }));

    expect(map.setLayerZoomRange).toHaveBeenCalledWith(ID, 4, 12);
    expect(map.getLayer(ID)).toMatchObject({ minzoom: 4, maxzoom: 12 });
  });

  it('moves when before_id changes', () => {
    const map = register();
    map.addLayer({ id: 'a', type: 'background' });
    map.addLayer({ id: 'b', type: 'background' });
    const m = mountHook(GeoJSONLayerHook, configWith({ beforeId: 'a' }));
    expect(map.getLayersOrder()).toEqual([ID, 'a', 'b']);

    m.update(configWith({ beforeId: 'b' }));

    expect(map.getLayersOrder()).toEqual(['a', ID, 'b']);
  });

  it('is re-added with its listeners when its type changes', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());

    m.update(configWith({ type: 'heatmap', paint: { 'heatmap-radius': 20 } }));

    expect(map.getLayer(ID)).toMatchObject({ type: 'heatmap', source: SOURCE_ID, paint: { 'heatmap-radius': 20 } });
    expect(map.listenerCount('click', ID)).toBe(1);
  });

  it('changes the cluster radius and max zoom in place', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith({ cluster: CLUSTERED }));
    const source = map.getSource(SOURCE_ID);

    m.update(configWith({ cluster: { ...CLUSTERED, clusterMaxZoom: 12, clusterRadius: 80 } }));

    expect(source.setClusterOptions).toHaveBeenCalledTimes(1);
    expect(source.setClusterOptions).toHaveBeenCalledWith({ cluster: true, clusterMaxZoom: 12, clusterRadius: 80 });
    expect(map.getSource(SOURCE_ID)).toBe(source);
  });

  it.each([
    ['clustering is turned off', CLUSTERED, {}],
    ['cluster properties change', CLUSTERED, { ...CLUSTERED, clusterProperties: { sum: ['+', ['get', 'n']] } }]
  ])('replaces the source under its layer when %s', (_what, from, to) => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith({ cluster: from }));

    m.update(configWith({ cluster: to }));

    expect(map.getSource(SOURCE_ID).serialize()).toEqual({ type: 'geojson', data: EMPTY, generateId: false, ...to });
    expect(map.getLayer(ID)).toMatchObject({ type: 'circle', source: SOURCE_ID });
    expect(map.listenerCount('click', ID)).toBe(1);
  });

  it('added after an update uses the latest config', () => {
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.update(configWith({ data: DATA, paint: { 'circle-radius': 9 }, minzoom: 3 }));

    const map = register();

    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: DATA });
    expect(map.getLayer(ID)).toMatchObject({ paint: { 'circle-radius': 9 }, minzoom: 3 });
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
    expect(m.hook.pushEvent).toHaveBeenCalledTimes(1);
  });
});

describe('a geojson layer survives style changes (#4)', () => {
  it.each([
    ['a diff style change', (map: FakeMap) => map.setStyle({ version: 8, sources: {}, layers: [{ id: 'base', type: 'background' }] })],
    ['a full style rebuild', (map: FakeMap) => {
      map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
      map.finishStyleLoad();
    }]
  ])('puts its source and layer back with their current config after %s', (_what, changeStyle) => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.update(configWith({ data: DATA, paint: { 'circle-radius': 9 } }));

    changeStyle(map);

    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: DATA });
    expect(map.getLayer(ID)).toMatchObject({ type: 'circle', source: SOURCE_ID, paint: { 'circle-radius': 9 } });
    expect(map.listenerCount('click', ID)).toBe(1);
    expect(pushed(m)).toEqual(['layer:source_loaded']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does nothing on the style and source events that follow its own add', () => {
    const map = register();
    mountHook(GeoJSONLayerHook, configWith());
    const listeners = map.listenerKeys();

    for (let i = 0; i < 3; i++) {
      map.emit('styledata', STYLEDATA);
      map.emit('sourcedata', { sourceId: SOURCE_ID, isSourceLoaded: true });
    }

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.listenerKeys()).toEqual(listeners);
  });

  // What the demo's basemap switcher showed in a browser: the diff removes the
  // layer, then the old basemap's source (firing sourcedata while the layer's
  // own source is still there), then adds the new basemap's layers.
  it('is back on top of the new basemap after a basemap switch', () => {
    const basemap = (source: string, layers: string[]) => ({
      version: 8,
      sources: { [source]: { type: 'vector', url: `${source}.json` } },
      layers: layers.map((id) => ({ id, type: 'fill', source, 'source-layer': id }))
    });
    const map = register(new FakeMap(undefined, { loaded: false }));
    map.finishStyleLoad(basemap('demotiles', ['countries', 'geolines']));
    const errors = vi.fn();
    map.on('error', errors);
    mountHook(GeoJSONLayerHook, configWith());

    map.setStyle(basemap('openmaptiles', ['water', 'building', 'place']));

    expect(map.getLayersOrder()).toEqual(['water', 'building', 'place', ID]);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('server commands', () => {
  function mounted(options: Options = {}): { map: FakeMap; m: MountedHook } {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith(options));
    return { map, m };
  }

  it('sets a paint property, a layout property, the filter and the data of its own layer only', () => {
    const { map, m } = mounted();
    const other = { layer_id: 'other' };

    m.pushFromServer('layer:set_paint_property', { ...other, property: 'circle-radius', value: 20 });
    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-radius', value: 12 });
    m.pushFromServer('layer:set_layout_property', { layer_id: ID, property: 'visibility', value: 'none' });
    m.pushFromServer('layer:set_filter', { layer_id: ID, filter: ['has', 'name'] });
    m.pushFromServer('layer:set_data', { ...other, data: EMPTY });
    m.pushFromServer('layer:set_data', { layer_id: ID, data: DATA });

    expect(map.setPaintProperty).toHaveBeenCalledTimes(1);
    expect(map.setPaintProperty).toHaveBeenCalledWith(ID, 'circle-radius', 12);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(ID, 'visibility', 'none');
    expect(map.setFilter).toHaveBeenCalledWith(ID, ['has', 'name']);
    expect(map.getSource(SOURCE_ID).setData).toHaveBeenCalledTimes(1);
    expect(map.getSource(SOURCE_ID).setData).toHaveBeenCalledWith(DATA);
    expect(map.getLayer(ID)).toMatchObject({
      paint: { 'circle-radius': 12 }, layout: { visibility: 'none' }, filter: ['has', 'name']
    });
  });

  it('keeps what a command set through a re-render that does not change it', () => {
    const { map, m } = mounted();
    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-color', value: '#0000ff' });
    m.pushFromServer('layer:set_layout_property', { layer_id: ID, property: 'visibility', value: 'none' });
    m.pushFromServer('layer:set_filter', { layer_id: ID, filter: ['has', 'name'] });
    m.pushFromServer('layer:set_data', { layer_id: ID, data: DATA });

    m.update(configWith({ paint: { 'circle-radius': 9, 'circle-color': '#e55e5e' } }));

    expect(map.getLayer(ID)).toMatchObject({
      paint: { 'circle-radius': 9, 'circle-color': '#0000ff' },
      layout: { visibility: 'none' },
      filter: ['has', 'name']
    });
    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: DATA });
  });

  it('lets a re-render that changes a commanded value win', () => {
    const { map, m } = mounted({ layout: { visibility: 'visible' } });
    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-color', value: '#0000ff' });
    m.pushFromServer('layer:set_layout_property', { layer_id: ID, property: 'visibility', value: 'none' });
    m.pushFromServer('layer:set_filter', { layer_id: ID, filter: ['has', 'name'] });
    m.pushFromServer('layer:set_data', { layer_id: ID, data: DATA });

    m.update(
      configWith({
        paint: { 'circle-radius': 6, 'circle-color': '#00ff00' },
        layout: {},
        filter: ['has', 'kind'],
        data: { ...EMPTY, features: [feature, feature] }
      })
    );

    expect(map.getLayer(ID)).toMatchObject({ paint: { 'circle-color': '#00ff00' }, filter: ['has', 'kind'] });
    expect(map.getLayer(ID).layout).toEqual({});
    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: { features: [feature, feature] } });
  });

  it('keeps what commands set through a style change', () => {
    const { map, m } = mounted();
    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-color', value: '#0000ff' });
    m.pushFromServer('layer:set_layout_property', { layer_id: ID, property: 'visibility', value: 'none' });
    m.pushFromServer('layer:set_filter', { layer_id: ID, filter: ['has', 'name'] });
    m.pushFromServer('layer:set_data', { layer_id: ID, data: DATA });

    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    map.finishStyleLoad();

    expect(map.getLayer(ID)).toMatchObject({
      paint: { 'circle-color': '#0000ff' }, layout: { visibility: 'none' }, filter: ['has', 'name']
    });
    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: DATA });
  });

  it('resets a property commanded to null', () => {
    const { map, m } = mounted();

    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-color', value: null });
    m.update(configWith({ data: DATA }));

    expect(map.getLayer(ID).paint).toEqual({ 'circle-radius': 6 });
  });

  it('applies commands received before the layer is on the map once it is added', () => {
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.pushFromServer('layer:set_paint_property', { layer_id: ID, property: 'circle-color', value: '#0000ff' });
    m.pushFromServer('layer:set_data', { layer_id: ID, data: DATA });

    const map = register();

    expect(map.getLayer(ID)).toMatchObject({ paint: { 'circle-color': '#0000ff' } });
    expect(map.getSource(SOURCE_ID).serialize()).toMatchObject({ data: DATA });
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('layer:source_loaded (#20)', () => {
  const loaded = (m: MountedHook) => m.hook.pushEvent.mock.calls.filter(([name]: [string]) => name === 'layer:source_loaded');

  it('is pushed once, when its own source has loaded, whatever other sources report first', () => {
    const map = register();
    map.setTilesLoading(true);
    const m = mountHook(GeoJSONLayerHook, configWith());
    expect(loaded(m)).toEqual([]);

    map.emit('sourcedata', { sourceId: 'basemap', isSourceLoaded: true });
    map.emit('sourcedata', { sourceId: SOURCE_ID, isSourceLoaded: false });
    expect(loaded(m)).toEqual([]);

    map.emit('sourcedata', { sourceId: SOURCE_ID, isSourceLoaded: true });
    map.emit('sourcedata', { sourceId: SOURCE_ID, isSourceLoaded: true });

    expect(loaded(m)).toEqual([['layer:source_loaded', { ...IDS, sourceId: SOURCE_ID }]]);
  });

  it.each([
    ['after', false, 1],
    ['before', true, 0]
  ])('leaves no listener when the hook is destroyed %s its source has loaded', (_when, tilesLoading, pushes) => {
    const map = register();
    map.setTilesLoading(tilesLoading);
    const m = mountHook(GeoJSONLayerHook, configWith());
    expect(map.getSource(SOURCE_ID)).toBeDefined();
    expect(loaded(m)).toHaveLength(pushes);

    m.destroy();
    map.emit('sourcedata', { sourceId: SOURCE_ID, isSourceLoaded: true });

    expect(map.listenerKeys()).toEqual([]);
    expect(loaded(m)).toHaveLength(pushes);
  });
});

describe('click and hover events', () => {
  it('pushes the same payloads as before', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.hook.pushEvent.mockClear();

    map.emit('click', ID, clickEvent);
    map.emit('click', ID, { features: [], lngLat: { toArray: () => [0, 0] }, point: { x: 0, y: 0 } });
    map.emit('mouseenter', ID, clickEvent);
    expect(map.getCanvas().style.cursor).toBe('pointer');
    map.emit('mouseleave', ID, {});
    expect(map.getCanvas().style.cursor).toBe('');

    expect(m.hook.pushEvent.mock.calls).toEqual([
      ['layer:feature_clicked', { ...IDS, feature, lngLat: [1, 2], point: [3, 4] }],
      ['layer:feature_mouseenter', { ...IDS, feature }],
      ['layer:feature_mouseleave', IDS]
    ]);
  });

  it('keeps one set of listeners through style changes and re-adds', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());

    map.setStyle({ version: 8, sources: {}, layers: [] });
    m.update(configWith({ type: 'heatmap', paint: {} }));
    m.update(configWith({ cluster: CLUSTERED }));
    m.update(configWith());

    for (const type of ['click', 'mouseenter', 'mouseleave']) {
      expect(map.listenerCount(type, ID), type).toBe(1);
    }
  });
});

describe('destroyed()', () => {
  it('removes its layer, its source and every listener, and pushes nothing', () => {
    const map = register();
    const m = mountHook(GeoJSONLayerHook, configWith());
    m.hook.pushEvent.mockClear();

    m.destroy();

    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.getSource(SOURCE_ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });

  it('leaves its source until another layer using it is removed', () => {
    const map = register();
    const errors = vi.fn();
    map.on('error', errors);
    const m = mountHook(GeoJSONLayerHook, configWith());
    map.addLayer({ id: 'labels', type: 'symbol', source: SOURCE_ID });

    m.destroy();
    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.getSource(SOURCE_ID)).toBeDefined();

    map.removeLayer('labels');
    map.emit('styledata', STYLEDATA);

    expect(map.getSource(SOURCE_ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual(['error']);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('a geojson layer in a LiveView', () => {
  const attr = (value: unknown) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const MAP = '<div id="map" phx-hook="MapHook" phx-update="ignore"></div>';
  const layer = (options: Options = {}) =>
    `<div id="${ID}" phx-hook="GeoJSONLayerHook" data-config="${attr(configWith(options))}" style="display: none;"></div>`;
  const fakeMap = () => MapManager.get('map') as unknown as FakeMap;

  it('is added when rendered before its map, follows re-renders and is removed with its element', () => {
    const lv = renderLiveView(layer() + MAP);
    const map = fakeMap();
    expect(map.getLayer(ID)).toMatchObject({ type: 'circle', source: SOURCE_ID });

    lv.render(layer({ data: DATA, paint: { 'circle-radius': 9 }, minzoom: 5 }) + MAP);

    expect(map.getSource(SOURCE_ID).setData).toHaveBeenCalledWith(DATA);
    expect(map.getLayer(ID)).toMatchObject({ paint: { 'circle-radius': 9 }, minzoom: 5 });
    expect(map.addLayer).toHaveBeenCalledTimes(1);

    lv.render(MAP);

    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.getSource(SOURCE_ID)).toBeUndefined();
    expect(lv.pushes).toEqual([['layer:source_loaded', { ...IDS, sourceId: SOURCE_ID }]]);
  });
});
