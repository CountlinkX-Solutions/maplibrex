/**
 * BackgroundLayerHook - Hook for the BackgroundLayer component
 *
 * This hook manages a background layer in MapLibre GL JS,
 * rendering a solid colour or pattern as the map's base.
 * It has no source, source layer or filter and reports no clicks or hovers.
 *
 * When the layer is added, updated, put back after a style change and
 * removed is common to every layer hook: see `createLayerHook`.
 */

import { createLayerHook } from './layer-hook';

export const BackgroundLayerHook = createLayerHook({
  type: 'background',
  name: 'background layer',
  without: ['source', 'sourceLayer', 'filter']
});
