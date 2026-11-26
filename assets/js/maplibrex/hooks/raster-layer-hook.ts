/**
 * RasterLayerHook - Hook for the RasterLayer component
 *
 * This hook manages a raster layer in MapLibre GL JS,
 * rendering image tiles from raster sources.
 * It has no source layer or filter and reports no clicks or hovers.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook } from './layer-hook';

export const RasterLayerHook = createLayerHook({
  type: 'raster',
  name: 'raster layer',
  without: ['sourceLayer', 'filter']
});
