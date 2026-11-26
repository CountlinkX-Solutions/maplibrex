/**
 * RasterTileSourceHook - Hook for the RasterTileSource component
 *
 * Keeps a raster tile source on the map, for satellite imagery and other
 * raster overlays. New tile URLs or a new TileJSON URL apply in place; other
 * changes (`tileSize`, `scheme`, ...) replace the source. The lifecycle and
 * events are createSourceHook's (source-hook.ts).
 */

import { TILE_UPDATES, createSourceHook } from './source-hook';

export const RasterTileSourceHook = createSourceHook({
  type: 'raster',
  name: 'raster tile source',
  keys: ['url', 'tiles', 'tileSize', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'tms', 'volatile'],
  inPlace: TILE_UPDATES,
  reportsEvents: true
});
