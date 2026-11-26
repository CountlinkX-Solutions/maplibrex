/**
 * The lifecycle shared by the five source hooks (vector tile, raster tile,
 * raster DEM, image, video): when the source is added (#17, #12), how assign
 * changes reach it (#3), how it comes back after a style change (#4), and how
 * `destroyed()` removes it while layers may still use it (#18).
 *
 * The behaviour is the same for every hook, so most tests run over the table
 * below; the last group renders real LiveView patches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import {
  CircleLayerHook,
  HillshadeLayerHook,
  ImageSourceHook,
  RasterDEMSourceHook,
  RasterLayerHook,
  RasterTileSourceHook,
  VectorTileSourceHook,
  VideoSourceHook
} from '../js/maplibrex/hooks';
import { FakeMap } from './mocks/maplibre-gl';
import { type MountedHook, mountHook, renderLiveView, resetEnvironment } from './helpers';

interface InPlaceChange {
  /** The config keys changed. */
  change: Record<string, unknown>;
  /** The source method MapLibre applies the change with, and its arguments. */
  method: string;
  args: unknown[];
}

interface SourceCase {
  hook: unknown;
  type: string;
  /** Its data-config at mount, without id and mapId. */
  config: Record<string, unknown>;
  /** Config changes MapLibre can apply to the source in place. */
  inPlace: InPlaceChange[];
  /** A config change that needs a new source; none when every config key has a setter. */
  reAdd?: Record<string, unknown>;
  /** Whether it pushes source:data and source:error for the source's map events. */
  reportsEvents: boolean;
  /** A layer component that can draw the source: its hook, its MapLibre type and its config. */
  layer: { hook: unknown; type: string; config: Record<string, unknown> };
}

const CORNERS = [[-80.4, 46.4], [-71.5, 46.4], [-71.5, 37.9], [-80.4, 37.9]];
const MOVED = [[-81, 47], [-72, 47], [-72, 38], [-81, 38]];
const RASTER_LAYER = { hook: RasterLayerHook, type: 'raster', config: { paint: { 'raster-opacity': 0.8 }, layout: {} } };

const SOURCES: [string, SourceCase][] = [
  ['VectorTileSourceHook', {
    hook: VectorTileSourceHook, type: 'vector',
    config: { url: 'https://tiles.example.com/a.json', minzoom: 0, maxzoom: 14, volatile: false },
    inPlace: [
      { change: { url: 'https://tiles.example.com/b.json' }, method: 'setUrl', args: ['https://tiles.example.com/b.json'] },
      {
        change: { tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'] },
        method: 'setTiles',
        args: [['https://tiles.example.com/{z}/{x}/{y}.pbf']]
      }
    ],
    reAdd: { scheme: 'tms' },
    reportsEvents: true,
    layer: { hook: CircleLayerHook, type: 'circle', config: { sourceLayer: 'places', paint: { 'circle-radius': 6 }, layout: {} } }
  }],
  ['RasterTileSourceHook', {
    hook: RasterTileSourceHook, type: 'raster',
    config: { tiles: ['https://a.example.com/{z}/{x}/{y}.png'], tileSize: 256, tms: false, volatile: false },
    inPlace: [
      {
        change: { tiles: ['https://b.example.com/{z}/{x}/{y}.png'] },
        method: 'setTiles',
        args: [['https://b.example.com/{z}/{x}/{y}.png']]
      },
      { change: { url: 'https://b.example.com/tiles.json' }, method: 'setUrl', args: ['https://b.example.com/tiles.json'] }
    ],
    reAdd: { tileSize: 512 },
    reportsEvents: true,
    layer: RASTER_LAYER
  }],
  ['RasterDEMSourceHook', {
    hook: RasterDEMSourceHook, type: 'raster-dem',
    config: { url: 'https://dem.example.com/a.json', tileSize: 256, encoding: 'terrarium', volatile: false },
    inPlace: [{ change: { url: 'https://dem.example.com/b.json' }, method: 'setUrl', args: ['https://dem.example.com/b.json'] }],
    reAdd: { encoding: 'mapbox' },
    reportsEvents: true,
    layer: { hook: HillshadeLayerHook, type: 'hillshade', config: { paint: { 'hillshade-exaggeration': 0.5 }, layout: {} } }
  }],
  ['ImageSourceHook', {
    hook: ImageSourceHook, type: 'image',
    config: { url: 'https://img.example.com/a.png', coordinates: CORNERS },
    inPlace: [
      {
        change: { url: 'https://img.example.com/b.png' },
        method: 'updateImage',
        args: [{ url: 'https://img.example.com/b.png', coordinates: CORNERS }]
      },
      { change: { coordinates: MOVED }, method: 'setCoordinates', args: [MOVED] }
    ],
    reportsEvents: false,
    layer: RASTER_LAYER
  }],
  ['VideoSourceHook', {
    hook: VideoSourceHook, type: 'video',
    config: { urls: ['https://video.example.com/a.mp4'], coordinates: CORNERS },
    inPlace: [{ change: { coordinates: MOVED }, method: 'setCoordinates', args: [MOVED] }],
    reAdd: { urls: ['https://video.example.com/b.mp4', 'https://video.example.com/b.webm'] },
    reportsEvents: false,
    layer: RASTER_LAYER
  }]
];

const RE_ADDED = SOURCES.filter(([, c]) => c.reAdd) as [string, SourceCase & { reAdd: Record<string, unknown> }][];
const REPORTING = SOURCES.filter(([, c]) => c.reportsEvents);
const NOT_REPORTING = SOURCES.filter(([, c]) => !c.reportsEvents);
const IN_PLACE: [string, string, SourceCase, InPlaceChange][] = SOURCES.flatMap(([name, c]) =>
  c.inPlace.map((p): [string, string, SourceCase, InPlaceChange] => [name, p.method, c, p])
);

const ID = 'src';
const SRC = { source_id: ID };
const ADDED = ['source:added', SRC];
const REMOVED = ['source:removed', SRC];
const STYLEDATA = { type: 'styledata', dataType: 'style' };

/** The `data-config` its component renders, plus `extra`. */
function configFor(c: SourceCase, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: ID, mapId: 'map', ...c.config, ...extra };
}

/** The source specification the map should hold. */
function specFor(c: SourceCase, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: c.type, ...c.config, ...extra };
}

function register(map = new FakeMap()): FakeMap {
  MapManager.register('map', map as never);
  return map;
}

/** The source's specification as the map holds it now. */
function onMap(map: FakeMap): Record<string, unknown> | undefined {
  return map.getSource(ID)?.serialize();
}

/** The source:added and source:removed events the hook pushed, in order. */
function lifecycle(m: MountedHook): unknown[][] {
  return m.hook.pushEvent.mock.calls.filter(([name]: [string]) => name === 'source:added' || name === 'source:removed');
}

/** Mount a layer component that draws the case's source. */
function mountLayer(c: SourceCase, id = 'lyr', extra: Record<string, unknown> = {}): MountedHook {
  return mountHook(c.layer.hook, { id, mapId: 'map', sourceId: ID, ...c.layer.config, ...extra });
}

/** Add a layer that draws the source the way application code or a basemap would. */
function addUnmanagedLayer(map: FakeMap, c: SourceCase, id = 'user'): void {
  map.addLayer({ id, type: c.layer.type, source: ID, paint: c.layer.config.paint });
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

describe('a source mounted before its map is registered (#17)', () => {
  it.each(SOURCES)('%s is added once the map registers', (_name, c) => {
    const m = mountHook(c.hook, configFor(c));
    expect(lifecycle(m)).toEqual([]);

    const map = register();

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(onMap(map)).toEqual(specFor(c));
    expect(lifecycle(m)).toEqual([ADDED]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(SOURCES)('%s destroyed before the map registers leaves nothing behind', (_name, c) => {
    const m = mountHook(c.hook, configFor(c));
    m.destroy();

    const map = register();

    expect(map.getSource(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });
});

describe('a source is added as soon as the style can accept it (#12)', () => {
  it.each(SOURCES)('%s mounted after load while tiles are loading is added right away', (_name, c) => {
    const map = register();
    map.setTilesLoading(true);

    const m = mountHook(c.hook, configFor(c));

    expect(onMap(map)).toEqual(specFor(c));
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s mounted while the style document loads is added when it arrives', (_name, c) => {
    const map = register(new FakeMap(undefined, { loaded: false }));
    const m = mountHook(c.hook, configFor(c));
    expect(map.addSource).not.toHaveBeenCalled();

    map.finishStyleLoad();

    expect(onMap(map)).toEqual(specFor(c));
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s destroyed before the style loads adds nothing, pushes nothing and leaves no listener', (_name, c) => {
    const map = register(new FakeMap(undefined, { loaded: false }));
    const m = mountHook(c.hook, configFor(c));

    m.destroy();
    expect(map.listenerKeys()).toEqual([]);

    map.finishStyleLoad();
    expect(map.getSource(ID)).toBeUndefined();
    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });
});

describe('updated() applies the new config (#3)', () => {
  it.each(IN_PLACE)('%s applies a change with %s, in place', (_name, method, c, p) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const source = map.getSource(ID);

    m.update(configFor(c, p.change));

    expect(source[method]).toHaveBeenCalledTimes(1);
    expect(source[method]).toHaveBeenCalledWith(...p.args);
    expect(map.getSource(ID)).toBe(source);
    expect(onMap(map)).toEqual(specFor(c, p.change));
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(RE_ADDED)('%s is replaced by a new source for a change it cannot apply in place', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));

    m.update(configFor(c, c.reAdd));

    expect(onMap(map)).toEqual(specFor(c, c.reAdd));
    expect(map.removeSource).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(RE_ADDED)(
    '%s keeps every layer that uses it, managed or not, as it was and where it was, across a replacement',
    (_name, c) => {
      const map = register();
      const errors = vi.fn();
      map.on('error', errors);
      const m = mountHook(c.hook, configFor(c));
      const managed = mountLayer(c, 'managed');
      map.addLayer({ id: 'middle', type: 'background' });
      addUnmanagedLayer(map, c, 'user');
      const [paintKey] = Object.keys(c.layer.config.paint as object);
      map.setPaintProperty('user', paintKey, 0.3);
      map.addLayer({ id: 'top', type: 'background' });
      const before = ['managed', 'user'].map((id) => JSON.parse(JSON.stringify(map.getLayer(id))));

      m.update(configFor(c, c.reAdd));

      expect(onMap(map)).toEqual(specFor(c, c.reAdd));
      expect(map.getLayersOrder()).toEqual(['managed', 'middle', 'user', 'top']);
      expect(['managed', 'user'].map((id) => map.getLayer(id))).toEqual(before);
      expect(errors).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(managed.hook.pushEvent.mock.calls.map(([name]: [string]) => name)).toEqual(['layer:added']);
      expect(lifecycle(m)).toEqual([ADDED]);
    }
  );

  it.each(RE_ADDED)('%s puts the previous source and its layers back when MapLibre refuses the new one', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    mountLayer(c, 'managed');
    addUnmanagedLayer(map, c, 'user');
    map.addSource.mockImplementationOnce(() => {
      throw new Error('Invalid source');
    });

    m.update(configFor(c, c.reAdd));

    expect(onMap(map)).toEqual(specFor(c));
    expect(map.getLayersOrder()).toEqual(['managed', 'user']);
    expect(m.hook.pushEvent).toHaveBeenLastCalledWith('source:error', { source_id: ID, error: 'Invalid source' });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(`"${ID}"`), expect.any(Error));
  });

  it.each(SOURCES)('%s added after an update uses the latest config', (_name, c) => {
    const change = { ...c.inPlace[0].change, ...c.reAdd };
    const m = mountHook(c.hook, configFor(c));
    m.update(configFor(c, change));

    const map = register();

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(onMap(map)).toEqual(specFor(c, change));
    expect(map.getSource(ID)[c.inPlace[0].method]).not.toHaveBeenCalled();
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s changes nothing on the map for an update that changes nothing', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const source = map.getSource(ID);

    m.update(Object.fromEntries(Object.entries(configFor(c)).reverse()));

    for (const { method } of c.inPlace) {
      expect(source[method], method).not.toHaveBeenCalled();
    }
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.addSource).toHaveBeenCalledTimes(1);
  });
});

describe('a source survives style changes (#4)', () => {
  it.each(SOURCES)('%s is put back with its current config after a diff style change', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const { change } = c.inPlace[0];
    m.update(configFor(c, change));

    map.setStyle({ version: 8, sources: {}, layers: [{ id: 'base', type: 'background' }] });

    expect(onMap(map)).toEqual(specFor(c, change));
    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s is put back with its current config after a full style rebuild', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const { change } = c.inPlace[0];
    m.update(configFor(c, change));

    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    expect(map.getSource(ID)).toBeUndefined();
    map.finishStyleLoad();

    expect(onMap(map)).toEqual(specFor(c, change));
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s and a layer mounted before it come back together, without a missing-source warning', (_name, c) => {
    const layer = mountLayer(c);
    const m = mountHook(c.hook, configFor(c));
    // The layer attaches first, before its source is on the map, and its
    // listeners run first on every style change.
    const map = register();
    expect(map.getLayer('lyr')).toMatchObject({ type: c.layer.type, source: ID });

    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    map.finishStyleLoad();

    expect(onMap(map)).toEqual(specFor(c));
    expect(map.getLayer('lyr')).toMatchObject({ type: c.layer.type, source: ID });
    expect(warn).not.toHaveBeenCalled();
    expect(lifecycle(m)).toEqual([ADDED]);
    expect(layer.hook.pushEvent.mock.calls.map(([name]: [string]) => name)).toEqual(['layer:added']);
  });

  it.each(SOURCES)('%s leaves alone a source with its id that the new style brings', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const basemap = { ...specFor(c), attribution: 'basemap' };

    map.setStyle({ version: 8, sources: { [ID]: basemap }, layers: [{ id: 'base', type: 'background' }] });

    expect(onMap(map)).toEqual(basemap);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    expect(lifecycle(m)).toEqual([ADDED]);
  });

  it.each(SOURCES)('%s does nothing on the style events that follow its own add', (_name, c) => {
    const map = register();
    mountHook(c.hook, configFor(c));
    const listeners = map.listenerKeys();

    for (let i = 0; i < 3; i++) {
      map.emit('styledata', STYLEDATA);
      map.emit('sourcedata', { sourceId: ID, isSourceLoaded: true });
    }

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual(listeners);
  });

  it.each(SOURCES)('%s attaches its listeners once, and keeps them through style changes and replacements', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const listeners = map.listenerKeys();
    expect(new Set(listeners).size).toBe(listeners.length);

    map.setStyle({ version: 8, sources: {}, layers: [] });
    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    map.finishStyleLoad();
    m.update(configFor(c, c.reAdd ?? c.inPlace[0].change));

    expect(map.listenerKeys()).toEqual(listeners);
  });
});

describe('destroyed() (#18)', () => {
  it.each(SOURCES)('%s removes a source no layer uses, every listener, and pushes source:removed', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));

    m.destroy();

    expect(map.getSource(ID)).toBeUndefined();
    expect(map.listenerKeys()).toEqual([]);
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
  });

  it.each(SOURCES)('%s waits for the layer component that uses it, then removes the source and pushes source:removed', (_name, c) => {
    const map = register();
    const errors = vi.fn();
    map.on('error', errors);
    const m = mountHook(c.hook, configFor(c));
    const layer = mountLayer(c);

    m.destroy();

    expect(onMap(map)).toEqual(specFor(c));
    expect(lifecycle(m)).toEqual([ADDED]);
    expect(errors).not.toHaveBeenCalled();

    layer.destroy();

    expect(map.getSource(ID)).toBeUndefined();
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
    expect(map.listenerKeys()).toEqual(['error']);
    expect(errors).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(SOURCES)('%s waits for a layer added by other code, re-checking on style events', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    addUnmanagedLayer(map, c);

    m.destroy();
    map.emit('styledata', STYLEDATA);
    expect(map.getSource(ID)).toBeDefined();
    expect(map.getLayer('user')).toBeDefined();
    expect(lifecycle(m)).toEqual([ADDED]);

    map.removeLayer('user');
    map.emit('styledata', STYLEDATA); // fired by MapLibre on the next frame

    expect(map.getSource(ID)).toBeUndefined();
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
    expect(map.listenerKeys()).toEqual([]);
  });

  it.each(SOURCES)('%s waiting for its layers pushes source:removed when a style change drops the source', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    addUnmanagedLayer(map, c);
    m.destroy();
    expect(map.getSource(ID)).toBeDefined();
    expect(lifecycle(m)).toEqual([ADDED]);

    map.setStyle({ version: 8, sources: {}, layers: [] });

    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
    expect(map.listenerKeys()).toEqual([]);
  });

  it.each(SOURCES)('%s waiting for its layers pushes source:removed when the map is removed', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    addUnmanagedLayer(map, c);
    m.destroy();
    expect(map.getSource(ID)).toBeDefined();
    expect(lifecycle(m)).toEqual([ADDED]);

    map.remove();

    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
    expect(map.listenerKeys()).toEqual([]);
  });

  it.each(SOURCES)('%s destroyed after its map hook does not touch the removed map', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    // The map hook's destroyed(): map.remove() deletes the map's style, so
    // getSource() and removeSource() throw, then the map is unregistered.
    map.getSource.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'getSource')");
    });
    MapManager.unregister('map');

    m.destroy();

    expect(consoleError).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual([]);
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
  });

  it.each(SOURCES)('%s mounted again while its removal waits takes the source over, with its new config', (_name, c) => {
    const map = register();
    const errors = vi.fn();
    map.on('error', errors);
    const first = mountHook(c.hook, configFor(c));
    const layer = mountLayer(c);
    first.destroy();
    const { change, method } = c.inPlace[0];
    const source = map.getSource(ID);

    const second = mountHook(c.hook, configFor(c, change));

    expect(source[method]).toHaveBeenCalledTimes(1);
    expect(onMap(map)).toEqual(specFor(c, change));
    expect(lifecycle(second)).toEqual([]);

    // The first hook's removal no longer waits for this layer.
    layer.destroy();
    expect(onMap(map)).toEqual(specFor(c, change));
    expect(lifecycle(first)).toEqual([ADDED]);

    second.destroy();
    expect(map.getSource(ID)).toBeUndefined();
    expect(lifecycle(second)).toEqual([REMOVED]);
    expect(map.listenerKeys()).toEqual(['error']);
    expect(errors).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(RE_ADDED)('%s mounted again while its removal waits replaces the source under its layer when it must', (_name, c) => {
    const map = register();
    const first = mountHook(c.hook, configFor(c));
    mountLayer(c);
    first.destroy();

    const second = mountHook(c.hook, configFor(c, c.reAdd));

    expect(onMap(map)).toEqual(specFor(c, c.reAdd));
    expect(map.getLayer('lyr')).toMatchObject({ type: c.layer.type, source: ID });
    expect(lifecycle(first)).toEqual([ADDED]);
    expect(lifecycle(second)).toEqual([]);
  });
});

describe('a source with its id already on the map (#46)', () => {
  const takeOverWarning = expect.stringContaining(`Source "${ID}" was already on map "map"`);

  /** A registered map that already has a source with the case's id and specification, from the style or other code. */
  function mapWithSource(c: SourceCase): FakeMap {
    const map = register();
    map.addSource(ID, specFor(c));
    map.addSource.mockClear();
    return map;
  }

  it.each(SOURCES)('%s takes it over for updates, with one warning, and leaves it on the map when destroyed', (_name, c) => {
    const map = mapWithSource(c);
    const source = map.getSource(ID);

    const m = mountHook(c.hook, configFor(c));
    map.emit('styledata', STYLEDATA);
    const { change, method } = c.inPlace[0];
    m.update(configFor(c, change));

    expect(map.addSource).not.toHaveBeenCalled();
    expect(source[method]).toHaveBeenCalledTimes(1);
    expect(onMap(map)).toEqual(specFor(c, change));
    expect(warn.mock.calls).toEqual([[takeOverWarning]]);

    m.destroy();

    expect(map.getSource(ID)).toBe(source);
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(map.listenerKeys()).toEqual([]);
    expect(lifecycle(m)).toEqual([]);
  });

  it.each(RE_ADDED)('%s does not replace a source it took over for a change that takes a new source, and says so', (_name, c) => {
    const map = mapWithSource(c);
    const source = map.getSource(ID);
    const m = mountHook(c.hook, configFor(c));

    m.update(configFor(c, c.reAdd));

    expect(map.getSource(ID)).toBe(source);
    expect(onMap(map)).toEqual(specFor(c));
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('is not applied');
    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });

  it.each(SOURCES)('%s adds the source itself once a style change drops the one it took over, and removes it as its own', (_name, c) => {
    const map = mapWithSource(c);
    const m = mountHook(c.hook, configFor(c));

    map.setStyle({ version: 8, sources: {}, layers: [] });

    expect(onMap(map)).toEqual(specFor(c));
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(lifecycle(m)).toEqual([ADDED]);

    m.destroy();

    expect(map.getSource(ID)).toBeUndefined();
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
  });

  it.each(SOURCES)('%s leaves on the map the source with its id that a style change brings in place of its own', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const basemap = { ...specFor(c), attribution: 'basemap' };

    map.setStyle({ version: 8, sources: { [ID]: basemap }, layers: [] });
    expect(warn.mock.calls).toEqual([[takeOverWarning]]);

    m.destroy();

    expect(onMap(map)).toEqual(basemap);
    expect(map.removeSource).not.toHaveBeenCalled();
    // Its own source is gone all the same.
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
  });

  it.each(SOURCES)('%s waiting for its layers leaves alone the source with its id that a style change brings', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    addUnmanagedLayer(map, c);
    m.destroy();
    const basemap = { ...specFor(c), attribution: 'basemap' };

    map.setStyle({ version: 8, sources: { [ID]: basemap }, layers: [{ id: 'user', type: c.layer.type, source: ID }] });

    expect(onMap(map)).toEqual(basemap);
    expect(map.getLayer('user')).toBeDefined();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(lifecycle(m)).toEqual([ADDED, REMOVED]);
    expect(map.listenerKeys()).toEqual([]);
  });

  it.each(SOURCES)('%s mounted again while the one that took the source over is mounted leaves it on the map too', (_name, c) => {
    const map = mapWithSource(c);
    const source = map.getSource(ID);
    const first = mountHook(c.hook, configFor(c));

    const second = mountHook(c.hook, configFor(c));
    first.destroy();
    second.destroy();

    expect(map.getSource(ID)).toBe(source);
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(lifecycle(first)).toEqual([]);
    expect(lifecycle(second)).toEqual([]);
  });

  it.each(RE_ADDED)('%s replaced under a layer component leaves the layer that component\'s own', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    const layer = mountLayer(c);
    m.update(configFor(c, c.reAdd));

    layer.destroy();

    expect(map.getLayer('lyr')).toBeUndefined();
    expect(layer.hook.pushEvent.mock.calls.map(([name]: [string]) => name)).toEqual(['layer:added', 'layer:removed']);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('source events', () => {
  const tile = { tileID: { canonical: { x: 1, y: 2, z: 3 } } };

  it.each(REPORTING)('%s pushes source:data and source:error with the same payloads as before, for its own source only', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    m.hook.pushEvent.mockClear();

    map.emit('sourcedata', { sourceId: ID, dataType: 'source', sourceDataType: 'content', tile, isSourceLoaded: false });
    map.emit('sourcedataloading', { sourceId: ID, dataType: 'source', sourceDataType: 'metadata' });
    map.emit('sourcedata', { sourceId: 'other', dataType: 'source', tile, isSourceLoaded: true });
    map.emit('error', { sourceId: ID, error: new Error('Tile failed'), tile });
    map.emit('error', { sourceId: ID });
    map.emit('error', { sourceId: 'other', error: new Error('Elsewhere') });

    expect(m.hook.pushEvent.mock.calls).toEqual([
      ['source:data', {
        source_id: ID, data_type: 'source', source_data_type: 'content',
        tile: { coord: { x: 1, y: 2, z: 3 }, isSourceLoaded: false }
      }],
      ['source:data', { source_id: ID, data_type: 'source', source_data_type: 'metadata', tile: undefined }],
      ['source:error', { source_id: ID, error: 'Tile failed', tile }],
      ['source:error', { source_id: ID, error: 'Unknown error', tile: undefined }]
    ]);
  });

  it.each(NOT_REPORTING)('%s pushes nothing for the source map events, as before', (_name, c) => {
    const map = register();
    const m = mountHook(c.hook, configFor(c));
    m.hook.pushEvent.mockClear();

    map.emit('sourcedata', { sourceId: ID, dataType: 'source', sourceDataType: 'content', tile, isSourceLoaded: false });
    map.emit('sourcedataloading', { sourceId: ID, dataType: 'source' });
    map.emit('error', { sourceId: ID, error: new Error('Tile failed'), tile });

    expect(m.hook.pushEvent).not.toHaveBeenCalled();
  });

  it.each(SOURCES)('%s pushes source:error when MapLibre throws on adding it, and retries only after a config change', (_name, c) => {
    const map = register();
    map.addSource.mockImplementationOnce(() => {
      throw new Error('Source is invalid');
    });

    const m = mountHook(c.hook, configFor(c));
    expect(m.hook.pushEvent.mock.calls).toEqual([['source:error', { source_id: ID, error: 'Source is invalid' }]]);

    map.emit('styledata', STYLEDATA);
    expect(map.addSource).toHaveBeenCalledTimes(1);

    m.update(configFor(c, c.inPlace[0].change));
    expect(onMap(map)).toEqual(specFor(c, c.inPlace[0].change));
    expect(lifecycle(m)).toEqual([ADDED]);
  });
});

describe('sources in a LiveView', () => {
  const attr = (value: unknown) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const MAP = '<div id="m" phx-hook="MapHook" phx-update="ignore"></div>';
  const PLACES = { source_id: 'places' };
  const POINTS = { layer_id: 'points', layerId: 'points' };

  function source(config: Record<string, unknown> = {}): string {
    const full = { id: 'places', mapId: 'm', url: 'https://tiles.example.com/places.json', volatile: false, ...config };
    return `<div id="places" phx-hook="VectorTileSourceHook" data-config="${attr(full)}" style="display: none;"></div>`;
  }

  const circle =
    `<div id="points" phx-hook="CircleLayerHook" data-config="${attr({
      id: 'points', mapId: 'm', sourceId: 'places', sourceLayer: 'place', paint: { 'circle-radius': 6 }, layout: {}
    })}" style="display: none;"></div>`;

  const fakeMap = () => MapManager.get('m') as unknown as FakeMap;
  const lifecyclePushes = (pushes: [string, unknown][]) =>
    pushes.filter(([name]) => /^(source|layer):(added|removed)$/.test(name));

  it('adds a source and its layer rendered before their map (#17)', () => {
    const lv = renderLiveView(source() + circle + MAP);

    expect(fakeMap().getSource('places').serialize()).toEqual({
      type: 'vector', url: 'https://tiles.example.com/places.json', volatile: false
    });
    expect(fakeMap().getLayer('points')).toMatchObject({ type: 'circle', source: 'places' });
    expect(lifecyclePushes(lv.pushes)).toEqual([
      ['source:added', PLACES],
      ['layer:added', POINTS]
    ]);
  });

  it('applies a re-rendered url in place, and replaces the source under its layer for a new scheme (#3)', () => {
    const lv = renderLiveView(MAP + source() + circle);
    const map = fakeMap();
    const first = map.getSource('places');

    lv.render(MAP + source({ url: 'https://tiles.example.com/v2.json' }) + circle);

    expect(first.setUrl).toHaveBeenCalledWith('https://tiles.example.com/v2.json');
    expect(map.getSource('places')).toBe(first);

    lv.render(MAP + source({ url: 'https://tiles.example.com/v2.json', scheme: 'tms' }) + circle);

    expect(map.getSource('places').serialize()).toMatchObject({ scheme: 'tms' });
    expect(map.getLayer('points')).toMatchObject({ type: 'circle', source: 'places', 'source-layer': 'place' });
    expect(lifecyclePushes(lv.pushes)).toEqual([
      ['source:added', PLACES],
      ['layer:added', POINTS]
    ]);
  });

  it('removes a source destroyed before its layer once the layer is gone, then adds it again (#18)', () => {
    const lv = renderLiveView(MAP + source() + circle);
    const map = fakeMap();
    const errors = vi.fn();
    map.on('error', errors);

    // LiveView destroys hooks in document order: the source before its layer.
    lv.render(MAP);

    expect(map.getLayer('points')).toBeUndefined();
    expect(map.getSource('places')).toBeUndefined();
    expect(errors).not.toHaveBeenCalled();
    expect(lifecyclePushes(lv.pushes)).toEqual([
      ['source:added', PLACES],
      ['layer:added', POINTS],
      ['source:removed', PLACES],
      ['layer:removed', POINTS]
    ]);

    lv.render(MAP + source() + circle);

    expect(map.getSource('places')).toBeDefined();
    expect(map.getLayer('points')).toBeDefined();
    expect(lifecyclePushes(lv.pushes).slice(4)).toEqual([
      ['source:added', PLACES],
      ['layer:added', POINTS]
    ]);
  });

  it('lets a source rendered again while its removal waits take the source over (#18)', () => {
    const lv = renderLiveView(MAP + source() + circle);
    const map = fakeMap();
    const errors = vi.fn();
    map.on('error', errors);

    lv.render(MAP + circle);
    expect(map.getSource('places')).toBeDefined();

    lv.render(MAP + source({ url: 'https://tiles.example.com/v2.json' }) + circle);

    expect(map.getSource('places').serialize()).toMatchObject({ url: 'https://tiles.example.com/v2.json' });
    expect(errors).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(lifecyclePushes(lv.pushes)).toEqual([
      ['source:added', PLACES],
      ['layer:added', POINTS]
    ]);

    lv.render(MAP);

    expect(map.getSource('places')).toBeUndefined();
    expect(lifecyclePushes(lv.pushes).slice(2)).toEqual([
      ['source:removed', PLACES],
      ['layer:removed', POINTS]
    ]);
  });
});
