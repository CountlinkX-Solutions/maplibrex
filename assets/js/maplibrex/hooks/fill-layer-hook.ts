/**
 * FillLayerHook - Hook for the FillLayer component
 *
 * This hook manages a filled polygon layer in MapLibre GL JS,
 * rendering configurable areas for regions and zones.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook, firstFeature } from './layer-hook';

export const FillLayerHook = createLayerHook({
  type: 'fill',
  name: 'fill layer',
  featurePayload: firstFeature
});
