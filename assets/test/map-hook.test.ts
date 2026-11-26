/**
 * MapHook creates the map from its `data-config`, and `updated()` applies to
 * it what changed in that config, and only that. The config comes out of
 * `JSON.parse` on every update, so an object or array value is a new object
 * each time even when nothing changed: re-applying an unchanged style object
 * would make MapLibre diff the style and drop every source and layer the
 * components added (#16).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { CircleLayerHook, MapHook } from '../js/maplibrex/hooks';
import type { FakeMap, StyleSpec } from './mocks/maplibre-gl';
import { type MountedHook, mountHook, resetEnvironment } from './helpers';

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

function mountMap(extra: Record<string, unknown> = {}): { m: MountedHook; map: FakeMap } {
  const m = mountHook(MapHook, configFor(extra));
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
