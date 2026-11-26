/**
 * Hand-written stand-in for `maplibre-gl`, aliased in by vitest.config.ts.
 *
 * It models only what the hooks touch: listener bookkeeping per event type
 * (and per layer id), source/layer registries, and spies for the imperative
 * camera and style commands. Tests drive it with `emit()`.
 */
import { vi } from 'vitest';

type Handler = (event?: any) => void;

interface Listener {
  type: string;
  layerId?: string;
  handler: Handler;
  once: boolean;
}

/** Shared by Map, Marker and Popup: a minimal event emitter. */
class Emitter {
  protected listeners: Listener[] = [];

  protected addListener(type: string, a: string | Handler, b: Handler | undefined, once: boolean): void {
    if (typeof a === 'function') {
      this.listeners.push({ type, handler: a, once });
    } else {
      this.listeners.push({ type, layerId: a, handler: b as Handler, once });
    }
  }

  protected removeListener(type: string, a: string | Handler, b?: Handler): void {
    const layerId = typeof a === 'function' ? undefined : a;
    const handler = typeof a === 'function' ? a : b;
    this.listeners = this.listeners.filter(
      (l) => !(l.type === type && l.layerId === layerId && l.handler === handler)
    );
  }

  /** Fire every matching listener, the way MapLibre does. */
  emit(type: string, layerIdOrEvent?: string | object, event?: object): void {
    const layerId = typeof layerIdOrEvent === 'string' ? layerIdOrEvent : undefined;
    const payload = typeof layerIdOrEvent === 'string' ? event : layerIdOrEvent;
    for (const l of [...this.listeners]) {
      if (l.type === type && l.layerId === layerId) {
        if (l.once) this.listeners = this.listeners.filter((x) => x !== l);
        l.handler(payload);
      }
    }
  }

  /** How many listeners are attached for a type (and layer id, when given). */
  listenerCount(type: string, layerId?: string): number {
    return this.listeners.filter((l) => l.type === type && l.layerId === layerId).length;
  }
}

export class FakeMap extends Emitter {
  sources = new Map<string, any>();
  layers = new Map<string, any>();
  zoom = 5;
  canvas = { style: { cursor: '' } };

  on(type: string, a: string | Handler, b?: Handler): this {
    this.addListener(type, a, b, false);
    return this;
  }
  once(type: string, a: string | Handler, b?: Handler): this {
    this.addListener(type, a, b, true);
    return this;
  }
  off(type: string, a: string | Handler, b?: Handler): this {
    this.removeListener(type, a, b);
    return this;
  }

  isStyleLoaded = () => true;
  getCanvas = () => this.canvas;
  getZoom = () => this.zoom;

  addSource = vi.fn((id: string, spec: any) => {
    this.sources.set(id, { ...spec, setData: vi.fn() });
  });
  getSource = vi.fn((id: string) => this.sources.get(id));
  removeSource = vi.fn((id: string) => {
    this.sources.delete(id);
  });
  addLayer = vi.fn((spec: any) => {
    this.layers.set(spec.id, spec);
  });
  getLayer = vi.fn((id: string) => this.layers.get(id));
  removeLayer = vi.fn((id: string) => {
    this.layers.delete(id);
  });
  setPaintProperty = vi.fn();
  setLayoutProperty = vi.fn();
  setFilter = vi.fn();

  addControl = vi.fn();
  removeControl = vi.fn();

  flyTo = vi.fn();
  jumpTo = vi.fn();
  fitBounds = vi.fn();
  setStyle = vi.fn();
  rotateTo = vi.fn();
  setPitch = vi.fn();
  resetNorth = vi.fn();
  zoomIn = vi.fn();
  zoomOut = vi.fn();
}

export class Popup extends Emitter {
  static instances: Popup[] = [];
  text?: string;
  html?: string;
  open = false;

  constructor(public options: Record<string, any> = {}) {
    super();
    Popup.instances.push(this);
  }
  isOpen = () => this.open;
  addTo = vi.fn(() => {
    this.open = true;
    return this;
  });
  remove = vi.fn(() => {
    this.open = false;
    return this;
  });
  setText = vi.fn((text: string) => {
    this.text = text;
    return this;
  });
  setHTML = vi.fn((html: string) => {
    this.html = html;
    return this;
  });
}

export class Marker extends Emitter {
  static instances: Marker[] = [];
  lngLat: [number, number] = [0, 0];
  popup?: Popup;
  draggable: boolean;
  removed = false;
  element = document.createElement('div');

  constructor(public options: Record<string, any> = {}) {
    super();
    this.draggable = !!options.draggable;
    Marker.instances.push(this);
  }

  setLngLat = vi.fn((lngLat: [number, number]) => {
    this.lngLat = lngLat;
    return this;
  });
  getLngLat = () => ({ lng: this.lngLat[0], lat: this.lngLat[1], toArray: () => [...this.lngLat] });
  addTo = vi.fn(() => this);
  setPopup = vi.fn((popup: Popup) => {
    this.popup = popup;
    return this;
  });
  getPopup = () => this.popup;
  togglePopup = vi.fn(() => {
    if (this.popup) {
      if (this.popup.isOpen()) this.popup.remove();
      else this.popup.addTo(null);
    }
    return this;
  });
  setRotation = vi.fn(() => this);
  setDraggable = vi.fn((draggable: boolean) => {
    this.draggable = draggable;
    return this;
  });
  setOffset = vi.fn(() => this);
  setPitchAlignment = vi.fn(() => this);
  setRotationAlignment = vi.fn(() => this);
  getElement = () => this.element;
  // Like MapLibre, removing a marker also closes its popup.
  remove = vi.fn(() => {
    this.removed = true;
    this.popup?.remove();
    return this;
  });

  on(type: string, handler: Handler): this {
    this.addListener(type, handler, undefined, false);
    return this;
  }
  off(type: string, handler: Handler): this {
    this.removeListener(type, handler);
    return this;
  }
}

/** Controls only need to be constructible; the map records `addControl` calls. */
export class ScaleControl {
  constructor(public options: Record<string, any> = {}) {}
}

/** Forget instances created by earlier tests. */
export function resetMocks(): void {
  Marker.instances = [];
  Popup.instances = [];
}
