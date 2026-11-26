import { afterEach, describe, expect, it } from 'vitest';
import { mountHook, registerMap, resetEnvironment } from './helpers';
import {
  BackgroundLayerHook,
  CircleLayerHook,
  FillExtrusionLayerHook,
  FillLayerHook,
  GeoJSONLayerHook,
  HeatmapLayerHook,
  HillshadeLayerHook,
  LineLayerHook,
  RasterLayerHook,
  SymbolLayerHook
} from '../js/maplibrex/hooks';

const feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } };
const interaction = { features: [feature], lngLat: { toArray: () => [1, 2] }, point: { x: 3, y: 4 } };

const sourceBased = { id: 'lyr', mapId: 'map', sourceId: 'src', paint: {}, layout: {} };
const geojson = {
  id: 'lyr',
  mapId: 'map',
  source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  layer: { id: 'lyr', type: 'circle', source: 'lyr-source' }
};

// [name, hook, config, interactive]
const cases: [string, any, Record<string, unknown>, boolean][] = [
  ['GeoJSONLayerHook', GeoJSONLayerHook, geojson, true],
  ['CircleLayerHook', CircleLayerHook, sourceBased, true],
  ['LineLayerHook', LineLayerHook, sourceBased, true],
  ['FillLayerHook', FillLayerHook, sourceBased, true],
  ['SymbolLayerHook', SymbolLayerHook, sourceBased, true],
  ['FillExtrusionLayerHook', FillExtrusionLayerHook, sourceBased, true],
  ['HeatmapLayerHook', HeatmapLayerHook, sourceBased, false],
  ['HillshadeLayerHook', HillshadeLayerHook, sourceBased, false],
  ['RasterLayerHook', RasterLayerHook, sourceBased, false],
  ['BackgroundLayerHook', BackgroundLayerHook, { id: 'lyr', mapId: 'map' }, false]
];

describe('layer:* events carry both layer_id and layerId (#7)', () => {
  afterEach(resetEnvironment);

  it.each(cases)('%s', (_name, hook, config, interactive) => {
    const map = registerMap('map');
    map.addSource('src', { type: 'geojson' });
    const m = mountHook(hook, config);

    if (interactive) {
      map.emit('click', 'lyr', interaction);
      map.emit('mouseenter', 'lyr', interaction);
      map.emit('mouseleave', 'lyr', interaction);
    }
    m.destroy();

    const layerEvents: [string, Record<string, unknown>][] = m.hook.pushEvent.mock.calls.filter(
      ([name]: [string]) => name.startsWith('layer:')
    );
    const names = layerEvents.map(([name]) => name);

    expect(names.length).toBeGreaterThan(0);
    if (interactive) {
      expect(names).toEqual(
        expect.arrayContaining([
          'layer:feature_clicked',
          'layer:feature_mouseenter',
          'layer:feature_mouseleave'
        ])
      );
    }
    for (const [, payload] of layerEvents) {
      expect(payload.layer_id).toBe('lyr');
      expect(payload.layerId).toBe('lyr');
    }
  });

  it('GeoJSONLayerHook layer:source_loaded carries both keys', () => {
    const map = registerMap('map');
    const m = mountHook(GeoJSONLayerHook, geojson);
    map.emit('sourcedata', { sourceId: 'lyr-source', isSourceLoaded: true });

    const call = m.hook.pushEvent.mock.calls.find(([n]: [string]) => n === 'layer:source_loaded');
    expect(call?.[1]).toMatchObject({ layer_id: 'lyr', layerId: 'lyr', sourceId: 'lyr-source' });
  });
});
