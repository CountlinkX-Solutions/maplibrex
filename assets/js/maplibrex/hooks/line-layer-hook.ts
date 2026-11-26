/**
 * LineLayerHook - Hook for the LineLayer component
 *
 * This hook manages a line layer in MapLibre GL JS,
 * rendering configurable lines for routes, paths and connections.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook, firstFeature } from './layer-hook';

export const LineLayerHook = createLayerHook({
  type: 'line',
  name: 'line layer',
  featurePayload: firstFeature
});
