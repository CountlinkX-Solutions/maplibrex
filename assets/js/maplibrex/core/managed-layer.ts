/**
 * ManagedLayer - one style layer kept on a map for as long as its component lives
 *
 * A layer component describes the layer it wants (its desired state) and this
 * class keeps the map in line with it, whatever the map is doing:
 *
 * - it waits for the map to be registered (`MapManager.whenReady`, #17) and
 *   for its style to accept layers (`whenStyleReady`, #12);
 * - it waits for the layer's source and adds the layer once the source
 *   appears, in whatever order the two were mounted (#5);
 * - `update()` applies a new desired state in place where MapLibre can, and
 *   removes and re-adds the layer where it cannot (#3);
 * - it puts the layer back, as currently desired, after a style change drops
 *   it (#4);
 * - `destroy()` removes the layer, every listener and every pending wait.
 *
 * The waiting and the map listeners come from ManagedItem
 * (core/managed-item.ts), shared with ManagedSource. A layer tells
 * ManagedSource when it leaves the map, so a source removal waiting for it
 * goes ahead at once (#18), and does not warn about a missing source that a
 * source component is about to add.
 *
 * Style changes are detected through `styledata`, which every way of changing
 * the style fires (maplibre-gl 5.0.0 fires no `style.load` after a diff), and a
 * missing source through `sourcedata` as well. MapLibre fires `styledata` on
 * the frame after any style change, this layer's own `addLayer` included, and
 * `sourcedata` for every tile, so reconciling is idempotent and, in its common
 * case (the layer is on the map), costs one `getLayer` lookup.
 */

import type { AddLayerObject, FilterSpecification, Map } from 'maplibre-gl';
import type { LayoutPropertyName, PaintPropertyName } from '../types';

import { logger } from './logger';
import { ManagedItem, isEqual } from './managed-item';
import { ManagedSource } from './managed-source';
import { isStyleReady } from './style-ready';

export { isEqual };

/** A layer specification without its id: what `addLayer` takes, minus `id`. */
export interface LayerSpec {
  type: string;
  source?: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  [key: string]: unknown;
}

/** The layer a component wants on the map, and where in the layer order. */
export interface DesiredLayer {
  spec: LayerSpec;
  /** The layer to insert it under; on top when undefined. */
  beforeId?: string;
}

/** A layer-scoped map listener (`map.on(type, layerId, ...)`), also given the map. */
export type LayerListener = (event: any, map: Map) => void;

export interface ManagedLayerOptions {
  /** Names the layer in console messages, e.g. `circle layer "points"`. */
  label?: string;
  /** Called once, the first time the layer is actually on the map. */
  onFirstAdd?: () => void;
  /**
   * Layer-scoped listeners by event type. They are attached once, at the
   * first add, and kept across re-adds: MapLibre keeps a layer listener when
   * its layer is removed.
   */
  listeners?: Record<string, LayerListener>;
}

/** One change `update()` can make to a layer already on the map. */
export type LayerChange =
  | { kind: 'paint' | 'layout'; name: string; value: unknown }
  | { kind: 'filter'; value: unknown }
  | { kind: 'zoom'; minzoom?: number; maxzoom?: number }
  | { kind: 'move'; beforeId?: string };

/** The spec keys `diffLayer` can change in place; any other changed key means a re-add. */
const IN_PLACE_KEYS = new Set(['paint', 'layout', 'filter', 'minzoom', 'maxzoom']);

/**
 * The changes that take a layer on the map from `previous` to `next` in place,
 * or `null` when it has to be removed and added again: another type, source or
 * source layer (MapLibre cannot change those on a layer), a zoom bound that is
 * no longer set (`setLayerZoomRange` ignores null, so a bound cannot be
 * cleared), or any other changed spec key.
 *
 * A paint or layout property, or the filter, missing from `next` comes back
 * with an `undefined` value, which resets it to its default.
 */
export function diffLayer(previous: DesiredLayer, next: DesiredLayer): LayerChange[] | null {
  const from = previous.spec;
  const to = next.spec;

  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (!IN_PLACE_KEYS.has(key) && !isEqual(from[key], to[key])) return null;
  }
  if ((from.minzoom !== undefined && to.minzoom === undefined) || (from.maxzoom !== undefined && to.maxzoom === undefined)) {
    return null;
  }

  const changes: LayerChange[] = [];
  for (const kind of ['paint', 'layout'] as const) {
    const before = from[kind] ?? {};
    const after = to[kind] ?? {};
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!isEqual(before[name], after[name])) changes.push({ kind, name, value: after[name] });
    }
  }
  if (!isEqual(from.filter, to.filter)) {
    changes.push({ kind: 'filter', value: to.filter });
  }
  if (from.minzoom !== to.minzoom || from.maxzoom !== to.maxzoom) {
    changes.push({ kind: 'zoom', minzoom: to.minzoom, maxzoom: to.maxzoom });
  }
  if (previous.beforeId !== next.beforeId) {
    changes.push({ kind: 'move', beforeId: next.beforeId });
  }
  return changes;
}

export class ManagedLayer extends ManagedItem {
  private desired: DesiredLayer;
  private readonly label: string;
  /** `onFirstAdd` has run (and the layer listeners are attached). */
  private wasAdded = false;
  /**
   * MapLibre refused the last add (an invalid paint value, a source of the
   * wrong type, ...) and fired an error event saying why. Retrying on every
   * map event would only repeat that error, so the next attempt waits for a
   * new desired state.
   */
  private refused = false;
  /** Added on top because the `beforeId` layer was missing: moved under it once it appears. */
  private awaitingBeforeId = false;
  /** The missing source and `beforeId` already warned about, so each is reported once. */
  private warnedSource?: string;
  private warnedBeforeId?: string;
  /** The layer listeners as attached at the first add, kept for `destroy()` to detach. */
  private attachedListeners: [string, (event: any) => void][] = [];

  /**
   * Start keeping layer `id` on map `mapId`: it is added as soon as the map is
   * registered, its style accepts layers and its source (if `spec` names one)
   * is on the map.
   */
  constructor(
    mapId: string,
    id: string,
    desired: DesiredLayer,
    private readonly options: ManagedLayerOptions = {}
  ) {
    super(mapId, id, ['styledata', 'sourcedata']);
    this.desired = desired;
    this.label = options.label ?? `layer "${id}"`;
    this.start();
  }

  /** Whether the layer has been on the map at least once (`onFirstAdd` has run). */
  get added(): boolean {
    return this.wasAdded;
  }

  /**
   * Make `desired` the layer's desired state. If the layer is on the map it is
   * changed now, in place where MapLibre allows it; otherwise the next add
   * uses it.
   */
  update(desired: DesiredLayer): void {
    if (this.destroyed) return;
    const previous = this.desired;
    if (isEqual(previous, desired)) return;
    this.desired = desired;
    this.refused = false;

    const map = this.map;
    if (!map || !map.getLayer(this.id)) {
      this.reconcile();
      return;
    }

    try {
      const changes = diffLayer(previous, desired);
      if (changes === null) {
        map.removeLayer(this.id);
        this.reconcile();
        // Back on the map, or moved to another source: a removal waiting for the old one may go ahead.
        ManagedSource.layerRemoved(this.mapId);
      } else {
        this.apply(map, changes);
      }
    } catch (error) {
      console.error(`[MaplibreX] Error updating ${this.label}:`, error);
    }
  }

  /**
   * Stop keeping the layer: cancel every pending wait, detach every listener
   * and remove the layer if it is on the map. Idempotent.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopWatching();

    const map = this.map;
    if (!map) return;
    for (const [type, listener] of this.attachedListeners) {
      map.off(type as never, this.id, listener);
    }
    // A map removed by its own hook first has no style left to remove from.
    if (this.isRegistered(map) && map.getLayer(this.id)) {
      map.removeLayer(this.id);
      ManagedSource.layerRemoved(this.mapId);
    }
    logger.debug(`[MaplibreX] ${this.label} destroyed`);
  }

  /** Bring the map in line with the desired state: add the layer if it is missing and can be added. */
  protected reconcile(): void {
    const map = this.map;
    if (!map || this.destroyed) return;

    try {
      if (map.getLayer(this.id)) {
        this.moveUnderAwaitedLayer(map);
        return;
      }
      if (this.refused) return;
      if (!isStyleReady(map)) {
        this.waitForStyle(map);
        return;
      }
      const source = this.desired.spec.source;
      if (source !== undefined && !map.getSource(source)) {
        this.warnMissingSource(map, source);
        return;
      }
      this.add(map);
    } catch (error) {
      this.refused = true;
      console.error(`[MaplibreX] Error adding ${this.label}:`, error);
    }
  }

  private add(map: Map): void {
    map.addLayer({ id: this.id, ...this.desired.spec } as AddLayerObject, this.resolveBeforeId(map));
    if (!map.getLayer(this.id)) {
      this.refused = true;
      return;
    }
    logger.debug(`[MaplibreX] ${this.label} added to map "${this.mapId}"`);

    if (!this.wasAdded) {
      this.wasAdded = true;
      this.attachedListeners = Object.entries(this.options.listeners ?? {}).map(([type, listener]) => [
        type,
        (event: any) => listener(event, map)
      ]);
      for (const [type, listener] of this.attachedListeners) {
        map.on(type as never, this.id, listener);
      }
      this.options.onFirstAdd?.();
    }
  }

  private apply(map: Map, changes: LayerChange[]): void {
    for (const change of changes) {
      switch (change.kind) {
        case 'paint':
          map.setPaintProperty(this.id, change.name as PaintPropertyName, change.value as never);
          break;
        case 'layout':
          map.setLayoutProperty(this.id, change.name as LayoutPropertyName, change.value as never);
          break;
        case 'filter':
          map.setFilter(this.id, (change.value ?? null) as FilterSpecification | null);
          break;
        case 'zoom':
          // An undefined bound was undefined before too: `diffLayer` re-adds to clear one.
          map.setLayerZoomRange(this.id, change.minzoom as number, change.maxzoom as number);
          break;
        case 'move':
          map.moveLayer(this.id, this.resolveBeforeId(map));
          break;
      }
    }
  }

  /**
   * The `beforeId` to insert or move the layer with now. MapLibre refuses a
   * `beforeId` that is not on the map (and 6.5.0's `moveLayer` then drops the
   * layer out of the drawing order), so a missing one puts the layer on top,
   * with a warning, until that layer appears.
   */
  private resolveBeforeId(map: Map): string | undefined {
    const beforeId = this.desired.beforeId;
    this.awaitingBeforeId = false;
    if (beforeId === undefined || map.getLayer(beforeId)) return beforeId;

    this.awaitingBeforeId = true;
    if (this.warnedBeforeId !== beforeId) {
      this.warnedBeforeId = beforeId;
      console.warn(
        `[MaplibreX] Layer "${beforeId}" not found for the beforeId of ${this.label}. ` +
          `It is added on top and moves below "${beforeId}" once that layer is added.`
      );
    }
    return undefined;
  }

  private moveUnderAwaitedLayer(map: Map): void {
    const beforeId = this.desired.beforeId;
    if (!this.awaitingBeforeId || beforeId === undefined || !map.getLayer(beforeId)) return;
    this.awaitingBeforeId = false;
    map.moveLayer(this.id, beforeId);
  }

  /** One warning per missing source, unless a source component is about to add it. */
  private warnMissingSource(map: Map, source: string): void {
    if (this.warnedSource === source || ManagedSource.isManaged(map, this.mapId, source)) return;
    this.warnedSource = source;
    console.warn(
      `[MaplibreX] Source "${source}" not found for ${this.label}. Layer will be added when source is available.`
    );
  }
}
