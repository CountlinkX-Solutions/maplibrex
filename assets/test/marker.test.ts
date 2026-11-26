import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountHook, registerMap, resetEnvironment } from './helpers';
import { FakeMap, Marker } from './mocks/maplibre-gl';
import { MarkerHook } from '../js/maplibrex/hooks';

const base = {
  id: 'pin',
  mapId: 'map',
  lngLat: [10, 20],
  color: '#3FB1CE',
  scale: 1,
  rotation: 0,
  draggable: false,
  pitchAlignment: 'auto',
  rotationAlignment: 'auto'
};

const pushed = (m: { hook: any }, name: string) =>
  m.hook.pushEvent.mock.calls.filter(([n]: [string]) => n === name);

describe('MarkerHook (#8)', () => {
  let map: FakeMap;

  beforeEach(() => {
    map = registerMap('map');
  });
  afterEach(() => {
    vi.useRealTimers();
    resetEnvironment();
  });

  describe('drag events', () => {
    it('are pushed when draggable is enabled after mount', () => {
      const m = mountHook(MarkerHook, base);
      m.update({ ...base, draggable: true });

      const marker = Marker.instances[0];
      expect(marker.setDraggable).toHaveBeenCalledWith(true);
      marker.emit('dragstart');
      marker.emit('dragend');

      expect(pushed(m, 'marker:drag_start')).toHaveLength(1);
      expect(pushed(m, 'marker:drag_end')).toHaveLength(1);
    });

    it('throttles marker:dragging but always pushes drag_end with the final position', () => {
      vi.useFakeTimers();
      const m = mountHook(MarkerHook, { ...base, draggable: true });
      const marker = Marker.instances[0];

      marker.emit('dragstart');
      for (let i = 1; i <= 10; i++) {
        marker.lngLat = [10 + i, 20];
        marker.emit('drag');
      }
      expect(pushed(m, 'marker:dragging')).toHaveLength(1);

      marker.lngLat = [99, 20];
      marker.emit('dragend');
      vi.advanceTimersByTime(100);

      const end = pushed(m, 'marker:drag_end');
      expect(end).toHaveLength(1);
      expect(end[0][1].lngLat).toEqual([99, 20]);
      // A throttled trailing tick must not arrive after drag_end.
      expect(pushed(m, 'marker:dragging')).toHaveLength(1);
    });

    it('keeps pushing a trailing dragging tick while the drag is in progress', () => {
      vi.useFakeTimers();
      const m = mountHook(MarkerHook, { ...base, draggable: true });
      const marker = Marker.instances[0];

      marker.emit('dragstart');
      marker.emit('drag');
      marker.emit('drag');
      vi.advanceTimersByTime(60);

      expect(pushed(m, 'marker:dragging')).toHaveLength(2);
    });
  });

  describe('pending throttled ticks', () => {
    it.each([
      ['destroyed', (m: any) => m.destroy()],
      // A rebuild requested during a drag happens when the drag ends.
      ['recreated', (m: any) => {
        m.update({ ...base, draggable: true, color: '#ff0000' });
        Marker.instances[0].emit('dragend');
      }]
    ])('do not push after the marker is %s', (_n, act) => {
      vi.useFakeTimers();
      const m = mountHook(MarkerHook, { ...base, draggable: true });
      const marker = Marker.instances[0];

      marker.emit('dragstart');
      marker.emit('drag');
      marker.emit('drag'); // trailing tick is now pending
      expect(pushed(m, 'marker:dragging')).toHaveLength(1);

      act(m);
      vi.advanceTimersByTime(200);

      expect(pushed(m, 'marker:dragging')).toHaveLength(1);
    });
  });

  describe('updates', () => {
    it.each([
      ['color', { color: '#ff0000' }, 'color', '#ff0000'],
      ['scale', { scale: 2 }, 'scale', 2],
      ['anchor', { anchor: 'bottom' }, 'anchor', 'bottom']
    ])('recreates the marker when %s changes', (_n, change, option, value) => {
      const popup = { text: 'hello', closeButton: true, closeOnClick: true, maxWidth: '240px' };
      const m = mountHook(MarkerHook, {
        ...base,
        draggable: true,
        rotation: 15,
        popup: { id: 'pin-popup', ...popup }
      });
      const first = Marker.instances[0];
      first.lngLat = [11, 21]; // the user dragged it

      m.update({ ...base, draggable: true, rotation: 15, popup: { id: 'pin-popup', ...popup }, ...change });

      expect(Marker.instances).toHaveLength(2);
      const second = Marker.instances[1];
      expect(first.removed).toBe(true);
      expect(second.options[option]).toBe(value);
      expect(second.options.draggable).toBe(true);
      expect(second.options.rotation).toBe(15);
      expect(second.lngLat).toEqual([11, 21]);
      expect(second.popup).toBe(first.popup);

      // listeners are attached to the new marker
      second.emit('dragend');
      expect(pushed(m, 'marker:drag_end')).toHaveLength(1);
      second.getElement().click();
      expect(pushed(m, 'marker:clicked')).toHaveLength(1);
      expect(second.togglePopup).toHaveBeenCalled();

      m.destroy();
      expect(second.removed).toBe(true);
    });

    it('re-opens an open popup on the recreated marker, and leaves a closed one closed', () => {
      const cfg = { ...base, popup: { id: 'pin-popup', text: 'hi' } };
      const m = mountHook(MarkerHook, cfg);
      const first = Marker.instances[0];

      first.togglePopup();
      expect(first.popup!.isOpen()).toBe(true);
      m.update({ ...cfg, color: '#ff0000' });
      expect(Marker.instances[1].popup!.isOpen()).toBe(true);

      Marker.instances[1].togglePopup(); // close it
      m.update({ ...cfg, color: '#00ff00' });
      expect(Marker.instances[2].popup!.isOpen()).toBe(false);
    });

    it('uses the new position when it changes together with the color', () => {
      const m = mountHook(MarkerHook, base);
      m.update({ ...base, color: '#00ff00', lngLat: [1, 2] });

      expect(Marker.instances[1].lngLat).toEqual([1, 2]);
    });

    it('updates offset and alignments in place', () => {
      const m = mountHook(MarkerHook, base);
      const marker = Marker.instances[0];

      m.update({ ...base, offset: [3, 4], pitchAlignment: 'map', rotationAlignment: 'viewport' });

      expect(Marker.instances).toHaveLength(1);
      expect(marker.setOffset).toHaveBeenCalledWith([3, 4]);
      expect(marker.setPitchAlignment).toHaveBeenCalledWith('map');
      expect(marker.setRotationAlignment).toHaveBeenCalledWith('viewport');
    });

    // E.g. the server highlights the marker on `marker:drag_start`.
    it.each([
      ['color', { color: '#ff0000' }, 'color', '#ff0000'],
      ['scale', { scale: 2 }, 'scale', 2],
      ['anchor', { anchor: 'bottom' }, 'anchor', 'bottom']
    ])('lets a drag finish when %s changes during it, then applies it', (_n, change, option, value) => {
      const cfg = { ...base, draggable: true, popup: { id: 'pin-popup', text: 'hi' } };
      const m = mountHook(MarkerHook, cfg);
      const first = Marker.instances[0];
      first.togglePopup();

      first.pointerDown();
      map.emit('mousemove', { lngLat: [11, 21] });
      map.emit('mousemove', { lngLat: [12, 22] });
      // The server echoes a position from an earlier `marker:dragging`.
      m.update({ ...cfg, ...change, lngLat: [11, 21], rotation: 30 });

      // The marker stays under the pointer and keeps following it.
      expect(first.lngLat).toEqual([12, 22]);
      map.emit('mousemove', { lngLat: [13, 23] });
      expect(first.lngLat).toEqual([13, 23]);
      // In-place updates apply at once.
      expect(first.setRotation).toHaveBeenCalledWith(30);
      expect(pushed(m, 'marker:drag_end')).toHaveLength(0);

      map.emit('mouseup');

      const end = pushed(m, 'marker:drag_end');
      expect(end).toHaveLength(1);
      expect(end[0][1].lngLat).toEqual([13, 23]);

      // Then the marker is rebuilt where it was dropped.
      expect(Marker.instances).toHaveLength(2);
      const second = Marker.instances[1];
      expect(first.removed).toBe(true);
      expect(second.options[option]).toBe(value);
      expect(second.options.rotation).toBe(30);
      expect(second.lngLat).toEqual([13, 23]);
      expect(second.popup!.isOpen()).toBe(true);

      // and can be dragged again.
      second.pointerDown();
      map.emit('mousemove', { lngLat: [14, 24] });
      map.emit('mouseup');
      expect(pushed(m, 'marker:drag_end')).toHaveLength(2);
    });

    it('does not recreate the marker when nothing relevant changed', () => {
      const m = mountHook(MarkerHook, base);
      m.update({ ...base, lngLat: [5, 6] });

      expect(Marker.instances).toHaveLength(1);
      expect(Marker.instances[0].setLngLat).toHaveBeenLastCalledWith([5, 6]);
    });
  });
});
