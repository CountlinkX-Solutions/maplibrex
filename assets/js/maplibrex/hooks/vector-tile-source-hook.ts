/**
 * VectorTileSourceHook - Hook for the VectorTileSource component
 *
 * Keeps a vector tile source on the map, for layers to draw from. New tile
 * URLs or a new TileJSON URL apply in place; other changes replace the
 * source. The lifecycle and events are createSourceHook's (source-hook.ts).
 */

import { TILE_UPDATES, createSourceHook } from './source-hook';

export const VectorTileSourceHook = createSourceHook({
  type: 'vector',
  name: 'vector tile source',
  keys: ['url', 'tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'promoteId', 'volatile'],
  inPlace: TILE_UPDATES,
  reportsEvents: true
});
