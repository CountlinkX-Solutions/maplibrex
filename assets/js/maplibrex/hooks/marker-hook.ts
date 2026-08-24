/**
 * MarkerHook - Hook for the Marker component
 * 
 * Manages map markers with support for drag & drop,
 * popups, y eventos personalizados.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook, MarkerConfig } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface MarkerHookState {
  marker: maplibregl.Marker;
  config: MarkerConfig;
  popup?: maplibregl.Popup;
}

export const MarkerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on marker element');
        return;
      }

      const config: MarkerConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for marker "${config.id}"`);
        return;
      }

      // Build the marker options
      const markerOptions: maplibregl.MarkerOptions = {
        color: config.color || '#3FB1CE',
        scale: config.scale || 1,
        rotation: config.rotation || 0,
        draggable: config.draggable || false,
        pitchAlignment: config.pitchAlignment || 'auto',
        rotationAlignment: config.rotationAlignment || 'auto'
      };

      if (config.anchor) {
        markerOptions.anchor = config.anchor;
      }

      if (config.offset) {
        markerOptions.offset = config.offset;
      }

      // Crear marcador
      const marker = new maplibregl.Marker(markerOptions)
        .setLngLat(config.lngLat)
        .addTo(map);

      // Attach a popup if one was configured
      let popup: maplibregl.Popup | undefined;
      if (config.popup) {
        popup = new maplibregl.Popup({
          closeButton: config.popup.closeButton !== false,
          closeOnClick: config.popup.closeOnClick !== false,
          maxWidth: config.popup.maxWidth || '240px',
          offset: config.popup.offset
        });

        if (config.popup.text) {
          popup.setText(config.popup.text);
        } else if (config.popup.html) {
          popup.setHTML(config.popup.html);
        }

        marker.setPopup(popup);
      }

      // Marker events
      if (config.draggable) {
        marker.on('dragstart', () => {
          this.pushEvent('marker:drag_start', {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });

        marker.on('drag', () => {
          this.pushEvent('marker:dragging', {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });

        marker.on('dragend', () => {
          this.pushEvent('marker:drag_end', {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });
      }

      // Click event
      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        if (popup) {
          marker.togglePopup();  // ← línea añadida
        }
        this.pushEvent('marker:clicked', {
          markerId: config.id,
          lngLat: marker.getLngLat().toArray()
        });
      });

      // Guardar estado
      (this as any)._maplibrex_marker = {
        marker,
        config,
        popup
      };

      logger.debug(`[MaplibreX] Marker "${config.id}" created`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting marker:', error);
    }
  },

  updated(this: any) {
    const state: MarkerHookState | undefined = (this as any)._maplibrex_marker;
    if (!state) return;

    try {
      const el = this.el as HTMLElement;
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: MarkerConfig = JSON.parse(configStr);
      const oldConfig = state.config;

      // Update the position if it changed
      if (
        newConfig.lngLat[0] !== oldConfig.lngLat[0] ||
        newConfig.lngLat[1] !== oldConfig.lngLat[1]
      ) {
        state.marker.setLngLat(newConfig.lngLat);
      }

      // Update the rotation if it changed
      if (newConfig.rotation !== undefined && newConfig.rotation !== oldConfig.rotation) {
        state.marker.setRotation(newConfig.rotation);
      }

      // Update draggable if it changed
      if (newConfig.draggable !== oldConfig.draggable) {
        state.marker.setDraggable(newConfig.draggable || false);
      }

      // Update the popup if it changed
      if (newConfig.popup && state.popup) {
        if (newConfig.popup.text && newConfig.popup.text !== oldConfig.popup?.text) {
          state.popup.setText(newConfig.popup.text);
        } else if (newConfig.popup.html && newConfig.popup.html !== oldConfig.popup?.html) {
          state.popup.setHTML(newConfig.popup.html);
        }
      }

      // Store the new configuration
      state.config = newConfig;

    } catch (error) {
      console.error('[MaplibreX] Error updating marker:', error);
    }
  },

  destroyed(this: any) {
    const state: MarkerHookState | undefined = (this as any)._maplibrex_marker;
    if (!state) return;

    try {
      // Remove the marker
      state.marker.remove();
      logger.debug(`[MaplibreX] Marker "${state.config.id}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying marker:', error);
    }
  }
};
