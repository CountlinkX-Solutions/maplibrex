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

class MapManagerClass {
  private maps: MapRegistry = {};

  /**
   * Register a new map instance
   */
  register(mapId: string, map: Map): void {
    if (this.maps[mapId]) {
      this.log('warn', `Map with id "${mapId}" already exists. Overwriting...`);
    }
    
    this.maps[mapId] = map;
    this.log('info', `Map "${mapId}" registered`, { map });
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
   * Remove every map. Useful in tests
   */
  clear(): void {
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
