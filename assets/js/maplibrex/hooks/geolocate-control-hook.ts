/**
 * GeolocateControlHook - Hook for the GeolocateControl component
 * 
 * This hook manages a MapLibre GL JS geolocate control,
 * letting users find their current location and optionally
 * track their movement in real time.
 */

// maplibre-gl v6 is ESM-only and no longer has a default export.
import * as maplibregl from 'maplibre-gl';
import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

import { logger } from '../core/logger';

interface GeolocateControlConfig {
  id: string;
  mapId: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  trackUserLocation: boolean;
  showAccuracyCircle: boolean;
  showUserHeading: boolean;
  fitBoundsOptions: any;
}

interface GeolocateControlHookState {
  control: maplibregl.GeolocateControl;
  config: GeolocateControlConfig;
}

export const GeolocateControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Read the configuration
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on geolocate control element');
        return;
      }

      const config: GeolocateControlConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Get the map instance
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for geolocate control "${config.id}"`);
        return;
      }

      // Create the geolocate control
      const control = new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: config.trackUserLocation,
        showAccuracyCircle: config.showAccuracyCircle,
        showUserLocation: config.showUserHeading, // MapLibre uses showUserLocation instead
        fitBoundsOptions: config.fitBoundsOptions
      });

      // Add the control to the map at the given position
      map.addControl(control, config.position);

      // Event: geolocate (location found)
      control.on('geolocate', (e: any) => {
        const coords = {
          latitude: e.coords.latitude,
          longitude: e.coords.longitude,
          accuracy: e.coords.accuracy,
          altitude: e.coords.altitude,
          altitudeAccuracy: e.coords.altitudeAccuracy,
          heading: e.coords.heading,
          speed: e.coords.speed,
          timestamp: e.timestamp
        };

        this.pushEvent('geolocate:location_found', { coords });
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Location found`, coords);
      });

      // Event: trackuserlocationstart
      control.on('trackuserlocationstart', () => {
        this.pushEvent('geolocate:tracking_started', {});
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Tracking started`);
      });

      // Event: trackuserlocationend
      control.on('trackuserlocationend', () => {
        this.pushEvent('geolocate:tracking_stopped', {});
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Tracking stopped`);
      });

      // Event: error
      control.on('error', (e: any) => {
        const error = {
          code: e.code,
          message: e.message
        };

        this.pushEvent('geolocate:location_error', error);
        console.error(`[MaplibreX] Geolocate control "${config.id}": Error`, error);
      });

      // Event: user location updated (durante tracking)
      // This fires continuously while trackUserLocation is on
      map.on('moveend', () => {
        if (control._watchState === 'ACTIVE_LOCK') {
          const center = map.getCenter();
          const coords = {
            latitude: center.lat,
            longitude: center.lng
          };
          this.pushEvent('geolocate:user_location_updated', { coords });
        }
      });

      // Guardar estado
      (this as any)._maplibrex_geolocate = {
        control,
        config
      };

      logger.debug(`[MaplibreX] Geolocate control "${config.id}" mounted on map "${mapId}"`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting geolocate control:', error);
    }
  },

  destroyed(this: any) {
    const state: GeolocateControlHookState | undefined = (this as any)._maplibrex_geolocate;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        // Remove the control from the map
        map.removeControl(state.control);
      }

      logger.debug(`[MaplibreX] Geolocate control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying geolocate control:', error);
    }
  }
};
