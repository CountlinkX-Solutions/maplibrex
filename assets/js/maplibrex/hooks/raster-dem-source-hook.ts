/**
 * RasterDEMSourceHook - Hook for the RasterDEMSource component
 *
 * Keeps a DEM (digital elevation model) source on the map, for terrain,
 * hillshading and 3D rendering. New tile URLs or a new TileJSON URL apply in
 * place; other changes (`tileSize`, `encoding`, ...) replace the source. The
 * lifecycle and events are createSourceHook's (source-hook.ts).
 */

import { TILE_UPDATES, createSourceHook } from './source-hook';

export const RasterDEMSourceHook = createSourceHook({
  type: 'raster-dem',
  name: 'raster DEM source',
  keys: ['url', 'tiles', 'tileSize', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'encoding', 'volatile'],
  inPlace: TILE_UPDATES,
  reportsEvents: true
});
