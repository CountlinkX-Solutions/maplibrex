/**
 * MapManager - Singleton registry of live map instances
 * 
 * Inspired by svelte-maplibre's Context API, this manager keeps
 * a registry of every map instance active in the application, so that
 * multiple components (markers, popups, layers) can safely reach the
 * same map.
 */

import type { Map } from 'maplibre-gl';
import type { MapRegistry } from '../types';

import { logger, setDebug as setGlobalDebug } from './logger';

/** Called with the map once it is registered; see `MapManager.whenReady`. */
export type MapReadyCallback = (map: Map) => void;

/** A pending `whenReady` request; an object so the same callback can wait twice. */
interface MapWaiter {
  callback: MapReadyCallback;
}

class MapManagerClass {
  private maps: MapRegistry = {};
  /** Pending `whenReady` requests per map id, in the order they were made. */
  private waiters = new globalThis.Map<string, Set<MapWaiter>>();

  /**
   * Register a new map instance, then call every `whenReady` waiter for its id
   */
  register(mapId: string, map: Map): void {
    if (this.maps[mapId]) {
      this.log('warn', `Map with id "${mapId}" already exists. Overwriting...`);
    }

    this.maps[mapId] = map;
    this.log('info', `Map "${mapId}" registered`, { map });

    const waiters = this.waiters.get(mapId);
    if (!waiters) return;
    this.waiters.delete(mapId);
    // Iterated live: a waiter cancelled by an earlier one is skipped.
    for (const waiter of waiters) {
      waiters.delete(waiter);
      this.callReady(mapId, waiter.callback, map);
    }
  }

  /**
   * Call `callback` with the map registered under `mapId`: right away
   * (synchronously) if it is registered, otherwise once it is.
   *
   * A pending waiter stays pending until a map with that id is registered or
   * the returned function cancels it; registering, unregistering or replacing
   * other maps never calls it, and it is called at most once. `clear()`
   * discards pending waiters without calling them. A callback that throws is
   * logged and does not stop the others.
   *
   * @returns a function that cancels the waiter; a no-op once it has run
   */
  whenReady(mapId: string, callback: MapReadyCallback): () => void {
    const map = this.maps[mapId];
    if (map) {
      this.callReady(mapId, callback, map);
      return () => {};
    }

    const waiter: MapWaiter = { callback };
    let waiters = this.waiters.get(mapId);
    if (!waiters) {
      waiters = new Set();
      this.waiters.set(mapId, waiters);
    }
    waiters.add(waiter);
    this.log('info', `Waiting for map "${mapId}" to be registered`);

    const pending = waiters;
    return () => {
      pending.delete(waiter);
      if (pending.size === 0 && this.waiters.get(mapId) === pending) {
        this.waiters.delete(mapId);
      }
    };
  }

  private callReady(mapId: string, callback: MapReadyCallback, map: Map): void {
    try {
      callback(map);
    } catch (error) {
      this.log('error', `Error in a whenReady callback for map "${mapId}"`, error);
    }
  }

  /**
   * Look up a map instance by id
   */
  get(mapId: string): Map | undefined {
    const map = this.maps[mapId];
    
    if (!map) {
      this.log('warn', `Map with id "${mapId}" not found`);
    }
    
    return map;
  }

  /**
   * Look up a map instance, raising if it does not exist
   */
  getOrThrow(mapId: string): Map {
    const map = this.get(mapId);
    
    if (!map) {
      throw new Error(`Map with id "${mapId}" not found. Make sure the map is mounted before accessing it.`);
    }
    
    return map;
  }

  /**
   * Whether a map with the given id is registered
   */
  has(mapId: string): boolean {
    return mapId in this.maps;
  }

  /**
   * Remove a map from the registry
   */
  unregister(mapId: string): boolean {
    if (!this.maps[mapId]) {
      this.log('warn', `Attempted to unregister non-existent map "${mapId}"`);
      return false;
    }
    
    delete this.maps[mapId];
    this.log('info', `Map "${mapId}" unregistered`);
    return true;
  }

  /**
   * Every registered map
   */
  getAll(): MapRegistry {
    return { ...this.maps };
  }

  /**
   * The ids of every registered map
   */
  getAllIds(): string[] {
    return Object.keys(this.maps);
  }

  /**
   * How many maps are registered
   */
  count(): number {
    return Object.keys(this.maps).length;
  }

  /**
   * Remove every map and discard every pending `whenReady` waiter without
   * calling it. Useful in tests
   */
  clear(): void {
    this.waiters.clear();

    const ids = this.getAllIds();
    ids.forEach(id => {
      try {
        const map = this.maps[id];
        if (map && typeof map.remove === 'function') {
          map.remove();
        }
      } catch (error) {
        this.log('error', `Error removing map "${id}"`, error);
      }
    });
    
    this.maps = {};
    this.log('info', 'All maps cleared');
  }

  /**
   * Enable or disable debug mode
   */
  setDebug(enabled: boolean): void {
    setGlobalDebug(enabled);
  }

  /**
   * Internal logger
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = '[MaplibreX MapManager]';
    
    switch (level) {
      case 'info':
        logger.debug(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}

/**
 * Singleton instance
 */
export const MapManager = new MapManagerClass();

/**
 * Safely look up a map
 * Handy inside components
 */
export function useMap(mapId: string): Map | undefined {
  return MapManager.get(mapId);
}

/**
 * Look up a map or raise
 * Use when the map is required
 */
export function requireMap(mapId: string): Map {
  return MapManager.getOrThrow(mapId);
}
