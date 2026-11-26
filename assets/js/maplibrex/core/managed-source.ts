/**
 * ManagedSource - one source kept on a map for as long as its component lives
 *
 * The source counterpart of ManagedLayer (core/managed-layer.ts), on the same
 * ManagedItem base. A source component describes the source it wants (its
 * desired specification) and this class keeps the map in line with it:
 *
 * - it waits for the map to be registered (#17) and for its style to accept
 *   sources (#12), then adds the source;
 * - `update()` applies a new specification in place where the source object
 *   has a method for the change (`setTiles`, `setUrl`, `updateImage`,
 *   `setCoordinates`, `setData`, ...), and otherwise replaces the source (#3);
 * - it puts the source back, as currently desired, after a style change
 *   drops it (#4), which `styledata` reports; in the common case (the source
 *   is on the map) that costs one `getSource` lookup;
 * - `destroy()` removes the source, or, while layers still use it, waits
 *   until none does (#18).
 *
 * Replacing a source. MapLibre refuses to remove a source that a layer uses,
 * so a change no method can apply takes every layer using the source off the
 * map, replaces the source, and puts those layers back from their serialized
 * state (`getStyle()`), each at its old place in the layer order. Layers kept
 * by a ManagedLayer and layers of the basemap or of application code are
 * treated alike: they come back as they were, runtime changes included, and
 * keep their layer listeners (MapLibre keeps those across a removal). Managed
 * items ignore the map events fired meanwhile (`whilePaused`), so none of
 * them reacts to the half-done replacement. If MapLibre refuses the new
 * source, the previous one goes back with its layers.
 *
 * Deferred removal. A source destroyed while layers use it stays until the
 * last of them goes, re-checking whenever a ManagedLayer removes its layer
 * (`ManagedSource.layerRemoved`) and on every `styledata`; `onRemoved` runs
 * only once the source is really gone: removed by this class, dropped by a
 * style change, or gone with its map.
 *
 * Hand-over. Each source id has one owner per map id. A ManagedSource created
 * for an id that another one still owns (typically one whose removal waits
 * for a layer, when the component is rendered again) takes the source over:
 * the previous owner stops without removing anything, and the new one brings
 * the source on the map to its own specification and inherits whether
 * `onFirstAdd` already ran, so `source:added` and `source:removed` stay
 * paired.
 */

import type { Map, SourceSpecification } from 'maplibre-gl';

import { logger } from './logger';
import { ManagedItem, isEqual, whilePaused } from './managed-item';
import { isStyleReady } from './style-ready';

/** A source specification: what `addSource` takes. */
export interface SourceSpec {
  type: string;
  [key: string]: unknown;
}

/** How a change to one specification key is applied to the source object on the map. */
export interface InPlaceUpdate {
  /** The source method that applies it, e.g. `setTiles`. */
  method: string;
  /** The method's arguments, from the new specification. */
  args: (spec: SourceSpec) => unknown[];
}

/** The in-place update of each specification key that has one. */
export type InPlaceUpdates = Record<string, InPlaceUpdate>;

/** A map listener for events about this source only, also given the map. */
export type SourceListener = (event: any, map: Map) => void;

export interface ManagedSourceOptions {
  /** Names the source in console messages, e.g. `vector tile source "places"`. */
  label?: string;
  /** What MapLibre can change in place on this source; any other change replaces the source. */
  inPlace?: InPlaceUpdates;
  /**
   * Map listeners by event type (`sourcedata`, `sourcedataloading`, `error`,
   * ...), called only for events whose `sourceId` is this source's. Attached
   * once the map is known and detached by `destroy()`.
   */
  listeners?: Record<string, SourceListener>;
  /** Called once, the first time the source is actually added to the map. */
  onFirstAdd?: () => void;
  /** Called once the source is really gone after `destroy()`, if `onFirstAdd` ran. */
  onRemoved?: () => void;
  /** Called when MapLibre throws while the source is added or replaced. */
  onError?: (error: unknown) => void;
}

/**
 * The in-place updates that take a source from `previous` to `next`, each
 * once, or `null` when the source has to be replaced: a changed key without
 * an in-place update (the type among them), or a key that is no longer set
 * (no method can unset one).
 */
export function diffSource(previous: SourceSpec, next: SourceSpec, inPlace: InPlaceUpdates = {}): InPlaceUpdate[] | null {
  const updates: InPlaceUpdate[] = [];
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (isEqual(previous[key], next[key])) continue;
    const update = inPlace[key];
    if (!update || next[key] == null) return null;
    if (!updates.includes(update)) updates.push(update);
  }
  return updates;
}

/** What an owner hands over to the ManagedSource that takes its source over. */
interface Handover {
  /** The map it was on, if it had one yet. */
  map?: Map;
  /** The specification the source on that map has. */
  spec: SourceSpec;
  /** Whether it had run `onFirstAdd`, and so owes `onRemoved`. */
  added: boolean;
}

/** The ManagedSource that owns each source id, per map id. */
const owners = new globalThis.Map<string, globalThis.Map<string, ManagedSource>>();

export class ManagedSource extends ManagedItem {
  private desired: SourceSpec;
  private readonly label: string;
  /** `onFirstAdd` has run, here or in the owner this one took over from. */
  private wasAdded = false;
  /**
   * MapLibre refused the last add (it threw, or fired an error event and
   * added nothing). Retrying on every style event would only repeat that, so
   * the next attempt waits for a new desired state.
   */
  private refused = false;
  /** `destroy()` found layers using the source: it is removed once none does. */
  private removalPending = false;
  /** Another ManagedSource took the source over: this one leaves the map alone. */
  private released = false;
  /** What the previous owner left: taken over once the map is known, if it is the same map. */
  private inherited?: Handover;
  /** The component's listeners as attached, kept for `destroy()` to detach. */
  private attachedListeners: [string, (event: any) => void][] = [];
  private readonly onMapRemoved = () => this.finishRemoval();

  /**
   * Start keeping source `id` on map `mapId`: it is added as soon as the map
   * is registered and its style accepts sources.
   */
  constructor(
    mapId: string,
    id: string,
    spec: SourceSpec,
    private readonly options: ManagedSourceOptions = {}
  ) {
    super(mapId, id, ['styledata']);
    this.desired = spec;
    this.label = options.label ?? `source "${id}"`;

    let sources = owners.get(mapId);
    if (!sources) {
      sources = new globalThis.Map();
      owners.set(mapId, sources);
    }
    const previous = sources.get(id);
    sources.set(id, this);
    if (previous) this.inherited = previous.release();

    this.start();
  }

  /**
   * Whether a live ManagedSource keeps source `id` on `map`, registered as
   * `mapId` (or is about to: it waits for that map id): a layer waiting for
   * that source can count on it being added.
   */
  static isManaged(map: Map, mapId: string, id: string): boolean {
    const owner = owners.get(mapId)?.get(id);
    return owner !== undefined && !owner.destroyed && (owner.map === undefined || owner.map === map);
  }

  /** A layer left map `mapId`: removals that waited for it may go ahead. */
  static layerRemoved(mapId: string): void {
    const sources = owners.get(mapId);
    if (!sources) return;
    for (const source of [...sources.values()]) source.retryRemoval();
  }

  /** Whether `onFirstAdd` has run (here or in the owner this one took over from). */
  get added(): boolean {
    return this.wasAdded;
  }

  /**
   * Make `spec` the source's desired specification. If the source is on the
   * map it is changed now, in place where MapLibre allows it; otherwise the
   * next add uses it.
   */
  update(spec: SourceSpec): void {
    if (this.destroyed || this.released) return;
    const previous = this.desired;
    if (isEqual(previous, spec)) return;
    this.desired = spec;
    this.refused = false;

    const map = this.map;
    if (!map || !map.getSource(this.id)) {
      this.reconcile();
      return;
    }
    try {
      this.change(map, previous);
    } catch (error) {
      this.fail('updating', error);
    }
  }

  /**
   * Stop keeping the source: cancel every pending wait, detach the
   * component's listeners and remove the source, now if no layer uses it,
   * otherwise once none does. Idempotent.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelWaits();
    this.detachListeners();
    if (this.released) return;

    const map = this.map;
    if (!map) {
      this.disown();
      return;
    }
    // A map removed by its own hook first took the source with it.
    if (!this.isRegistered(map)) {
      this.finishRemoval();
      return;
    }
    this.removalPending = true;
    this.retryRemoval();
    if (this.removalPending) {
      map.on('remove', this.onMapRemoved);
      logger.debug(`[MaplibreX] ${this.label} is still used by a layer; it will be removed with the last one`);
    }
  }

  protected attach(map: Map): void {
    this.map = map;
    this.attachListeners(map);
    const inherited = this.inherited;
    this.inherited = undefined;
    // An owner on another map (one since replaced under the same id) leaves nothing here.
    if (inherited?.map === map) this.takeOver(map, inherited);
    super.attach(map);
  }

  protected reconcile(): void {
    const map = this.map;
    if (!map || this.released) return;
    if (this.destroyed) {
      this.retryRemoval();
      return;
    }

    try {
      if (map.getSource(this.id)) return;
      if (this.refused) return;
      if (!isStyleReady(map)) {
        this.waitForStyle(map);
        return;
      }
      this.add(map);
    } catch (error) {
      this.refused = true;
      this.fail('adding', error);
    }
  }

  private add(map: Map): void {
    map.addSource(this.id, this.desired as SourceSpecification);
    if (!map.getSource(this.id)) {
      this.refused = true;
      return;
    }
    logger.debug(`[MaplibreX] ${this.label} added to map "${this.mapId}"`);

    if (!this.wasAdded) {
      this.wasAdded = true;
      this.options.onFirstAdd?.();
    }
  }

  /** Take the source on the map from `previous` to the desired specification. */
  private change(map: Map, previous: SourceSpec): void {
    const source = map.getSource(this.id) as unknown as Record<string, unknown>;
    const updates = diffSource(previous, this.desired, this.options.inPlace);
    // A method missing from this MapLibre version means a replacement too.
    if (updates === null || updates.some(({ method }) => typeof source[method] !== 'function')) {
      this.replace(map);
      return;
    }
    for (const { method, args } of updates) {
      (source[method] as (...args: unknown[]) => unknown).apply(source, args(this.desired));
    }
  }

  /** Replace the source on the map with the desired one, keeping the layers that use it. */
  private replace(map: Map): void {
    const style = map.getStyle();
    const order = map.getLayersOrder();
    const current = style?.sources?.[this.id];
    const users = (style?.layers ?? []).filter((layer) => 'source' in layer && layer.source === this.id);
    let failure: unknown;

    whilePaused(map, () => {
      for (const layer of users) map.removeLayer(layer.id);
      map.removeSource(this.id);
      try {
        map.addSource(this.id, this.desired as SourceSpecification);
      } catch (error) {
        failure = error;
      }
      if (!map.getSource(this.id)) {
        this.refused = true;
        if (current) map.addSource(this.id, current);
      }
      for (const layer of users) map.addLayer(layer, nextLayerOnMap(map, order, layer.id));
    });

    if (failure !== undefined) throw failure;
    logger.debug(`[MaplibreX] ${this.label} replaced on map "${this.mapId}", with ${users.length} layer(s) using it`);
  }

  /** Continue from the owner this one took over from. */
  private takeOver(map: Map, inherited: Handover): void {
    this.wasAdded = inherited.added;
    try {
      if (!map.getSource(this.id) || isEqual(inherited.spec, this.desired)) return;
      this.change(map, inherited.spec);
    } catch (error) {
      this.fail('updating', error);
    }
  }

  /** Stop for good because another ManagedSource took the source over, and say what it takes over. */
  private release(): Handover {
    const handed: Handover = { map: this.map, spec: this.desired, added: this.wasAdded };
    this.released = true;
    this.wasAdded = false;
    this.removalPending = false;
    this.stopWatching();
    this.detachListeners();
    this.map?.off('remove', this.onMapRemoved);
    return handed;
  }

  /** If a removal waits for the source's layers, remove the source once none uses it. */
  private retryRemoval(): void {
    const map = this.map;
    if (!this.removalPending || !map) return;

    try {
      if (map.getSource(this.id)) {
        if (this.isUsed(map)) return;
        map.removeSource(this.id);
        if (map.getSource(this.id)) return;
      }
    } catch (error) {
      console.error(`[MaplibreX] Error removing ${this.label}:`, error);
    }
    this.finishRemoval();
  }

  /** The source is gone from the map: stop watching it and report it. */
  private finishRemoval(): void {
    this.removalPending = false;
    this.stopWatching();
    this.map?.off('remove', this.onMapRemoved);
    this.disown();
    logger.debug(`[MaplibreX] ${this.label} destroyed`);
    if (this.wasAdded) {
      this.wasAdded = false;
      this.options.onRemoved?.();
    }
  }

  private isUsed(map: Map): boolean {
    return map.getLayersOrder().some((layerId) => {
      const layer = map.getLayer(layerId) as { source?: unknown } | undefined;
      return layer?.source === this.id;
    });
  }

  private disown(): void {
    const sources = owners.get(this.mapId);
    if (sources?.get(this.id) !== this) return;
    sources.delete(this.id);
    if (sources.size === 0) owners.delete(this.mapId);
  }

  private attachListeners(map: Map): void {
    this.attachedListeners = Object.entries(this.options.listeners ?? {}).map(([type, listener]) => [
      type,
      (event: any) => {
        if (event?.sourceId === this.id) listener(event, map);
      }
    ]);
    for (const [type, listener] of this.attachedListeners) map.on(type as never, listener);
  }

  private detachListeners(): void {
    const map = this.map;
    if (map) {
      for (const [type, listener] of this.attachedListeners) map.off(type as never, listener);
    }
    this.attachedListeners = [];
  }

  private fail(action: string, error: unknown): void {
    console.error(`[MaplibreX] Error ${action} ${this.label}:`, error);
    this.options.onError?.(error);
  }
}

/**
 * The layer to put `layerId` back under: the first layer after it in the
 * layer order `order` that is on the map now. Layers put back in their old
 * order so end up exactly where they were.
 */
function nextLayerOnMap(map: Map, order: string[], layerId: string): string | undefined {
  for (const id of order.slice(order.indexOf(layerId) + 1)) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}
