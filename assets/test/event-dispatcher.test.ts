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

// MapLibre treats a key that is present as set: `{ bearing: undefined }` becomes
// NaN in flyTo/jumpTo, and `{ maxZoom: undefined }` in fitBounds.
describe('server-pushed camera commands pass only the options they were given', () => {
  it.each([
    ['map:fly_to', (m: FakeMap) => m.flyTo, 0, ['bearing', 'pitch']],
    ['map:jump_to', (m: FakeMap) => m.jumpTo, 0, ['bearing', 'pitch']]
  ] as const)('%s without bearing or pitch leaves them alone', (event, spy, arg, keys) => {
    const { map, send } = setup();
    send(event, { center: [1, 2], zoom: 3 });
    const options = (spy(map) as any).mock.calls[0][arg];
    for (const key of keys) expect(options, key).not.toHaveProperty(key);
    expect(options).toMatchObject({ center: [1, 2], zoom: 3 });
  });

  it('map:jump_to without a zoom or centre passes neither', () => {
    const { map, send } = setup();
    send('map:jump_to', { bearing: 45 });
    expect(map.jumpTo.mock.calls[0][0]).toEqual({ bearing: 45 });
  });

  it('map:fly_to and map:jump_to still pass a bearing and pitch of 0', () => {
    const { map, send } = setup();
    send('map:fly_to', { center: [1, 2], zoom: 3, bearing: 0, pitch: 0 });
    expect(map.flyTo.mock.calls[0][0]).toMatchObject({ bearing: 0, pitch: 0 });
  });

  it('map:fit_bounds without maxZoom leaves it out', () => {
    const { map, send } = setup();
    send('map:fit_bounds', { bounds: [[0, 0], [1, 1]] });
    expect(map.fitBounds.mock.calls[0][1]).not.toHaveProperty('maxZoom');
  });
});
