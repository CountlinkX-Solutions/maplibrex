/**
 * Every hook pushes its events to the LiveView through one helper
 * (core/push.ts), so for every hook:
 *
 * - without an `events` list in its config, the component pushes every event
 *   it emits, with the same payloads as before (#45);
 * - with one, it pushes only the events named in it, and none for an empty
 *   list (#45);
 * - a push that fails (the view is disconnected, the push times out, the hook
 *   is gone) is dropped quietly: no unhandled promise rejection, and the hook
 *   carries on (#23).
 *
 * Each scenario below mounts one hook, with `extra` merged into its config,
 * and makes it emit each of its events once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeOverlay } = vi.hoisted(() => {
  /** deck.gl's MapboxOverlay: a map control that reports picks through the callbacks it was given. */
  class FakeOverlay {
    static last?: FakeOverlay;
    constructor(public props: Record<string, any>) {
      FakeOverlay.last = this;
    }
    setProps(props: Record<string, unknown>): void {
      Object.assign(this.props, props);
    }
    onAdd(): HTMLElement {
      return document.createElement('div');
    }
    onRemove(): void {}
  }
  return { FakeOverlay };
});

// deck.gl itself is not loaded: the overlay is the fake above, and a layer
// whose props ask for it fails to build.
vi.mock('../js/maplibrex/utils/deckgl-lazy-loader', () => ({
  loadDeckGL: async () => ({}),
  requireDeckGL: () => ({ mapbox: { MapboxOverlay: FakeOverlay } })
}));
vi.mock('../js/maplibrex/utils/deckgl-layer-factory', () => ({
  createDeckLayer: (config: { id: string; props?: { fail?: boolean } }) => {
    if (config.props?.fail) throw new Error('Unknown layer type');
    return { id: config.id };
  }
}));

import { MapManager } from '../js/maplibrex/core/map-manager';
import { push } from '../js/maplibrex/core/push';
import {
  BackgroundLayerHook,
  CircleLayerHook,
  DeckGlLayerHook,
  FillExtrusionLayerHook,
  FillLayerHook,
  FullscreenControlHook,
  GeoJSONLayerHook,
  GeolocateControlHook,
  HeatmapLayerHook,
  HillshadeLayerHook,
  ImageSourceHook,
  LineLayerHook,
  MapHook,
  MarkerHook,
  PopupHook,
  RasterDEMSourceHook,
  RasterLayerHook,
  RasterTileSourceHook,
  SkyHook,
  SymbolLayerHook,
  TerrainControlHook,
  TerrainHook,
  VectorTileSourceHook,
  VideoSourceHook
} from '../js/maplibrex/hooks';
import { type FakeMap, FullscreenControl, GeolocateControl, Marker, Popup } from './mocks/maplibre-gl';
import { type MountOptions, type MountedHook, mountHook, registerMap, renderLiveView, resetEnvironment } from './helpers';

type Config = Record<string, unknown>;
type Push = [string, unknown];

interface Scenario {
  /** Mount the hook with `extra` merged into its config and make it emit each of its events once. */
  run(extra: Config, options?: MountOptions): Promise<MountedHook>;
  /** What it pushes without an `events` list, in order. */
  pushes: Push[];
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const GEOJSON = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
const DEM = { type: 'raster-dem', tiles: ['https://dem.example.com/{z}/{x}/{y}.png'], tileSize: 256 };
const feature = { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Point', coordinates: [1, 2] } };

function mapScenario(): Scenario {
  return {
    async run(extra, options) {
      vi.useFakeTimers();
      try {
        const config = { id: 'map', center: [1, 2], zoom: 5, style: { version: 8, sources: {}, layers: [] }, ...extra };
        const m = mountHook(MapHook, config, '', options);
        const map = MapManager.get('map') as unknown as FakeMap;
        map.emit('load');
        map.center = [3, 4];
        map.zoom = 6.123;
        map.bearing = 10.456;
        map.pitch = 20;
        map.emit('moveend');
        vi.advanceTimersByTime(150); // map:moved is debounced
        map.emit('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 3, y: 4 } });
        map.emit('zoomend');
        map.emit('error', { error: new Error('Tile failed') });
        return m;
      } finally {
        vi.useRealTimers();
      }
    },
    pushes: [
      ['map:loaded', { mapId: 'map', type: 'load' }],
      ['map:moved', { mapId: 'map', type: 'moveend', center: [3, 4], zoom: 6.12, bearing: 10.46, pitch: 20 }],
      ['map:clicked', { mapId: 'map', type: 'click', lngLat: [1, 2], point: [3, 4] }],
      ['map:zoom_changed', { mapId: 'map', type: 'zoomend', zoom: 6.123 }],
      ['map:error', { mapId: 'map', type: 'error', error: 'Tile failed' }]
    ]
  };
}

function markerScenario(): Scenario {
  return {
    async run(extra, options) {
      registerMap('map');
      const m = mountHook(MarkerHook, { id: 'pin', mapId: 'map', lngLat: [1, 2], draggable: true, ...extra }, '', options);
      const marker = Marker.instances[0];
      marker.getElement().dispatchEvent(new MouseEvent('click'));
      marker.emit('dragstart');
      marker.lngLat = [3, 4];
      marker.emit('drag');
      marker.emit('dragend');
      return m;
    },
    pushes: [
      ['marker:clicked', { markerId: 'pin', lngLat: [1, 2] }],
      ['marker:drag_start', { markerId: 'pin', lngLat: [1, 2] }],
      ['marker:dragging', { markerId: 'pin', lngLat: [3, 4] }],
      ['marker:drag_end', { markerId: 'pin', lngLat: [3, 4] }]
    ]
  };
}

function popupScenario(): Scenario {
  return {
    async run(extra, options) {
      registerMap('map');
      const config = { id: 'tip', mapId: 'map', lngLat: [1, 2], ...extra };
      const m = mountHook(PopupHook, config, '<div data-popup-content>Hi</div>', options);
      Popup.instances[0].emit('open');
      Popup.instances[0].emit('close');
      return m;
    },
    pushes: [
      ['popup:opened', { popupId: 'tip', lngLat: [1, 2] }],
      ['popup:closed', { popupId: 'tip' }]
    ]
  };
}

const COORDS = {
  latitude: 40.4,
  longitude: -3.7,
  accuracy: 10,
  altitude: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null
};

function geolocateScenario(): Scenario {
  return {
    async run(extra, options) {
      const map = registerMap('map');
      const config = {
        id: 'geo',
        mapId: 'map',
        position: 'top-right',
        trackUserLocation: true,
        showAccuracyCircle: true,
        showUserHeading: true,
        fitBoundsOptions: {},
        ...extra
      };
      const m = mountHook(GeolocateControlHook, config, '', options);
      const control = GeolocateControl.instances[0];
      control.emit('geolocate', { coords: COORDS, timestamp: 1700000000000 });
      control.emit('trackuserlocationstart');
      control.emit('trackuserlocationend');
      control.emit('error', { code: 1, message: 'User denied Geolocation' });
      control._watchState = 'ACTIVE_LOCK';
      map.center = [5, 6];
      map.emit('moveend');
      return m;
    },
    pushes: [
      ['geolocate:location_found', { coords: { ...COORDS, timestamp: 1700000000000 } }],
      ['geolocate:tracking_started', {}],
      ['geolocate:tracking_stopped', {}],
      ['geolocate:location_error', { code: 1, message: 'User denied Geolocation' }],
      ['geolocate:user_location_updated', { coords: { latitude: 6, longitude: 5 } }]
    ]
  };
}

function fullscreenScenario(): Scenario {
  return {
    async run(extra, options) {
      registerMap('map');
      const m = mountHook(FullscreenControlHook, { id: 'fs', mapId: 'map', position: 'top-right', ...extra }, '', options);
      FullscreenControl.instances[0].emit('fullscreenstart');
      FullscreenControl.instances[0].emit('fullscreenend');
      return m;
    },
    pushes: [
      ['fullscreen:entered', { controlId: 'fs', mapId: 'map' }],
      ['fullscreen:exited', { controlId: 'fs', mapId: 'map' }]
    ]
  };
}

function terrainControlScenario(): Scenario {
  return {
    async run(extra, options) {
      const map = registerMap('map');
      map.addSource('dem', DEM);
      const config = {
        id: 'tc',
        mapId: 'map',
        position: 'top-right',
        terrainSourceId: 'dem',
        exaggeration: 1.5,
        enabled: false,
        ...extra
      };
      const m = mountHook(TerrainControlHook, config, '', options);
      const button = map.controlPositions['top-right'].querySelector('button')!;
      button.click();
      map.setTerrain.mockImplementationOnce(() => {
        throw new Error('Terrain failed');
      });
      button.click();
      return m;
    },
    pushes: [
      ['terrain_control:toggled', { enabled: true, source_id: 'dem', exaggeration: 1.5 }],
      ['terrain_control:error', { error: 'Terrain failed' }],
      ['terrain_control:toggled', { enabled: false, source_id: 'dem', exaggeration: 1.5 }]
    ]
  };
}

function terrainScenario(): Scenario {
  return {
    async run(extra, options) {
      const map = registerMap('map');
      map.addSource('dem', DEM);
      const config = { id: 'terrain-map', mapId: 'map', sourceId: 'dem', exaggeration: 1.5, ...extra };
      const m = mountHook(TerrainHook, config, '', options);
      map.setTerrain.mockImplementationOnce(() => {
        throw new Error('Terrain failed');
      });
      m.update({ ...config, exaggeration: 2 });
      m.destroy();
      return m;
    },
    pushes: [
      ['terrain:enabled', { source_id: 'dem', exaggeration: 1.5 }],
      ['terrain:error', { error: 'Terrain failed' }],
      ['terrain:disabled', {}]
    ]
  };
}

function skyScenario(): Scenario {
  return {
    async run(extra, options) {
      const map = registerMap('map');
      const m = mountHook(SkyHook, { id: 'sky', mapId: 'map', paint: {}, ...extra }, '', options);
      // The mock has no sky layer type: stand one in for the removal.
      map.addLayer({ id: 'sky', type: 'background' });
      m.destroy();
      return m;
    },
    pushes: [
      ['sky:added', {}],
      ['sky:removed', {}]
    ]
  };
}

function deckglScenario(): Scenario {
  const object = { name: 'A' };
  const info = { object, layer: { id: 'arcs' }, x: 1, y: 2, coordinate: [3, 4] };
  return {
    async run(extra, options) {
      registerMap('map');
      const config = { id: 'arcs', mapId: 'map', layerType: 'ScatterplotLayer', data: [], props: {}, ...extra };
      const m = mountHook(DeckGlLayerHook, config, '', options);
      await flush(); // mounted() waits for deck.gl to load
      const overlay = FakeOverlay.last!;
      overlay.props.onClick(info);
      overlay.props.onHover(info);
      overlay.props.onDragStart(info);
      overlay.props.onDrag(info);
      overlay.props.onDragEnd(info);
      m.update({ ...config, props: { fail: true } });
      m.destroy();
      return m;
    },
    pushes: [
      ['deckgl:layer_loaded', { layerId: 'arcs' }],
      ['deckgl:click', { layerId: 'arcs', object, x: 1, y: 2, coordinate: [3, 4] }],
      ['deckgl:hover', { layerId: 'arcs', object, x: 1, y: 2 }],
      ['deckgl:drag_start', { layerId: 'arcs', object }],
      ['deckgl:drag', { layerId: 'arcs', object, coordinate: [3, 4] }],
      ['deckgl:drag_end', { layerId: 'arcs' }],
      ['deckgl:error', { error: 'Unknown layer type' }]
    ]
  };
}

/** How a layer's click and hover payloads carry features; none for a layer without those events. */
type FeaturePayload = 'feature' | 'features' | undefined;

function layerScenario(hook: unknown, withSource: boolean, payload: FeaturePayload): Scenario {
  const ids = { layer_id: 'lyr', layerId: 'lyr' };
  const lngLat = { lng: 1, lat: 2 };
  const interaction = { features: [feature], lngLat, point: { x: 3, y: 4 } };
  const featurePart = payload === 'feature' ? { feature } : { features: [feature], lngLat };
  return {
    async run(extra, options) {
      const map = registerMap('map');
      if (withSource) map.addSource('src', GEOJSON);
      const config = { id: 'lyr', mapId: 'map', ...(withSource ? { sourceId: 'src' } : {}), paint: {}, ...extra };
      const m = mountHook(hook, config, '', options);
      map.emit('click', 'lyr', interaction);
      map.emit('mouseenter', 'lyr', interaction);
      map.emit('mouseleave', 'lyr', {});
      m.destroy();
      return m;
    },
    pushes: [
      ['layer:added', ids],
      ...(payload
        ? ([
            ['layer:feature_clicked', { ...ids, ...featurePart }],
            ['layer:feature_mouseenter', { ...ids, ...featurePart }],
            ['layer:feature_mouseleave', ids]
          ] as Push[])
        : []),
      ['layer:removed', ids]
    ]
  };
}

function geojsonScenario(): Scenario {
  const ids = { layer_id: 'points', layerId: 'points' };
  const interaction = { features: [feature], lngLat: { toArray: () => [1, 2] }, point: { x: 3, y: 4 } };
  return {
    async run(extra, options) {
      const map = registerMap('map');
      const config = {
        id: 'points',
        mapId: 'map',
        source: GEOJSON,
        layer: { id: 'points', type: 'circle', source: 'points-source' },
        ...extra
      };
      const m = mountHook(GeoJSONLayerHook, config, '', options);
      map.emit('click', 'points', interaction);
      map.emit('mouseenter', 'points', interaction);
      map.emit('mouseleave', 'points', {});
      m.destroy();
      return m;
    },
    pushes: [
      // The mock reports a new source loaded as soon as it is added.
      ['layer:source_loaded', { ...ids, sourceId: 'points-source' }],
      ['layer:feature_clicked', { ...ids, feature, lngLat: [1, 2], point: [3, 4] }],
      ['layer:feature_mouseenter', { ...ids, feature }],
      ['layer:feature_mouseleave', ids]
    ]
  };
}

function sourceScenario(hook: unknown, config: Config, change: Config, reportsEvents: boolean): Scenario {
  const src = { source_id: 'src' };
  const tile = { tileID: { canonical: { x: 1, y: 2, z: 3 } } };
  return {
    async run(extra, options) {
      const map = registerMap('map');
      // The first add throws: source:error; the update after it adds the source.
      map.addSource.mockImplementationOnce(() => {
        throw new Error('Source refused');
      });
      const full = { id: 'src', mapId: 'map', ...config, ...extra };
      const m = mountHook(hook, full, '', options);
      m.update({ ...full, ...change });
      map.emit('sourcedata', { sourceId: 'src', dataType: 'source', sourceDataType: 'content', tile, isSourceLoaded: false });
      map.emit('error', { sourceId: 'src', error: new Error('Tile failed'), tile });
      m.destroy();
      return m;
    },
    pushes: [
      ['source:error', { ...src, error: 'Source refused' }],
      // The mock fires the new source's metadata `sourcedata` while adding it.
      ...(reportsEvents
        ? ([['source:data', { ...src, data_type: 'source', source_data_type: 'metadata', tile: undefined }]] as Push[])
        : []),
      ['source:added', src],
      ...(reportsEvents
        ? ([
            ['source:data', { ...src, data_type: 'source', source_data_type: 'content', tile: { coord: { x: 1, y: 2, z: 3 }, isSourceLoaded: false } }],
            ['source:error', { ...src, error: 'Tile failed', tile }]
          ] as Push[])
        : []),
      ['source:removed', src]
    ]
  };
}

const CORNERS = [[-80.4, 46.4], [-71.5, 46.4], [-71.5, 37.9], [-80.4, 37.9]];

const SCENARIOS: [string, Scenario][] = [
  ['MapHook', mapScenario()],
  ['MarkerHook', markerScenario()],
  ['PopupHook', popupScenario()],
  ['GeolocateControlHook', geolocateScenario()],
  ['FullscreenControlHook', fullscreenScenario()],
  ['TerrainControlHook', terrainControlScenario()],
  ['TerrainHook', terrainScenario()],
  ['SkyHook', skyScenario()],
  ['DeckGlLayerHook', deckglScenario()],
  ['CircleLayerHook', layerScenario(CircleLayerHook, true, 'feature')],
  ['LineLayerHook', layerScenario(LineLayerHook, true, 'feature')],
  ['FillLayerHook', layerScenario(FillLayerHook, true, 'feature')],
  ['SymbolLayerHook', layerScenario(SymbolLayerHook, true, 'feature')],
  ['FillExtrusionLayerHook', layerScenario(FillExtrusionLayerHook, true, 'features')],
  ['HeatmapLayerHook', layerScenario(HeatmapLayerHook, true, undefined)],
  ['HillshadeLayerHook', layerScenario(HillshadeLayerHook, true, undefined)],
  ['RasterLayerHook', layerScenario(RasterLayerHook, true, undefined)],
  ['BackgroundLayerHook', layerScenario(BackgroundLayerHook, false, undefined)],
  ['GeoJSONLayerHook', geojsonScenario()],
  [
    'VectorTileSourceHook',
    sourceScenario(VectorTileSourceHook, { url: 'https://tiles.example.com/a.json' }, { url: 'https://tiles.example.com/b.json' }, true)
  ],
  [
    'RasterTileSourceHook',
    sourceScenario(
      RasterTileSourceHook,
      { tiles: ['https://a.example.com/{z}/{x}/{y}.png'], tileSize: 256 },
      { tiles: ['https://b.example.com/{z}/{x}/{y}.png'] },
      true
    )
  ],
  [
    'RasterDEMSourceHook',
    sourceScenario(RasterDEMSourceHook, { url: 'https://dem.example.com/a.json' }, { url: 'https://dem.example.com/b.json' }, true)
  ],
  [
    'ImageSourceHook',
    sourceScenario(ImageSourceHook, { url: 'https://img.example.com/a.png', coordinates: CORNERS }, { url: 'https://img.example.com/b.png' }, false)
  ],
  [
    'VideoSourceHook',
    sourceScenario(
      VideoSourceHook,
      { urls: ['https://video.example.com/a.mp4'], coordinates: CORNERS },
      { urls: ['https://video.example.com/b.mp4'] },
      false
    )
  ]
];

/** What the hook pushed, in order, as [event, payload]. */
function recorded(m: MountedHook): Push[] {
  return m.hook.pushEvent.mock.calls.map(([event, payload]: Push) => [event, payload]);
}

/** The names of the events a scenario's hook emits. */
function eventNames(s: Scenario): string[] {
  return [...new Set(s.pushes.map(([event]) => event))];
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetEnvironment();
});

describe('without an events list a component pushes every event, as before (#45)', () => {
  it.each(SCENARIOS)('%s', async (_name, s) => {
    const m = await s.run({});

    expect(recorded(m)).toEqual(s.pushes);
  });
});

describe('with an events list a component pushes only the events it names (#45)', () => {
  const cases = SCENARIOS.flatMap(([hook, s]) => eventNames(s).map((event): [string, string, Scenario] => [hook, event, s]));

  it.each(cases)('%s pushes only %s', async (_hook, event, s) => {
    const m = await s.run({ events: [event] });

    expect(recorded(m)).toEqual(s.pushes.filter(([name]) => name === event));
  });

  it.each(SCENARIOS)('%s pushes nothing for an empty list', async (_name, s) => {
    const m = await s.run({ events: [] });

    expect(recorded(m)).toEqual([]);
  });

  it('a component follows a new events list from a re-render', async () => {
    const map = registerMap('map');
    map.addSource('src', GEOJSON);
    const config = { id: 'lyr', mapId: 'map', sourceId: 'src', paint: {}, events: ['layer:added'] };
    const m = mountHook(CircleLayerHook, config);

    m.update({ ...config, events: ['layer:feature_clicked'] });
    map.emit('click', 'lyr', { features: [feature] });
    m.destroy();

    expect(recorded(m).map(([event]) => event)).toEqual(['layer:added', 'layer:feature_clicked']);
  });
});

describe('a push that fails is dropped quietly (#23)', () => {
  let unhandled: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandled);
  });

  it.each(SCENARIOS)('%s: a rejected push is no unhandled rejection', async (_name, s) => {
    const attempted: string[] = [];
    const reject = (event: string) => {
      attempted.push(event);
      return Promise.reject(new Error('unable to push hook event. LiveView not connected'));
    };

    await s.run({}, { pushEvent: reject });
    await flush();

    expect(attempted).toEqual(s.pushes.map(([event]) => event));
    expect(unhandled).not.toHaveBeenCalled();
  });

  it.each(SCENARIOS)('%s: a push that throws does not stop the hook', async (_name, s) => {
    const attempted: string[] = [];
    const fail = (event: string) => {
      attempted.push(event);
      throw new Error('view gone');
    };

    await s.run({}, { pushEvent: fail });

    expect(attempted).toEqual(s.pushes.map(([event]) => event));
  });

  it('a layer in a disconnected LiveView pushes nothing and leaves no unhandled rejection', async () => {
    const attr = (value: unknown) => JSON.stringify(value).replace(/"/g, '&quot;');
    const source = { id: 'src', mapId: 'm', url: 'https://tiles.example.com/a.json' };
    const layer = { id: 'lyr', mapId: 'm', sourceId: 'src', sourceLayer: 'place', paint: {} };
    const lv = renderLiveView(
      '<div id="m" phx-hook="MapHook" phx-update="ignore"></div>' +
        `<div id="src" phx-hook="VectorTileSourceHook" data-config="${attr(source)}"></div>` +
        `<div id="lyr" phx-hook="CircleLayerHook" data-config="${attr(layer)}"></div>`,
      { connected: false }
    );
    lv.render('<div id="m" phx-hook="MapHook" phx-update="ignore"></div>');
    await flush();

    expect(MapManager.get('m')?.getLayer('lyr')).toBeUndefined();
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('push says what became of the push (#49)', () => {
  const hook = (pushEvent: (...args: any[]) => unknown, config?: Record<string, unknown>) => {
    const el = document.createElement('div');
    if (config) el.dataset.config = JSON.stringify(config);
    return { el, pushEvent: pushEvent as any };
  };

  it('returns false for an event the component did not ask for, which is not sent', () => {
    const pushEvent = vi.fn();

    expect(push(hook(pushEvent, { events: ['map:clicked'] }), 'map:moved', {})).toBe(false);
    expect(pushEvent).not.toHaveBeenCalled();
  });

  it('returns false when pushEvent throws', () => {
    expect(
      push(
        hook(() => {
          throw new Error('view gone');
        }),
        'map:moved',
        {}
      )
    ).toBe(false);
  });

  it('returns true when pushEvent gives no promise', () => {
    expect(push(hook(() => undefined), 'map:moved', {})).toBe(true);
  });

  it('returns a promise that resolves once the promise LiveView gave settles, also when it rejects', async () => {
    let answer!: (reply: unknown) => void;
    const answered = push(hook(() => new Promise((resolve) => (answer = resolve))), 'map:moved', {});
    const failed = push(hook(() => Promise.reject(new Error('push timeout'))), 'map:moved', {});
    const settled: string[] = [];
    (answered as Promise<void>).then(() => settled.push('answered'));
    (failed as Promise<void>).then(() => settled.push('failed'));

    await flush();
    expect(settled).toEqual(['failed']);

    answer({});
    await flush();
    expect(settled).toEqual(['failed', 'answered']);
  });
});
