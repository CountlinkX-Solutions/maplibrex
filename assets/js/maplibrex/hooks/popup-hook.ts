/**
 * PopupHook - Hook para el componente Popup
 * 
 * Gestiona popups independientes en el mapa con soporte para
 * contenido HTML, eventos, y control programático desde LiveView.
 */

import maplibregl from 'maplibre-gl';
import type { LiveViewHook, PopupConfig } from '../types';
import { MapManager } from '../core/map-manager';

interface PopupHookState {
  popup: maplibregl.Popup;
  config: PopupConfig;
  map: maplibregl.Map;
  contentElement: HTMLElement | null;
}

export const PopupHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on popup element');
        return;
      }

      const config: PopupConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || 'default');

      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for popup "${config.id}"`);
        return;
      }

      // Get content element
      const contentElement = el.querySelector('[data-popup-content]') as HTMLElement;
      if (!contentElement) {
        console.error(`[MaplibreX] No content element found for popup "${config.id}"`);
        return;
      }

      // Create popup options
      const popupOptions: maplibregl.PopupOptions = {
        closeButton: config.closeButton !== false,
        closeOnClick: config.closeOnClick !== false,
        closeOnMove: config.closeOnMove || false,
        maxWidth: config.maxWidth || '240px',
        anchor: config.anchor as any || 'auto'
      };

      if (config.offset !== undefined) {
        popupOptions.offset = config.offset as any;
      }

      if (config.className) {
        popupOptions.className = config.className;
      }

      // Create popup
      const popup = new maplibregl.Popup(popupOptions);

      // Set HTML content from the slot
      const htmlContent = contentElement.innerHTML;
      popup.setHTML(htmlContent);

      // Add popup to map if lngLat provided and open is true
      if (config.lngLat && config.open !== false) {
        popup.setLngLat(config.lngLat).addTo(map);
      } else if (config.lngLat) {
        // Set location but don't add to map yet
        popup.setLngLat(config.lngLat);
      }

      // Setup event listeners
      popup.on('open', () => {
        this.pushEvent('popup:opened', {
          popupId: config.id,
          lngLat: popup.getLngLat()?.toArray()
        });
      });

      popup.on('close', () => {
        this.pushEvent('popup:closed', {
          popupId: config.id
        });
      });

      // Handle commands from LiveView
      this.handleEvent('popup:open', (payload: any) => {
        if (payload.popup_id === config.id) {
          if (payload.lng_lat) {
            popup.setLngLat(payload.lng_lat);
          }
          if (!popup.isOpen()) {
            popup.addTo(map);
          }
        }
      });

      this.handleEvent('popup:close', (payload: any) => {
        if (payload.popup_id === config.id && popup.isOpen()) {
          popup.remove();
        }
      });

      this.handleEvent('popup:toggle', (payload: any) => {
        if (payload.popup_id === config.id) {
          if (popup.isOpen()) {
            popup.remove();
          } else {
            popup.addTo(map);
          }
        }
      });

      this.handleEvent('popup:set_location', (payload: any) => {
        if (payload.popup_id === config.id && payload.lng_lat) {
          popup.setLngLat(payload.lng_lat);
        }
      });

      // Save state
      (this as any)._maplibrex_popup = {
        popup,
        config,
        map,
        contentElement
      };

      console.log(`[MaplibreX] Popup "${config.id}" created`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting popup:', error);
    }
  },

  updated(this: any) {
    const state: PopupHookState | undefined = (this as any)._maplibrex_popup;
    if (!state) return;

    try {
      const el = this.el as HTMLElement;
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: PopupConfig = JSON.parse(configStr);
      const oldConfig = state.config;

      // Update content if it changed
      const contentElement = el.querySelector('[data-popup-content]') as HTMLElement;
      if (contentElement) {
        const newContent = contentElement.innerHTML;
        const currentContent = state.popup.getElement()?.innerHTML;
        
        if (newContent !== currentContent) {
          state.popup.setHTML(newContent);
        }
      }

      // Update position if changed
      if (newConfig.lngLat) {
        const oldLngLat = oldConfig.lngLat;
        if (
          !oldLngLat ||
          newConfig.lngLat[0] !== oldLngLat[0] ||
          newConfig.lngLat[1] !== oldLngLat[1]
        ) {
          state.popup.setLngLat(newConfig.lngLat);
        }
      }

      // Handle open/close state changes
      const shouldBeOpen = newConfig.open !== false && newConfig.lngLat;
      const isCurrentlyOpen = state.popup.isOpen();

      if (shouldBeOpen && !isCurrentlyOpen) {
        state.popup.addTo(state.map);
      } else if (!shouldBeOpen && isCurrentlyOpen) {
        state.popup.remove();
      }

      // Update maxWidth if changed
      if (newConfig.maxWidth !== oldConfig.maxWidth) {
        state.popup.setMaxWidth(newConfig.maxWidth || '240px');
      }

      // Update configuration
      state.config = newConfig;

    } catch (error) {
      console.error('[MaplibreX] Error updating popup:', error);
    }
  },

  destroyed(this: any) {
    const state: PopupHookState | undefined = (this as any)._maplibrex_popup;
    if (!state) return;

    try {
      // Remove the popup
      state.popup.remove();
      console.log(`[MaplibreX] Popup "${state.config.id}" destroyed`);

    } catch (error) {
      console.error('[MaplibreX] Error destroying popup:', error);
    }
  }
};
