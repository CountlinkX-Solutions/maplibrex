/**
 * ImageSourceHook - Hook for the ImageSource component
 *
 * Keeps a georeferenced image source on the map, for radar overlays,
 * historical maps, scanned imagery and the like. A new image (`updateImage`)
 * and new corner coordinates (`setCoordinates`) apply in place. The lifecycle
 * and events are createSourceHook's (source-hook.ts); like before, it pushes
 * no `source:data`.
 */

import { createSourceHook } from './source-hook';

export const ImageSourceHook = createSourceHook({
  type: 'image',
  name: 'image source',
  keys: ['url', 'coordinates'],
  inPlace: {
    url: { method: 'updateImage', args: (spec) => [{ url: spec.url, coordinates: spec.coordinates }] },
    coordinates: { method: 'setCoordinates', args: (spec) => [spec.coordinates] }
  }
});
