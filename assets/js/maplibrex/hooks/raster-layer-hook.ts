/**
 * RasterLayerHook - Hook para el componente RasterLayer
 * 
 * Este hook gestiona una capa raster en MapLibre GL JS,
 * renderizando tiles de imágenes desde fuentes raster.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface RasterLayerConfig {
  id: string;
  mapId: string;
  sourceId: string;
  paint: any;
  layout: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface RasterLayerHookState {
  config: RasterLayerConfig;
}

export const RasterLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on raster layer element');
        return;
      }

      const config: RasterLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster layer "${config.id}"`);
        return;
      }

      // Esperar a que el mapa esté completamente cargado
      const addLayer = () => {
        try {
          // Verificar que el source existe
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for raster layer "${config.id}". Layer will be added when source is available.`);
            return;
          }

          // Construir especificación de la capa
          const layerSpec: any = {
            id: config.id,
            type: 'raster',
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };

          // Agregar propiedades opcionales
          if (config.minZoom !== undefined) {
            layerSpec.minzoom = config.minZoom;
          }

          if (config.maxZoom !== undefined) {
            layerSpec.maxzoom = config.maxZoom;
          }

          // Agregar la capa al mapa
          map.addLayer(layerSpec, config.beforeId);

          // Guardar estado
          (this as any)._maplibrex_raster_layer = {
            config
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          console.log(`[MaplibreX] Raster layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding raster layer "${config.id}":`, error);
        }
      };

      // Si el mapa ya está cargado, agregar la capa inmediatamente
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        // Esperar a que el estilo se cargue
        map.once('load', addLayer);
      }

    } catch (error) {
      console.error('[MaplibreX] Error mounting raster layer:', error);
    }
  },

  destroyed(this: any) {
    const state: RasterLayerHookState | undefined = (this as any)._maplibrex_raster_layer;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remover la capa si existe
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }

        // Emitir evento de capa removida
        this.pushEvent('layer:removed', { layer_id: state.config.id });
      }

      console.log(`[MaplibreX] Raster layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying raster layer:', error);
    }
  }
};
