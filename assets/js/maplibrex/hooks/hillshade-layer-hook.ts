/**
 * HillshadeLayerHook - Hook for the HillshadeLayer component
 *
 * This hook manages a terrain hillshade layer in MapLibre GL JS,
 * rendering 3D relief from a raster-dem source.
 * It has no filter and reports no clicks or hovers.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook } from './layer-hook';

export const HillshadeLayerHook = createLayerHook({
  type: 'hillshade',
  name: 'hillshade layer',
  without: ['filter']
});
