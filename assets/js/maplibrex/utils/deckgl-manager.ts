/**
 * Manager para capas de deck.gl
 * 
 * Gestiona la integración entre deck.gl y MapLibre GL JS,
 * manejando el overlay, layers y eventos.
 */

import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDeckLayer } from './deckgl-layer-factory';
import type { DeckGLLayerConfig } from '../types/deckgl';

export class DeckGLLayerManager {
  private map: MapLibreMap;
  private hook: any;
  private overlay: MapboxOverlay | null = null;
  private layers: Map<string, Layer> = new Map<string, Layer>();
  
  constructor(map: MapLibreMap, hook: any) {
    this.map = map;
    this.hook = hook;
    this.initializeOverlay();
  }
  
  /**
   * Inicializa el overlay de deck.gl sobre MapLibre
   */
  private initializeOverlay(): void {
    console.log('[MaplibreX] Initializing DeckGL overlay');
    
    this.overlay = new MapboxOverlay({
      interleaved: true,
      onClick: this.handleClick.bind(this),
      onHover: this.handleHover.bind(this),
      onDragStart: this.handleDragStart.bind(this),
      onDrag: this.handleDrag.bind(this),
      onDragEnd: this.handleDragEnd.bind(this)
    });
    
    this.map.addControl(this.overlay as any);
  }
  
  /**
   * Agrega un layer al overlay
   */
  addLayer(config: DeckGLLayerConfig): void {
    console.log(`[MaplibreX] Adding DeckGL layer: ${config.id}`);
    
    try {
      const layer = createDeckLayer(config);
      this.layers.set(config.id, layer);
      this.updateOverlay();
    } catch (error) {
      console.error(`[MaplibreX] Error adding DeckGL layer:`, error);
      throw error;
    }
  }
  
  /**
   * Actualiza un layer existente
   */
  updateLayer(config: DeckGLLayerConfig): void {
    console.log(`[MaplibreX] Updating DeckGL layer: ${config.id}`);
    
    try {
      const layer = createDeckLayer(config);
      this.layers.set(config.id, layer);
      this.updateOverlay();
    } catch (error) {
      console.error(`[MaplibreX] Error updating DeckGL layer:`, error);
      throw error;
    }
  }
  
  /**
   * Remueve un layer del overlay
   */
  removeLayer(layerId: string): void {
    console.log(`[MaplibreX] Removing DeckGL layer: ${layerId}`);
    
    this.layers.delete(layerId);
    this.updateOverlay();
  }
  
  /**
   * Actualiza el overlay con los layers actuales
   */
  private updateOverlay(): void {
    if (!this.overlay) return;
    
    const layersArray = Array.from(this.layers.values());
    this.overlay.setProps({ layers: layersArray });
  }
  
  /**
   * Maneja eventos de click
   */
  private handleClick(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:click', {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y,
        coordinate: info.coordinate
      });
    }
  }
  
  /**
   * Maneja eventos de hover
   */
  private handleHover(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:hover', {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y
      });
    }
  }
  
  /**
   * Maneja inicio de drag
   */
  private handleDragStart(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:drag_start', {
        layerId: info.layer?.id,
        object: info.object
      });
    }
  }
  
  /**
   * Maneja evento de drag
   */
  private handleDrag(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:drag', {
        layerId: info.layer?.id,
        object: info.object,
        coordinate: info.coordinate
      });
    }
  }
  
  /**
   * Maneja fin de drag
   */
  private handleDragEnd(info: PickingInfo): void {
    this.hook.pushEvent('deckgl:drag_end', {
      layerId: info.layer?.id
    });
  }
  
  /**
   * Limpia recursos
   */
  destroy(): void {
    console.log('[MaplibreX] Destroying DeckGL manager');
    
    if (this.overlay) {
      this.map.removeControl(this.overlay as any);
      this.overlay = null;
    }
    this.layers.clear();
  }
}
