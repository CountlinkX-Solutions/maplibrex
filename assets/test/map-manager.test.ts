import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapManager, requireMap, useMap } from '../js/maplibrex/core/map-manager';
import { FakeMap } from './mocks/maplibre-gl';
import { resetEnvironment } from './helpers';

function fakeMap(): never {
  return new FakeMap() as never;
}

describe('MapManager registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEnvironment();
  });

  it('keeps registering, looking up and unregistering maps', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const map = fakeMap();

    MapManager.register('a', map);

    expect(MapManager.has('a')).toBe(true);
    expect(MapManager.get('a')).toBe(map);
    expect(useMap('a')).toBe(map);
    expect(requireMap('a')).toBe(map);
    expect(MapManager.getAll()).toEqual({ a: map });
    expect(MapManager.getAllIds()).toEqual(['a']);
    expect(MapManager.count()).toBe(1);

    expect(MapManager.unregister('a')).toBe(true);
    expect(MapManager.has('a')).toBe(false);
    expect(MapManager.get('a')).toBeUndefined();
    expect(() => requireMap('a')).toThrow('Map with id "a" not found');
  });
});

describe('MapManager.whenReady', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEnvironment();
  });

  it('calls back right away with a map that is already registered', () => {
    const map = fakeMap();
    MapManager.register('a', map);
    const callback = vi.fn();

    const cancel = MapManager.whenReady('a', callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(map);
    expect(() => cancel()).not.toThrow();
  });

  it('waits for a map that is not registered yet, without warning (#17)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const callback = vi.fn();

    MapManager.whenReady('a', callback);
    expect(callback).not.toHaveBeenCalled();

    const map = fakeMap();
    MapManager.register('a', map);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(map);
    expect(warn).not.toHaveBeenCalled();
  });

  it('calls a waiter once, even when the map id is registered again', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const callback = vi.fn();
    MapManager.whenReady('a', callback);

    MapManager.register('a', fakeMap());
    MapManager.unregister('a');
    MapManager.register('a', fakeMap());

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls only the waiters for the id that was registered, in the order they asked', () => {
    const calls: string[] = [];
    MapManager.whenReady('a', () => calls.push('a1'));
    MapManager.whenReady('b', () => calls.push('b'));
    MapManager.whenReady('a', () => calls.push('a2'));

    MapManager.register('a', fakeMap());

    expect(calls).toEqual(['a1', 'a2']);
  });

  it('never calls a cancelled waiter', () => {
    const callback = vi.fn();
    const cancel = MapManager.whenReady('a', callback);

    cancel();
    cancel();
    MapManager.register('a', fakeMap());

    expect(callback).not.toHaveBeenCalled();
  });

  it('cancels one waiter without affecting another registered with the same callback', () => {
    const callback = vi.fn();
    const cancelFirst = MapManager.whenReady('a', callback);
    MapManager.whenReady('a', callback);

    cancelFirst();
    MapManager.register('a', fakeMap());

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call a waiter that another waiter cancels while the map is being registered', () => {
    const second = vi.fn();
    let cancelSecond = () => {};
    MapManager.whenReady('a', () => cancelSecond());
    cancelSecond = MapManager.whenReady('a', second);

    MapManager.register('a', fakeMap());

    expect(second).not.toHaveBeenCalled();
  });

  it('keeps a waiter pending through unrelated registrations and unregistrations', () => {
    const callback = vi.fn();
    MapManager.whenReady('a', callback);

    MapManager.register('b', fakeMap());
    MapManager.unregister('b');
    expect(callback).not.toHaveBeenCalled();

    const map = fakeMap();
    MapManager.register('a', map);
    expect(callback).toHaveBeenCalledWith(map);
  });

  it('makes a waiter added after unregister wait for the next map with that id', () => {
    MapManager.register('a', fakeMap());
    MapManager.unregister('a');
    const callback = vi.fn();

    MapManager.whenReady('a', callback);
    expect(callback).not.toHaveBeenCalled();

    const next = fakeMap();
    MapManager.register('a', next);
    expect(callback).toHaveBeenCalledWith(next);
  });

  it('discards pending waiters on clear(), so they never fire for a later map', () => {
    const callback = vi.fn();
    const cancel = MapManager.whenReady('a', callback);

    MapManager.clear();
    MapManager.register('a', fakeMap());

    expect(callback).not.toHaveBeenCalled();
    expect(() => cancel()).not.toThrow();
  });

  it('logs a waiter that throws and still calls the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('boom');
    const other = vi.fn();
    MapManager.whenReady('a', () => {
      throw boom;
    });
    MapManager.whenReady('a', other);

    expect(() => MapManager.register('a', fakeMap())).not.toThrow();

    expect(other).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[MaplibreX MapManager]', expect.stringContaining('"a"'), boom);
  });

  it('logs a callback that throws when the map is already registered', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    MapManager.register('a', fakeMap());

    expect(() =>
      MapManager.whenReady('a', () => {
        throw new Error('boom');
      })
    ).not.toThrow();

    expect(error).toHaveBeenCalledTimes(1);
  });
});
