/**
 * MapManager - Singleton para gestionar instancias de mapas
 * 
 * Inspirado en el Context API de svelte-maplibre, este manager mantiene
 * un registro de todas las instancias de mapas activas en la aplicación.
 * Permite que múltiples componentes (markers, popups, layers) accedan al
 * mismo mapa de forma segura.
 */

import type { Map } from 'maplibre-gl';
import type { MapRegistry } from '../types';

class MapManagerClass {
  private maps: MapRegistry = {};
  private debug: boolean = false;

  /**
   * Registra una nueva instancia de mapa
   */
  register(mapId: string, map: Map): void {
    if (this.maps[mapId]) {
      this.log('warn', `Map with id "${mapId}" already exists. Overwriting...`);
    }
    
    this.maps[mapId] = map;
    this.log('info', `Map "${mapId}" registered`, { map });
  }

  /**
   * Obtiene una instancia de mapa por ID
   */
  get(mapId: string): Map | undefined {
    const map = this.maps[mapId];
    
    if (!map) {
      this.log('warn', `Map with id "${mapId}" not found`);
    }
    
    return map;
  }

  /**
   * Obtiene una instancia de mapa o lanza error si no existe
   */
  getOrThrow(mapId: string): Map {
    const map = this.get(mapId);
    
    if (!map) {
      throw new Error(`Map with id "${mapId}" not found. Make sure the map is mounted before accessing it.`);
    }
    
    return map;
  }

  /**
   * Verifica si existe un mapa con el ID dado
   */
  has(mapId: string): boolean {
    return mapId in this.maps;
  }

  /**
   * Elimina un mapa del registro
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
   * Obtiene todos los mapas registrados
   */
  getAll(): MapRegistry {
    return { ...this.maps };
  }

  /**
   * Obtiene los IDs de todos los mapas registrados
   */
  getAllIds(): string[] {
    return Object.keys(this.maps);
  }

  /**
   * Cuenta cuántos mapas están registrados
   */
  count(): number {
    return Object.keys(this.maps).length;
  }

  /**
   * Limpia todos los mapas (útil para testing)
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
   * Habilita/deshabilita modo debug
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Logger interno
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.debug && level === 'info') return;
    
    const prefix = '[MaplibreX MapManager]';
    
    switch (level) {
      case 'info':
        console.log(prefix, message, data || '');
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
 * Helper para obtener un mapa de forma segura
 * Útil para uso en componentes
 */
export function useMap(mapId: string): Map | undefined {
  return MapManager.get(mapId);
}

/**
 * Helper para obtener un mapa o lanzar error
 * Útil cuando el mapa es requerido
 */
export function requireMap(mapId: string): Map {
  return MapManager.getOrThrow(mapId);
}
