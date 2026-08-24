/**
 * ControlGroupHook - Hook for control group component
 * 
 * Manages grouped controls with vertical or horizontal layout.
 * Implements MapLibre's IControl interface to integrate with the map's control system.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, ControlGroupConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface ControlGroupHookState {
  config: ControlGroupConfig;
  map: maplibregl.Map;
  control: GroupControl;
}

/**
 * Group control implementation that wraps multiple controls
 */
class GroupControl implements maplibregl.IControl {
  private container: HTMLElement | null = null;
  private contentElement: HTMLElement;
  private className: string;
  private orientation: 'vertical' | 'horizontal';

  constructor(contentElement: HTMLElement, className: string = '', orientation: 'vertical' | 'horizontal' = 'vertical') {
    this.contentElement = contentElement;
    this.className = className;
    this.orientation = orientation;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    
    // Add custom class if provided
    if (this.className) {
      this.container.className += ` ${this.className}`;
    }

    // Add orientation class
    this.container.className += ` control-group-${this.orientation}`;

    // Move the content element into the control container
    this.container.appendChild(this.contentElement);
    
    // Make content visible (it starts with display: none)
    this.contentElement.style.display = '';

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      // Move content back to original location before removing
      const originalParent = this.container.parentNode;
      if (this.contentElement.parentNode === this.container) {
        originalParent.insertBefore(this.contentElement, this.container);
      }
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  getDefaultPosition(): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
    return 'top-right';
  }
}

export const ControlGroupHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on control group element');
        return;
      }

      const config: ControlGroupConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for control group "${config.id}"`);
        return;
      }

      // Find the content element (child div with id="${id}-content")
      const contentElement = el.querySelector(`#${config.id}-content`) as HTMLElement;
      if (!contentElement) {
        console.error(`[MaplibreX] Content element not found for control group "${config.id}"`);
        return;
      }

      // Create and add control to map
      const orientation = (config.orientation || 'vertical') as 'vertical' | 'horizontal';
      const control = new GroupControl(contentElement, config.className || '', orientation);
      const position = (config.position || 'top-right') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      
      map.addControl(control, position);

      // Save state
      (this as any)._maplibrex_control_group = {
        config,
        map,
        control
      };

      logger.debug(`[MaplibreX] ControlGroup "${config.id}" added at ${position} (${orientation})`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting control group:', error);
    }
  },

  updated(this: any) {
    // Control groups with dynamic content are already updated by LiveView
    // We don't need to recreate the control, just ensure content stays in place
    logger.debug('[MaplibreX] ControlGroup updated');
  },

  destroyed(this: any) {
    const state: ControlGroupHookState | undefined = (this as any)._maplibrex_control_group;
    if (!state) return;

    try {
      // Remove the control from the map
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] ControlGroup "${state.config.id}" removed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying control group:', error);
    }
  }
};
