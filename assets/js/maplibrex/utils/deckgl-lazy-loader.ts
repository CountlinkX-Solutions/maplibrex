/**
 * Lazy loader for the deck.gl packages.
 *
 * deck.gl is roughly 600 KB — larger than the rest of MaplibreX put together —
 * and only matters to applications that use `<.deckgl_layer>`. Nothing in this
 * module may be imported statically anywhere in the library, or the bundler
 * hoists deck.gl into the main chunk and the split is lost. That is why the
 * layer factory and the overlay manager reach for their constructors through
 * `requireDeckGL()` instead of importing them directly.
 *
 * `import type` declarations are erased at compile time and are safe.
 */

import type { Deck } from '@deck.gl/core';
import { getVersion } from 'maplibre-gl';

import { logger } from '../core/logger';

// Type-only imports (no runtime cost)
type DeckGLCore = typeof import('@deck.gl/core');
type DeckGLLayers = typeof import('@deck.gl/layers');
type DeckGLAggregation = typeof import('@deck.gl/aggregation-layers');
type DeckGLMapbox = typeof import('@deck.gl/mapbox');

export interface DeckGLModules {
  core: DeckGLCore;
  layers: DeckGLLayers;
  aggregation: DeckGLAggregation;
  mapbox: DeckGLMapbox;
  Deck: typeof Deck;
}

// Cache for loaded modules
let deckGLModules: DeckGLModules | null = null;
let loadingPromise: Promise<DeckGLModules> | null = null;

/**
 * deck.gl's MapboxOverlay reads MapLibre's internal `map.transform`, which
 * maplibre-gl v6 removed. Every published @deck.gl/mapbox — 9.3.10 and the
 * 9.4 alphas included — still depends on it, so a deck.gl layer under v6
 * dies with an opaque `Cannot read properties of undefined (reading '_nearZ')`.
 *
 * Fail early with an explanation instead. Remove this check once deck.gl
 * supports maplibre-gl v6.
 */
function assertDeckGLSupported(): void {
  const version = getVersion();
  const major = Number.parseInt(version, 10);

  if (Number.isFinite(major) && major >= 6) {
    throw new Error(
      `deck.gl layers require maplibre-gl v5 — you are running v${version}. ` +
        '@deck.gl/mapbox reads the internal map.transform that maplibre-gl v6 removed. ' +
        'Either pin maplibre-gl to ^5.0.0, or drop <.deckgl_layer> from this page. ' +
        'Every other MaplibreX component works on v6.'
    );
  }
}

/**
 * Load the deck.gl modules, importing them on first call and returning the
 * cached set afterwards.
 */
export async function loadDeckGL(): Promise<DeckGLModules> {
  if (deckGLModules) {
    return deckGLModules;
  }

  assertDeckGLSupported();

  if (loadingPromise) {
    return loadingPromise;
  }

  logger.debug('[MaplibreX] Lazy loading deck.gl modules...');

  loadingPromise = Promise.all([
    import('@deck.gl/core'),
    import('@deck.gl/layers'),
    import('@deck.gl/aggregation-layers'),
    import('@deck.gl/mapbox')
  ])
    .then(([core, layers, aggregation, mapbox]) => {
      const modules: DeckGLModules = {
        core,
        layers,
        aggregation,
        mapbox,
        Deck: core.Deck
      };

      deckGLModules = modules;
      loadingPromise = null;

      logger.debug('[MaplibreX] deck.gl modules loaded successfully');
      return modules;
    })
    .catch((error) => {
      loadingPromise = null;
      console.error(
        '[MaplibreX] Failed to load deck.gl. Install the optional peer dependencies: ' +
          'npm install @deck.gl/core @deck.gl/layers @deck.gl/aggregation-layers @deck.gl/mapbox',
        error
      );
      throw error;
    });

  return loadingPromise;
}

/**
 * The already-loaded deck.gl modules.
 *
 * Throws if `loadDeckGL()` has not resolved yet. Call this only from code that
 * runs after the DeckGlLayerHook has awaited the load.
 */
export function requireDeckGL(): DeckGLModules {
  if (!deckGLModules) {
    throw new Error(
      'deck.gl has not been loaded yet. Await loadDeckGL() before using deck.gl layers.'
    );
  }

  return deckGLModules;
}

/**
 * Whether the deck.gl modules are cached in memory.
 */
export function isDeckGLLoaded(): boolean {
  return deckGLModules !== null;
}

/**
 * Start loading deck.gl in the background so the first `<.deckgl_layer>` mount
 * does not have to wait for the network.
 */
export function preloadDeckGL(): void {
  if (!deckGLModules && !loadingPromise) {
    loadDeckGL().catch(() => {
      // Preloading is best-effort; loadDeckGL already reported the failure.
    });
  }
}

/**
 * Clear the module cache. Useful in tests.
 */
export function clearDeckGLCache(): void {
  deckGLModules = null;
  loadingPromise = null;
}
