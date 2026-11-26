/**
 * ManagedItem - what ManagedLayer and ManagedSource share: something a
 * component keeps on a map for as long as the component lives
 *
 * An item waits for its map to be registered (`MapManager.whenReady`, #17),
 * then listens for the map events after which it may have to act, and calls
 * its `reconcile()` on each of them. `waitForStyle()` lets it wait for the
 * style to accept sources and layers (`whenStyleReady`, #12).
 *
 * `whilePaused()` lets one item change several things on a map at once
 * without the other items reacting to the events those changes fire halfway.
 *
 * What an item owns (#46). A layer or source already on the map when an item
 * finds it there (from the map style, application code or another component)
 * is taken over: the item applies its updates to it, but never removes it. An
 * item owns, and removes when it goes, only the layer or source it added
 * itself. Ownership follows the object MapLibre holds for the id
 * (`getLayer`, `getSource`): MapLibre keeps that object while the layer or
 * source stays on the map, changes made in place included, and creates a new
 * one whenever the layer or source is added again, by anyone. So an item that
 * adds a layer after a style change dropped the one it took over owns it, and
 * an item whose own layer a style change replaced with one of the same id no
 * longer does.
 */

import type { Map } from 'maplibre-gl';

import { MapManager } from './map-manager';
import { whenStyleReady } from './style-ready';

/** Maps on which managed items ignore map events for now; see `whilePaused`. */
const paused = new WeakSet<Map>();

/** The item whose own add created each layer or source object MapLibre holds. */
const addedBy = new WeakMap<object, ManagedItem>();

/** The item whose own add created `object`, a layer or source as MapLibre holds it, if any. */
export function adderOf(object: unknown): ManagedItem | undefined {
  return typeof object === 'object' && object !== null ? addedBy.get(object) : undefined;
}

/**
 * Record that `item` added `object`, a layer or source as MapLibre holds it;
 * nothing when `item` is undefined. For code that removes and adds back a
 * layer on an item's behalf, so the item keeps owning it.
 */
export function recordAdd(object: unknown, item: ManagedItem | undefined): void {
  if (item && typeof object === 'object' && object !== null) addedBy.set(object, item);
}

/**
 * Run `change` while every managed item on `map` ignores the map events it
 * fires (MapLibre fires some of them synchronously, e.g. `sourcedata` from
 * `removeSource`). For changes that pass through states no item should react
 * to, such as a source briefly missing while it is replaced.
 */
export function whilePaused(map: Map, change: () => void): void {
  if (paused.has(map)) {
    change();
    return;
  }
  paused.add(map);
  try {
    change();
  } finally {
    paused.delete(map);
  }
}

/**
 * Deep equality of JSON values, regardless of object key order. A key whose
 * value is `undefined` counts as absent, as it would in JSON.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!isEqual(left[key], right[key])) return false;
  }
  return true;
}

export abstract class ManagedItem {
  /** The map, once it is registered. */
  protected map?: Map;
  protected destroyed = false;
  private cancelMapWait: () => void = () => {};
  private cancelStyleWait?: () => void;
  /** The listener attached for each of `mapEvents`, kept to detach it. */
  private mapListeners: [string, (event: unknown) => void][] = [];
  /** The take-over warning was logged; once per item is enough. */
  private warnedTakeOver = false;

  /**
   * @param mapEvents the map events after which the item reconciles
   */
  constructor(
    readonly mapId: string,
    readonly id: string,
    private readonly mapEvents: readonly string[]
  ) {}

  /**
   * Start waiting for the map. Called by the subclass constructor once its
   * own fields are set: `attach()`, and so `reconcile()`, runs right away when
   * the map is already registered.
   */
  protected start(): void {
    this.cancelMapWait = MapManager.whenReady(this.mapId, (map) => this.attach(map));
  }

  protected attach(map: Map): void {
    this.map = map;
    this.mapListeners = this.mapEvents.map((type) => [
      type,
      (event: unknown) => {
        if (!paused.has(map) && this.reactsTo(type, event)) this.reconcile();
      }
    ]);
    for (const [type, listener] of this.mapListeners) map.on(type as never, listener);
    this.reconcile();
  }

  /** Bring the map in line with the item's desired state. Idempotent. */
  protected abstract reconcile(): void;

  /**
   * Whether a map event of `type` (one of `mapEvents`) may call for a
   * reconcile. Every one does, unless a subclass narrows it down.
   */
  protected reactsTo(_type: string, _event: unknown): boolean {
    return true;
  }

  /** Cancel the waits for the map and for its style. */
  protected cancelWaits(): void {
    this.cancelMapWait();
    this.cancelStyleWait?.();
    this.cancelStyleWait = undefined;
  }

  /** Cancel every wait and detach the listeners that call `reconcile()`. */
  protected stopWatching(): void {
    this.cancelWaits();
    const map = this.map;
    if (map) {
      for (const [type, listener] of this.mapListeners) map.off(type as never, listener);
    }
    this.mapListeners = [];
  }

  /** Reconcile once the style of `map` accepts sources and layers; one wait at a time. */
  protected waitForStyle(map: Map): void {
    if (this.cancelStyleWait) return;
    let ran = false;
    const cancel = whenStyleReady(map, () => {
      ran = true;
      this.cancelStyleWait = undefined;
      this.reconcile();
    });
    if (!ran) this.cancelStyleWait = cancel;
  }

  /** Whether `map` is still the registered map: its own hook removes it first when it goes. */
  protected isRegistered(map: Map): boolean {
    return MapManager.has(this.mapId) && MapManager.get(this.mapId) === map;
  }

  /** Whether this item added `object`, its layer or source as MapLibre holds it now. */
  protected owns(object: unknown): boolean {
    return adderOf(object) === this;
  }

  /** Record that this item added `object`, its layer or source as MapLibre holds it. */
  protected claim(object: unknown): void {
    recordAdd(object, this);
  }

  /**
   * Note that the item's layer or source is on the map but was not added by
   * it. The first time, warn that the id was already in use: the item takes it
   * over for updates and leaves it on the map when it goes.
   *
   * @param kind "Layer" or "Source"
   * @param label names the item, e.g. `fill layer "water"`
   */
  protected tookOver(kind: string, label: string): void {
    if (this.warnedTakeOver) return;
    this.warnedTakeOver = true;
    console.warn(
      `[MaplibreX] ${kind} "${this.id}" was already on map "${this.mapId}", added by the map style or other code. ` +
        `${label} takes it over for updates and leaves it on the map when it is removed.`
    );
  }

  /**
   * Warn that a change MapLibre cannot apply in place is skipped: making it
   * means removing the layer or source, which this item did not add.
   */
  protected skipReplacement(kind: string, label: string): void {
    console.warn(
      `[MaplibreX] ${label} cannot apply this change in place, and does not replace the ${kind.toLowerCase()} ` +
        `it took over: the change is not applied until the component adds the ${kind.toLowerCase()} itself.`
    );
  }
}
