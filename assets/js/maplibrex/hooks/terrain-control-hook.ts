/**
 * TerrainControlHook - Hook para el componente TerrainControl
 * 
 * Este hook crea un control UI que permite toggle de terreno 3D on/off.
 */

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';

interface TerrainControlConfig {
  id: string;
  mapId: string;
  position: string;
  terrainSourceId: string;
  exaggeration: number;
  enabled: boolean;
}

interface TerrainControlHookState {
  config: TerrainControlConfig;
  control: any;
  enabled: boolean;
}

export const TerrainControlHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;

    try {
      // Obtener configuración
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config found on terrain control element');
        return;
      }

      const config: TerrainControlConfig = JSON.parse(configStr);
      const mapId = config.mapId;

      // Obtener instancia del mapa
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for terrain control "${config.id}"`);
        return;
      }

      // Crear clase de control personalizado
      class TerrainControl {
        private _map: any;
        private _container: HTMLDivElement | undefined;
        private _button: HTMLButtonElement | undefined;
        private _enabled: boolean;
        private _config: TerrainControlConfig;
        private _pushEvent: any;

        constructor(config: TerrainControlConfig, pushEvent: any) {
          this._enabled = config.enabled;
          this._config = config;
          this._pushEvent = pushEvent;
        }

        onAdd(map: any) {
          this._map = map;
          this._container = document.createElement('div');
          this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

          this._button = document.createElement('button');
          this._button.className = 'maplibregl-ctrl-terrain';
          this._button.type = 'button';
          this._button.title = this._enabled ? 'Disable 3D Terrain' : 'Enable 3D Terrain';
          this._button.setAttribute('aria-label', this._button.title);
          
          // Icono para terrain (mountain/3D icon)
          this._button.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M3 20l6-8 4 4 8-12v16H3z"/>
            </svg>
          `;

          // Aplicar estilo inicial
          this._updateButtonStyle();

          // Event listener para toggle
          this._button.addEventListener('click', () => {
            this._enabled = !this._enabled;
            this._toggleTerrain();
            this._updateButtonStyle();
            this._button!.title = this._enabled ? 'Disable 3D Terrain' : 'Enable 3D Terrain';
            this._button!.setAttribute('aria-label', this._button!.title);
            
            // Emitir evento a LiveView
            this._pushEvent('terrain_control:toggled', {
              enabled: this._enabled,
              source_id: this._config.terrainSourceId,
              exaggeration: this._config.exaggeration
            });
          });

          this._container.appendChild(this._button);

          // Si está enabled inicialmente, habilitar terreno
          if (this._enabled) {
            this._toggleTerrain();
          }

          return this._container;
        }

        onRemove() {
          if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
          }
          this._map = undefined;
        }

        private _toggleTerrain() {
          if (!this._map) return;

          try {
            if (this._enabled) {
              // Habilitar terreno
              this._map.setTerrain({
                source: this._config.terrainSourceId,
                exaggeration: this._config.exaggeration
              });
            } else {
              // Deshabilitar terreno
              this._map.setTerrain(null);
            }
          } catch (error) {
            console.error('[MaplibreX] Error toggling terrain:', error);
            this._pushEvent('terrain_control:error', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        private _updateButtonStyle() {
          if (!this._button) return;
          
          if (this._enabled) {
            this._button.style.backgroundColor = '#4A90E2';
            this._button.style.color = '#ffffff';
          } else {
            this._button.style.backgroundColor = '';
            this._button.style.color = '';
          }
        }

        setEnabled(enabled: boolean) {
          if (this._enabled !== enabled) {
            this._enabled = enabled;
            this._toggleTerrain();
            this._updateButtonStyle();
            if (this._button) {
              this._button.title = this._enabled ? 'Disable 3D Terrain' : 'Enable 3D Terrain';
              this._button.setAttribute('aria-label', this._button.title);
            }
          }
        }
      }

      // Crear instancia del control
      const control = new TerrainControl(config, this.pushEvent.bind(this));

      // Agregar control al mapa
      map.addControl(control as any, config.position as any);

      // Guardar estado
      (this as any)._maplibrex_terrain_control = {
        config,
        control,
        enabled: config.enabled
      };

      console.log(`[MaplibreX] Terrain control "${config.id}" mounted on map "${mapId}" at position "${config.position}"`);

    } catch (error) {
      console.error('[MaplibreX] Error mounting terrain control:', error);
    }
  },

  updated(this: any) {
    const el = this.el as HTMLElement;

    try {
      const configStr = el.dataset.config;
      if (!configStr) return;

      const newConfig: TerrainControlConfig = JSON.parse(configStr);
      const state: TerrainControlHookState | undefined = (this as any)._maplibrex_terrain_control;
      
      if (!state) return;

      // Si el estado enabled cambió, actualizar el control
      if (newConfig.enabled !== state.enabled) {
        state.control.setEnabled(newConfig.enabled);
        state.enabled = newConfig.enabled;
        state.config = newConfig;
      }
    } catch (error) {
      console.error('[MaplibreX] Error in terrain control updated:', error);
    }
  },

  destroyed(this: any) {
    const state: TerrainControlHookState | undefined = (this as any)._maplibrex_terrain_control;
    if (!state) return;

    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        // Remover el control del mapa
        try {
          map.removeControl(state.control);
        } catch (e) {
          console.warn(`[MaplibreX] Could not remove terrain control: ${e}`);
        }
      }

      console.log(`[MaplibreX] Terrain control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error('[MaplibreX] Error destroying terrain control:', error);
    }
  }
};
