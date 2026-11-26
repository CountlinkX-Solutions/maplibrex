/**
 * ManagedTerrain - the 3D terrain a terrain component keeps on a map for as
 * long as it lives
 *
 * The terrain counterpart of ManagedLayer (core/managed-layer.ts), on the same
 * ManagedItem base (core/managed-item.ts). The component describes the
 * terrain it wants (a raster-dem source and an exaggeration) and this class
 * keeps the map in line with it:
 *
 * - it waits for the map to be registered (`MapManager.whenReady`, #17) and
 *   for its style to accept changes (`whenStyleReady`, #12);
 * - it waits for the DEM source and enables the terrain once the source is on
 *   the map, in whatever order the two were mounted and however late the
 *   source comes (#5), with one console warning per missing source (none for
 *   a source a source component is about to add);
 * - `update()` applies a new source or exaggeration whenever it comes; while a
 *   new source is not there yet, the terrain set before stays;
 * - it turns the terrain back on, as currently desired, after a style change
 *   turns it off (#4). MapLibre turns terrain off on every style change: a
 *   full rebuild loads the new style's terrain (usually none), and a diffing
 *   `setStyle` while terrain is on fails and falls back to a full rebuild;
 * - `destroy()` turns the terrain off if it is still the one this class set,
 *   and drops every listener and pending wait.
 *
 * Style changes are detected through `styledata` and the arrival of the DEM
 * source through that source's `sourcedata`. Both fire often, so reconciling
 * is idempotent and, in its common case (the terrain is on), costs one
 * `getTerrain()` call.
 */

import type { Map } from 'maplibre-gl';

import { logger } from './logger';
import { ManagedItem, isEqual } from './managed-item';
import { ManagedSource } from './managed-source';
import { isStyleReady } from './style-ready';

/** The terrain a component wants on the map. */
export interface DesiredTerrain {
  /** The id of the raster-dem source to take elevations from. */
  source: string;
  exaggeration: number;
}

export interface ManagedTerrainOptions {
  /** Called once, the first time the terrain is actually on, with the terrain set. */
  onFirstEnable?: (terrain: DesiredTerrain) => void;
  /** Called when MapLibre throws while the terrain is set. */
  onError?: (error: unknown) => void;
}

export class ManagedTerrain extends ManagedItem {
  private desired: DesiredTerrain;
  /** `onFirstEnable` has run. */
  private wasEnabled = false;
  /** The terrain this class last set, which `destroy()` turns off if it is still on. */
  private applied?: DesiredTerrain;
  /**
   * MapLibre threw on the last attempt, or did not set the terrain. Retrying
   * on every map event would only repeat that, so the next attempt waits for
   * a new desired state.
   */
  private refused = false;
  /** The missing source already warned about, so each is reported once. */
  private warnedSource?: string;

  /**
   * Start keeping `desired` as the terrain of map `mapId`: it is set as soon
   * as the map is registered, its style accepts it and the source is there.
   */
  constructor(
    mapId: string,
    desired: DesiredTerrain,
    private readonly options: ManagedTerrainOptions = {}
  ) {
    super(mapId, 'terrain', ['styledata', 'sourcedata']);
    this.desired = desired;
    this.start();
  }

  /** Whether the terrain has been on at least once (`onFirstEnable` has run). */
  get enabled(): boolean {
    return this.wasEnabled;
  }

  /** Make `desired` the terrain wanted; it is set now if the map, its style and the source allow it. */
  update(desired: DesiredTerrain): void {
    if (this.destroyed || isEqual(this.desired, desired)) return;
    this.desired = desired;
    this.refused = false;
    this.reconcile();
  }

  /**
   * Stop keeping the terrain: cancel every pending wait, detach every
   * listener and turn the terrain off if it is still the one this class set.
   * Idempotent.
   *
   * @returns whether it turned the terrain off
   */
  destroy(): boolean {
    if (this.destroyed) return false;
    this.destroyed = true;
    this.stopWatching();

    const map = this.map;
    // A map removed by its own hook first has no style left to change.
    if (!map || !this.isRegistered(map) || !this.applied || !isOn(map, this.applied)) return false;
    map.setTerrain(null);
    logger.debug(`[MaplibreX] Terrain on map "${this.mapId}" disabled`);
    return true;
  }

  /** Only the `sourcedata` of the DEM source can let the terrain be set. */
  protected reactsTo(type: string, event: unknown): boolean {
    return type !== 'sourcedata' || (event as { sourceId?: unknown } | undefined)?.sourceId === this.desired.source;
  }

  /** Bring the map in line with the desired terrain: set it if it is not on and can be set. */
  protected reconcile(): void {
    const map = this.map;
    if (!map || this.destroyed) return;

    try {
      if (isOn(map, this.desired) || this.refused) return;
      if (!isStyleReady(map)) {
        this.waitForStyle(map);
        return;
      }
      if (!map.getSource(this.desired.source)) {
        this.warnMissingSource(map, this.desired.source);
        return;
      }
      this.enable(map);
    } catch (error) {
      this.refused = true;
      console.error(`[MaplibreX] Error enabling terrain on map "${this.mapId}":`, error);
      this.options.onError?.(error);
    }
  }

  private enable(map: Map): void {
    const terrain = { ...this.desired };
    map.setTerrain({ source: terrain.source, exaggeration: terrain.exaggeration });
    if (!isOn(map, terrain)) {
      this.refused = true;
      return;
    }
    this.applied = terrain;
    logger.debug(`[MaplibreX] Terrain enabled with source "${terrain.source}" and exaggeration ${terrain.exaggeration}`);

    if (!this.wasEnabled) {
      this.wasEnabled = true;
      this.options.onFirstEnable?.(terrain);
    }
  }

  /** One warning per missing source, unless a source component is about to add it. */
  private warnMissingSource(map: Map, source: string): void {
    if (this.warnedSource === source || ManagedSource.isManaged(map, this.mapId, source)) return;
    this.warnedSource = source;
    console.warn(
      `[MaplibreX] Source "${source}" not found for terrain on map "${this.mapId}". ` +
        'Terrain will be enabled when the source is available.'
    );
  }
}

/** Whether `terrain` is the map's terrain now. A terrain without an exaggeration has MapLibre's default, 1. */
function isOn(map: Map, terrain: DesiredTerrain): boolean {
  const current = map.getTerrain();
  return current?.source === terrain.source && (current.exaggeration ?? 1) === terrain.exaggeration;
}
