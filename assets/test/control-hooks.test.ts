import { afterEach, describe, expect, it } from 'vitest';
import { mountHook, registerMap, renderLiveView, resetEnvironment } from './helpers';
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

    expect(map.controlPositions['top-left'].querySelector('.maplibregl-ctrl #c1-content span')).not.toBeNull();
    expect(el.querySelector('#c1-content')).toBeNull();
  });

  it('ControlGroupHook adds the slot content with its orientation class', () => {
    const map = registerMap('m');
    mountHook(
      ControlGroupHook,
      { id: 'g1', mapId: 'm', position: 'top-right', orientation: 'horizontal', className: '' },
      '<div id="g1-content"></div>'
    );

    const container = map.controlPositions['top-right'].querySelector('#g1-content')!.parentElement!;
    expect(container.className).toContain('control-group-horizontal');
  });

  it('ControlButtonHook adds the button and tracks the active state', () => {
    const map = registerMap('m');
    const m = mountHook(
      ControlButtonHook,
      { id: 'b1', mapId: 'm', position: 'top-right', tooltip: 'Go', active: false },
      '<button id="b1-button" type="button">L</button>'
    );

    const button = map.controlPositions['top-right'].querySelector('.maplibregl-ctrl #b1-button')!;
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

    const button = document.getElementById('b2-button')!;
    expect(button.getAttribute('phx-click')).toBe('locate');
    expect(button.getAttribute('phx-value-kind')).toBe('gps');
    // The hook attribute itself must never be copied.
    expect(button.hasAttribute('phx-hook')).toBe(false);
  });

  describe('ControlButtonHook binding forwarding', () => {
    function mountButton(attrs: Record<string, string>) {
      registerMap('m');
      const el = document.createElement('div');
      el.id = 'b3';
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.dataset.config = JSON.stringify({ id: 'b3', mapId: 'm', position: 'top-right' });
      el.innerHTML = '<button id="b3-button" type="button">L</button>';
      document.body.appendChild(el);
      const hook: any = Object.create(ControlButtonHook);
      hook.el = el;
      hook.mounted();
      return { el, hook, button: document.getElementById('b3-button')! };
    }

    it('forwards only event bindings and their values', () => {
      const { button } = mountButton({
        'phx-click': 'go',
        'phx-value-id': '7',
        'phx-target': '#t',
        'phx-disable-with': '...',
        'phx-keydown': 'k',
        'phx-window-keyup': 'w',
        'phx-debounce': '100',
        'phx-throttle': '50',
        'phx-hook': 'ControlButtonHook',
        'phx-update': 'ignore',
        'phx-mounted': '[]',
        'phx-remove': '[]',
        'phx-connected': '[]',
        'phx-disconnected': '[]'
      });

      ['phx-click', 'phx-value-id', 'phx-target', 'phx-disable-with', 'phx-keydown',
        'phx-window-keyup', 'phx-debounce', 'phx-throttle'].forEach((n) =>
        expect(button.hasAttribute(n), n).toBe(true)
      );
      ['phx-hook', 'phx-update', 'phx-mounted', 'phx-remove', 'phx-connected', 'phx-disconnected']
        .forEach((n) => expect(button.hasAttribute(n), n).toBe(false));
    });

    it('removes forwarded bindings that disappear from the wrapper on update', () => {
      const { el, hook, button } = mountButton({ 'phx-click': 'go', 'phx-value-id': '7' });
      button.setAttribute('data-keep', 'yes');

      el.removeAttribute('phx-value-id');
      el.setAttribute('phx-click', 'other');
      hook.updated();

      expect(button.getAttribute('phx-click')).toBe('other');
      expect(button.hasAttribute('phx-value-id')).toBe(false);
      expect(button.getAttribute('data-keep')).toBe('yes');
    });
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

// Server-rendered markup, as the components produce it.
const attr = (value: unknown) =>
  String(typeof value === 'string' ? value : JSON.stringify(value)).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const MAP = '<div id="m" phx-hook="MapHook" phx-update="ignore"></div>';

function controlButton({ active = false, tooltip = 'Filter', cls = '', label = 'F', bindings = 'phx-click="toggle_filter"' } = {}) {
  const config = { id: 'f', mapId: 'm', position: 'top-right', tooltip, active, hasSlot: false, icon: label };
  return `<div id="f" phx-hook="ControlButtonHook" data-config="${attr(config)}" style="display: none;" ${bindings}>` +
    `<button id="f-button" type="button" class="maplibregl-ctrl-icon ${cls}" title="${tooltip}" aria-label="${tooltip}">${label}</button>` +
    '</div>';
}

function control(slot: string) {
  const config = { id: 'c', mapId: 'm', position: 'top-left', className: 'panel' };
  return `<div id="c" phx-hook="ControlHook" data-config="${attr(config)}" style="display: none;">` +
    `<div id="c-content" class="panel">${slot}</div></div>`;
}

function controlGroup(slot: string) {
  const config = { id: 'g', mapId: 'm', position: 'bottom-left', orientation: 'horizontal', className: '' };
  return `<div id="g" phx-hook="ControlGroupHook" data-config="${attr(config)}" style="display: none;">` +
    `<div id="g-content" class="control-group-horizontal ">${slot}</div></div>`;
}

/** The single element with this id; fails if there is none or more than one. */
function only(id: string): HTMLElement {
  const found = document.querySelectorAll(`[id="${id}"]`);
  expect(found, `elements with id "${id}"`).toHaveLength(1);
  return found[0] as HTMLElement;
}

/** Whether `el` is shown as a MapLibre control in that corner of map "m". */
const inMapControl = (el: Element, position: string) =>
  el.closest(`#m .maplibregl-ctrl-${position} > .maplibregl-ctrl`) !== null;

/** Whether map "m" shows no control at all. */
const noControls = () => document.querySelector('#m .maplibregl-ctrl') === null;

// LiveView's patch finds an element by id anywhere in the view, including the
// moved control content inside the map's `phx-update="ignore"` element, and
// puts it back where the server rendered it: the hidden wrapper (#2).
describe('custom controls across LiveView re-renders (#2)', () => {
  afterEach(resetEnvironment);

  it('control_button stays in the map with the newly rendered state and bindings', () => {
    const lv = renderLiveView(MAP + controlButton());

    lv.render(MAP + controlButton({
      active: true,
      tooltip: 'Filtering',
      cls: 'wide',
      label: 'On',
      bindings: 'phx-click="toggle_filter" phx-value-scope="all"'
    }));

    let button = only('f-button');
    expect(inMapControl(button, 'top-right')).toBe(true);
    expect(button.classList.contains('maplibregl-ctrl-active')).toBe(true);
    expect(button.classList.contains('wide')).toBe(true);
    expect(button.title).toBe('Filtering');
    expect(button.textContent).toBe('On');
    expect(button.getAttribute('phx-click')).toBe('toggle_filter');
    expect(button.getAttribute('phx-value-scope')).toBe('all');

    lv.render(MAP + controlButton({ active: false, bindings: 'phx-click="clear_filter"' }));

    button = only('f-button');
    expect(inMapControl(button, 'top-right')).toBe(true);
    expect(button.classList.contains('maplibregl-ctrl-active')).toBe(false);
    expect(button.getAttribute('phx-click')).toBe('clear_filter');
    expect(button.hasAttribute('phx-value-scope')).toBe(false);

    lv.render(MAP);
    expect(document.getElementById('f-button')).toBeNull();
    expect(noControls()).toBe(true);
  });

  it('control stays in the map with its new slot content, and leaves it when removed', () => {
    const lv = renderLiveView(MAP + control('<button phx-click="toggle_layers">Layers: 1</button>'));

    lv.render(MAP + control('<button phx-click="toggle_layers">Layers: 2</button>'));

    const content = only('c-content');
    expect(inMapControl(content, 'top-left')).toBe(true);
    expect(content.textContent).toBe('Layers: 2');
    expect(content.querySelector('button')!.getAttribute('phx-click')).toBe('toggle_layers');

    lv.render(MAP);
    expect(document.getElementById('c-content')).toBeNull();
    expect(noControls()).toBe(true);
  });

  it('control_group stays in the map with its new slot content, and leaves it when removed', () => {
    const lv = renderLiveView(MAP + controlGroup('<button phx-click="north">N</button>'));

    lv.render(MAP + controlGroup('<button phx-click="north">N</button><button phx-click="home">H</button>'));

    const content = only('g-content');
    expect(inMapControl(content, 'bottom-left')).toBe(true);
    expect(Array.from(content.querySelectorAll('button'), (b) => b.getAttribute('phx-click'))).toEqual(['north', 'home']);

    lv.render(MAP);
    expect(document.getElementById('g-content')).toBeNull();
    expect(noControls()).toBe(true);
  });

  it('zoom_range keeps out-of-range content hidden after a re-render', () => {
    const zoomRange = (text: string) =>
      `<div id="z" phx-hook="ZoomRangeHook" data-config="${attr({ id: 'z', mapId: 'm', min: 8, max: null })}">` +
      `<div id="z-content">${text}</div></div>`;
    const lv = renderLiveView(MAP + zoomRange('Zoom in'));
    expect(only('z-content').style.display).toBe('none'); // the map is at zoom 5

    lv.render(MAP + zoomRange('Zoom in further'));

    expect(only('z-content').style.display).toBe('none');
    expect(only('z-content').textContent).toBe('Zoom in further');
  });
});
