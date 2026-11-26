/**
 * HeatmapLayerHook - Hook for the HeatmapLayer component
 *
 * This hook manages a heatmap layer in MapLibre GL JS,
 * visualising the density and concentration of data points.
 * A heatmap layer has no layout and reports no clicks or hovers.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook } from './layer-hook';

export const HeatmapLayerHook = createLayerHook({
  type: 'heatmap',
  name: 'heatmap layer',
  without: ['layout']
});
