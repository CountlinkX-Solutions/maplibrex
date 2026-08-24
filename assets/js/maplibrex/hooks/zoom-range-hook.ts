/**
 * ZoomRangeHook - Hook for zoom-based visibility control
 * 
 * Shows or hides content based on the current map zoom level.
 * Listens to map zoom events and toggles CSS display property.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, ZoomRangeConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ZoomRangeHookState {
  config: ZoomRangeConfig;
  map: maplibregl.Map;
  contentElement: HTMLElement;
  zoomHandler: () => void;
}

/**
 * Helper to check if zoom level is within the configured range
 */
function isZoomInRange(zoom: number, min?: number | null, max?: number | null): boolean {
  const minOk = min === undefined || min === null || zoom >= min;
  const maxOk = max === undefined || max === null || zoom <= max;
  return minOk && maxOk;
}

export const ZoomRangeHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on zoom range element');
        return;
      }

      const config: ZoomRangeConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for zoom range "${config.id}"`);
        return;
      }

      // Find the content element
      const contentElement = el.querySelector(`#${config.id}-content`) as HTMLElement;
      if (!contentElement) {
        console.error(`[MaplibreX] Content element not found for zoom range "${config.id}"`);
        return;
      }

      // Function to check if current zoom is in range and update visibility
      const updateVisibility = () => {
        const currentZoom = map.getZoom();
        const isVisible = isZoomInRange(currentZoom, config.min, config.max);
        
        contentElement.style.display = isVisible ? '' : 'none';
      };

      // Create zoom handler
      const zoomHandler = () => {
        updateVisibility();
      };

      // Add zoom event listener
      map.on('zoom', zoomHandler);

      // Set initial visibility
      updateVisibility();

      // Save state
      (this as any)._maplibrex_zoom_range = {
        config,
        map,
        contentElement,
        zoomHandler
      };

      logger.debug(`[MaplibreX] ZoomRange "${config.id}" initialized (min: ${config.min ?? 'none'}, max: ${config.max ?? 'none'})`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting zoom range:', error);
    }
  },

  updated(this: any) {
    const state: ZoomRangeHookState | undefined = (this as any)._maplibrex_zoom_range;
    if (!state) return;

    try {
      // Re-parse config in case min/max changed
      const configStr = (this.el as HTMLElement).dataset.config;
      if (!configStr) return;

      const newConfig: ZoomRangeConfig = JSON.parse(configStr);
      
      // Update config
      state.config = newConfig;

      // Re-check visibility with new config
      const currentZoom = state.map.getZoom();
      const isVisible = isZoomInRange(currentZoom, newConfig.min, newConfig.max);
      state.contentElement.style.display = isVisible ? '' : 'none';

      logger.debug(`[MaplibreX] ZoomRange "${newConfig.id}" updated (min: ${newConfig.min ?? 'none'}, max: ${newConfig.max ?? 'none'})`);

    } catch (error) {
      console.error('[MaplibreX] Error updating zoom range:', error);
    }
  },

  destroyed(this: any) {
    const state: ZoomRangeHookState | undefined = (this as any)._maplibrex_zoom_range;
    if (!state) return;

    try {
      // Remove zoom event listener
      state.map.off('zoom', state.zoomHandler);
      logger.debug(`[MaplibreX] ZoomRange "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying zoom range:', error);
    }
  }
};
