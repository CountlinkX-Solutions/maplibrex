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
 */

import type { Map } from 'maplibre-gl';

import { MapManager } from './map-manager';
import { whenStyleReady } from './style-ready';

/** Maps on which managed items ignore map events for now; see `whilePaused`. */
const paused = new WeakSet<Map>();

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
  private readonly onMapChange = () => {
    if (this.map && !paused.has(this.map)) this.reconcile();
  };

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
    for (const type of this.mapEvents) map.on(type as never, this.onMapChange);
    this.reconcile();
  }

  /** Bring the map in line with the item's desired state. Idempotent. */
  protected abstract reconcile(): void;

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
    if (!map) return;
    for (const type of this.mapEvents) map.off(type as never, this.onMapChange);
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
}
