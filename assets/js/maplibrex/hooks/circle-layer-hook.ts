/**
 * CircleLayerHook - Hook for the CircleLayer component
 *
 * This hook manages a circle layer in MapLibre GL JS,
 * rendering points as circles with configurable styling.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook, firstFeature } from './layer-hook';

export const CircleLayerHook = createLayerHook({
  type: 'circle',
  name: 'circle layer',
  featurePayload: firstFeature
});
