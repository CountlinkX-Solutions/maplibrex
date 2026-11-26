/**
 * TerrainHook keeps the map's 3D terrain on for as long as its component
 * lives, with the same guarantees as the layer and source components: it is
 * enabled once its map registers (#17), as soon as the style can take it and
 * its DEM source is there, in any template order (#5), follows `updated()`,
 * comes back after a style change (#4), and `destroyed()` turns off only its
 * own terrain.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { ManagedSource } from '../js/maplibrex/core/managed-source';
import { TerrainHook } from '../js/maplibrex/hooks';
import { FakeMap, type StyleSpec } from './mocks/maplibre-gl';
import { type MountedHook, mountHook, renderLiveView, resetEnvironment } from './helpers';

const DEM = { type: 'raster-dem', tiles: ['https://dem.example.com/{z}/{x}/{y}.png'], tileSize: 256 };
const STYLEDATA = { type: 'styledata', dataType: 'style' };
const BASEMAP: StyleSpec = {
  version: 8,
  sources: { base: { type: 'vector', url: 'base.json' } },
  layers: [{ id: 'water', type: 'fill', source: 'base', 'source-layer': 'water' }]
};

/** The `data-config` the terrain component renders, plus `extra`. */
function configFor(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'terrain-map', mapId: 'map', sourceId: 'dem', exaggeration: 1.5, ...extra };
}

/** A registered map, already loaded, with the DEM source unless `withSource` is false. */
function register(withSource = true, map = new FakeMap()): FakeMap {
  if (withSource) map.addSource('dem', DEM);
  MapManager.register('map', map as never);
  return map;
}

/** The names of the events the hook pushed, in order. */
function pushed(m: MountedHook): string[] {
  return m.hook.pushEvent.mock.calls.map(([name]: [string]) => name);
}

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvironment();
});

describe('terrain mounted before its map is registered (#17)', () => {
  it('is enabled once the map registers', () => {
    const m = mountHook(TerrainHook, configFor());
    expect(pushed(m)).toEqual([]);

    const map = register();

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(m.hook.pushEvent.mock.calls).toEqual([['terrain:enabled', { source_id: 'dem', exaggeration: 1.5 }]]);
    expect(error).not.toHaveBeenCalled();
  });

  it('destroyed before the map registers leaves nothing behind', () => {
    const m = mountHook(TerrainHook, configFor());
    m.destroy();

    const map = register();

    expect(map.getTerrain()).toBeNull();
    expect(map.listenerKeys()).toEqual([]);
    expect(pushed(m)).toEqual([]);
  });
});

describe('terrain is enabled as soon as the style can take it (#12)', () => {
  it('mounted after load while tiles are loading, it is enabled right away', () => {
    const map = register();
    map.setTilesLoading(true);

    const m = mountHook(TerrainHook, configFor());

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });

  it('mounted while the style document loads, it is enabled when the style arrives', () => {
    const map = register(false, new FakeMap(undefined, { loaded: false }));
    const m = mountHook(TerrainHook, configFor());
    expect(map.setTerrain).not.toHaveBeenCalled();

    map.finishStyleLoad({ ...BASEMAP, sources: { ...BASEMAP.sources, dem: DEM } });

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });
});

describe('terrain whose DEM source is not there yet (#5)', () => {
  it('is enabled when the source appears, after one warning and no error', () => {
    const map = register(false);
    const errors = vi.fn();
    map.on('error', errors);
    const m = mountHook(TerrainHook, configFor());
    expect(map.getTerrain()).toBeNull();

    // Unrelated map activity while it waits.
    map.addSource('other', DEM);
    map.emit('styledata', STYLEDATA);
    map.emit('sourcedata', { sourceId: 'other', isSourceLoaded: true });
    expect(map.getTerrain()).toBeNull();

    map.addSource('dem', DEM);

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(m.hook.pushEvent.mock.calls).toEqual([['terrain:enabled', { source_id: 'dem', exaggeration: 1.5 }]]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"dem"'));
    expect(errors).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps waiting for a source that appears much later, through style changes', () => {
    const map = register(false);
    const m = mountHook(TerrainHook, configFor());

    map.setStyle(BASEMAP);
    map.setStyle(BASEMAP, { diff: false });
    map.finishStyleLoad();
    expect(map.getTerrain()).toBeNull();

    map.addSource('dem', DEM);

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn about a source a source component is about to add', () => {
    const map = register(false, new FakeMap(undefined, { loaded: false }));
    const source = new ManagedSource('map', 'dem', DEM);
    const m = mountHook(TerrainHook, configFor());

    map.finishStyleLoad(BASEMAP);

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
    expect(warn).not.toHaveBeenCalled();
    m.destroy();
    source.destroy();
  });

  it('destroyed while waiting leaves nothing behind and pushes nothing', () => {
    const map = register(false);
    const m = mountHook(TerrainHook, configFor());

    m.destroy();
    expect(map.listenerKeys()).toEqual([]);

    map.addSource('dem', DEM);
    expect(map.getTerrain()).toBeNull();
    expect(pushed(m)).toEqual([]);
  });
});

describe('updated() applies the new config', () => {
  it('changes the exaggeration, also while tiles are loading', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());
    map.setTilesLoading(true);

    m.update(configFor({ exaggeration: 3 }));

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 3 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });

  it('moves to another source, waiting for it when it is not there yet', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());

    m.update(configFor({ sourceId: 'dem2' }));
    // The previous terrain stays until the new source can take over.
    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });

    map.addSource('dem2', DEM);

    expect(map.getTerrain()).toEqual({ source: 'dem2', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });

  it('enabled after an update, it uses and reports the latest config', () => {
    const map = register(false);
    const m = mountHook(TerrainHook, configFor());
    m.update(configFor({ exaggeration: 2 }));

    map.addSource('dem', DEM);

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 2 });
    expect(m.hook.pushEvent.mock.calls).toEqual([['terrain:enabled', { source_id: 'dem', exaggeration: 2 }]]);
  });

  it('changes nothing on the map for an update that changes nothing', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());

    m.update(configFor());

    expect(map.setTerrain).toHaveBeenCalledTimes(1);
  });
});

describe('terrain survives style changes (#4)', () => {
  it('is put back with its current config after a full rebuild, without pushing terrain:enabled again', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());
    m.update(configFor({ exaggeration: 2 }));

    map.setStyle({ ...BASEMAP, sources: { ...BASEMAP.sources, dem: DEM } }, { diff: false });
    map.finishStyleLoad();

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 2 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });

  // A diffing setStyle while terrain is on turns into a full rebuild in MapLibre.
  it('is put back on its source component\'s source after a basemap switch', () => {
    const map = register(false, new FakeMap(undefined, { loaded: false }));
    map.finishStyleLoad(BASEMAP);
    const source = new ManagedSource('map', 'dem', DEM);
    const m = mountHook(TerrainHook, configFor());

    map.setStyle({ version: 8, sources: {}, layers: [] });
    map.finishStyleLoad();

    expect(map.getSource('dem')).toBeDefined();
    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
    expect(warn).toHaveBeenCalledTimes(1); // MapLibre's own "Unable to perform style diff"
    m.destroy();
    source.destroy();
  });

  it('does nothing on the style and source events that follow its own setTerrain', () => {
    const map = register();
    mountHook(TerrainHook, configFor());
    const listeners = map.listenerKeys();

    for (let i = 0; i < 3; i++) {
      map.emit('styledata', STYLEDATA);
      map.emit('sourcedata', { sourceId: 'dem', isSourceLoaded: true });
    }

    expect(map.setTerrain).toHaveBeenCalledTimes(1);
    expect(map.listenerKeys()).toEqual(listeners);
  });
});

describe('a real failure', () => {
  it('pushes terrain:error, and is not retried until the config changes', () => {
    const map = register();
    map.setTerrain.mockImplementationOnce(() => {
      throw new Error('terrain refused');
    });

    const m = mountHook(TerrainHook, configFor());
    map.emit('styledata', STYLEDATA);

    expect(m.hook.pushEvent.mock.calls).toEqual([['terrain:error', { error: 'terrain refused' }]]);
    expect(map.setTerrain).toHaveBeenCalledTimes(1);

    m.update(configFor({ exaggeration: 2 }));

    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 2 });
    expect(pushed(m)).toEqual(['terrain:error', 'terrain:enabled']);
  });
});

describe('destroyed()', () => {
  it('turns its terrain off, removes every listener and pushes terrain:disabled', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());

    m.destroy();

    expect(map.getTerrain()).toBeNull();
    expect(map.listenerKeys()).toEqual([]);
    expect(pushed(m)).toEqual(['terrain:enabled', 'terrain:disabled']);
  });

  it('leaves alone a terrain that is no longer its own', () => {
    const map = register();
    map.addSource('other', DEM);
    const m = mountHook(TerrainHook, configFor());
    map.setTerrain({ source: 'other', exaggeration: 1 });

    m.destroy();

    expect(map.getTerrain()).toEqual({ source: 'other', exaggeration: 1 });
    expect(pushed(m)).toEqual(['terrain:enabled']);
  });

  it('turns off the terrain it set on a source it has since moved away from', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());
    m.update(configFor({ sourceId: 'dem2' }));

    m.destroy();

    expect(map.getTerrain()).toBeNull();
    expect(pushed(m)).toEqual(['terrain:enabled', 'terrain:disabled']);
  });

  it('destroyed after its map hook does not touch the removed map', () => {
    const map = register();
    const m = mountHook(TerrainHook, configFor());
    MapManager.unregister('map');

    m.destroy();

    expect(map.setTerrain).toHaveBeenCalledTimes(1);
    expect(map.listenerKeys()).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('terrain in a LiveView', () => {
  const attr = (value: unknown) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const MAP = '<div id="m" phx-hook="MapHook" phx-update="ignore"></div>';
  const SOURCE =
    `<div id="dem" phx-hook="RasterDEMSourceHook" ` +
    `data-config="${attr({ id: 'dem', mapId: 'm', tiles: DEM.tiles, tileSize: 256 })}" style="display: none;"></div>`;
  const terrain = (exaggeration: number) =>
    `<div id="terrain-m" phx-hook="TerrainHook" ` +
    `data-config="${attr({ mapId: 'm', sourceId: 'dem', exaggeration })}" style="display: none;"></div>`;
  const fakeMap = () => MapManager.get('m') as unknown as FakeMap;
  const terrainPushes = (pushes: [string, unknown][]) => pushes.filter(([name]) => name.startsWith('terrain:'));

  it('is enabled when rendered before its map and its source, follows re-renders and goes with its element', () => {
    const lv = renderLiveView(terrain(1.5) + MAP + SOURCE);
    const map = fakeMap();
    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 1.5 });

    lv.render(terrain(2.5) + MAP + SOURCE);
    expect(map.getTerrain()).toEqual({ source: 'dem', exaggeration: 2.5 });

    lv.render(MAP + SOURCE);
    expect(map.getTerrain()).toBeNull();
    expect(terrainPushes(lv.pushes)).toEqual([
      ['terrain:enabled', { source_id: 'dem', exaggeration: 1.5 }],
      ['terrain:disabled', {}]
    ]);
  });
});
