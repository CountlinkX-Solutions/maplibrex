/**
 * createSourceHook - the LiveView hook shared by the source components
 *
 * The vector tile, raster tile, raster DEM, image and video source components
 * render the same kind of `data-config`: the source id, the map id and the
 * source's own fields. This hook turns it into a source specification and
 * hands it to a `ManagedSource` (core/managed-source.ts), which keeps the
 * source on the map: it is added once the map and its style are ready,
 * follows `updated()` (in place where MapLibre allows it, otherwise by
 * replacing the source under its layers), comes back after a style change,
 * and is removed by `destroyed()`, or once the last layer using it is gone. A
 * source with its id that was already on the map is taken over and left
 * there (#46).
 *
 * Each component's hook only declares what is its own: the source type, the
 * config keys that go into the specification, the changes MapLibre applies in
 * place, and whether it reports the source's map events.
 *
 * Events pushed to the server, all with `source_id`:
 * - `source:added`, once, the first time the source is on the map (not again
 *   when a style change or an update puts it back);
 * - `source:removed`, once the source is really gone after `destroyed()`, if
 *   `source:added` was pushed: right away, or, while layers still use the
 *   source, when the last of them leaves the map;
 * - `source:data` and `source:error`, for the source's map events, from the
 *   sources that report them;
 * - `source:error`, when MapLibre throws while adding or replacing the source.
 */

import type { HookContext, LiveViewHook } from '../types';
import { type InPlaceUpdates, ManagedSource, type SourceListener, type SourceSpec } from '../core/managed-source';
import { logger } from '../core/logger';

/** The `data-config` of a source component; keys whose assign is nil are left out. */
export interface SourceConfig {
  id: string;
  mapId: string;
  [key: string]: unknown;
}

export interface SourceHookDefinition {
  /** The MapLibre source type. */
  type: string;
  /** Names the source in console messages, e.g. "vector tile source". */
  name: string;
  /** The config keys copied, when set, into the source specification. */
  keys: string[];
  /** The changes MapLibre applies in place; any other change replaces the source. */
  inPlace?: InPlaceUpdates;
  /** Whether it pushes `source:data` and `source:error` for the source's map events. */
  reportsEvents?: boolean;
}

/** New tile URLs or a new TileJSON URL, which tiled sources take in place. */
export const TILE_UPDATES: InPlaceUpdates = {
  url: { method: 'setUrl', args: (spec) => [spec.url] },
  tiles: { method: 'setTiles', args: (spec) => [spec.tiles] }
};

interface SourceHookContext extends HookContext {
  _maplibrex_source?: ManagedSource;
}

/**
 * Push `event` from `hook`. `source:removed` can come after `destroyed()`,
 * when the last layer using the source goes: LiveView (1.2) still sends a
 * destroyed hook's push while its view is connected, and rejects it once the
 * view is gone, when there is nobody left to tell, so the rejection is
 * dropped instead of surfacing as an unhandled one.
 */
function push(hook: HookContext, event: string, payload: Record<string, unknown>): void {
  try {
    const result: unknown = hook.pushEvent(event, payload);
    if (result instanceof Promise) result.catch(() => {});
  } catch (error) {
    logger.debug(`[MaplibreX] Could not push ${event}:`, error);
  }
}

export function createSourceHook(definition: SourceHookDefinition): LiveViewHook {
  function sourceSpec(config: SourceConfig): SourceSpec {
    const spec: SourceSpec = { type: definition.type };
    for (const key of definition.keys) {
      if (config[key] != null) spec[key] = config[key];
    }
    return spec;
  }

  function readConfig(el: HTMLElement): SourceConfig | undefined {
    const config = el.dataset.config;
    return config ? JSON.parse(config) : undefined;
  }

  function eventListeners(hook: HookContext, id: string): Record<string, SourceListener> | undefined {
    if (!definition.reportsEvents) return undefined;

    const data: SourceListener = (e) =>
      push(hook, 'source:data', {
        source_id: id,
        data_type: e.dataType,
        source_data_type: e.sourceDataType,
        tile: e.tile ? { coord: e.tile.tileID.canonical, isSourceLoaded: e.isSourceLoaded } : undefined
      });

    return {
      sourcedata: data,
      sourcedataloading: data,
      error: (e) =>
        push(hook, 'source:error', {
          source_id: id,
          error: e.error ? e.error.message : 'Unknown error',
          tile: e.tile
        })
    };
  }

  return {
    mounted(this: SourceHookContext) {
      try {
        const config = readConfig(this.el);
        if (!config) {
          console.error(`[MaplibreX] No config found on ${definition.name} element`);
          return;
        }

        const id = config.id;
        this._maplibrex_source = new ManagedSource(config.mapId, id, sourceSpec(config), {
          label: `${definition.name} "${id}"`,
          inPlace: definition.inPlace,
          listeners: eventListeners(this, id),
          onFirstAdd: () => push(this, 'source:added', { source_id: id }),
          onRemoved: () => push(this, 'source:removed', { source_id: id }),
          onError: (error) =>
            push(this, 'source:error', {
              source_id: id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
        });
      } catch (error) {
        console.error(`[MaplibreX] Error mounting ${definition.name}:`, error);
      }
    },

    updated(this: SourceHookContext) {
      const source = this._maplibrex_source;
      if (!source) return;

      try {
        const config = readConfig(this.el);
        if (config) source.update(sourceSpec(config));
      } catch (error) {
        console.error(`[MaplibreX] Error updating ${definition.name}:`, error);
      }
    },

    destroyed(this: SourceHookContext) {
      const source = this._maplibrex_source;
      if (!source) return;
      this._maplibrex_source = undefined;

      try {
        source.destroy();
      } catch (error) {
        console.error(`[MaplibreX] Error destroying ${definition.name}:`, error);
      }
    }
  };
}
