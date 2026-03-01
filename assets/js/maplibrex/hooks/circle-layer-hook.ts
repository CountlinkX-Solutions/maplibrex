/**
 * CircleLayerHook - Hook para el componente CircleLayer
 * 
 * Este hook gestiona una capa de círculos en MapLibre GL JS,
 * renderizando puntos como círculos con estilos configurables.
 */

import maplibregl from 'maplibre-gl';
import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface CircleLayerConfig {
  id: string;
  mapId: string;
  sourceId: string;
  sourceLayer?: string;
  paint: any;
  layout: any;
  filter?: any;
  minZoom?: number;
  maxZoom?: number;
  beforeId?: string;
}

interface CircleLayerHookState {
  config: CircleLayerConfig;
  clickHandler?: (e: any) => void;
  mouseenterHandler?: (e: any) => void;
  mouseleaveHandler?: (e: any) => void;
}

export const CircleLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on circle layer element');
        return;
      }

      const config: CircleLayerConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for circle layer "${config.id}"`);
        return;
      }

      // Esperar a que el mapa esté completamente cargado
      const addLayer = () => {
        try {
          // Verificar que el source existe
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for circle layer "${config.id}". Layer will be added when source is available.`);
            return;
          }

          // Construir especificación de la capa
          const layerSpec: any = {
            id: config.id,
            type: 'circle',
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
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

          // Event handlers para interactividad
          const clickHandler = (e: any) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent('layer:feature_clicked', {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };

          const mouseenterHandler = (e: any) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = 'pointer';
              this.pushEvent('layer:feature_mouseenter', {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };

          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = '';
            this.pushEvent('layer:feature_mouseleave', {
              layer_id: config.id
            });
          };

          // Agregar event listeners
          map.on('click', config.id, clickHandler);
          map.on('mouseenter', config.id, mouseenterHandler);
          map.on('mouseleave', config.id, mouseleaveHandler);

          // Guardar estado
          (this as any)._maplibrex_circle_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };

          // Emitir evento de capa agregada
          this.pushEvent('layer:added', { layer_id: config.id });

          console.log(`[MaplibreX] Circle layer "${config.id}" mounted on map "${mapId}"`);

        } catch (error) {
          console.error(`[MaplibreX] Error adding circle layer "${config.id}":`, error);
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
      console.error('[MaplibreX] Error mounting circle layer:', error);
    }
  },

  destroyed(this: any) {
    const state: CircleLayerHookState | undefined = (this as any)._maplibrex_circle_layer;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        // Remover event listeners
        if (state.clickHandler) {
          map.off('click', state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off('mouseenter', state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off('mouseleave', state.config.id, state.mouseleaveHandler);
        }

        // Remover la capa si existe
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }

        // Emitir evento de capa removida
        this.pushEvent('layer:removed', { layer_id: state.config.id });
      }

      console.log(`[MaplibreX] Circle layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying circle layer:', error);
    }
  }
};
