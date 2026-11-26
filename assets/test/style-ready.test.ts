import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStyleReady, whenStyleReady } from '../js/maplibrex/core/style-ready';
import { FakeMap } from './mocks/maplibre-gl';
import { resetEnvironment } from './helpers';

/** Listeners left on the events `whenStyleReady` may wait for. */
function styleListeners(map: FakeMap): number {
  return map.listenerCount('styledata') + map.listenerCount('style.load') + map.listenerCount('load');
}

function asMap(map: FakeMap): never {
  return map as never;
}

describe('isStyleReady', () => {
  afterEach(resetEnvironment);

  it('is true once the style has loaded', () => {
    expect(isStyleReady(asMap(new FakeMap()))).toBe(true);
  });

  it('is true while tiles load, although isStyleLoaded() is false (#12)', () => {
    const map = new FakeMap();
    map.setTilesLoading(true);

    expect(map.isStyleLoaded()).toBe(false);
    expect(isStyleReady(asMap(map))).toBe(true);
  });

  it('is false until the style document has loaded', () => {
    const map = new FakeMap(undefined, { loaded: false });
    expect(isStyleReady(asMap(map))).toBe(false);

    map.finishStyleLoad();
    expect(isStyleReady(asMap(map))).toBe(true);
  });

  it('is false while a full style rebuild is loading', () => {
    const map = new FakeMap();
    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });

    expect(isStyleReady(asMap(map))).toBe(false);
  });
});

describe('whenStyleReady', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEnvironment();
  });

  it('runs the callback right away when the map accepts sources and layers', () => {
    const map = new FakeMap();
    const callback = vi.fn();

    const cancel = whenStyleReady(asMap(map), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(styleListeners(map)).toBe(0);
    expect(() => cancel()).not.toThrow();
  });

  it('runs right away after load has fired while tiles are loading (#12)', () => {
    const map = new FakeMap(undefined, { loaded: false });
    map.finishStyleLoad();
    map.setTilesLoading(true);
    const callback = vi.fn(() => {
      map.addSource('s', { type: 'geojson', data: null });
      map.addLayer({ id: 'l', type: 'circle', source: 's' });
    });

    whenStyleReady(asMap(map), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.getLayer('l')).toBeDefined();
  });

  it('waits for the style document, then runs once, when sources and layers can be added', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const callback = vi.fn(() => {
      map.addSource('s', { type: 'geojson', data: null });
      map.addLayer({ id: 'l', type: 'circle', source: 's' });
    });

    whenStyleReady(asMap(map), callback);
    expect(callback).not.toHaveBeenCalled();

    map.finishStyleLoad();
    map.setStyle({ version: 8, sources: { other: { type: 'geojson', data: null } }, layers: [] });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.getSource('s')).toBeUndefined(); // dropped by the later setStyle, not re-added
    expect(styleListeners(map)).toBe(0);
  });

  it('keeps waiting through style events that come before the style document', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const callback = vi.fn();

    whenStyleReady(asMap(map), callback);
    map.emit('styledata', { type: 'styledata', dataType: 'style' });

    expect(callback).not.toHaveBeenCalled();
    map.finishStyleLoad();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits through a full style rebuild', () => {
    const map = new FakeMap();
    map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    const callback = vi.fn(() => map.addSource('s', { type: 'geojson', data: null }));

    whenStyleReady(asMap(map), callback);
    expect(callback).not.toHaveBeenCalled();

    map.finishStyleLoad();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(map.getSource('s')).toBeDefined();
  });

  it('never runs a callback cancelled before the style loaded, and removes its listeners', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const callback = vi.fn();

    const cancel = whenStyleReady(asMap(map), callback);
    expect(styleListeners(map)).toBeGreaterThan(0);

    cancel();
    cancel();
    expect(styleListeners(map)).toBe(0);

    map.finishStyleLoad();
    expect(callback).not.toHaveBeenCalled();
  });

  it('runs each call’s callback once, independently', () => {
    const map = new FakeMap(undefined, { loaded: false });
    const first = vi.fn();
    const second = vi.fn();

    whenStyleReady(asMap(map), first);
    const cancelSecond = whenStyleReady(asMap(map), second);
    cancelSecond();
    map.finishStyleLoad();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('logs a callback that throws while waiting, without breaking the style load for other listeners', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = new FakeMap(undefined, { loaded: false });
    const styleLoad = vi.fn();
    whenStyleReady(asMap(map), () => {
      throw new Error('boom');
    });
    map.on('style.load', styleLoad);

    expect(() => map.finishStyleLoad()).not.toThrow();

    expect(styleLoad).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('logs a callback that throws when run right away', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      whenStyleReady(asMap(new FakeMap()), () => {
        throw new Error('boom');
      })
    ).not.toThrow();

    expect(error).toHaveBeenCalledTimes(1);
  });
});
