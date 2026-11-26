/**
 * VideoSourceHook - Hook for the VideoSource component
 *
 * Keeps a georeferenced video source on the map, for drone footage, cameras,
 * time-lapses and the like. New corner coordinates apply in place
 * (`setCoordinates`); new video URLs replace the source. The lifecycle and
 * events are createSourceHook's (source-hook.ts); like before, it pushes no
 * `source:data`.
 */

import { createSourceHook } from './source-hook';

export const VideoSourceHook = createSourceHook({
  type: 'video',
  name: 'video source',
  keys: ['urls', 'coordinates'],
  inPlace: {
    coordinates: { method: 'setCoordinates', args: (spec) => [spec.coordinates] }
  }
});
