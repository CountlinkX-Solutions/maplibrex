/**
 * FullscreenControlHook - Hook for the FullscreenControl component
 * 
 * Manages MapLibre's native fullscreen control.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, FullscreenControlConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface FullscreenControlHookState {
  config: FullscreenControlConfig;
  map: maplibregl.Map;
  control: maplibregl.FullscreenControl;
}

export const FullscreenControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on fullscreen control element');
        return;
      }

      const config: FullscreenControlConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for fullscreen control "${config.id}"`);
        return;
      }

      // Get container element if specified
      let containerElement: HTMLElement | undefined = undefined;
      if (config.containerSelector) {
        const containerEl = document.getElementById(config.containerSelector);
        if (containerEl) {
          containerElement = containerEl;
        } else {
          console.warn(`[MaplibreX] Container "${config.containerSelector}" not found, using map container`);
        }
      }

      // Create fullscreen control with options
      const controlOptions: maplibregl.FullscreenControlOptions = containerElement ? { container: containerElement } : {};
      const control = new maplibregl.FullscreenControl(controlOptions);

      // Add control to map at specified position
      const position = (config.position || 'top-right') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      map.addControl(control, position);

      // FullscreenControl is itself an Evented and fires these on the control,
      // never on the map — listening on the map silently received nothing.
      control.on('fullscreenstart', () => {
        this.pushEvent('fullscreen:entered', {
          controlId: config.id,
          mapId: config.mapId
        });
      });

      control.on('fullscreenend', () => {
        this.pushEvent('fullscreen:exited', {
          controlId: config.id,
          mapId: config.mapId
        });
      });

      // Save state
      (this as any)._maplibrex_fullscreen_control = {
        config,
        map,
        control
      };

      logger.debug(`[MaplibreX] Fullscreen Control "${config.id}" added at ${position}`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting fullscreen control:', error);
    }
  },

  destroyed(this: any) {
    const state: FullscreenControlHookState | undefined = (this as any)._maplibrex_fullscreen_control;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Fullscreen Control "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying fullscreen control:', error);
    }
  }
};
