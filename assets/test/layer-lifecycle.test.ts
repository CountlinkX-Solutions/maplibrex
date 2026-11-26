/**
 * The lifecycle shared by the nine layer hooks with a fixed type (circle, line,
 * fill, symbol, fill-extrusion, heatmap, hillshade, raster, background): when
 * the layer is added (#17, #12, #5), how assign changes reach it (#3), how it
 * comes back after a style change (#4), and what `destroyed()` leaves behind.
 *
 * The behaviour is the same for every hook, so most tests run over the table
 * below; the last group renders real LiveView patches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { ManagedSource, type SourceSpec } from '../js/maplibrex/core/managed-source';
import {
  BackgroundLayerHook,
  CircleLayerHook,
  FillExtrusionLayerHook,
  FillLayerHook,
  HeatmapLayerHook,
  HillshadeLayerHook,
  LineLayerHook,
  RasterLayerHook,
  SymbolLayerHook
} from '../js/maplibrex/hooks';
import { FakeMap, type FakeMapOptions, type StyleSpec } from './mocks/maplibre-gl';
import { type MountedHook, mountHook, renderLiveView, resetEnvironment } from './helpers';

interface LayerCase {
  hook: unknown;
  type: string;
  /** The source the layer reads from; none for a background layer. */
  source?: Record<string, unknown>;
  /** Its paint at mount, and the paint an update gives it: first key changed, second key gone. */
  paint: Record<string, unknown>;
  repaint: Record<string, unknown>;
  /** Whether its component has these attributes. */
  sourceLayer: boolean;
  layout: boolean;
  filter: boolean;
  /** How its click and hover events carry features; none for a layer without those events. */
  payload?: 'feature' | 'features';
}

const GEOJSON = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
const RASTER = { type: 'raster', tiles: ['https://tiles.example.com/{z}/{x}/{y}.png'], tileSize: 256 };
const DEM = { type: 'raster-dem', tiles: ['https://dem.example.com/{z}/{x}/{y}.png'], tileSize: 256 };

const LAYERS: [string, LayerCase][] = [
  ['CircleLayerHook', {
    hook: CircleLayerHook, type: 'circle', source: GEOJSON,
    paint: { 'circle-radius': 6, 'circle-color': '#e55e5e' }, repaint: { 'circle-radius': 9 },
    sourceLayer: true, layout: true, filter: true, payload: 'feature'
  }],
  ['LineLayerHook', {
    hook: LineLayerHook, type: 'line', source: GEOJSON,
    paint: { 'line-width': 2, 'line-color': '#3887be' }, repaint: { 'line-width': 4 },
    sourceLayer: true, layout: true, filter: true, payload: 'feature'
  }],
  ['FillLayerHook', {
    hook: FillLayerHook, type: 'fill', source: GEOJSON,
    paint: { 'fill-opacity': 0.5, 'fill-color': '#088' }, repaint: { 'fill-opacity': 0.8 },
    sourceLayer: true, layout: true, filter: true, payload: 'feature'
  }],
  ['SymbolLayerHook', {
    hook: SymbolLayerHook, type: 'symbol', source: GEOJSON,
    paint: { 'text-opacity': 1, 'text-color': '#333' }, repaint: { 'text-opacity': 0.5 },
    sourceLayer: true, layout: true, filter: true, payload: 'feature'
  }],
  ['FillExtrusionLayerHook', {
    hook: FillExtrusionLayerHook, type: 'fill-extrusion', source: GEOJSON,
    paint: { 'fill-extrusion-height': 10, 'fill-extrusion-color': '#aaa' }, repaint: { 'fill-extrusion-height': 20 },
    sourceLayer: true, layout: true, filter: true, payload: 'features'
  }],
  ['HeatmapLayerHook', {
    hook: HeatmapLayerHook, type: 'heatmap', source: GEOJSON,
    paint: { 'heatmap-radius': 20, 'heatmap-intensity': 1 }, repaint: { 'heatmap-radius': 30 },
    sourceLayer: true, layout: false, filter: true
  }],
  ['HillshadeLayerHook', {
    hook: HillshadeLayerHook, type: 'hillshade', source: DEM,
    paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#000' }, repaint: { 'hillshade-exaggeration': 0.8 },
    sourceLayer: true, layout: true, filter: false
  }],
  ['RasterLayerHook', {
    hook: RasterLayerHook, type: 'raster', source: RASTER,
    paint: { 'raster-opacity': 1, 'raster-saturation': 0.2 }, repaint: { 'raster-opacity': 0.6 },
    sourceLayer: false, layout: true, filter: false
  }],
  ['BackgroundLayerHook', {
    hook: BackgroundLayerHook, type: 'background',
    paint: { 'background-opacity': 1, 'background-color': '#f8f4f0' }, repaint: { 'background-opacity': 0.5 },
    sourceLayer: false, layout: true, filter: false
  }]
];

const WITH_SOURCE = LAYERS.filter(([, c]) => c.source);
const WITH_SOURCE_LAYER = LAYERS.filter(([, c]) => c.sourceLayer);
const WITH_LAYOUT = LAYERS.filter(([, c]) => c.layout);
const WITH_FILTER = LAYERS.filter(([, c]) => c.filter);
const INTERACTIVE = LAYERS.filter(([, c]) => c.payload);
const NOT_INTERACTIVE = LAYERS.filter(([, c]) => !c.payload);

const ID = 'lyr';
const IDS = { layer_id: ID, layerId: ID };
const STYLEDATA = { type: 'styledata', dataType: 'style' };
const HOVER_EVENTS = ['click', 'mouseenter', 'mouseleave'];

/** The `data-config` its component renders, plus `extra`. */
function configFor(c: LayerCase, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    mapId: 'map',
    ...(c.source ? { sourceId: 'src' } : {}),
    paint: c.paint,
    ...(c.layout ? { layout: {} } : {}),
    ...extra
  };
}

/** A map that already has the case's source, not registered yet. */
function mapFor(c: LayerCase, options?: FakeMapOptions): FakeMap {
  const map = new FakeMap(document.createElement('div'), options);
  if (c.source) map.addSource('src', c.source);
  return map;
}

function register(map: FakeMap): FakeMap {
  MapManager.register('map', map as never);
  return map;
}

/** A style document that has the case's source, as a basemap switch that keeps it would. */
function styleFor(c: LayerCase, layers: any[] = []): StyleSpec {
  return { version: 8, sources: c.source ? { src: c.source } : {}, layers };
}

/** What the map's copy of the layer should hold. */
function specFor(c: LayerCase, paint = c.paint): Record<string, unknown> {
  return { id: ID, type: c.type, paint, ...(c.source ? { source: 'src' } : {}) };
}

/** The names of the events the hook pushed, in order. */
function pushed(m: MountedHook): string[] {
  return m.hook.pushEvent.mock.calls.map(([name]: [string]) => name);
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvironment();
});

describe('a layer mounted before its map is registered (#17)', () => {
  it.each(LAYERS)('%s is added once the map registers', (_name, c) => {
    const m = mountHook(c.hook, configFor(c));
    expect(pushed(m)).toEqual([]);

    const map = register(mapFor(c));

    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(m.hook.pushEvent.mock.calls).toEqual([['layer:added', IDS]]);
  });

  it.each(LAYERS)('%s destroyed before the map registers leaves nothing behind', (_name, c) => {
    const m = mountHook(c.hook, configFor(c));
    m.destroy();

    const map = register(mapFor(c));

    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(pushed(m)).toEqual([]);
  });
});

describe('a layer is added as soon as the style can accept it (#12)', () => {
  it.each(LAYERS)('%s mounted after load while tiles are loading is added right away', (_name, c) => {
    const map = register(mapFor(c));
    map.setTilesLoading(true);

    const m = mountHook(c.hook, configFor(c));

    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(m.hook.pushEvent.mock.calls).toEqual([['layer:added', IDS]]);
  });

  it.each(LAYERS)('%s mounted while the style document loads is added when it arrives', (_name, c) => {
    const map = register(new FakeMap(undefined, { loaded: false }));
    const m = mountHook(c.hook, configFor(c));
    expect(map.getLayer(ID)).toBeUndefined();

    map.finishStyleLoad(styleFor(c));

    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(LAYERS)('%s destroyed before the style loads adds nothing, pushes nothing and leaves no listener', (_name, c) => {
    const map = register(new FakeMap(undefined, { loaded: false }));
    const m = mountHook(c.hook, configFor(c));

    m.destroy();
    expect(map.listenerKeys()).toEqual([]);

    map.finishStyleLoad(styleFor(c));
    expect(map.getLayer(ID)).toBeUndefined();
    expect(pushed(m)).toEqual([]);
  });
});

describe('a layer whose source is not there yet (#5)', () => {
  it.each(WITH_SOURCE)('%s is added when the source appears, after one warning and no error event', (_name, c) => {
    const map = register(new FakeMap());
    const errors = vi.fn();
    map.on('error', errors);
    const m = mountHook(c.hook, configFor(c));
    expect(map.getLayer(ID)).toBeUndefined();

    // Unrelated map activity while it waits.
    map.addSource('other', GEOJSON);
    map.emit('styledata', STYLEDATA);
    map.emit('sourcedata', { sourceId: 'other', isSourceLoaded: true });
    expect(map.getLayer(ID)).toBeUndefined();

    map.addSource('src', c.source);

    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(pushed(m)).toEqual(['layer:added']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Layer will be added when source is available'));
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(WITH_SOURCE)('%s keeps waiting for a source that appears much later, through style changes', (_name, c) => {
    const map = register(new FakeMap());
    const m = mountHook(c.hook, configFor(c));

    map.setStyle({ version: 8, sources: { other: GEOJSON }, layers: [] });
    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    map.finishStyleLoad();
    expect(map.getLayer(ID)).toBeUndefined();

    map.addSource('src', c.source);

    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(pushed(m)).toEqual(['layer:added']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(WITH_SOURCE)('%s destroyed while waiting leaves nothing behind and pushes nothing', (_name, c) => {
    const map = register(new FakeMap());
    const m = mountHook(c.hook, configFor(c));

    m.destroy();
    expect(map.listenerKeys()).toEqual([]);

    map.addSource('src', c.source);
    expect(map.getLayer(ID)).toBeUndefined();
    expect(pushed(m)).toEqual([]);
  });

  it.each(WITH_SOURCE)('%s still waiting is added at once when an update points it to an existing source', (_name, c) => {
    const map = register(new FakeMap());
    map.addSource('other', c.source);
    const m = mountHook(c.hook, configFor(c));

    m.update(configFor(c, { sourceId: 'other' }));

    expect(map.getLayer(ID)).toMatchObject({ type: c.type, source: 'other' });
    expect(pushed(m)).toEqual(['layer:added']);
  });
});

describe('updated() applies the new config (#3)', () => {
  it.each(LAYERS)('%s changes paint in place and resets a removed paint property', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    const removed = Object.keys(c.paint)[1];

    m.update(configFor(c, { paint: c.repaint }));

    expect(map.getLayer(ID).paint).toEqual(c.repaint);
    expect(map.setPaintProperty).toHaveBeenCalledWith(ID, removed, undefined);
    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalledTimes(1);
  });

  it.each(WITH_LAYOUT)('%s changes layout in place and resets a removed layout property', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c, { layout: { visibility: 'none' } }));

    m.update(configFor(c, { layout: { visibility: 'visible' } }));
    expect(map.getLayer(ID).layout).toEqual({ visibility: 'visible' });

    m.update(configFor(c, { layout: {} }));
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(ID, 'visibility', undefined);
    expect(map.getLayer(ID).layout).toEqual({});
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it.each(WITH_FILTER)('%s changes the filter in place and clears a removed filter', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c, { filter: ['==', ['get', 'kind'], 'cafe'] }));
    expect(map.getLayer(ID).filter).toEqual(['==', ['get', 'kind'], 'cafe']);

    m.update(configFor(c, { filter: ['==', ['get', 'kind'], 'bar'] }));
    expect(map.getLayer(ID).filter).toEqual(['==', ['get', 'kind'], 'bar']);

    m.update(configFor(c));
    expect(map.setFilter).toHaveBeenLastCalledWith(ID, null);
    expect(map.getLayer(ID).filter).toBeUndefined();
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it.each(LAYERS)('%s changes the zoom range in place, and re-adds the layer to clear a bound', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c, { minZoom: 2, maxZoom: 10 }));
    expect(map.getLayer(ID)).toMatchObject({ minzoom: 2, maxzoom: 10 });

    m.update(configFor(c, { minZoom: 3, maxZoom: 12 }));
    expect(map.setLayerZoomRange).toHaveBeenCalledWith(ID, 3, 12);
    expect(map.getLayer(ID)).toMatchObject({ minzoom: 3, maxzoom: 12 });
    expect(map.removeLayer).not.toHaveBeenCalled();

    // MapLibre's setLayerZoomRange cannot clear a bound.
    m.update(configFor(c, { minZoom: 3 }));
    expect(map.getLayer(ID)).toMatchObject({ ...specFor(c), minzoom: 3 });
    expect(map.getLayer(ID).maxzoom).toBeUndefined();
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(LAYERS)('%s moves when beforeId changes', (_name, c) => {
    const map = register(mapFor(c));
    map.addLayer({ id: 'a', type: 'background' });
    map.addLayer({ id: 'b', type: 'background' });
    const m = mountHook(c.hook, configFor(c, { beforeId: 'a' }));
    expect(map.getLayersOrder()).toEqual([ID, 'a', 'b']);

    m.update(configFor(c, { beforeId: 'b' }));
    expect(map.getLayersOrder()).toEqual(['a', ID, 'b']);

    m.update(configFor(c));
    expect(map.getLayersOrder()).toEqual(['a', 'b', ID]);
    expect(map.removeLayer).not.toHaveBeenCalled();
  });

  it.each(WITH_SOURCE)('%s is re-added on the new source when sourceId changes', (_name, c) => {
    const map = register(mapFor(c));
    map.addSource('src2', c.source);
    const m = mountHook(c.hook, configFor(c));

    m.update(configFor(c, { sourceId: 'src2', paint: c.repaint }));

    expect(map.getLayer(ID)).toMatchObject({ type: c.type, source: 'src2', paint: c.repaint });
    expect(map.removeLayer).toHaveBeenCalledTimes(1);
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(WITH_SOURCE_LAYER)('%s is re-added at the same place in the order when sourceLayer changes', (_name, c) => {
    const map = register(mapFor(c));
    map.addLayer({ id: 'labels', type: 'background' });
    const m = mountHook(c.hook, configFor(c, { sourceLayer: 'roads', beforeId: 'labels' }));

    m.update(configFor(c, { sourceLayer: 'rivers', beforeId: 'labels' }));

    expect(map.getLayer(ID)['source-layer']).toBe('rivers');
    expect(map.getLayersOrder()).toEqual([ID, 'labels']);
    expect(map.removeLayer).toHaveBeenCalledTimes(1);
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(LAYERS)('%s added after an update uses the latest config', (_name, c) => {
    const m = mountHook(c.hook, configFor(c));
    m.update(configFor(c, { paint: c.repaint, minZoom: 4 }));

    const map = register(mapFor(c));

    expect(map.getLayer(ID)).toMatchObject({ ...specFor(c, c.repaint), minzoom: 4 });
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
  });

  it.each(LAYERS)('%s changes nothing on the map for an update that changes nothing', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c, { minZoom: 2 }));

    m.update(configFor(c, { minZoom: 2 }));

    for (const method of ['setPaintProperty', 'setLayoutProperty', 'setFilter', 'setLayerZoomRange', 'moveLayer', 'removeLayer'] as const) {
      expect(map[method], method).not.toHaveBeenCalled();
    }
    expect(map.addLayer).toHaveBeenCalledTimes(1);
  });
});

describe('a layer survives style changes (#4)', () => {
  it.each(LAYERS)('%s is put back with its current config after a diff style change', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    m.update(configFor(c, { paint: c.repaint }));

    map.setStyle(styleFor(c, [{ id: 'base', type: 'background' }]));

    expect(map.getLayer(ID)).toMatchObject(specFor(c, c.repaint));
    expect(map.getLayersOrder()).toEqual(['base', ID]);
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(LAYERS)('%s is put back with its current config after a full style rebuild', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    m.update(configFor(c, { paint: c.repaint }));

    map.setStyle(styleFor(c), { diff: false });
    expect(map.getLayer(ID)).toBeUndefined();
    map.finishStyleLoad();

    expect(map.getLayer(ID)).toMatchObject(specFor(c, c.repaint));
    expect(pushed(m)).toEqual(['layer:added']);
  });

  it.each(LAYERS)('%s does nothing on the style and source events that follow its own add', (_name, c) => {
    const map = register(mapFor(c));
    mountHook(c.hook, configFor(c));
    const listeners = map.listenerKeys();

    // MapLibre fires styledata on the frame after every addLayer, and
    // sourcedata for every tile.
    for (let i = 0; i < 3; i++) {
      map.emit('styledata', STYLEDATA);
      map.emit('sourcedata', { sourceId: 'src', isSourceLoaded: true });
    }

    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.moveLayer).not.toHaveBeenCalled();
    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual(listeners);
  });

  it.each(LAYERS)('%s does not retry an add MapLibre refused until its config changes', (_name, c) => {
    const map = register(mapFor(c));
    // MapLibre refuses an invalid layer by firing an error event and adding nothing.
    map.addLayer.mockImplementationOnce(() => map);
    const m = mountHook(c.hook, configFor(c));

    map.emit('styledata', STYLEDATA);
    map.emit('sourcedata', { sourceId: 'src', isSourceLoaded: true });
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(pushed(m)).toEqual([]);

    m.update(configFor(c, { paint: c.repaint }));

    expect(map.getLayer(ID)).toMatchObject(specFor(c, c.repaint));
    expect(pushed(m)).toEqual(['layer:added']);
  });
});

describe('the layer order after a style change', () => {
  const BASEMAP: StyleSpec = {
    version: 8,
    sources: { base: { type: 'vector', url: 'base.json' } },
    layers: [
      { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water' },
      { id: 'building', type: 'fill', source: 'base', 'source-layer': 'building' },
      { id: 'labels', type: 'symbol', source: 'base', 'source-layer': 'place' }
    ]
  };
  const OTHER_BASEMAP: StyleSpec = {
    version: 8,
    sources: { streets: { type: 'vector', url: 'streets.json' } },
    layers: [
      { id: 'land', type: 'fill', source: 'streets', 'source-layer': 'land' },
      { id: 'building', type: 'fill', source: 'streets', 'source-layer': 'building' },
      { id: 'labels', type: 'symbol', source: 'streets', 'source-layer': 'place' }
    ]
  };

  /** A registered map showing `style`, with its `error` events collected. */
  function mapShowing(style: StyleSpec): { map: FakeMap; errors: string[] } {
    const map = register(new FakeMap(undefined, { loaded: false }));
    map.finishStyleLoad(style);
    const errors: string[] = [];
    map.on('error', (e: { error: Error }) => errors.push(e.error.message));
    return { map, errors };
  }

  // The basemap switch MapLibre diffs: it removes the layer, then the
  // basemap's source (firing sourcedata while the layer's own source is still
  // there), then the layer's source, then adds the new basemap's layers.
  it.each(WITH_SOURCE)('%s with no beforeId is back on top of the new basemap', (_name, c) => {
    const { map, errors } = mapShowing(BASEMAP);
    const source = new ManagedSource('map', 'src', c.source as SourceSpec);
    const m = mountHook(c.hook, configFor(c));
    expect(map.getLayersOrder()).toEqual(['water', 'building', 'labels', ID]);

    map.setStyle(OTHER_BASEMAP);

    expect(map.getLayersOrder()).toEqual(['land', 'building', 'labels', ID]);
    expect(map.getLayer(ID)).toMatchObject(specFor(c));
    expect(errors).toEqual([]);
    expect(pushed(m)).toEqual(['layer:added']);
    source.destroy();
  });

  it.each(WITH_SOURCE)('%s with a beforeId is back directly under that layer, without a warning', (_name, c) => {
    const { map, errors } = mapShowing(BASEMAP);
    const source = new ManagedSource('map', 'src', c.source as SourceSpec);
    mountHook(c.hook, configFor(c, { beforeId: 'building' }));
    expect(map.getLayersOrder()).toEqual(['water', ID, 'building', 'labels']);

    map.setStyle(OTHER_BASEMAP);

    expect(map.getLayersOrder()).toEqual(['land', ID, 'building', 'labels']);
    expect(errors).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    source.destroy();
  });

  /** A circle layer component with its own id and source, plus `extra` config. */
  function mountCircle(id: string, sourceId: string, extra: Record<string, unknown> = {}): MountedHook {
    return mountHook(CircleLayerHook, { id, mapId: 'map', sourceId, paint: {}, layout: {}, ...extra });
  }

  /** `BASEMAP` with the given extra sources, as a basemap switch that keeps them would be. */
  function withSources(...ids: string[]): StyleSpec {
    return { ...BASEMAP, sources: { ...BASEMAP.sources, ...Object.fromEntries(ids.map((id) => [id, GEOJSON])) } };
  }

  // "second" is mounted first but waits for its source, so it is added after
  // "first"; MapLibre calls their listeners in the order they were attached.
  it.each([
    ['a diff', (map: FakeMap) => map.setStyle(withSources('a', 'b'))],
    ['a full rebuild', (map: FakeMap) => { map.setStyle(withSources('a', 'b'), { diff: false }); map.finishStyleLoad(); }]
  ])('several layers keep the order they were first added in, after %s', (_path, change) => {
    const { map } = mapShowing(withSources('a'));
    mountCircle('second', 'b');
    mountCircle('first', 'a');
    map.addSource('b', GEOJSON);
    expect(map.getLayersOrder()).toEqual(['water', 'building', 'labels', 'first', 'second']);

    change(map);

    expect(map.getLayersOrder()).toEqual(['water', 'building', 'labels', 'first', 'second']);
  });

  it('several layers with the same beforeId keep the order they were first added in', () => {
    const { map } = mapShowing(withSources('a'));
    mountCircle('second', 'b', { beforeId: 'labels' });
    mountCircle('first', 'a', { beforeId: 'labels' });
    map.addSource('b', GEOJSON);
    expect(map.getLayersOrder()).toEqual(['water', 'building', 'first', 'second', 'labels']);

    map.setStyle(withSources('a', 'b'), { diff: false });
    map.finishStyleLoad();

    expect(map.getLayersOrder()).toEqual(['water', 'building', 'first', 'second', 'labels']);
  });

  it('a layer an update re-adds keeps its place among the other layers', () => {
    const { map } = mapShowing(withSources('a', 'b'));
    const first = mountCircle('first', 'a');
    mountCircle('second', 'b');

    first.update({ id: 'first', mapId: 'map', sourceId: 'a', sourceLayer: 'points', paint: {}, layout: {} });

    expect(map.getLayer('first')['source-layer']).toBe('points');
    expect(map.getLayersOrder()).toEqual(['water', 'building', 'labels', 'first', 'second']);
  });

  // So the order does not change again at the next style change.
  it('a layer whose beforeId is cleared goes back under the layers added after it', () => {
    const { map } = mapShowing(withSources('a', 'b'));
    const first = mountCircle('first', 'a');
    mountCircle('second', 'b');

    first.update({ id: 'first', mapId: 'map', sourceId: 'a', paint: {}, layout: {}, beforeId: 'water' });
    expect(map.getLayersOrder()).toEqual(['first', 'water', 'building', 'labels', 'second']);
    first.update({ id: 'first', mapId: 'map', sourceId: 'a', paint: {}, layout: {} });

    expect(map.getLayersOrder()).toEqual(['water', 'building', 'labels', 'first', 'second']);
  });
});

describe('beforeId naming a layer that is not on the map', () => {
  it.each(LAYERS)('%s is added on top with one warning, and moves under that layer once it appears', (_name, c) => {
    const map = register(mapFor(c));
    map.addLayer({ id: 'base', type: 'background' });
    const errors = vi.fn();
    map.on('error', errors);

    const m = mountHook(c.hook, configFor(c, { beforeId: 'labels' }));

    expect(map.getLayersOrder()).toEqual(['base', ID]);
    expect(pushed(m)).toEqual(['layer:added']);
    expect(errors).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"labels"'));

    map.addLayer({ id: 'labels', type: 'background' });
    map.emit('styledata', STYLEDATA); // fired by MapLibre on the next frame
    expect(map.getLayersOrder()).toEqual(['base', ID, 'labels']);

    map.emit('styledata', STYLEDATA);
    expect(map.moveLayer).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(LAYERS)('%s moves on top with one warning when an update names a missing layer', (_name, c) => {
    const map = register(mapFor(c));
    map.addLayer({ id: 'a', type: 'background' });
    const m = mountHook(c.hook, configFor(c, { beforeId: 'a' }));

    m.update(configFor(c, { beforeId: 'labels' }));

    expect(map.getLayersOrder()).toEqual(['a', ID]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"labels"'));
  });
});

describe('click and hover events', () => {
  const feature = { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Point', coordinates: [1, 2] } };
  const lngLat = { lng: 1, lat: 2 };
  const interaction = { features: [feature], lngLat, point: { x: 3, y: 4 } };

  it.each(INTERACTIVE)('%s pushes the same payloads as before', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    const featurePart = c.payload === 'feature' ? { feature } : { features: [feature], lngLat };
    m.hook.pushEvent.mockClear();

    map.emit('click', ID, interaction);
    map.emit('click', ID, { features: [], lngLat, point: { x: 0, y: 0 } });
    map.emit('mouseenter', ID, interaction);
    expect(map.getCanvas().style.cursor).toBe('pointer');
    map.emit('mouseleave', ID, {});
    expect(map.getCanvas().style.cursor).toBe('');

    expect(m.hook.pushEvent.mock.calls).toEqual([
      ['layer:feature_clicked', { ...IDS, ...featurePart }],
      ['layer:feature_mouseenter', { ...IDS, ...featurePart }],
      ['layer:feature_mouseleave', IDS]
    ]);
  });

  it.each(INTERACTIVE)('%s attaches its listeners once, and they survive every re-add', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));

    map.setStyle(styleFor(c));
    map.setStyle(styleFor(c), { diff: false });
    map.finishStyleLoad();
    m.update(configFor(c, { minZoom: 2 }));
    m.update(configFor(c));
    expect(map.removeLayer).toHaveBeenCalledTimes(1);

    for (const type of HOVER_EVENTS) {
      expect(map.listenerCount(type, ID), type).toBe(1);
    }
    map.emit('click', ID, interaction);
    expect(pushed(m).filter((name) => name === 'layer:feature_clicked')).toHaveLength(1);
  });

  it.each(NOT_INTERACTIVE)('%s has no click or hover listener', (_name, c) => {
    const map = register(mapFor(c));
    mountHook(c.hook, configFor(c));

    for (const type of HOVER_EVENTS) {
      expect(map.listenerCount(type, ID), type).toBe(0);
    }
  });
});

describe('destroyed()', () => {
  it.each(LAYERS)('%s removes the layer and every listener, and pushes layer:removed', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));

    m.destroy();

    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(m.hook.pushEvent.mock.calls).toEqual([
      ['layer:added', IDS],
      ['layer:removed', IDS]
    ]);
  });

  it.each(LAYERS)('%s destroyed after its map hook does not touch the removed map', (_name, c) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    // The map hook's destroyed(): map.remove() deletes the map's style, so
    // getLayer() and removeLayer() throw, then the map is unregistered.
    map.getLayer.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'getLayer')");
    });
    MapManager.unregister('map');

    m.destroy();

    expect(error).not.toHaveBeenCalled();
    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual([]);
    expect(pushed(m)).toEqual(['layer:added', 'layer:removed']);
  });

  it.each(LAYERS)('%s removes the layer it put back after a style change, and pushes layer:removed once', (_name, c) => {
    const map = register(mapFor(c));
    const m = mountHook(c.hook, configFor(c));
    map.setStyle(styleFor(c));

    m.destroy();

    expect(map.getLayer(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(pushed(m)).toEqual(['layer:added', 'layer:removed']);
  });
});

describe('layers in a LiveView', () => {
  const attr = (value: unknown) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const MAP = '<div id="m" phx-hook="MapHook" phx-update="ignore"></div>';
  const SOURCE =
    `<div id="places" phx-hook="VectorTileSourceHook" ` +
    `data-config="${attr({ id: 'places', mapId: 'm', url: 'https://tiles.example.com/places.json' })}" style="display: none;"></div>`;
  const POINTS = { layer_id: 'points', layerId: 'points' };

  function circle(config: Record<string, unknown> = {}): string {
    const full = {
      id: 'points',
      mapId: 'm',
      sourceId: 'places',
      sourceLayer: 'place',
      paint: { 'circle-radius': 6, 'circle-color': '#e55e5e' },
      layout: {},
      ...config
    };
    return `<div id="points" phx-hook="CircleLayerHook" data-config="${attr(full)}" style="display: none;"></div>`;
  }

  const background = `<div id="bg" phx-hook="BackgroundLayerHook" ` +
    `data-config="${attr({ id: 'bg', mapId: 'm', paint: { 'background-color': '#f8f4f0' }, layout: {} })}" style="display: none;"></div>`;

  const fakeMap = () => MapManager.get('m') as unknown as FakeMap;
  const layerPushes = (pushes: [string, unknown][]) => pushes.filter(([name]) => name.startsWith('layer:'));

  it('adds a layer rendered before its map and its source (#17, #5)', () => {
    const lv = renderLiveView(circle() + background + MAP + SOURCE);

    expect(fakeMap().getLayer('points')).toMatchObject({ type: 'circle', source: 'places', 'source-layer': 'place' });
    expect(fakeMap().getLayer('bg')).toMatchObject({ type: 'background' });
    expect(layerPushes(lv.pushes)).toEqual([
      ['layer:added', { layer_id: 'bg', layerId: 'bg' }],
      ['layer:added', POINTS]
    ]);
  });

  it('adds a layer rendered between its map and its source (#5)', () => {
    const lv = renderLiveView(MAP + circle() + SOURCE);

    expect(fakeMap().getLayer('points')).toMatchObject({ type: 'circle', source: 'places' });
    expect(layerPushes(lv.pushes)).toEqual([['layer:added', POINTS]]);
  });

  it('applies re-rendered paint, filter and zoom range in place, and removes the layer with its element (#3)', () => {
    const lv = renderLiveView(MAP + SOURCE + circle({ filter: ['==', ['get', 'kind'], 'cafe'], minZoom: 4 }));
    const map = fakeMap();

    lv.render(MAP + SOURCE + circle({ paint: { 'circle-radius': 9 }, minZoom: 6 }));

    expect(map.getLayer('points')).toMatchObject({ paint: { 'circle-radius': 9 }, minzoom: 6 });
    expect(map.getLayer('points').filter).toBeUndefined();
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.removeLayer).not.toHaveBeenCalled();

    lv.render(MAP + SOURCE);

    expect(map.getLayer('points')).toBeUndefined();
    expect(layerPushes(lv.pushes)).toEqual([
      ['layer:added', POINTS],
      ['layer:removed', POINTS]
    ]);
  });
});
