import { afterEach, describe, expect, it } from 'vitest';
import { mountHook, registerMap, resetEnvironment } from './helpers';
import { GeoJSONLayerHook } from '../js/maplibrex/hooks';

const config = {
  id: 'points',
  mapId: 'map',
  source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  layer: { id: 'points', type: 'circle', source: 'points-source' }
};

const feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } };
const clickEvent = { features: [feature], lngLat: { toArray: () => [1, 2] }, point: { x: 3, y: 4 } };

describe('GeoJSONLayerHook', () => {
  afterEach(resetEnvironment);

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

  it('does not add anything when destroyed before the style has loaded', () => {
    const map = registerMap('map');
    map.isStyleLoaded = () => false;
    const m = mountHook(GeoJSONLayerHook, config);

    m.destroy();
    map.emit('load');

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
    expect(map.listenerCount('click', 'points')).toBe(0);
    expect(map.listenerCount('load')).toBe(0);
  });
});
