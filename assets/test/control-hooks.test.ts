import { afterEach, describe, expect, it } from 'vitest';
import { mountHook, registerMap, resetEnvironment } from './helpers';
import {
  ControlHook,
  ControlButtonHook,
  ControlGroupHook,
  ZoomRangeHook
} from '../js/maplibrex/hooks';

// The markup below mirrors what lib/maplibrex/components/{control,control_button,
// control_group,zoom_range}.ex render around `data-config`.
describe('custom control hooks against their component markup', () => {
  afterEach(resetEnvironment);

  it('ControlHook adds the slot content to the map as a control', () => {
    const map = registerMap('m');
    const { el } = mountHook(
      ControlHook,
      { id: 'c1', mapId: 'm', position: 'top-left', className: '' },
      '<div id="c1-content"><span>hi</span></div>'
    );

    expect(map.addControl).toHaveBeenCalledTimes(1);
    expect(map.addControl.mock.calls[0][1]).toBe('top-left');
    const control = map.addControl.mock.calls[0][0];
    const container = control.onAdd(map);
    expect(container.querySelector('#c1-content span')).not.toBeNull();
    expect(el.querySelector('#c1-content')).toBeNull();
  });

  it('ControlGroupHook adds the slot content with its orientation class', () => {
    const map = registerMap('m');
    mountHook(
      ControlGroupHook,
      { id: 'g1', mapId: 'm', position: 'top-right', orientation: 'horizontal', className: '' },
      '<div id="g1-content"></div>'
    );

    const container = map.addControl.mock.calls[0][0].onAdd(map);
    expect(container.className).toContain('control-group-horizontal');
  });

  it('ControlButtonHook adds the button and tracks the active state', () => {
    const map = registerMap('m');
    const m = mountHook(
      ControlButtonHook,
      { id: 'b1', mapId: 'm', position: 'top-right', tooltip: 'Go', active: false },
      '<button id="b1-button" type="button">L</button>'
    );

    const container = map.addControl.mock.calls[0][0].onAdd(map);
    const button = container.querySelector('#b1-button');
    expect(button).not.toBeNull();

    m.update({ id: 'b1', mapId: 'm', position: 'top-right', tooltip: 'Go', active: true });
    expect(button.classList.contains('maplibregl-ctrl-active')).toBe(true);
  });

  it('ControlButtonHook forwards phx-* bindings from the wrapper to the moved button', () => {
    registerMap('m');
    const el = document.createElement('div');
    el.id = 'b2';
    el.setAttribute('phx-click', 'locate');
    el.setAttribute('phx-value-kind', 'gps');
    el.dataset.config = JSON.stringify({ id: 'b2', mapId: 'm', position: 'top-right' });
    el.innerHTML = '<button id="b2-button" type="button">L</button>';
    document.body.appendChild(el);

    const hook: any = Object.create(ControlButtonHook);
    hook.el = el;
    hook.mounted();

    const button = el.querySelector('#b2-button') as HTMLElement;
    expect(button.getAttribute('phx-click')).toBe('locate');
    expect(button.getAttribute('phx-value-kind')).toBe('gps');
    // The hook attribute itself must never be copied.
    expect(button.hasAttribute('phx-hook')).toBe(false);
  });

  it('ZoomRangeHook hides its content outside the range and unsubscribes on destroy', () => {
    const map = registerMap('m');
    map.zoom = 3;
    const m = mountHook(
      ZoomRangeHook,
      { id: 'z1', mapId: 'm', min: 5, max: 10 },
      '<div id="z1-content">x</div>'
    );
    const content = m.el.querySelector('#z1-content') as HTMLElement;

    expect(content.style.display).toBe('none');
    map.zoom = 7;
    map.emit('zoom');
    expect(content.style.display).toBe('');

    m.destroy();
    expect(map.listenerCount('zoom')).toBe(0);
  });
});
