/**
 * HeatmapLayerHook - Hook para el componente HeatmapLayer
 * 
 * Este hook gestiona una capa de mapa de calor en MapLibre GL JS,
 * visualizando densidad y concentración de puntos de datos.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface HeatmapLayerConfig {
  id: string;
  mapId: string;
  sourceId: string;
  sourceLayer?: string;
  paint: any;
  filter?: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface HeatmapLayerHookState {
  config: HeatmapLayerConfig;
}

export const HeatmapLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on heatmap layer element');
        return;
      }

      const config: HeatmapLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for heatmap layer "${config.id}"`);
        return;
      }

      // Esperar a que el mapa esté completamente cargado
      const addLayer = () => {
        try {
          // Verificar que el source existe
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for heatmap layer "${config.id}". Layer will be added when source is available.`);
            return;
          }

          // Construir especificación de la capa
          const layerSpec: any = {
            id: config.id,
            type: 'heatmap',
            source: config.sourceId,
            paint: config.paint || {}
          };

          // Agregar propiedades opcionales
          if (config.sourceLayer) {
            layerSpec['source-layer'] = config.sourceLayer;
          }

          if (config.filter) {
            layerSpec.filter = config.filter;
          }

          if (config.minZoom !== undefined) {
            layerSpec.minzoom = config.minZoom;
          }

          if (config.maxZoom !== undefined) {
            layerSpec.maxzoom = config.maxZoom;
          }

          // Agregar la capa al mapa
          map.addLayer(layerSpec, config.beforeId);

          // Guardar estado
          (this as any)._maplibrex_heatmap_layer = {
            config
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          console.log(`[MaplibreX] Heatmap layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding heatmap layer "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting heatmap layer:', error);
    }
  },

  destroyed(this: any) {
    const state: HeatmapLayerHookState | undefined = (this as any)._maplibrex_heatmap_layer;
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

      console.log(`[MaplibreX] Heatmap layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying heatmap layer:', error);
    }
  }
};
