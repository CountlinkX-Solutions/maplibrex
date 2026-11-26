/**
 * Covers the FakeMap stand-in itself: the hook tests rely on it behaving like
 * MapLibre GL JS (checked against maplibre-gl 6.5.0's `ui/map.ts` and
 * `style/style.ts`) where layer and source lifecycle bugs live.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeMap, Map as MapLibreMap } from './mocks/maplibre-gl';
import { registerMap, resetEnvironment } from './helpers';

const NOT_LOADED = 'Style is not done loading.';

/** Record the order in which the given map events fire. */
function recordEvents(map: FakeMap, types: string[]): string[] {
  const fired: string[] = [];
  types.forEach((type) => map.on(type, () => fired.push(type)));
  return fired;
}

describe('FakeMap load lifecycle', () => {
  afterEach(resetEnvironment);

  it('starts with its style loaded and accepting sources and layers', () => {
    const map = new FakeMap();

    expect(map.isStyleLoaded()).toBe(true);
    expect(map.loaded()).toBe(true);
    expect(map.getStyle()).toEqual({ version: 8, sources: {}, layers: [] });
    expect(map.listImages()).toEqual([]);

    map.addSource('s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'l', type: 'circle', source: 's' });
    expect(map.getLayer('l')).toBeDefined();
  });

  it('refuses style changes while its style document is still loading', () => {
    const map = new FakeMap(undefined, { loaded: false });

    expect(map.isStyleLoaded()).toBe(false);
    expect(map.loaded()).toBe(false);
    expect(map.getStyle()).toBeUndefined();
    expect(() => map.listImages()).toThrow(NOT_LOADED);
    expect(() => map.addSource('s', { type: 'geojson' })).toThrow(NOT_LOADED);
    expect(() => map.removeSource('s')).toThrow(NOT_LOADED);
    expect(() => map.addLayer({ id: 'l', type: 'background' })).toThrow(NOT_LOADED);
    expect(() => map.removeLayer('l')).toThrow(NOT_LOADED);
    expect(() => map.setTerrain(null)).toThrow(NOT_LOADED);
  });

  it('registerMap can register a map whose style is still loading', () => {
    const map = registerMap('map', undefined, { loaded: false });

    expect(map.isStyleLoaded()).toBe(false);
    expect(() => map.addSource('s', { type: 'geojson' })).toThrow(NOT_LOADED);
  });

  it('fires styledata, style.load and then load when the style document arrives', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const fired = recordEvents(map, ['styledata', 'style.load', 'load']);

    map.finishStyleLoad();

    expect(fired).toEqual(['styledata', 'style.load', 'load']);
    expect(map.isStyleLoaded()).toBe(true);
    expect(() => map.addSource('s', { type: 'geojson' })).not.toThrow();
  });

  it('accepts sources and layers while tiles load, although isStyleLoaded() and loaded() are false (#12)', () => {
    const map = new FakeMap();

    map.setTilesLoading(true);

    expect(map.isStyleLoaded()).toBe(false);
    expect(map.loaded()).toBe(false);
    expect(map.getStyle()).toBeDefined();
    expect(() => map.listImages()).not.toThrow();
    map.addSource('s', { type: 'geojson' });
    map.addLayer({ id: 'l', type: 'circle', source: 's' });
    expect(map.getLayer('l')).toBeDefined();

    map.setTilesLoading(false);
    expect(map.isStyleLoaded()).toBe(true);
  });

  it('holds load back until tiles have loaded on the first load', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const fired = recordEvents(map, ['styledata', 'style.load', 'load']);

    map.setTilesLoading(true);
    map.finishStyleLoad();
    expect(fired).toEqual(['styledata', 'style.load']);

    map.setTilesLoading(false);
    expect(fired).toEqual(['styledata', 'style.load', 'load']);
  });

  it('fires load once per map', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const fired = recordEvents(map, ['load']);

    map.finishStyleLoad();
    map.setTilesLoading(true);
    map.setTilesLoading(false);
    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    map.finishStyleLoad();

    expect(fired).toEqual(['load']);
  });

  it('never fires load for a map created already loaded', () => {
    const map = new FakeMap();
    const fired = recordEvents(map, ['load']);

    map.setTilesLoading(true);
    map.setTilesLoading(false);

    expect(fired).toEqual([]);
  });

  it('refuses finishStyleLoad() when no style is loading', () => {
    expect(() => new FakeMap().finishStyleLoad()).toThrow(/no style is loading/);
  });
});

describe("FakeMap refuses what MapLibre refuses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEnvironment();
  });

  /** Collect the messages of the `error` events the map fires. */
  function recordErrors(map: FakeMap): string[] {
    const messages: string[] = [];
    map.on('error', (e: { error: Error }) => messages.push(e.error.message));
    return messages;
  }

  function mapWithSource(): FakeMap {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    return map;
  }

  it('throws on a duplicate source id and keeps the first source', () => {
    const map = mapWithSource();
    const first = map.getSource('s');

    expect(() => map.addSource('s', { type: 'vector', url: 'x' })).toThrow('Source "s" already exists.');
    expect(map.getSource('s')).toBe(first);
  });

  it('throws on a source without a type', () => {
    const map = new FakeMap();

    expect(() => map.addSource('s', { url: 'x' })).toThrow(
      'The type property must be defined, but only the following properties were given: url.'
    );
    expect(map.getSource('s')).toBeUndefined();
  });

  it('fires an error event for a duplicate layer id and keeps the first layer', () => {
    const map = mapWithSource();
    const errors = recordErrors(map);
    map.addLayer({ id: 'l', type: 'circle', source: 's' });

    map.addLayer({ id: 'l', type: 'line', source: 's' });

    expect(errors).toEqual(['Layer "l" already exists on this map.']);
    expect(map.getLayer('l').type).toBe('circle');
  });

  it('fires an error event for a layer whose source does not exist, and does not add it', () => {
    const map = new FakeMap();
    const errors = recordErrors(map);

    map.addLayer({ id: 'l', type: 'circle', source: 'missing' });
    map.addLayer({ id: 'm', type: 'circle' });

    expect(errors).toEqual(['layers.l: source "missing" not found', 'layers.m: missing required property "source"']);
    expect(map.getLayer('l')).toBeUndefined();
    expect(map.getLayer('m')).toBeUndefined();
  });

  it('adds background and custom layers without a source', () => {
    const map = new FakeMap();
    const errors = recordErrors(map);

    map.addLayer({ id: 'bg', type: 'background' });
    map.addLayer({ id: 'c', type: 'custom', render: () => {} });

    expect(errors).toEqual([]);
    expect(map.getLayersOrder()).toEqual(['bg', 'c']);
  });

  it('adds the source a layer gives inline, under the layer id', () => {
    const map = new FakeMap();

    map.addLayer({ id: 'l', type: 'circle', source: { type: 'geojson', data: null } });

    expect(map.getSource('l')).toBeDefined();
    expect(map.getLayer('l').source).toBe('l');
  });

  it('fires an error event instead of removing a source a layer still uses', () => {
    const map = mapWithSource();
    const errors = recordErrors(map);
    map.addLayer({ id: 'l', type: 'circle', source: 's' });

    expect(() => map.removeSource('s')).not.toThrow();

    expect(errors).toEqual(['Source "s" cannot be removed while layer "l" is using it.']);
    expect(map.getSource('s')).toBeDefined();
  });

  it('throws when removing a source that does not exist', () => {
    expect(() => new FakeMap().removeSource('s')).toThrow('There is no source with this ID=s');
  });

  it('fires an error event when removing a layer that does not exist', () => {
    const map = new FakeMap();
    const errors = recordErrors(map);

    expect(() => map.removeLayer('l')).not.toThrow();

    expect(errors).toEqual(['Cannot remove non-existing layer "l".']);
  });

  it('fires an error event for a beforeId that does not exist, and does not add the layer', () => {
    const map = mapWithSource();
    const errors = recordErrors(map);

    map.addLayer({ id: 'l', type: 'circle', source: 's' }, 'missing');

    expect(errors).toEqual(['Cannot add layer "l" before non-existing layer "missing".']);
    expect(map.getLayer('l')).toBeUndefined();
  });

  it('logs the error to the console when nothing listens for error events', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = new FakeMap();

    map.removeLayer('l');

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toEqual(new Error('Cannot remove non-existing layer "l".'));
  });
});

describe('FakeMap layer order and layer properties', () => {
  afterEach(resetEnvironment);

  function mapWithLayers(...ids: string[]): FakeMap {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    ids.forEach((id) => map.addLayer({ id, type: 'circle', source: 's' }));
    return map;
  }

  function recordErrors(map: FakeMap): string[] {
    const messages: string[] = [];
    map.on('error', (e: { error: Error }) => messages.push(e.error.message));
    return messages;
  }

  it('inserts a layer before beforeId, and on top without one', () => {
    const map = mapWithLayers('a', 'b');

    map.addLayer({ id: 'c', type: 'circle', source: 's' }, 'b');
    map.addLayer({ id: 'd', type: 'circle', source: 's' });

    expect(map.getLayersOrder()).toEqual(['a', 'c', 'b', 'd']);
  });

  it('keeps the order after a layer is removed', () => {
    const map = mapWithLayers('a', 'b', 'c');

    map.removeLayer('b');

    expect(map.getLayersOrder()).toEqual(['a', 'c']);
  });

  it('moves a layer before another one, or to the top', () => {
    const map = mapWithLayers('a', 'b', 'c');

    map.moveLayer('c', 'a');
    expect(map.getLayersOrder()).toEqual(['c', 'a', 'b']);

    map.moveLayer('c');
    expect(map.getLayersOrder()).toEqual(['a', 'b', 'c']);
  });

  it('refuses to move a missing layer', () => {
    const map = mapWithLayers('a');
    const errors = recordErrors(map);

    map.moveLayer('x', 'a');

    expect(errors).toEqual(["The layer 'x' does not exist in the map's style and cannot be moved."]);
    expect(map.getLayersOrder()).toEqual(['a']);
  });

  it('drops a layer out of the order when moving it before a missing layer, as MapLibre does', () => {
    const map = mapWithLayers('a', 'b');
    const errors = recordErrors(map);

    map.moveLayer('a', 'missing');

    expect(errors).toEqual(['Cannot move layer "a" before non-existing layer "missing".']);
    expect(map.getLayersOrder()).toEqual(['b']);
    expect(map.getLayer('a')).toBeDefined();
  });

  it('sets a layer zoom range, leaving a bound alone when given null', () => {
    const map = mapWithLayers('a');

    map.setLayerZoomRange('a', 3, 10);
    expect(map.getLayer('a')).toMatchObject({ minzoom: 3, maxzoom: 10 });

    map.setLayerZoomRange('a', null, 12);
    expect(map.getLayer('a')).toMatchObject({ minzoom: 3, maxzoom: 12 });
  });

  it('refuses the zoom range of a missing layer', () => {
    const map = new FakeMap();
    const errors = recordErrors(map);

    map.setLayerZoomRange('x', 1, 2);

    expect(errors).toEqual(['Cannot set the zoom range of non-existing layer "x".']);
  });

  it('applies paint, layout and filter changes, and resets them when given undefined or null', () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    map.addLayer({ id: 'a', type: 'circle', source: 's', paint: { 'circle-radius': 4 }, filter: ['==', 'k', 1] });

    map.setPaintProperty('a', 'circle-color', '#f00');
    map.setPaintProperty('a', 'circle-radius', undefined);
    map.setLayoutProperty('a', 'visibility', 'none');
    map.setFilter('a', null);

    expect(map.getLayer('a').paint).toEqual({ 'circle-color': '#f00' });
    expect(map.getLayer('a').layout).toEqual({ visibility: 'none' });
    expect(map.getLayer('a').filter).toBeUndefined();
    expect(map.setPaintProperty).toHaveBeenCalledTimes(2);
  });

  it('refuses paint, layout and filter changes on a missing layer', () => {
    const map = new FakeMap();
    const errors = recordErrors(map);

    map.setPaintProperty('x', 'circle-color', '#f00');
    map.setLayoutProperty('x', 'visibility', 'none');
    map.setFilter('x', ['==', 'k', 1]);

    expect(errors).toEqual([
      'Cannot style non-existing layer "x".',
      'Cannot style non-existing layer "x".',
      'Cannot filter non-existing layer "x".'
    ]);
  });

  it('does not let later changes to the caller’s layer object reach the map', () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    const spec = { id: 'a', type: 'circle', source: 's', paint: { 'circle-radius': 4 } };

    map.addLayer(spec);
    spec.paint['circle-radius'] = 9;

    expect(map.getLayer('a').paint).toEqual({ 'circle-radius': 4 });
  });

  it('serializes sources, ordered layers and terrain in getStyle()', () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    map.addSource('dem', { type: 'raster-dem', url: 'dem.json' });
    map.addLayer({ id: 'b', type: 'circle', source: 's' });
    map.addLayer({ id: 'a', type: 'line', source: 's' }, 'b');
    map.addLayer({ id: 'c', type: 'custom', render: () => {} });
    map.setTerrain({ source: 'dem', exaggeration: 2 });

    expect(map.getStyle()).toEqual({
      version: 8,
      sources: { s: { type: 'geojson', data: null }, dem: { type: 'raster-dem', url: 'dem.json' } },
      // Custom layers are left out, as MapLibre's serialization does.
      layers: [
        { id: 'a', type: 'line', source: 's' },
        { id: 'b', type: 'circle', source: 's' }
      ],
      terrain: { source: 'dem', exaggeration: 2 }
    });
  });
});

describe('FakeMap terrain', () => {
  afterEach(resetEnvironment);

  it('sets, reports and clears terrain, firing a terrain event each time', () => {
    const map = new FakeMap();
    const terrainEvents: unknown[] = [];
    map.on('terrain', (e: { terrain: unknown }) => terrainEvents.push(e.terrain));
    map.addSource('dem', { type: 'raster-dem', url: 'dem.json' });

    expect(map.getTerrain()).toBeNull();
    map.setTerrain({ source: 'dem', exaggeration: 1.5 });
    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    map.setTerrain(null);
    expect(map.getTerrain()).toBeNull();

    expect(terrainEvents).toEqual([{ source: 'dem', exaggeration: 1.5 }, null]);
  });

  it('throws when the terrain source does not exist', () => {
    const map = new FakeMap();

    expect(() => map.setTerrain({ source: 'dem' })).toThrow(
      'cannot load terrain, because there exists no source with ID: dem'
    );
    expect(map.getTerrain()).toBeNull();
  });
});

describe('FakeMap setStyle', () => {
  afterEach(resetEnvironment);

  const basemap = {
    version: 8,
    name: 'basemap',
    sources: { base: { type: 'vector', url: 'base.json' } },
    layers: [
      { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water' },
      { id: 'roads', type: 'line', source: 'base', 'source-layer': 'roads' }
    ]
  };

  /** A map showing `basemap`, plus a source and a layer added at runtime. */
  function mapWithRuntimeContent(): FakeMap {
    const map = new FakeMap(undefined, { loaded: false });
    map.finishStyleLoad(basemap);
    map.addSource('points', { type: 'geojson', data: null });
    map.addLayer({ id: 'points', type: 'circle', source: 'points' });
    return map;
  }

  /** `mapWithRuntimeContent()` with terrain on a runtime DEM source too. */
  function mapWithRuntimeTerrain(): FakeMap {
    const map = mapWithRuntimeContent();
    map.addSource('dem', { type: 'raster-dem', url: 'dem.json' });
    map.setTerrain({ source: 'dem' });
    return map;
  }

  it('loads the given style document on finishStyleLoad()', () => {
    const map = new FakeMap(undefined, { loaded: false });

    map.finishStyleLoad(basemap);

    expect(map.getStyle()).toEqual(basemap);
    expect(map.getLayersOrder()).toEqual(['water', 'roads']);
  });

  it('diffs by default: drops sources and layers the new style lacks, and fires styledata', () => {
    const map = mapWithRuntimeContent();
    const fired = recordEvents(map, ['styledataloading', 'styledata', 'style.load', 'load']);
    const next = {
      version: 8,
      sources: { base: basemap.sources.base, labels: { type: 'vector', url: 'labels.json' } },
      layers: [basemap.layers[0], { id: 'places', type: 'symbol', source: 'labels', 'source-layer': 'places' }]
    };

    map.setStyle(next);

    expect(map.getStyle()).toEqual(next);
    expect(map.getSource('points')).toBeUndefined();
    expect(map.getLayer('points')).toBeUndefined();
    expect(map.getLayer('roads')).toBeUndefined();
    expect(fired).toEqual(['styledata']);
    // The style document stays loaded on this path.
    expect(map.isStyleLoaded()).toBe(true);
    expect(() => map.addSource('points', { type: 'geojson', data: null })).not.toThrow();
  });

  it('keeps the source objects a diff leaves unchanged', () => {
    const map = mapWithRuntimeContent();
    const base = map.getSource('base');

    map.setStyle(basemap);

    expect(map.getSource('base')).toBe(base);
  });

  it('fires nothing when the new style matches the current one', () => {
    const map = new FakeMap(undefined, { loaded: false });
    map.finishStyleLoad(basemap);
    const fired = recordEvents(map, ['styledata', 'style.load', 'terrain']);

    map.setStyle(basemap);

    expect(fired).toEqual([]);
  });

  it('treats a style URL as a style with no sources or layers', () => {
    const map = mapWithRuntimeContent();

    map.setStyle('https://example.com/style.json');

    expect(map.getStyle()).toEqual({ version: 8, sources: {}, layers: [] });
  });

  // maplibre-gl 5.24.0 and 6.5.0 in a browser: the diff's setTerrain
  // operation calls Map.setTerrain on the Style, which throws, and the map
  // rebuilds the style from scratch instead.
  it('rebuilds from scratch when the diff would change the terrain, as MapLibre does', () => {
    const map = mapWithRuntimeTerrain();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fired = recordEvents(map, ['styledataloading', 'styledata', 'terrain']);

    map.setStyle(basemap);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unable to perform style diff'));
    expect(fired).toEqual(['styledataloading']);
    expect(map.getStyle()).toBeUndefined();
    expect(map.getTerrain()).toEqual({ source: 'dem' });

    map.finishStyleLoad();

    expect(fired).toEqual(['styledataloading', 'terrain', 'styledata']);
    expect(map.getTerrain()).toBeNull();
    expect(map.getStyle()).toEqual(basemap);
    warn.mockRestore();
  });

  it('rebuilds from scratch with { diff: false }: style changes throw until the new style has loaded', () => {
    const map = mapWithRuntimeTerrain();
    const fired = recordEvents(map, ['styledataloading', 'styledata', 'style.load', 'load']);
    const next = { version: 8, sources: { dem: { type: 'raster-dem', url: 'dem.json' } }, layers: [], terrain: { source: 'dem' } };

    map.setStyle(next, { diff: false });

    expect(fired).toEqual(['styledataloading']);
    expect(map.getStyle()).toBeUndefined();
    expect(map.getSource('base')).toBeUndefined();
    expect(map.getLayer('points')).toBeUndefined();
    expect(() => map.addSource('points', { type: 'geojson', data: null })).toThrow(NOT_LOADED);
    // MapLibre keeps the old terrain until the new style has loaded.
    expect(map.getTerrain()).toEqual({ source: 'dem' });

    map.finishStyleLoad();

    expect(fired).toEqual(['styledataloading', 'styledata', 'style.load']);
    expect(map.getStyle()).toEqual(next);
    expect(map.getTerrain()).toEqual({ source: 'dem' });
  });

  it('rebuilds from scratch when the style document has not loaded yet', () => {
    const map = new FakeMap(undefined, { loaded: false });

    map.setStyle(basemap);
    expect(() => map.addSource('s', { type: 'geojson' })).toThrow(NOT_LOADED);

    map.finishStyleLoad();
    expect(map.getStyle()).toEqual(basemap);
  });

  it('fires sourcedata for the style sources a load or a diff adds', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const sourceIds: string[] = [];
    map.on('sourcedata', (e: { sourceId: string }) => sourceIds.push(e.sourceId));
    const fired = recordEvents(map, ['style.load', 'sourcedata']);

    map.finishStyleLoad(basemap);
    expect(fired).toEqual(['style.load', 'sourcedata']);

    map.setStyle({ ...basemap, sources: { ...basemap.sources, labels: { type: 'vector', url: 'labels.json' } } });
    expect(sourceIds).toEqual(['base', 'labels']);
  });

  it('keeps the listeners attached across style changes', () => {
    const map = mapWithRuntimeContent();
    const handler = vi.fn();
    map.on('click', 'points', handler);

    map.setStyle(basemap, { diff: false });
    map.finishStyleLoad();
    map.emit('click', 'points', {});

    expect(handler).toHaveBeenCalledTimes(1);
  });

  describe('a diff applied one operation at a time, as maplibre-gl-style-spec orders them', () => {
    const streets = {
      version: 8,
      sources: { streets: { type: 'vector', url: 'streets.json' } },
      layers: [
        { id: 'land', type: 'fill', source: 'streets', 'source-layer': 'land' },
        { id: 'building', type: 'fill', source: 'streets', 'source-layer': 'building' },
        { id: 'labels', type: 'symbol', source: 'streets', 'source-layer': 'place' }
      ]
    };

    /** `basemap` plus a runtime source and a layer on it, added after the style's own. */
    function mapWithRuntimeLayer(): FakeMap {
      const map = new FakeMap(undefined, { loaded: false });
      map.finishStyleLoad(basemap);
      map.addSource('points', { type: 'geojson', data: null });
      map.addLayer({ id: 'points', type: 'circle', source: 'points' });
      return map;
    }

    it('removes the layers of removed sources, then the sources in their old order, then adds the new layers', () => {
      const map = mapWithRuntimeLayer();
      const seen: [string, string[]][] = [];
      map.on('sourcedata', (e: { sourceId: string }) => seen.push([e.sourceId, map.getLayersOrder()]));

      map.setStyle(streets);

      // Removing a source fires sourcedata synchronously, while the diff is
      // half done; a new source's sourcedata arrives after it.
      expect(seen).toEqual([
        ['base', []],
        ['points', []],
        ['streets', ['land', 'building', 'labels']]
      ]);
      expect(map.getStyle()).toEqual(streets);
      expect(map.removeSource).not.toHaveBeenCalled();
      expect(map.addLayer).toHaveBeenCalledTimes(1);
    });

    it('leaves a layer added by a listener during the diff under the layers the diff adds after it', () => {
      const map = mapWithRuntimeLayer();
      const errors: string[] = [];
      map.on('error', (e: { error: Error }) => errors.push(e.error.message));
      // A listener that puts "points" back as soon as anything changes, while
      // its source is still there.
      map.on('sourcedata', () => {
        if (!map.getLayer('points') && map.getSource('points')) {
          map.addLayer({ id: 'points', type: 'circle', source: 'points' });
        }
      });

      map.setStyle(streets);

      expect(map.getLayersOrder()).toEqual(['points', 'land', 'building', 'labels']);
      expect(map.getSource('points')).toBeDefined();
      expect(errors).toEqual(['Source "points" cannot be removed while layer "points" is using it.']);
    });

    it('keeps the layers a diff leaves in place, and inserts the new ones between them', () => {
      const map = new FakeMap(undefined, { loaded: false });
      map.finishStyleLoad(streets);
      map.addLayer({ id: 'mine', type: 'background' });
      const next = {
        ...streets,
        layers: [streets.layers[0], { id: 'roads', type: 'line', source: 'streets', 'source-layer': 'roads' }, ...streets.layers.slice(1)]
      };

      map.setStyle(next);

      expect(map.getLayersOrder()).toEqual(['land', 'roads', 'building', 'labels']);
      expect(map.getSource('streets')).toBeDefined();
    });

    it('restyles a layer in place, keeping the map’s layer object, and re-creates one whose source changes', () => {
      const map = new FakeMap(undefined, { loaded: false });
      map.finishStyleLoad(streets);
      const land = map.getLayer('land');
      const building = map.getLayer('building');
      const next = {
        ...streets,
        sources: { ...streets.sources, other: { type: 'vector', url: 'other.json' } },
        layers: [
          { ...streets.layers[0], paint: { 'fill-color': '#000' } },
          { ...streets.layers[1], source: 'other' },
          streets.layers[2]
        ]
      };

      map.setStyle(next);

      // MapLibre's setPaintProperty and the other style setters change its
      // StyleLayer object; a layer on another source is removed and added again.
      expect(map.getLayer('land')).toBe(land);
      expect(map.getLayer('building')).not.toBe(building);
      expect(map.getStyle()).toEqual(next);
    });

    it('updates a GeoJSON source in place when only its data changed', () => {
      const style = { version: 8, sources: { points: { type: 'geojson', data: null } }, layers: [{ id: 'points', type: 'circle', source: 'points' }] };
      const map = new FakeMap(undefined, { loaded: false });
      map.finishStyleLoad(style);
      const source = map.getSource('points');
      const data = { type: 'FeatureCollection', features: [] };

      map.setStyle({ ...style, sources: { points: { type: 'geojson', data } } });

      expect(map.getSource('points')).toBe(source);
      expect(map.getSource('points').serialize()).toEqual({ type: 'geojson', data });
      expect(map.getLayersOrder()).toEqual(['points']);
    });

    it('rebuilds the style from scratch when an operation throws, as MapLibre does', () => {
      const map = mapWithRuntimeLayer();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const putBack = () => {
        if (!map.getLayer('points') && map.getSource('points')) {
          map.addLayer({ id: 'points', type: 'circle', source: 'points' });
          map.off('sourcedata', putBack);
        }
      };
      map.on('sourcedata', putBack);
      // "points" changes, so the diff removes and re-adds it; the layer put
      // back meanwhile makes the removal fail and the add throw.
      const next = { ...streets, sources: { ...streets.sources, points: { type: 'geojson', data: null, cluster: true } } };

      map.setStyle(next);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unable to perform style diff'));
      expect(map.getStyle()).toBeUndefined();
      map.finishStyleLoad();
      expect(map.getStyle()).toEqual(next);
      vi.restoreAllMocks();
    });
  });
});

describe('FakeMap listener bookkeeping', () => {
  afterEach(resetEnvironment);

  it('lists every attached listener by event type and layer id, until it is removed', () => {
    const map = new FakeMap();
    const onStyle = () => {};
    const onClick = () => {};
    expect(map.listenerKeys()).toEqual([]);

    map.on('styledata', onStyle);
    map.on('click', 'points', onClick);
    map.once('load', () => {});
    expect(map.listenerKeys()).toEqual(['styledata', 'click:points', 'load']);

    map.off('styledata', onStyle);
    map.off('click', 'points', onClick);
    map.emit('load');
    expect(map.listenerKeys()).toEqual([]);
  });
});

describe('FakeMap camera', () => {
  afterEach(resetEnvironment);

  const MOVE_EVENTS = [
    'movestart',
    'move',
    'zoomstart',
    'zoom',
    'zoomend',
    'rotatestart',
    'rotate',
    'rotateend',
    'pitchstart',
    'pitch',
    'pitchend',
    'moveend'
  ];

  function camera(map: FakeMap) {
    const { lng, lat } = map.getCenter();
    return { center: [lng, lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  }

  it('starts a map made with new Map(options) at the camera its options give', () => {
    const map = new MapLibreMap({ container: document.createElement('div'), center: [1, 2], zoom: 3, bearing: 4, pitch: 5 });

    expect(camera(map)).toEqual({ center: [1, 2], zoom: 3, bearing: 4, pitch: 5 });
  });

  it('takes a centre given as { lng, lat } too', () => {
    const map = new MapLibreMap({ container: document.createElement('div'), center: { lng: 1, lat: 2 } });

    expect(map.getCenter()).toEqual({ lng: 1, lat: 2 });
  });

  it('jumpTo moves the camera at once and fires movestart, move, the events of what changed, and moveend', () => {
    const map = new FakeMap();
    const fired = recordEvents(map, MOVE_EVENTS);

    map.jumpTo({ center: [1, 2], zoom: 6 });

    expect(camera(map)).toEqual({ center: [1, 2], zoom: 6, bearing: 0, pitch: 0 });
    expect(fired).toEqual(['movestart', 'move', 'zoomstart', 'zoom', 'zoomend', 'moveend']);
  });

  it.each([
    ['setCenter', (m: FakeMap) => m.setCenter([1, 2]), { center: [1, 2] }, []],
    ['setZoom', (m: FakeMap) => m.setZoom(7), { zoom: 7 }, ['zoomstart', 'zoom', 'zoomend']],
    ['setBearing', (m: FakeMap) => m.setBearing(30), { bearing: 30 }, ['rotatestart', 'rotate', 'rotateend']],
    ['setPitch', (m: FakeMap) => m.setPitch(20), { pitch: 20 }, ['pitchstart', 'pitch', 'pitchend']]
  ] as const)('%s jumps at once, as MapLibre does', (_name, move, changed, events) => {
    const map = new FakeMap();
    const before = camera(map);
    const fired = recordEvents(map, MOVE_EVENTS);

    move(map);

    expect(camera(map)).toEqual({ ...before, ...changed });
    expect(fired).toEqual(['movestart', 'move', ...events, 'moveend']);
  });

  it('fires movestart, move and moveend for a jump to where the map already is, as MapLibre does', () => {
    const map = new FakeMap();
    map.jumpTo({ center: [1, 2], zoom: 6, bearing: 10, pitch: 20 });
    const fired = recordEvents(map, MOVE_EVENTS);

    map.jumpTo({ center: [1, 2], zoom: 6, bearing: 10, pitch: 20 });

    expect(fired).toEqual(['movestart', 'move', 'moveend']);
  });

  it('passes the event data on to every event it fires', () => {
    const map = new FakeMap();
    const seen: unknown[] = [];
    ['movestart', 'zoomend', 'moveend'].forEach((type) => map.on(type, (e) => seen.push(e)));

    map.setZoom(8, { origin: 'test' });

    expect(seen).toEqual([
      { type: 'movestart', origin: 'test' },
      { type: 'zoomend', origin: 'test' },
      { type: 'moveend', origin: 'test' }
    ]);
  });

  // MapLibre animates these over several frames and fires moveend when the
  // animation ends; the mock ends it at once.
  it.each([
    ['flyTo', (m: FakeMap) => m.flyTo({ center: [1, 2], zoom: 9, bearing: 10, pitch: 20 }), { center: [1, 2], zoom: 9, bearing: 10, pitch: 20 }],
    ['easeTo', (m: FakeMap) => m.easeTo({ center: [3, 4] }), { center: [3, 4] }],
    ['fitBounds', (m: FakeMap) => m.fitBounds([[0, 0], [2, 4]]), { center: [1, 2] }],
    ['zoomIn', (m: FakeMap) => m.zoomIn(), { zoom: 6 }],
    ['zoomOut', (m: FakeMap) => m.zoomOut(), { zoom: 4 }],
    ['rotateTo', (m: FakeMap) => m.rotateTo(45), { bearing: 45 }],
    ['resetNorth', (m: FakeMap) => m.resetNorth(), { bearing: 0 }]
  ] as const)('%s ends at once where it was going, with one moveend', (_name, move, changed) => {
    const map = new FakeMap();
    map.setBearing(90);
    const before = camera(map);
    const fired = recordEvents(map, ['moveend']);

    move(map);

    expect(camera(map)).toEqual({ ...before, ...changed });
    expect(fired).toEqual(['moveend']);
  });

  it('keeps every camera method a spy', () => {
    const map = new FakeMap();

    map.setCenter([1, 2]);
    map.flyTo({ zoom: 3 });

    expect(map.setCenter).toHaveBeenCalledWith([1, 2]);
    expect(map.flyTo).toHaveBeenCalledWith({ zoom: 3 });
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('userMove moves the camera the way a gesture does: its events carry originalEvent', () => {
    const map = new FakeMap();
    const seen: any[] = [];
    MOVE_EVENTS.forEach((type) => map.on(type, (e) => seen.push(e)));

    map.userMove({ center: [1, 2], zoom: 7 });

    expect(camera(map)).toMatchObject({ center: [1, 2], zoom: 7 });
    expect(seen.map((e) => e.type)).toEqual(['movestart', 'zoomstart', 'move', 'zoom', 'zoomend', 'moveend']);
    expect(seen.every((e) => e.originalEvent instanceof Event)).toBe(true);
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('userMove with { ended: false } leaves the gesture going: moveend waits for the call that ends it', () => {
    const map = new FakeMap();
    const fired = recordEvents(map, MOVE_EVENTS);

    map.userMove({ center: [1, 2] }, { ended: false });
    map.userMove({ center: [3, 4], bearing: 20 }, { ended: false });
    expect(fired).toEqual(['movestart', 'move', 'rotatestart', 'move', 'rotate']);
    expect(map.getCenter()).toEqual({ lng: 3, lat: 4 });

    map.userMove({ center: [5, 6] });
    expect(fired.slice(5)).toEqual(['move', 'rotateend', 'moveend']);
  });
});

describe('FakeMap removal', () => {
  afterEach(resetEnvironment);

  it('drops its sources and layers and fires remove when the map is removed', () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    map.addLayer({ id: 'l', type: 'circle', source: 's' });
    const fired: string[] = [];
    map.on('remove', () => fired.push(`remove with ${map.getLayersOrder().length} layers`));

    map.remove();

    expect(fired).toEqual(['remove with 0 layers']);
    expect(map.getSource('s')).toBeUndefined();
    expect(map.getLayer('l')).toBeUndefined();
  });
});

describe('FakeMap sources', () => {
  afterEach(resetEnvironment);

  function recordSourceData(map: FakeMap): any[] {
    const events: any[] = [];
    map.on('sourcedata', (e: any) => events.push({ ...e, present: !!map.getSource(e.sourceId) }));
    return events;
  }

  it('fires sourcedata when a source is added', () => {
    const map = new FakeMap();
    const events = recordSourceData(map);

    map.addSource('s', { type: 'geojson', data: null });

    expect(events).toEqual([
      {
        type: 'sourcedata',
        dataType: 'source',
        sourceDataType: 'metadata',
        sourceId: 's',
        isSourceLoaded: true,
        source: { type: 'geojson', data: null },
        present: true
      }
    ]);
  });

  it('reports the source as not loaded while tiles load', () => {
    const map = new FakeMap();
    const events = recordSourceData(map);
    map.setTilesLoading(true);

    map.addSource('s', { type: 'geojson', data: null });

    expect(events[0].isSourceLoaded).toBe(false);
  });

  it('fires sourcedata, as MapLibre does, once a source has been removed', () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null });
    const events = recordSourceData(map);

    map.removeSource('s');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ sourceId: 's', sourceDataType: 'metadata', present: false });
  });

  it('fires no sourcedata when the removal is refused', () => {
    const map = new FakeMap();
    map.on('error', () => {});
    map.addSource('s', { type: 'geojson', data: null });
    map.addLayer({ id: 'l', type: 'circle', source: 's' });
    const events = recordSourceData(map);

    map.removeSource('s');

    expect(events).toEqual([]);
  });

  it('gives a geojson source setData, updateData and setClusterOptions', async () => {
    const map = new FakeMap();
    map.addSource('s', { type: 'geojson', data: null, cluster: false });
    const source = map.getSource('s');
    const data = { type: 'FeatureCollection', features: [] };

    await source.setData(data);
    await source.setClusterOptions({ cluster: true, clusterRadius: 30 });

    expect(source.setData).toHaveBeenCalledWith(data);
    expect(source.updateData).toBeTypeOf('function');
    expect(source.setTiles).toBeUndefined();
    expect(source.data).toEqual(data);
    expect(map.getStyle()!.sources!.s).toEqual({ type: 'geojson', data, cluster: true, clusterRadius: 30 });
  });

  it.each(['vector', 'raster', 'raster-dem'])('gives a %s source setTiles and setUrl', (type) => {
    const map = new FakeMap();
    map.addSource('s', { type, url: 'a.json' });
    const source = map.getSource('s');

    expect(source.setUrl('b.json')).toBe(source);
    expect(source.setTiles(['https://t/{z}/{x}/{y}'])).toBe(source);

    expect(source.setData).toBeUndefined();
    expect(source.url).toBe('b.json');
    expect(map.getStyle()!.sources!.s).toEqual({ type, url: 'b.json', tiles: ['https://t/{z}/{x}/{y}'] });
  });

  it('gives an image source updateImage and setCoordinates', () => {
    const map = new FakeMap();
    const corners = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const moved = [[0, 2], [2, 2], [2, 0], [0, 0]];
    map.addSource('s', { type: 'image', url: 'a.png', coordinates: corners });
    const source = map.getSource('s');

    expect(source.updateImage({ url: 'b.png' })).toBe(source);
    expect(map.getStyle()!.sources!.s).toEqual({ type: 'image', url: 'b.png', coordinates: corners });

    source.updateImage({ url: 'c.png', coordinates: moved });
    expect(map.getStyle()!.sources!.s).toEqual({ type: 'image', url: 'c.png', coordinates: moved });

    expect(source.setCoordinates(corners)).toBe(source);
    expect(source.coordinates).toEqual(corners);
    expect(source.setData).toBeUndefined();
  });

  it('gives a video source setCoordinates and playback controls', () => {
    const map = new FakeMap();
    const corners = [[0, 1], [1, 1], [1, 0], [0, 0]];
    map.addSource('s', { type: 'video', urls: ['a.mp4'], coordinates: corners });
    const source = map.getSource('s');

    source.setCoordinates([[0, 2], [2, 2], [2, 0], [0, 0]]);
    source.play();
    source.pause();
    source.seek(3);

    expect(source.setCoordinates).toHaveBeenCalledTimes(1);
    expect(source.play).toHaveBeenCalledTimes(1);
    expect(source.pause).toHaveBeenCalledTimes(1);
    expect(source.seek).toHaveBeenCalledWith(3);
    expect(source.getVideo()).toBeInstanceOf(HTMLVideoElement);
    expect(source.setTiles).toBeUndefined();
    expect(map.getStyle()!.sources!.s.coordinates).toEqual([[0, 2], [2, 2], [2, 0], [0, 0]]);
  });
});
