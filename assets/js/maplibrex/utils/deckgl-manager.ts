/**
 * Manager for deck.gl layers
 * 
 * Manages the integration between deck.gl and MapLibre GL JS,
 * handling the overlay, its layers and their events.
 */

import type { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDeckLayer } from './deckgl-layer-factory';
import { requireDeckGL } from './deckgl-lazy-loader';
import type { DeckGLLayerConfig } from '../types/deckgl';

import { logger } from '../core/logger';

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
   * Initialise the deck.gl overlay on top of MapLibre
   */
  private initializeOverlay(): void {
    logger.debug('[MaplibreX] Initializing DeckGL overlay');
    
    // Resolved at runtime so @deck.gl/mapbox stays out of the main bundle.
    const { MapboxOverlay } = requireDeckGL().mapbox;

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
   * Add a layer to the overlay
   */
  addLayer(config: DeckGLLayerConfig): void {
    logger.debug(`[MaplibreX] Adding DeckGL layer: ${config.id}`);
    
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
   * Update an existing layer
   */
  updateLayer(config: DeckGLLayerConfig): void {
    logger.debug(`[MaplibreX] Updating DeckGL layer: ${config.id}`);
    
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
   * Remove a layer from the overlay
   */
  removeLayer(layerId: string): void {
    logger.debug(`[MaplibreX] Removing DeckGL layer: ${layerId}`);
    
    this.layers.delete(layerId);
    this.updateOverlay();
  }
  
  /**
   * Refresh the overlay with the current layers
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
    logger.debug('[MaplibreX] Destroying DeckGL manager');
    
    if (this.overlay) {
      this.map.removeControl(this.overlay as any);
      this.overlay = null;
    }
    this.layers.clear();
  }
}
