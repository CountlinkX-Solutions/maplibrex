/**
 * ControlButtonHook - Hook for button control component
 * 
 * Manages button controls with icons, tooltips, and active state.
 * Implements MapLibre's IControl interface to integrate with the map's control system.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, ControlButtonConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ControlButtonHookState {
  config: ControlButtonConfig;
  map: maplibregl.Map;
  control: ButtonControl;
  buttonElement: HTMLButtonElement;
}

/**
 * Button control implementation that wraps a button element
 */
class ButtonControl implements maplibregl.IControl {
  private container: HTMLElement | null = null;
  private buttonElement: HTMLButtonElement;

  constructor(buttonElement: HTMLButtonElement) {
    this.buttonElement = buttonElement;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // Move the button element into the control container
    this.container.appendChild(this.buttonElement);
    
    // Make button visible (it starts with parent display: none)
    this.buttonElement.style.display = '';

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  getDefaultPosition(): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
    return 'top-right';
  }

  /**
   * Update button active state
   */
  setActive(active: boolean): void {
    if (active) {
      this.buttonElement.classList.add('maplibregl-ctrl-active');
    } else {
      this.buttonElement.classList.remove('maplibregl-ctrl-active');
    }
  }
}

export const ControlButtonHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on control button element');
        return;
      }

      const config: ControlButtonConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for control button "${config.id}"`);
        return;
      }

      // Find the button element
      const buttonElement = el.querySelector(`#${config.id}-button`) as HTMLButtonElement;
      if (!buttonElement) {
        console.error(`[MaplibreX] Button element not found for control button "${config.id}"`);
        return;
      }

      // Create and add control to map
      const control = new ButtonControl(buttonElement);
      const position = (config.position || 'top-right') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      
      map.addControl(control, position);

      // Set initial active state
      if (config.active) {
        control.setActive(true);
      }

      // Save state
      (this as any)._maplibrex_control_button = {
        config,
        map,
        control,
        buttonElement
      };

      logger.debug(`[MaplibreX] ControlButton "${config.id}" added at ${position}`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting control button:', error);
    }
  },

  updated(this: any) {
    const state: ControlButtonHookState | undefined = (this as any)._maplibrex_control_button;
    if (!state) return;

    try {
      // Re-parse config in case active state or tooltip changed
      const configStr = (this.el as HTMLElement).dataset.config;
      if (!configStr) return;

      const newConfig: ControlButtonConfig = JSON.parse(configStr);
      
      // Update active state if changed
      if (newConfig.active !== state.config.active) {
        state.control.setActive(newConfig.active || false);
      }

      // Update tooltip if changed
      if (newConfig.tooltip !== state.config.tooltip) {
        state.buttonElement.title = newConfig.tooltip || '';
        state.buttonElement.setAttribute('aria-label', newConfig.tooltip || '');
      }

      // Update config
      state.config = newConfig;

      logger.debug(`[MaplibreX] ControlButton "${newConfig.id}" updated`);

    } catch (error) {
      console.error('[MaplibreX] Error updating control button:', error);
    }
  },

  destroyed(this: any) {
    const state: ControlButtonHookState | undefined = (this as any)._maplibrex_control_button;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] ControlButton "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying control button:', error);
    }
  }
};
