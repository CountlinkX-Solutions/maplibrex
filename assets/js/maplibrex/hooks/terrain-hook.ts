/**
 * TerrainHook - Hook for the Terrain component
 *
 * Turns on MapLibre's 3D terrain, from a raster-dem source, and keeps it on
 * for as long as the component lives. The terrain is kept by a
 * `ManagedTerrain` (core/managed-terrain.ts), the same machinery as the layer
 * and source components: it is enabled once the map is registered, its style
 * accepts it and the DEM source is there, in any template order; it follows
 * `updated()`; it comes back after a style change; and `destroyed()` turns it
 * off if it is still this component's terrain.
 *
 * Events pushed to the server
 * (through `push`, core/push.ts: only those the component's `events` list
 * names, when it has one):
 * - `terrain:enabled`, with `source_id` and `exaggeration`, once, the first
 *   time the terrain is on (not again when a style change or an update sets it
 *   again);
 * - `terrain:disabled`, from `destroyed()`, when it turned the terrain off;
 * - `terrain:error`, with `error`, when MapLibre throws while the terrain is
 *   set. A source that is not there yet is not an error: the terrain waits for
 *   it.
 */

import type { HookContext, LiveViewHook } from '../types';
import { type DesiredTerrain, ManagedTerrain } from '../core/managed-terrain';
import { push } from '../core/push';

/** The `data-config` of the terrain component. */
interface TerrainConfig {
  mapId: string;
  sourceId: string;
  exaggeration: number;
}

interface TerrainHookContext extends HookContext {
  _maplibrex_terrain?: ManagedTerrain;
}

function readConfig(el: HTMLElement): TerrainConfig | undefined {
  const config = el.dataset.config;
  return config ? JSON.parse(config) : undefined;
}

function desiredTerrain(config: TerrainConfig): DesiredTerrain {
  return { source: config.sourceId, exaggeration: config.exaggeration };
}

export const TerrainHook: LiveViewHook = {
  mounted(this: TerrainHookContext) {
    try {
      const config = readConfig(this.el);
      if (!config) {
        console.error('[MaplibreX] No config found on terrain element');
        return;
      }

      this._maplibrex_terrain = new ManagedTerrain(config.mapId, desiredTerrain(config), {
        onFirstEnable: (terrain) =>
          push(this, 'terrain:enabled', { source_id: terrain.source, exaggeration: terrain.exaggeration }),
        onError: (error) =>
          push(this, 'terrain:error', { error: error instanceof Error ? error.message : 'Unknown error' })
      });
    } catch (error) {
      console.error('[MaplibreX] Error mounting terrain:', error);
    }
  },

  updated(this: TerrainHookContext) {
    const terrain = this._maplibrex_terrain;
    if (!terrain) return;

    try {
      const config = readConfig(this.el);
      if (config) terrain.update(desiredTerrain(config));
    } catch (error) {
      console.error('[MaplibreX] Error updating terrain:', error);
    }
  },

  destroyed(this: TerrainHookContext) {
    const terrain = this._maplibrex_terrain;
    if (!terrain) return;
    this._maplibrex_terrain = undefined;

    try {
      if (terrain.destroy()) push(this, 'terrain:disabled', {});
    } catch (error) {
      console.warn('[MaplibreX] Could not disable terrain:', error);
    }
  }
};
