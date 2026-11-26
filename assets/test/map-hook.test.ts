/**
 * MapHook creates the map from its `data-config`, and `updated()` applies to
 * it what changed in that config, and only that. The config comes out of
 * `JSON.parse` on every update, so an object or array value is a new object
 * each time even when nothing changed: re-applying an unchanged style object
 * would make MapLibre diff the style and drop every source and layer the
 * components added (#16).
 *
 * Of the camera, it leaves alone a value the map itself reported and the
 * LiveView renders back, and a value where the map already is (#49): one
 * user move pushes one `map:moved`, and the answer never pulls the map back
 * while the user is moving it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { CircleLayerHook, MapHook } from '../js/maplibrex/hooks';
import type { FakeMap, StyleSpec } from './mocks/maplibre-gl';
import { type MountOptions, type MountedHook, mountHook, renderLiveView, resetEnvironment } from './helpers';

const STYLE: StyleSpec = {
  version: 8,
  sources: { places: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f8f4f0' } }]
};
const STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/** The `data-config` the map component renders, plus `extra`. */
function configFor(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'map',
    center: [-3.7, 40.4],
    zoom: 5,
    style: STYLE,
    bearing: 0,
    pitch: 0,
    interactive: true,
    attributionControl: true,
    ...extra
  };
}

function mountMap(extra: Record<string, unknown> = {}, options?: MountOptions): { m: MountedHook; map: FakeMap } {
  const m = mountHook(MapHook, configFor(extra), '', options);
  return { m, map: MapManager.get('map') as unknown as FakeMap };
}

const SETTERS = ['setCenter', 'setZoom', 'setBearing', 'setPitch', 'setStyle'] as const;

afterEach(resetEnvironment);

describe('MapHook', () => {
  it('creates a map from its config and registers it', () => {
    const { map } = mountMap();

    expect((map as unknown as { options: Record<string, unknown> }).options).toMatchObject({
      center: [-3.7, 40.4],
      zoom: 5,
      style: STYLE
    });
    expect(map.getLayersOrder()).toEqual(['bg']);
  });
});

describe('MapHook.updated() applies what changed, and only that (#16)', () => {
  it.each([
    ['a style object', STYLE],
    ['a style URL', STYLE_URL]
  ])('re-applies nothing for an update that changes nothing, with %s', (_what, style) => {
    const { m, map } = mountMap({ style, bounds: [[-10, 35], [5, 44]], maxBounds: [[-20, 30], [10, 50]] });

    m.update(configFor({ style, bounds: [[-10, 35], [5, 44]], maxBounds: [[-20, 30], [10, 50]] }));

    for (const setter of SETTERS) {
      expect(map[setter], setter).not.toHaveBeenCalled();
    }
  });

  it('does not call setStyle for an unchanged style object when another assign changes', () => {
    const { m, map } = mountMap();

    m.update(configFor({ center: [2.35, 48.85], zoom: 6 }));

    expect(map.setCenter).toHaveBeenCalledWith([2.35, 48.85]);
    expect(map.setZoom).toHaveBeenCalledWith(6);
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('does not call setStyle for the same style object with its keys in another order', () => {
    const { m, map } = mountMap();
    const { layers, sources, version } = STYLE;

    m.update(configFor({ style: { layers, sources, version } }));

    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('leaves the layers of the components alone when another assign changes', () => {
    const { m, map } = mountMap();
    mountHook(CircleLayerHook, { id: 'points', mapId: 'map', sourceId: 'places', paint: {}, layout: {} });

    m.update(configFor({ center: [2.35, 48.85] }));

    expect(map.getLayersOrder()).toEqual(['bg', 'points']);
    // Not removed by a style diff and put back.
    expect(map.addLayer).toHaveBeenCalledTimes(1);
  });

  it('calls setStyle when the style object changed', () => {
    const { m, map } = mountMap();
    const next = { ...STYLE, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000' } }] };

    m.update(configFor({ style: next }));

    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.setStyle).toHaveBeenCalledWith(next);
    expect(map.getLayer('bg').paint).toEqual({ 'background-color': '#000' });
  });

  it('calls setStyle when the style URL changed', () => {
    const { m, map } = mountMap({ style: STYLE_URL });

    m.update(configFor({ style: 'https://tiles.openfreemap.org/styles/liberty' }));

    expect(map.setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/liberty');
  });
});

const PARIS: [number, number] = [2.35, 48.85];
const LONDON: [number, number] = [-0.12, 51.5];
const AMSTERDAM: [number, number] = [4.9, 52.37];
const CAMERA_SETTERS = ['setCenter', 'setZoom', 'setBearing', 'setPitch'] as const;

/** Where the map is, as a config would give it. */
function cameraOf(map: FakeMap) {
  const { lng, lat } = map.getCenter();
  return { center: [lng, lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

/** The payloads of every `event` a hook pushed through a `pushEvent` spy. */
function pushed(m: MountedHook, event = 'map:moved'): any[] {
  return m.hook.pushEvent.mock.calls.filter(([name]: [string]) => name === event).map(([, payload]: [string, any]) => payload);
}

/** The user moves the map; 150 ms later, the debounced map:moved is pushed. */
function userMoves(map: FakeMap, camera: Parameters<FakeMap['userMove']>[0]): void {
  map.userMove(camera);
  vi.advanceTimersByTime(150);
}

/**
 * What a LiveView with the README's handler renders in answer to map:moved:
 * `assign(socket, center: center, zoom: zoom)`.
 */
function readmeAnswer(moved: { center: unknown; zoom: unknown }, extra: Record<string, unknown> = {}) {
  return configFor({ center: moved.center, zoom: moved.zoom, ...extra });
}

describe('MapHook does not send the map its own camera back (#49)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes map:moved once for one user move, and leaves the map alone when the LiveView assigns that camera', () => {
    const { m, map } = mountMap();

    userMoves(map, { center: PARIS, zoom: 6.123 });
    const [moved] = pushed(m);
    expect(moved).toMatchObject({ center: PARIS, zoom: 6.12 });

    m.update(readmeAnswer(moved));
    vi.advanceTimersByTime(1000);

    expect(pushed(m)).toHaveLength(1);
    for (const setter of CAMERA_SETTERS) expect(map[setter], setter).not.toHaveBeenCalled();
    expect(cameraOf(map)).toEqual({ center: PARIS, zoom: 6.123, bearing: 0, pitch: 0 });
  });

  it('does not move the map back when the answer arrives while the user is still moving it', () => {
    const { m, map } = mountMap();
    userMoves(map, { center: PARIS });
    const [moved] = pushed(m);

    map.userMove({ center: AMSTERDAM }, { ended: false });
    m.update(readmeAnswer(moved));
    expect(map.getCenter()).toEqual({ lng: AMSTERDAM[0], lat: AMSTERDAM[1] });

    map.userMove({ center: AMSTERDAM });
    vi.advanceTimersByTime(150);
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(pushed(m).map((p) => p.center)).toEqual([PARIS, AMSTERDAM]);
  });

  it('recognises its own camera however late the answer comes, behind later moves', () => {
    const { m, map } = mountMap();
    userMoves(map, { center: PARIS, zoom: 6 });
    userMoves(map, { center: LONDON, zoom: 7 });
    userMoves(map, { center: AMSTERDAM, zoom: 8 });
    const [paris, london, amsterdam] = pushed(m);

    m.update(readmeAnswer(paris));
    m.update(readmeAnswer(london));
    expect(cameraOf(map)).toMatchObject({ center: AMSTERDAM, zoom: 8 });

    m.update(readmeAnswer(amsterdam));
    vi.advanceTimersByTime(1000);
    for (const setter of CAMERA_SETTERS) expect(map[setter], setter).not.toHaveBeenCalled();
    expect(pushed(m)).toHaveLength(3);
  });

  it('does not apply the zoom it reported in map:zoom_changed', () => {
    const { m, map } = mountMap();

    map.userMove({ zoom: 7.4567 });
    const [changed] = pushed(m, 'map:zoom_changed');
    m.update(configFor({ zoom: changed.zoom }));

    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('does not apply the bearing and pitch it reported, rounded as map:moved sends them', () => {
    const { m, map } = mountMap();

    userMoves(map, { bearing: 30.456, pitch: 40.123 });
    const [moved] = pushed(m);
    m.update(configFor({ bearing: moved.bearing, pitch: moved.pitch }));

    expect(map.setBearing).not.toHaveBeenCalled();
    expect(map.setPitch).not.toHaveBeenCalled();
    expect(cameraOf(map)).toMatchObject({ bearing: 30.456, pitch: 40.123 });
  });

  it('after the user rotates the map, a pan does not turn it back to north (README handler, bearing not kept)', () => {
    const { m, map } = mountMap();
    // The README handler assigns the centre and zoom, unchanged by a
    // rotation: the config does not change, so LiveView does not call updated().
    userMoves(map, { bearing: 30 });

    userMoves(map, { center: PARIS });
    const moved = pushed(m)[1];
    // The re-render carries the component's default bearing, 0.
    m.update(readmeAnswer(moved));
    vi.advanceTimersByTime(1000);

    expect(map.getBearing()).toBe(30);
    for (const setter of CAMERA_SETTERS) expect(map[setter], setter).not.toHaveBeenCalled();
    expect(pushed(m)).toHaveLength(2);
  });

  it('leaves a value the LiveView did not change alone: an app that sets the zoom and lets the user pan', () => {
    // `center` is written in the template; only `zoom` follows the assigns.
    const { m, map } = mountMap();
    userMoves(map, { center: PARIS, zoom: 8 });
    const [moved] = pushed(m);

    m.update(configFor({ zoom: moved.zoom }));
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();

    // A zoom level is chosen: the zoom moves, the centre stays where the user put it.
    m.update(configFor({ zoom: 12 }));
    expect(map.setZoom).toHaveBeenCalledWith(12);
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.getCenter()).toEqual({ lng: PARIS[0], lat: PARIS[1] });
  });
});

describe('MapHook applies a camera the LiveView sets (#49)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves the map to a camera the server changes to, and pushes map:moved once where it ends', () => {
    const { m, map } = mountMap();

    m.update(configFor({ center: PARIS, zoom: 8, bearing: 20, pitch: 30 }));
    vi.advanceTimersByTime(150);

    expect(map.setCenter).toHaveBeenCalledWith(PARIS);
    expect(map.setZoom).toHaveBeenCalledWith(8);
    expect(map.setBearing).toHaveBeenCalledWith(20);
    expect(map.setPitch).toHaveBeenCalledWith(30);
    expect(pushed(m)).toEqual([{ mapId: 'map', type: 'moveend', center: PARIS, zoom: 8, bearing: 20, pitch: 30 }]);
  });

  it('does not apply a value equal to where the map already is: no move, no event', () => {
    // map:moved is not pushed here, so nothing the server sends is an echo.
    const { m, map } = mountMap({ events: ['map:clicked'] });
    m.pushFromServer('map:jump_to', { center: PARIS, zoom: 6.123, bearing: 10, pitch: 20 });
    const moveends = vi.fn();
    map.on('moveend', moveends);

    m.update(configFor({ events: ['map:clicked'], center: [PARIS[0] + 1e-9, PARIS[1]], zoom: 6.12, bearing: 10, pitch: 20 }));

    for (const setter of CAMERA_SETTERS) expect(map[setter], setter).not.toHaveBeenCalled();
    expect(moveends).not.toHaveBeenCalled();
  });

  it('applies a value that differs from where the map is by more than the rounding of map:moved', () => {
    const { m, map } = mountMap({ events: ['map:clicked'] });
    m.pushFromServer('map:jump_to', { center: PARIS, zoom: 6.123 });

    m.update(configFor({ events: ['map:clicked'], center: PARIS, zoom: 6.13 }));

    expect(map.setZoom).toHaveBeenCalledWith(6.13);
  });

  it('moves the map back to a position it reported, once LiveView has answered that report', async () => {
    let m!: MountedHook;
    // A LiveView with the README handler; LiveView applies the re-render that
    // comes with the answer, then resolves the push's promise.
    const pushEvent = (event: string, payload: any) =>
      Promise.resolve().then(() => {
        if (event === 'map:moved') m.update(readmeAnswer(payload));
      });
    let map: FakeMap;
    ({ m, map } = mountMap({}, { pushEvent }));
    userMoves(map, { center: PARIS });
    await vi.advanceTimersByTimeAsync(0);
    userMoves(map, { center: LONDON });
    await vi.advanceTimersByTimeAsync(0);
    expect(map.setCenter).not.toHaveBeenCalled();

    // "Back to Paris": the LiveView assigns the centre the map reported first.
    m.update(configFor({ center: PARIS }));

    expect(map.setCenter).toHaveBeenCalledWith(PARIS);
    expect(map.getCenter()).toEqual({ lng: PARIS[0], lat: PARIS[1] });
  });

  it('moves the map back to a position the server set before (an app that does not keep map:moved)', async () => {
    const pushEvent = () => Promise.resolve();
    const { m, map } = mountMap({}, { pushEvent });

    for (const center of [PARIS, LONDON, PARIS]) {
      m.update(configFor({ center }));
      vi.advanceTimersByTime(150);
      await vi.advanceTimersByTimeAsync(0);
      expect(map.getCenter()).toEqual({ lng: center[0], lat: center[1] });
    }
    expect(map.setCenter).toHaveBeenCalledTimes(3);
  });

  const B = { center: PARIS, zoom: 8 };
  const commands: [string, (m: MountedHook) => void][] = [
    ['the fly_to JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:fly_to', { detail: B }))],
    ['the jump_to JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:jump_to', { detail: B }))],
    ['the fit_bounds JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:fit_bounds', { detail: { bounds: [[2, 48], [3, 49]] } }))],
    ['the zoom_in JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:zoom_in'))],
    ['the zoom_out JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:zoom_out'))],
    ['the reset_north JS command', (m) => m.el.dispatchEvent(new CustomEvent('maplibrex:reset_north'))],
    ['push_event map:fly_to', (m) => m.pushFromServer('map:fly_to', B)],
    ['push_event map:jump_to', (m) => m.pushFromServer('map:jump_to', B)],
    ['push_event map:fit_bounds', (m) => m.pushFromServer('map:fit_bounds', { bounds: [[2, 48], [3, 49]] })],
    ['push_event map:set_bearing', (m) => m.pushFromServer('map:set_bearing', { bearing: 45 })],
    ['push_event map:set_pitch', (m) => m.pushFromServer('map:set_pitch', { pitch: 30 })],
    ['push_event map:reset_north', (m) => m.pushFromServer('map:reset_north', {})],
    ['push_event map:zoom_in', (m) => m.pushFromServer('map:zoom_in', {})],
    ['push_event map:zoom_out', (m) => m.pushFromServer('map:zoom_out', {})]
  ];

  it.each(commands)('%s moves the map and pushes map:moved once, and its answer does not move it again', (_name, command) => {
    const { m, map } = mountMap();

    command(m);
    vi.advanceTimersByTime(150);
    const after = cameraOf(map);
    expect(pushed(m)).toHaveLength(1);
    expect(pushed(m)[0]).toMatchObject({ center: after.center });

    m.update(readmeAnswer(pushed(m)[0]));
    vi.advanceTimersByTime(1000);
    expect(cameraOf(map)).toEqual(after);
    expect(pushed(m)).toHaveLength(1);
  });
});

describe('MapHook in a LiveView that keeps map:moved in its assigns, as the README shows (#49)', () => {
  const attr = (value: unknown) => JSON.stringify(value).replace(/"/g, '&quot;');
  const mapElement = (config: Record<string, unknown>) =>
    `<div id="map" phx-hook="MapHook" phx-update="ignore" data-config="${attr(config)}"></div>`;
  const readme = (event: string, payload: any) => (event === 'map:moved' ? mapElement(readmeAnswer(payload)) : undefined);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes one map:moved for one user move, through LiveView’s own patching', async () => {
    const lv = renderLiveView(mapElement(configFor()), { realMapHook: true, server: readme });
    vi.useFakeTimers();
    const map = MapManager.get('map') as unknown as FakeMap;

    userMoves(map, { center: PARIS, zoom: 6.123 });
    lv.answer();
    await vi.advanceTimersByTimeAsync(1000);
    lv.answer();

    expect(lv.pushes.filter(([event]) => event === 'map:moved')).toHaveLength(1);
    expect((document.getElementById('map') as HTMLElement).dataset.config).toContain('6.12');
    for (const setter of CAMERA_SETTERS) expect(map[setter], setter).not.toHaveBeenCalled();
  });

  it('does not move the map back when the answer comes while the user is still moving it', async () => {
    const lv = renderLiveView(mapElement(configFor()), { realMapHook: true, server: readme });
    vi.useFakeTimers();
    const map = MapManager.get('map') as unknown as FakeMap;

    userMoves(map, { center: PARIS });
    map.userMove({ center: AMSTERDAM }, { ended: false });
    lv.answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(map.getCenter()).toEqual({ lng: AMSTERDAM[0], lat: AMSTERDAM[1] });

    map.userMove({ center: AMSTERDAM });
    await vi.advanceTimersByTimeAsync(150);
    lv.answer();
    await vi.advanceTimersByTimeAsync(1000);

    expect(lv.pushes.filter(([event]) => event === 'map:moved').map(([, p]: any) => p.center)).toEqual([PARIS, AMSTERDAM]);
    expect(map.setCenter).not.toHaveBeenCalled();
  });
});
