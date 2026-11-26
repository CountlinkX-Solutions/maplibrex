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
import { throttle } from '../utils/debounce';

interface MarkerHookState {
  marker: maplibregl.Marker;
  /** Silences the marker's pending throttled drag tick. */
  dispose: () => void;
  map: maplibregl.Map;
  config: MarkerConfig;
  popup?: maplibregl.Popup;
}

/** `marker:dragging` is pushed at most once per this many milliseconds. */
const DRAG_THROTTLE_MS = 50;

function createPopup(popupConfig: NonNullable<MarkerConfig['popup']>): maplibregl.Popup {
  const popup = new maplibregl.Popup({
    closeButton: popupConfig.closeButton !== false,
    closeOnClick: popupConfig.closeOnClick !== false,
    maxWidth: popupConfig.maxWidth || '240px',
    offset: popupConfig.offset
  });

  if (popupConfig.text) {
    popup.setText(popupConfig.text);
  } else if (popupConfig.html) {
    popup.setHTML(popupConfig.html);
  }

  return popup;
}

/**
 * Builds a marker from `config`, adds it to the map and wires its events.
 *
 * Shared by mount and by recreation: MapLibre cannot change a marker's color,
 * scale or anchor in place. The drag listeners are always attached because
 * MapLibre only fires them while the marker is draggable, which can change
 * after mount.
 */
function createMarker(
  hook: any,
  map: maplibregl.Map,
  config: MarkerConfig,
  popup: maplibregl.Popup | undefined,
  lngLat: [number, number] = config.lngLat
): { marker: maplibregl.Marker; dispose: () => void } {
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

  const marker = new maplibregl.Marker(markerOptions).setLngLat(lngLat).addTo(map);

  if (popup) {
    marker.setPopup(popup);
  }

  const payload = () => ({
    markerId: config.id,
    lngLat: marker.getLngLat().toArray()
  });

  // A throttled tick can fire after `dragend`; `dragging` guards against
  // pushing a stale position once the drag is over.
  let dragging = false;
  const pushDragging = throttle(() => {
    if (dragging) hook.pushEvent('marker:dragging', payload());
  }, DRAG_THROTTLE_MS);

  marker.on('dragstart', () => {
    dragging = true;
    hook.pushEvent('marker:drag_start', payload());
  });

  marker.on('drag', pushDragging);

  marker.on('dragend', () => {
    dragging = false;
    hook.pushEvent('marker:drag_end', payload());
  });

  marker.getElement().addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup) {
      marker.togglePopup();
    }
    hook.pushEvent('marker:clicked', payload());
  });

  return {
    marker,
    dispose: () => {
      dragging = false;
    }
  };
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

      const popup = config.popup ? createPopup(config.popup) : undefined;
      const { marker, dispose } = createMarker(this, map, config, popup);

      // Save state
      (this as any)._maplibrex_marker = {
        marker,
        dispose,
        map,
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

      const lngLatChanged =
        newConfig.lngLat[0] !== oldConfig.lngLat[0] ||
        newConfig.lngLat[1] !== oldConfig.lngLat[1];

      // Color, scale and anchor are construction-time options in MapLibre, so
      // a change means building a new marker. Position, popup, draggable state
      // and listeners carry over.
      const needsRecreate =
        newConfig.color !== oldConfig.color ||
        newConfig.scale !== oldConfig.scale ||
        newConfig.anchor !== oldConfig.anchor;

      if (needsRecreate) {
        const lngLat = lngLatChanged
          ? newConfig.lngLat
          : (state.marker.getLngLat().toArray() as [number, number]);
        // MapLibre's remove() also closes the marker's popup; reopen it.
        const popupWasOpen = state.popup?.isOpen() ?? false;
        state.dispose();
        state.marker.remove();
        const next = createMarker(this, state.map, newConfig, state.popup, lngLat);
        state.marker = next.marker;
        state.dispose = next.dispose;
        if (popupWasOpen) {
          state.marker.togglePopup();
        }
      } else {
        if (lngLatChanged) {
          state.marker.setLngLat(newConfig.lngLat);
        }

        if (newConfig.rotation !== undefined && newConfig.rotation !== oldConfig.rotation) {
          state.marker.setRotation(newConfig.rotation);
        }

        if (newConfig.draggable !== oldConfig.draggable) {
          state.marker.setDraggable(newConfig.draggable || false);
        }

        if (JSON.stringify(newConfig.offset) !== JSON.stringify(oldConfig.offset)) {
          state.marker.setOffset(newConfig.offset || [0, 0]);
        }

        if (newConfig.pitchAlignment !== oldConfig.pitchAlignment) {
          state.marker.setPitchAlignment(newConfig.pitchAlignment || 'auto');
        }

        if (newConfig.rotationAlignment !== oldConfig.rotationAlignment) {
          state.marker.setRotationAlignment(newConfig.rotationAlignment || 'auto');
        }
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
      state.dispose();
      state.marker.remove();
      logger.debug(`[MaplibreX] Marker "${state.config.id}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying marker:', error);
    }
  }
};
