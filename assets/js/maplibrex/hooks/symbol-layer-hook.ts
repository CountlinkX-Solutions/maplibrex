/**
 * SymbolLayerHook - Hook for the SymbolLayer component
 *
 * This hook manages a symbol layer in MapLibre GL JS,
 * rendering icons and/or text with configurable styling.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook, firstFeature } from './layer-hook';

export const SymbolLayerHook = createLayerHook({
  type: 'symbol',
  name: 'symbol layer',
  featurePayload: firstFeature
});
