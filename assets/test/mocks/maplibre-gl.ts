/**
 * Hand-written stand-in for `maplibre-gl`, aliased in by vitest.config.ts.
 *
 * It models only what the hooks touch: listener bookkeeping per event type
 * (and per layer id), source/layer registries, control placement inside the
 * map container, and spies for the imperative camera and style commands.
 * Tests drive it with `emit()` and the lifecycle controls on `FakeMap`.
 *
 * Where layer and source lifecycle bugs live, `FakeMap` follows maplibre-gl
 * 6.5.0 (`src/ui/map.ts`, `src/style/style.ts`), including its error messages:
 *
 * - "Style document loaded" is separate from "fully loaded". Until the style
 *   document has loaded, style changes throw "Style is not done loading.".
 *   Once it has, they are accepted even while `isStyleLoaded()` and
 *   `loaded()` are false because tiles are loading (`setTilesLoading`).
 * - `load` fires once per map, when the style and its tiles have loaded.
 * - Refusals either throw or fire an `error` event (logged to the console when
 *   nothing listens), exactly where MapLibre does.
 *
 * Simplifications: events MapLibre fires on a later frame or after a network
 * round trip (`sourcedata` after `addSource`, `styledata` after `setStyle`)
 * fire synchronously; ordinary style changes (`addLayer`, ...) do not fire the
 * `styledata` MapLibre would fire on the next frame, so emit it by hand to test
 * reactions to it.
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

  /**
   * Every attached listener, in the order it was attached, as its event type
   * or `type:layerId` for a layer-scoped one: shows what a component leaves
   * behind without naming each event it might have used.
   */
  listenerKeys(): string[] {
    return this.listeners.map((l) => (l.layerId === undefined ? l.type : `${l.type}:${l.layerId}`));
  }
}

type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface Control {
  onAdd(map: FakeMap): HTMLElement;
  onRemove(map: FakeMap): void;
  getDefaultPosition?(): ControlPosition;
}

export interface FakeMapOptions {
  /**
   * `false` gives the state right after `new Map({ style })`: the style
   * document is still loading and `load` has not fired; `finishStyleLoad()`
   * completes it. Defaults to `true`: the style has loaded and `load` has
   * already fired.
   */
  loaded?: boolean;
}

/** A style document, as `setStyle` takes it and `getStyle` returns it. */
export interface StyleSpec {
  version?: number;
  sources?: Record<string, any>;
  layers?: any[];
  terrain?: any;
  [key: string]: unknown;
}

const EMPTY_STYLE: StyleSpec = { version: 8, sources: {}, layers: [] };

/** A deep copy of a JSON value, as MapLibre keeps and serializes style objects. */
function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** `group` (a layer's paint or layout) with `name` set, or removed for null/undefined. */
function withProperty(group: Record<string, unknown> | undefined, name: string, value: unknown) {
  const next = { ...group };
  if (value == null) {
    delete next[name];
  } else {
    next[name] = clone(value);
  }
  return next;
}

/**
 * A source object as `getSource` returns it: the specification's fields, `id`,
 * `serialize()` (the source's current specification) and, as spies, the
 * update methods MapLibre 6.5.0 gives that source type. Updates show in the
 * fields and in `serialize()`.
 */
function createSource(id: string, specification: Record<string, any>): Record<string, any> {
  const spec = { ...specification };
  const source: Record<string, any> = { ...spec, id, serialize: () => clone(spec) };
  const update = (changes: Record<string, unknown>) => {
    Object.assign(spec, clone(changes));
    Object.assign(source, clone(changes));
  };

  switch (spec.type) {
    case 'geojson':
      // These return a promise in MapLibre 6.5.0.
      source.setData = vi.fn((data: unknown) => {
        update({ data });
        return Promise.resolve();
      });
      source.updateData = vi.fn(() => Promise.resolve());
      source.setClusterOptions = vi.fn((options: Record<string, unknown>) => {
        update(options);
        return Promise.resolve();
      });
      break;
    case 'vector':
    case 'raster':
    case 'raster-dem':
      source.setTiles = vi.fn((tiles: string[]) => {
        update({ tiles });
        return source;
      });
      source.setUrl = vi.fn((url: string) => {
        update({ url });
        return source;
      });
      break;
    case 'image':
      source.updateImage = vi.fn((options: { url?: string; coordinates?: unknown }) => {
        // Without a url (or an already decoded image) MapLibre changes nothing.
        if (options.url) {
          update({ url: options.url, ...(options.coordinates ? { coordinates: options.coordinates } : {}) });
        }
        return source;
      });
      source.setCoordinates = vi.fn((coordinates: unknown) => {
        update({ coordinates });
        return source;
      });
      break;
    case 'video': {
      const video = document.createElement('video');
      source.setCoordinates = vi.fn((coordinates: unknown) => {
        update({ coordinates });
        return source;
      });
      source.play = vi.fn();
      source.pause = vi.fn();
      source.seek = vi.fn();
      source.getVideo = vi.fn(() => video);
      break;
    }
  }
  return source;
}

export class FakeMap extends Emitter {
  sources = new Map<string, any>();
  layers = new Map<string, any>();
  zoom = 5;
  canvas = { style: { cursor: '' } };
  /** The corner elements MapLibre creates inside the map container for controls. */
  controlPositions = {} as Record<ControlPosition, HTMLElement>;

  /** MapLibre's `Style._loaded`: the style document has loaded. */
  private styleDocumentLoaded: boolean;
  /** MapLibre's `Map._loaded`: `load` has fired, which happens once per map. */
  private loadFired: boolean;
  private tilesLoading = false;
  /** The style a full rebuild (`setStyle(style, { diff: false })`) is loading. */
  private pendingStyle?: StyleSpec;
  /** Top-level style fields other than sources, layers and terrain. */
  private stylesheet: Record<string, unknown> = { version: 8 };
  private layerOrder: string[] = [];
  private terrain: any = null;

  constructor(
    public container: HTMLElement = document.createElement('div'),
    options: FakeMapOptions = {}
  ) {
    super();
    this.styleDocumentLoaded = options.loaded ?? true;
    this.loadFired = this.styleDocumentLoaded;
    const controlContainer = document.createElement('div');
    controlContainer.className = 'maplibregl-control-container';
    (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).forEach((position) => {
      const corner = document.createElement('div');
      corner.className = `maplibregl-ctrl-${position}`;
      controlContainer.appendChild(corner);
      this.controlPositions[position] = corner;
    });
    container.appendChild(controlContainer);
  }

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

  // ---------------------------------------------------------------------
  // Lifecycle controls (test-only)
  // ---------------------------------------------------------------------

  /**
   * The style document being loaded arrives, as in MapLibre's `Style._load`:
   * its content (`style`, or the one passed to a full-rebuild `setStyle`)
   * replaces the map's, then `styledata` and `style.load` fire. `load`
   * follows, the first time only, unless tiles are still loading.
   */
  finishStyleLoad(style?: StyleSpec): void {
    if (this.styleDocumentLoaded) {
      throw new Error('FakeMap: no style is loading; create the map with { loaded: false } or call setStyle(style, { diff: false })');
    }
    const next = style ?? this.pendingStyle ?? EMPTY_STYLE;
    this.pendingStyle = undefined;
    this.styleDocumentLoaded = true;
    const added = this.replaceStyleContent(next);
    // `Style._load` applies the style's terrain, or none, through `setTerrain`.
    this.emit('terrain', { type: 'terrain', terrain: this.terrain });
    this.emit('styledata', { type: 'styledata', dataType: 'style' });
    this.emit('style.load', { type: 'style.load' });
    this.emitSourceDataFor(added);
    this.fireLoadIfDue();
  }

  /**
   * While tiles load, `isStyleLoaded()` and `loaded()` are false, as in
   * MapLibre, yet sources and layers can still be added. When they finish on
   * a map whose `load` has not fired yet, `load` fires.
   */
  setTilesLoading(loading: boolean): void {
    this.tilesLoading = loading;
    this.fireLoadIfDue();
  }

  private fireLoadIfDue(): void {
    if (!this.loadFired && this.styleDocumentLoaded && !this.tilesLoading) {
      this.loadFired = true;
      this.emit('load', { type: 'load' });
    }
  }

  /** MapLibre's `Style._checkLoaded()`, which guards every style change. */
  private checkLoaded(): void {
    if (!this.styleDocumentLoaded) {
      throw new Error('Style is not done loading.');
    }
  }

  /** Fire an `error` event as MapLibre does: logged to the console when nothing listens. */
  private fireError(message: string): void {
    const error = new Error(message);
    if (this.listenerCount('error') > 0) {
      this.emit('error', { type: 'error', error });
    } else {
      console.error(error);
    }
  }

  /** MapLibre's `Style.addSource`. */
  private insertSource(id: string, spec: any): void {
    this.checkLoaded();
    if (this.sources.has(id)) {
      throw new Error(`Source "${id}" already exists.`);
    }
    if (!spec?.type) {
      throw new Error(
        `The type property must be defined, but only the following properties were given: ${Object.keys(spec ?? {}).join(', ')}.`
      );
    }
    this.sources.set(id, createSource(id, spec));
    this.emitSourceData(id, this.sources.get(id));
  }

  /**
   * The source `metadata` event, relayed by the map as `sourcedata`. MapLibre
   * fires it once a new source's metadata has loaded (the mock: right away),
   * and also, synchronously, when a source is removed.
   */
  private emitSourceData(id: string, source: any): void {
    this.emit('sourcedata', {
      type: 'sourcedata',
      dataType: 'source',
      sourceDataType: 'metadata',
      sourceId: id,
      isSourceLoaded: !this.tilesLoading,
      source: source.serialize()
    });
  }

  /** The layer a style setter targets, or `undefined` after firing `missingMessage`. */
  private styledLayer(id: string, missingMessage: string): any {
    this.checkLoaded();
    const layer = this.layers.get(id);
    if (!layer) this.fireError(missingMessage);
    return layer;
  }

  /** MapLibre's `Map._updateStyle`: a new, still loading style replaces the current one. */
  private rebuildStyle(next: StyleSpec): void {
    this.styleDocumentLoaded = false;
    this.pendingStyle = next;
    this.sources.clear();
    this.layers.clear();
    this.layerOrder = [];
    // The terrain stays until the new style loads, as MapLibre's map keeps it.
    this.emit('styledataloading', { type: 'styledataloading', dataType: 'style' });
  }

  /** MapLibre's `Style.setState`: the end state is `next`, reached in place. */
  private diffStyle(next: StyleSpec): void {
    const before = JSON.stringify(this.serializeStyle());
    const terrainBefore = JSON.stringify(this.terrain);
    const added = this.replaceStyleContent(next);
    if (JSON.stringify(this.terrain) !== terrainBefore) {
      this.emit('terrain', { type: 'terrain', terrain: this.terrain });
    }
    if (JSON.stringify(this.serializeStyle()) !== before) {
      this.emit('styledata', { type: 'styledata', dataType: 'style' });
    }
    this.emitSourceDataFor(added);
  }

  /** `sourcedata` for each of these sources still on the map. */
  private emitSourceDataFor(ids: string[]): void {
    ids.forEach((id) => {
      const source = this.sources.get(id);
      if (source) this.emitSourceData(id, source);
    });
  }

  /**
   * Swap in a style document's sources, layers and terrain, without events,
   * and return the ids of the sources that got a new object. A source whose
   * specification is unchanged keeps its object; custom layers, which
   * MapLibre's diff never sees, stay on top.
   */
  private replaceStyleContent(style: StyleSpec): string[] {
    const { sources = {}, layers = [], terrain, ...rest } = style;
    this.stylesheet = { version: 8, ...rest };

    const previousSources = new Map(this.sources);
    const added: string[] = [];
    this.sources.clear();
    Object.entries(sources).forEach(([id, spec]) => {
      const kept = previousSources.get(id);
      if (kept && JSON.stringify(kept.serialize()) === JSON.stringify(spec)) {
        this.sources.set(id, kept);
      } else {
        this.sources.set(id, createSource(id, spec));
        added.push(id);
      }
    });

    const customLayers = this.layerOrder.map((id) => this.layers.get(id)).filter((layer) => layer.type === 'custom');
    this.layers.clear();
    this.layerOrder = [];
    [...layers.map((layer) => clone(layer)), ...customLayers].forEach((layer) => {
      this.layers.set(layer.id, layer);
      this.layerOrder.push(layer.id);
    });

    this.terrain = clone(terrain) ?? null;
    return added;
  }

  /** MapLibre's `Style.serialize()`: custom layers are left out. */
  private serializeStyle(): StyleSpec {
    const sources = Object.fromEntries([...this.sources].map(([id, source]) => [id, source.serialize()]));
    const layers = this.layerOrder
      .map((id) => this.layers.get(id))
      .filter((layer) => layer.type !== 'custom')
      .map((layer) => clone(layer));
    return { ...this.stylesheet, sources, layers, ...(this.terrain ? { terrain: clone(this.terrain) } : {}) };
  }

  // ---------------------------------------------------------------------
  // Map API
  // ---------------------------------------------------------------------

  /** MapLibre's `Style.loaded()`: the style document and all its tiles have loaded. */
  isStyleLoaded = (): boolean => this.styleDocumentLoaded && !this.tilesLoading;
  loaded = (): boolean => this.styleDocumentLoaded && !this.tilesLoading;
  getCanvas = () => this.canvas;
  getZoom = () => this.zoom;

  /** Like MapLibre, `undefined` until the style document has loaded. */
  getStyle = (): StyleSpec | undefined => (this.styleDocumentLoaded ? this.serializeStyle() : undefined);

  /** No images are modelled; like MapLibre, it goes through `Style._checkLoaded()`. */
  listImages = (): string[] => {
    this.checkLoaded();
    return [];
  };

  addSource = vi.fn((id: string, spec: any) => {
    this.insertSource(id, spec);
    return this;
  });
  getSource = vi.fn((id: string) => this.sources.get(id));
  removeSource = vi.fn((id: string) => {
    this.checkLoaded();
    if (!this.sources.has(id)) {
      throw new Error(`There is no source with this ID=${id}`);
    }
    const user = [...this.layers.values()].find((layer) => layer.source === id);
    if (user) {
      this.fireError(`Source "${id}" cannot be removed while layer "${user.id}" is using it.`);
      return this;
    }
    const source = this.sources.get(id);
    this.sources.delete(id);
    this.emitSourceData(id, source);
    return this;
  });
  addLayer = vi.fn((layer: any, beforeId?: string) => {
    this.checkLoaded();
    const id = layer.id;
    if (this.layers.has(id)) {
      this.fireError(`Layer "${id}" already exists on this map.`);
      return this;
    }
    let spec = layer;
    if (layer.type !== 'custom') {
      if (layer.source && typeof layer.source === 'object') {
        this.insertSource(id, layer.source);
        spec = { ...layer, source: id };
      }
      // MapLibre's style validation of the layer.
      if (spec.type !== 'background' && !spec.source) {
        this.fireError(`layers.${id}: missing required property "source"`);
        return this;
      }
      if (spec.type !== 'background' && !this.sources.has(spec.source)) {
        this.fireError(`layers.${id}: source "${spec.source}" not found`);
        return this;
      }
      // Like MapLibre's style layer, later changes to the caller's object do not reach it.
      spec = clone(spec);
    }
    const index = beforeId ? this.layerOrder.indexOf(beforeId) : this.layerOrder.length;
    if (beforeId && index === -1) {
      this.fireError(`Cannot add layer "${id}" before non-existing layer "${beforeId}".`);
      return this;
    }
    this.layerOrder.splice(index, 0, id);
    this.layers.set(id, spec);
    return this;
  });
  getLayer = vi.fn((id: string) => this.layers.get(id));
  getLayersOrder = (): string[] => [...this.layerOrder];
  moveLayer = vi.fn((id: string, beforeId?: string) => {
    this.checkLoaded();
    if (!this.layers.has(id)) {
      this.fireError(`The layer '${id}' does not exist in the map's style and cannot be moved.`);
      return this;
    }
    if (id === beforeId) return this;
    this.layerOrder = this.layerOrder.filter((layerId) => layerId !== id);
    const index = beforeId ? this.layerOrder.indexOf(beforeId) : this.layerOrder.length;
    if (beforeId && index === -1) {
      // MapLibre 6.5.0 has already taken the layer out of its order here and
      // does not put it back: the layer still exists but is no longer drawn.
      this.fireError(`Cannot move layer "${id}" before non-existing layer "${beforeId}".`);
      return this;
    }
    this.layerOrder.splice(index, 0, id);
    return this;
  });
  /** As in MapLibre, a null or undefined bound leaves that bound unchanged. */
  setLayerZoomRange = vi.fn((id: string, minzoom?: number | null, maxzoom?: number | null) => {
    const layer = this.styledLayer(id, `Cannot set the zoom range of non-existing layer "${id}".`);
    if (!layer) return this;
    if (minzoom != null) layer.minzoom = minzoom;
    if (maxzoom != null) layer.maxzoom = maxzoom;
    return this;
  });
  removeLayer = vi.fn((id: string) => {
    this.checkLoaded();
    if (!this.layers.has(id)) {
      this.fireError(`Cannot remove non-existing layer "${id}".`);
      return this;
    }
    this.layers.delete(id);
    this.layerOrder = this.layerOrder.filter((layerId) => layerId !== id);
    return this;
  });
  /** A null or undefined value resets the property to its default. */
  setPaintProperty = vi.fn((id: string, name: string, value: unknown) => {
    const layer = this.styledLayer(id, `Cannot style non-existing layer "${id}".`);
    if (layer) layer.paint = withProperty(layer.paint, name, value);
    return this;
  });
  setLayoutProperty = vi.fn((id: string, name: string, value: unknown) => {
    const layer = this.styledLayer(id, `Cannot style non-existing layer "${id}".`);
    if (layer) layer.layout = withProperty(layer.layout, name, value);
    return this;
  });
  setFilter = vi.fn((id: string, filter?: unknown) => {
    const layer = this.styledLayer(id, `Cannot filter non-existing layer "${id}".`);
    if (!layer) return this;
    if (filter == null) {
      delete layer.filter;
    } else {
      layer.filter = clone(filter);
    }
    return this;
  });

  setTerrain = vi.fn((options: any) => {
    this.checkLoaded();
    if (options && !this.sources.has(options.source)) {
      throw new Error(`cannot load terrain, because there exists no source with ID: ${options.source}`);
    }
    this.terrain = options ?? null;
    this.emit('terrain', { type: 'terrain', terrain: options });
    return this;
  });
  getTerrain = () => this.terrain;

  /**
   * By default MapLibre diffs the new style against the current one, and the
   * result matches the new style: sources, layers and terrain added at
   * runtime are dropped unless the new style has them too. `styledata` fires
   * when something changed (MapLibre 6.5.0 also fires `style.load` on this
   * path, 5.0.0 does not, so the mock leaves it out).
   *
   * `{ diff: false }`, or a style document that has not loaded yet, takes the
   * full-rebuild path instead: sources and layers are gone and style changes
   * throw until `finishStyleLoad()` loads the new style.
   *
   * The mock cannot fetch a style URL: it stands for a style with no sources
   * or layers.
   */
  setStyle = vi.fn((style: StyleSpec | string | null, options: { diff?: boolean } = {}) => {
    const next = style && typeof style === 'object' ? style : EMPTY_STYLE;
    if (options.diff === false || !this.styleDocumentLoaded) {
      this.rebuildStyle(next);
    } else {
      this.diffStyle(next);
    }
    return this;
  });

  getContainer = () => this.container;

  /**
   * MapLibre's `Map.remove()`: the style goes (`setStyle(null)`, which fires
   * no source or style events) and `remove` fires last. Unlike MapLibre,
   * whose style methods then throw for want of a style, the mock keeps
   * answering with an empty style; tests that need the throw stub it.
   */
  remove = vi.fn(() => {
    this.sources.clear();
    this.layers.clear();
    this.layerOrder = [];
    this.terrain = null;
    this.emit('remove', { type: 'remove' });
  });

  // As in MapLibre: the element returned by `onAdd` goes into the corner for
  // `position` (prepended at the bottom), and removal is left to `onRemove`.
  addControl = vi.fn((control: Control, position?: ControlPosition) => {
    const at = position ?? control.getDefaultPosition?.() ?? 'top-right';
    const element = control.onAdd(this);
    const corner = this.controlPositions[at];
    if (at.startsWith('bottom')) {
      corner.insertBefore(element, corner.firstChild);
    } else {
      corner.appendChild(element);
    }
    return this;
  });
  removeControl = vi.fn((control: Control) => {
    control.onRemove(this);
    return this;
  });

  flyTo = vi.fn();
  jumpTo = vi.fn();
  fitBounds = vi.fn();
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
  map?: FakeMap;
  private dragState: 'inactive' | 'pending' | 'active' = 'inactive';

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
  addTo = vi.fn((map: FakeMap) => {
    this.map = map;
    return this;
  });

  /**
   * Presses the pointer on the marker. As in MapLibre, a draggable marker then
   * follows the map's `mousemove` events (the first one fires `dragstart`) and
   * fires `dragend` from a one-time map `mouseup` listener, which `remove()`
   * unsubscribes. Drive the drag with `map.emit('mousemove', { lngLat })` and
   * `map.emit('mouseup')`.
   */
  pointerDown(): void {
    if (!this.map || !this.draggable) return;
    this.dragState = 'pending';
    this.map.on('mousemove', this.onMove);
    this.map.once('mouseup', this.onUp);
  }

  private onMove = (e: { lngLat: [number, number] }) => {
    this.lngLat = e.lngLat;
    if (this.dragState === 'pending') {
      this.dragState = 'active';
      this.emit('dragstart');
    }
    this.emit('drag');
  };

  private onUp = () => {
    this.map?.off('mousemove', this.onMove);
    if (this.dragState === 'active') this.emit('dragend');
    this.dragState = 'inactive';
  };
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
  // Like MapLibre, removing a marker drops its map listeners (cutting short a
  // drag in progress, without `dragend`) and closes its popup.
  remove = vi.fn(() => {
    this.map?.off('mousemove', this.onMove);
    this.map?.off('mouseup', this.onUp);
    this.map = undefined;
    this.removed = true;
    this.popup?.remove();
    return this;
  });

  on(type: string, handler: Handler): this {
    this.addListener(type, handler, undefined, false);
    return this;
  }
  once(type: string, handler: Handler): this {
    this.addListener(type, handler, undefined, true);
    return this;
  }
  off(type: string, handler: Handler): this {
    this.removeListener(type, handler);
    return this;
  }
}

/** A built-in control: an element the map places on `addControl`. */
export class ScaleControl implements Control {
  element = document.createElement('div');

  constructor(public options: Record<string, any> = {}) {
    this.element.className = 'maplibregl-ctrl maplibregl-ctrl-scale';
  }
  onAdd(): HTMLElement {
    return this.element;
  }
  onRemove(): void {
    this.element.remove();
  }
}

/** Forget instances created by earlier tests. */
export function resetMocks(): void {
  Marker.instances = [];
  Popup.instances = [];
}
