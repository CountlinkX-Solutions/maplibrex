/**
 * Lazy loader for deck.gl libraries
 * 
 * This module implements code splitting for deck.gl, only loading it when needed.
 * This significantly reduces the initial bundle size since deck.gl is ~600KB.
 * 
 * The deck.gl libraries are only loaded when a DeckGlLayer component is mounted.
 */

import type { Deck } from '@deck.gl/core';

// Type-only imports (no runtime cost)
type DeckGLCore = typeof import('@deck.gl/core');
type DeckGLLayers = typeof import('@deck.gl/layers');
type DeckGLAggregation = typeof import('@deck.gl/aggregation-layers');

export interface DeckGLModules {
  core: DeckGLCore;
  layers: DeckGLLayers;
  aggregation: DeckGLAggregation;
  Deck: typeof Deck;
}

// Cache for loaded modules
let deckGLModules: DeckGLModules | null = null;
let loadingPromise: Promise<DeckGLModules> | null = null;

/**
 * Lazy load deck.gl modules
 * 
 * This function dynamically imports deck.gl only when needed.
 * Subsequent calls return the cached modules.
 * 
 * @returns Promise resolving to all deck.gl modules
 */
export async function loadDeckGL(): Promise<DeckGLModules> {
  // Return cached modules if already loaded
  if (deckGLModules) {
    return deckGLModules;
  }

  // Return existing loading promise if currently loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  console.log('[MaplibreX] Lazy loading deck.gl modules...');
  
  loadingPromise = Promise.all([
    import('@deck.gl/core'),
    import('@deck.gl/layers'),
    import('@deck.gl/aggregation-layers')
  ]).then(([core, layers, aggregation]) => {
    const modules: DeckGLModules = {
      core,
      layers,
      aggregation,
      Deck: core.Deck
    };
    
    deckGLModules = modules;
    loadingPromise = null;
    
    console.log('[MaplibreX] deck.gl modules loaded successfully');
    return modules;
  }).catch((error) => {
    console.error('[MaplibreX] Failed to load deck.gl modules:', error);
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}

/**
 * Check if deck.gl is already loaded
 * 
 * @returns true if deck.gl modules are cached in memory
 */
export function isDeckGLLoaded(): boolean {
  return deckGLModules !== null;
}

/**
 * Preload deck.gl modules in the background
 * 
 * Use this to preload deck.gl before it's needed, reducing
 * the delay when the first DeckGlLayer mounts.
 */
export function preloadDeckGL(): void {
  if (!deckGLModules && !loadingPromise) {
    loadDeckGL().catch(() => {
      // Silently fail on preload
    });
  }
}

/**
 * Clear the deck.gl module cache (useful for testing)
 */
export function clearDeckGLCache(): void {
  deckGLModules = null;
  loadingPromise = null;
}
