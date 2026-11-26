import { afterEach, describe, expect, it } from 'vitest';
import { FakeMap } from './mocks/maplibre-gl';
import { createEventDispatcher } from '../js/maplibrex/core/event-dispatcher';
import { resetEnvironment } from './helpers';

type Handler = (payload: any) => void;

function setup(mapId = 'overview') {
  const map = new FakeMap();
  const handlers = new Map<string, Handler>();
  const hook: any = {
    handleEvent: (event: string, handler: Handler) => handlers.set(event, handler),
    pushEvent: () => {}
  };
  createEventDispatcher(hook, map as never, mapId, true);
  return { map, send: (event: string, payload: any) => handlers.get(event)!(payload) };
}

// [event, payload, the FakeMap spy it must reach]
const commands: [string, Record<string, unknown>, (m: FakeMap) => unknown][] = [
  ['map:fly_to', { center: [1, 2], zoom: 3 }, (m) => m.flyTo],
  ['map:jump_to', { center: [1, 2], zoom: 3 }, (m) => m.jumpTo],
  ['map:fit_bounds', { bounds: [[0, 0], [1, 1]] }, (m) => m.fitBounds],
  ['map:set_style', { style: 'https://example.test/style.json' }, (m) => m.setStyle],
  ['map:set_bearing', { bearing: 90 }, (m) => m.rotateTo],
  ['map:set_pitch', { pitch: 30 }, (m) => m.setPitch],
  ['map:reset_north', {}, (m) => m.resetNorth],
  ['map:zoom_in', {}, (m) => m.zoomIn],
  ['map:zoom_out', {}, (m) => m.zoomOut]
];

describe('server-pushed map events honour an optional id (#9)', () => {
  afterEach(resetEnvironment);

  describe.each(commands)('%s', (event, payload, spy) => {
    it('is ignored when the id targets another map', () => {
      const { map, send } = setup('overview');
      send(event, { ...payload, id: 'detail' });
      expect(spy(map)).not.toHaveBeenCalled();
    });

    it('is applied when the id matches this map', () => {
      const { map, send } = setup('overview');
      send(event, { ...payload, id: 'overview' });
      expect(spy(map)).toHaveBeenCalledTimes(1);
    });

    it('is applied when no id is given', () => {
      const { map, send } = setup('overview');
      send(event, payload);
      expect(spy(map)).toHaveBeenCalledTimes(1);
    });
  });

  it('does not pass the id on to MapLibre', () => {
    const { map, send } = setup('overview');
    send('map:fly_to', { id: 'overview', center: [1, 2], zoom: 3 });
    expect(map.flyTo.mock.calls[0][0]).not.toHaveProperty('id');
  });
});
