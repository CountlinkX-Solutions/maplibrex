/**
 * Style readiness - when a map can accept `addSource` / `addLayer`
 *
 * `map.isStyleLoaded()` is not the right test for that: it is also false
 * while any tile is loading, so a component added while the user pans sees
 * `false` and waits for `load`, which fires once per map and has already
 * fired (#12). What `addSource` and `addLayer` actually need is the style
 * document itself: until it has loaded they throw "Style is not done
 * loading." (MapLibre's `Style._checkLoaded()`), afterwards they are accepted
 * whatever the tiles are doing.
 *
 * This module answers that question with public MapLibre API only, without
 * reading the internal `style._loaded` field, and waits for the next style
 * event when the answer is no.
 */

import type { Map } from 'maplibre-gl';

/**
 * The events that can follow the style document's arrival. MapLibre's
 * `Style._load` fires `data` with `dataType: 'style'` (relayed by the map as
 * `styledata`) and then `style.load`, on the initial load and after a full
 * style rebuild alike (maplibre-gl 5.0.0 and 6.5.0).
 */
const STYLE_EVENTS = ['styledata', 'style.load'] as const;

/**
 * Whether `map` can accept `addSource` / `addLayer` now: its style document
 * has loaded, even if tiles, sprites or glyphs are still loading.
 *
 * `map.listImages()` is the probe: it is public, cheap, has no side effects
 * and, in maplibre-gl 5.0.0 and 6.5.0, goes through the same
 * `Style._checkLoaded()` as `addSource` and `addLayer`, so it throws exactly
 * when they would. (`map.getStyle()` would also tell, by returning
 * `undefined`, but it serializes and clones every layer on each call.)
 */
export function isStyleReady(map: Map): boolean {
  try {
    map.listImages();
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `callback` as soon as `map` can accept `addSource` / `addLayer`: right
 * away (synchronously) if it already can, at any point in the map's life,
 * otherwise on the first style event after which it can.
 *
 * The callback runs at most once per call. A callback that throws is logged
 * and not rethrown, so it cannot break MapLibre's event dispatch (the rest of
 * a style load) for other listeners.
 *
 * @returns a function that cancels the call and removes every listener it
 *   added; a no-op once the callback has run
 */
export function whenStyleReady(map: Map, callback: () => void): () => void {
  if (isStyleReady(map)) {
    run(callback);
    return () => {};
  }

  let settled = false;
  const stop = () => {
    if (settled) return;
    settled = true;
    STYLE_EVENTS.forEach((type) => map.off(type, check));
  };
  function check() {
    if (settled || !isStyleReady(map)) return;
    stop();
    run(callback);
  }

  STYLE_EVENTS.forEach((type) => map.on(type, check));
  return stop;
}

function run(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    console.error('[MaplibreX] Error in a whenStyleReady callback:', error);
  }
}
