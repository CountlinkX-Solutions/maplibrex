/**
 * Components nested in the `<.map>` slot (#15), in a real LiveView.
 *
 * The map element carries `phx-update="ignore"`: LiveView never patches what
 * is inside it, so MapLibre's DOM survives every re-render. A component
 * rendered inside it would be frozen at its first render, so the slot is
 * rendered right after the map element, as its sibling, and LiveView patches
 * nested components like any other element.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { type FakeMap, Marker } from './mocks/maplibre-gl';
import { renderLiveView, resetEnvironment } from './helpers';

const attr = (value: unknown) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** What `<.map id="m" ...>slot</.map>` renders (lib/maplibrex/components/map.ex). */
function map(slot: string, config: Record<string, unknown> = {}): string {
  const full = { id: 'm', center: [0, 0], zoom: 5, ...config };
  return (
    `<div id="m" phx-hook="MapHook" phx-update="ignore" data-config="${attr(full)}" ` +
    `data-testid="maplibrex-map-m" class="maplibrex-map"></div>${slot}`
  );
}

/** What `<.marker id="pin" map_id="m" lng_lat={...} />` renders (lib/maplibrex/components/marker.ex). */
function marker(lngLat: [number, number]): string {
  const config = {
    id: 'pin',
    mapId: 'm',
    lngLat,
    color: '#3FB1CE',
    scale: 1,
    rotation: 0,
    draggable: false,
    pitchAlignment: 'auto',
    rotationAlignment: 'auto'
  };
  return `<div id="pin" phx-hook="MarkerHook" data-config="${attr(config)}" style="display: none;"></div>`;
}

/** A vector tile source and a circle layer on it, as their components render them. */
const SOURCE =
  `<div id="places" phx-hook="VectorTileSourceHook" ` +
  `data-config="${attr({ id: 'places', mapId: 'm', url: 'https://tiles.example.com/places.json' })}" style="display: none;"></div>`;

function circle(paint: Record<string, unknown>): string {
  const config = { id: 'points', mapId: 'm', sourceId: 'places', sourceLayer: 'place', paint, layout: {} };
  return `<div id="points" phx-hook="CircleLayerHook" data-config="${attr(config)}" style="display: none;"></div>`;
}

const fakeMap = () => MapManager.get('m') as unknown as FakeMap;
const POINTS = { layer_id: 'points', layerId: 'points' };
const layerPushes = (pushes: [string, unknown][]) => pushes.filter(([name]) => name.startsWith('layer:'));

describe('components nested in the <.map> slot (#15)', () => {
  afterEach(resetEnvironment);

  it('a nested marker follows its lng_lat', () => {
    const lv = renderLiveView(map(marker([-3.7, 40.4])));
    expect(Marker.instances).toHaveLength(1);

    lv.render(map(marker([2.35, 48.86])));

    expect(Marker.instances).toHaveLength(1);
    expect(Marker.instances[0].lngLat).toEqual([2.35, 48.86]);
  });

  it('a nested layer follows its paint', () => {
    const lv = renderLiveView(map(SOURCE + circle({ 'circle-radius': 6 })));
    expect(fakeMap().getLayer('points')).toMatchObject({ paint: { 'circle-radius': 6 } });

    lv.render(map(SOURCE + circle({ 'circle-radius': 9 })));

    expect(fakeMap().getLayer('points')).toMatchObject({ paint: { 'circle-radius': 9 } });
  });

  it('a nested component behind :if mounts when it appears and unmounts when it goes', () => {
    const lv = renderLiveView(map(SOURCE));
    const layer = circle({ 'circle-radius': 6 });

    lv.render(map(SOURCE + layer));

    expect(fakeMap().getLayer('points')).toMatchObject({ type: 'circle', source: 'places' });
    expect(layerPushes(lv.pushes)).toEqual([['layer:added', POINTS]]);

    lv.render(map(SOURCE));

    expect(fakeMap().getLayer('points')).toBeUndefined();
    expect(document.getElementById('points')).toBeNull();
    expect(layerPushes(lv.pushes)).toEqual([['layer:added', POINTS], ['layer:removed', POINTS]]);
  });

  it('the map element itself is still not patched, and still gets its new data-config', () => {
    const lv = renderLiveView(map(marker([-3.7, 40.4])));
    const el = document.getElementById('m')!;
    // What MapLibre builds inside the map element.
    const mapDom = el.querySelector('.maplibregl-control-container');
    expect(mapDom).not.toBeNull();

    lv.render(map(SOURCE + marker([2.35, 48.86]), { zoom: 7 }));

    expect(document.getElementById('m')).toBe(el);
    expect(el.querySelector('.maplibregl-control-container')).toBe(mapDom);
    expect(JSON.parse(el.dataset.config!)).toMatchObject({ zoom: 7 });
  });
});
