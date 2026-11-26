/**
 * FillExtrusionLayerHook - Hook for the FillExtrusionLayer component
 *
 * This hook manages an extruded 3D polygon layer in MapLibre GL JS,
 * commonly used for buildings and height-based data visualisations.
 * Its click and hover events carry every feature under the pointer
 * and where it is.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook, allFeaturesAndLngLat } from './layer-hook';

export const FillExtrusionLayerHook = createLayerHook({
  type: 'fill-extrusion',
  name: 'fill extrusion layer',
  featurePayload: allFeaturesAndLngLat
});
