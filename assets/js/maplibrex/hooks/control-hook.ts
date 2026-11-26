/**
 * ControlHook - Hook for generic custom control component
 * 
 * Manages custom HTML controls that can be positioned on the map.
 * Implements MapLibre's IControl interface to integrate with the map's control system.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, ControlConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ControlHookState {
  config: ControlConfig;
  map: maplibregl.Map;
  control: CustomControl;
}

/**
 * Custom control implementation that wraps LiveView content
 */
class CustomControl implements maplibregl.IControl {
  private container: HTMLElement | null = null;
  private contentElement: HTMLElement;
  private className: string;

  constructor(contentElement: HTMLElement, className: string = '') {
    this.contentElement = contentElement;
    this.className = className;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    
    // Add custom class if provided
    if (this.className) {
      this.container.className += ` ${this.className}`;
    }

    // Move the content element into the control container
    this.container.appendChild(this.contentElement);
    
    // Make content visible (it starts with display: none)
    this.contentElement.style.display = '';

    return this.container;
  }

  onRemove(): void {
    // The content goes with the container: this runs from `destroyed()`,
    // once LiveView has removed the wrapper the content came from.
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  getDefaultPosition(): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
    return 'top-right';
  }

  /** Shows `contentElement` in the control, in place of the current content. */
  attach(contentElement: HTMLElement): void {
    this.contentElement = contentElement;
    this.container?.replaceChildren(contentElement);
  }
}

export const ControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on control element');
        return;
      }

      const config: ControlConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for control "${config.id}"`);
        return;
      }

      // Find the content element (child div with id="${id}-content")
      const contentElement = el.querySelector(`#${config.id}-content`) as HTMLElement;
      if (!contentElement) {
        console.error(`[MaplibreX] Content element not found for control "${config.id}"`);
        return;
      }

      // Create and add control to map
      const control = new CustomControl(contentElement, config.className || '');
      const position = (config.position || 'top-right') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      
      map.addControl(control, position);

      // Save state
      (this as any)._maplibrex_control = {
        config,
        map,
        control
      };

      logger.debug(`[MaplibreX] Control "${config.id}" added at ${position}`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting control:', error);
    }
  },

  updated(this: any) {
    const state: ControlHookState | undefined = (this as any)._maplibrex_control;
    if (!state) return;

    // LiveView's patch finds the content by id anywhere in the view, even
    // inside the map's `phx-update="ignore"` element, and renders it back
    // into this hidden wrapper. Move it back into the control.
    const rendered = (this.el as HTMLElement).querySelector<HTMLElement>(`#${state.config.id}-content`);
    if (rendered) {
      state.control.attach(rendered);
    }
    logger.debug(`[MaplibreX] Control "${state.config.id}" updated`);
  },

  destroyed(this: any) {
    const state: ControlHookState | undefined = (this as any)._maplibrex_control;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Control "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying control:', error);
    }
  }
};
