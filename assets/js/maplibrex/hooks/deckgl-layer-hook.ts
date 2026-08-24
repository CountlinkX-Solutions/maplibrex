/**
 * LiveView hook for deck.gl layers
 * 
 * Manages the lifecycle of deck.gl layers inside LiveView,
 * keeping server and client updates in sync.
 * 
 * Uses lazy loading to only load deck.gl when needed, reducing initial bundle size.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';
import { DeckGLLayerManager } from '../utils/deckgl-manager';
import type { DeckGLLayerConfig } from '../types/deckgl';
import { loadDeckGL } from '../utils/deckgl-lazy-loader';

import { logger } from '../core/logger';

interface DeckGlLayerHookState {
  config: DeckGLLayerConfig;
  deckglManager: DeckGLLayerManager | null;
}

export const DeckGlLayerHook: LiveViewHook = {
  async mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config for DeckGL layer');
        return;
      }
      
      const config: DeckGLLayerConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId);
      
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for DeckGL layer`);
        return;
      }
      
      logger.debug(`[MaplibreX] Mounting DeckGL layer: ${config.id}`);
      
      // Lazy load deck.gl modules (only on first use)
      await loadDeckGL();
      
      // Initialize DeckGL manager
      const deckglManager = new DeckGLLayerManager(map, this);
      
      // Add layer
      deckglManager.addLayer(config);
      
      // Store state
      (this as any)._maplibrex_deckgl = {
        config,
        deckglManager
      };
      
      this.pushEvent('deckgl:layer_loaded', { layerId: config.id });
      
    } catch (error) {
      console.error('[MaplibreX] Error mounting DeckGL layer:', error);
      this.pushEvent('deckgl:error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  },
  
  updated(this: any) {
    const el = this.el as HTMLElement;
    const state: DeckGlLayerHookState | undefined = (this as any)._maplibrex_deckgl;
    
    if (!state) return;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      
      const newConfig: DeckGLLayerConfig = JSON.parse(configStr);
      
      logger.debug(`[MaplibreX] Updating DeckGL layer: ${newConfig.id}`);
      
      // Update layer
      state.deckglManager?.updateLayer(newConfig);
      state.config = newConfig;
      
    } catch (error) {
      console.error('[MaplibreX] Error updating DeckGL layer:', error);
      this.pushEvent('deckgl:error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  },
  
  destroyed(this: any) {
    const state: DeckGlLayerHookState | undefined = (this as any)._maplibrex_deckgl;
    if (!state) return;
    
    try {
      logger.debug(`[MaplibreX] Destroying DeckGL layer: ${state.config.id}`);
      
      state.deckglManager?.removeLayer(state.config.id);
      state.deckglManager?.destroy();
    } catch (error) {
      console.error('[MaplibreX] Error destroying DeckGL layer:', error);
    }
  }
};
