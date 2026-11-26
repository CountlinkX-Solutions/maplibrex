# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-25

Bugfix release. There are no breaking changes.

### Fixed

- `control`, `control_button` and `control_group` never became map controls,
  and `zoom_range` never reacted to the zoom: their hooks (`ControlHook`,
  `ControlButtonHook`, `ControlGroupHook`, `ZoomRangeHook`) were implemented but
  missing from `MapHooks` and the named exports ([#2]). `control_button` also
  now forwards its `phx-click`, `phx-click-away`, `phx-keydown`, `phx-keyup`,
  `phx-focus` and `phx-blur` bindings, with `phx-value-*`, `phx-key`,
  `phx-target`, `phx-debounce`, `phx-throttle` and `phx-disable-with`, to its
  button, which the map moves out of the component's wrapper element.
  `phx-window-*` bindings stay on the wrapper, where they already work.
- Controls survive LiveView re-renders: a re-render of `control`,
  `control_button` or `control_group` put the control's content back into the
  component's hidden wrapper, leaving an empty box on the map. The content now
  stays on the map with its newly rendered state, and removing the component
  removes it from the map ([#2]).
- `geojson_layer` left its click and hover listeners attached when destroyed, so
  remounting a layer with the same id pushed every feature event more than once
  ([#6]).
- Layer feature events were inconsistent between components ([#7]). Every
  `layer:*` event now carries both `"layer_id"` (canonical, as the other layer
  components already sent) and `"layerId"` (kept so existing `geojson_layer`
  handlers keep matching). The README and the `MaplibreX` moduledoc listed
  `layer:feature_click`; the emitted event is `layer:feature_clicked`, and the
  docs now say so.
- `marker` attached its drag listeners only when it was draggable at mount, so
  enabling `draggable` later produced no `marker:drag_*` events ([#8]). Updates
  to `color`, `scale`, `anchor`, `offset`, `pitch_alignment` and
  `rotation_alignment` are now applied (color, scale and anchor rebuild the
  marker, keeping position, popup and drag state), `marker:dragging` is
  throttled to one event per 50 ms, and `marker:drag_end` always carries the
  final position.
- Server-pushed map events (`map:fly_to`, `map:jump_to`, `map:fit_bounds`,
  `map:set_style`, `map:set_bearing`, `map:set_pitch`, `map:reset_north`,
  `map:zoom_in`, `map:zoom_out`) were applied by every map on the page ([#9]).

### Added

- Server-pushed map events accept an optional `id` in the payload. A map ignores
  an event whose `id` is not its own; without an `id` every map reacts, as
  before.

### Development

- Hook tests: vitest with a `maplibre-gl` mock, run with `npm test` in `assets/`
  and in CI.

## [0.1.0] - 2026-08-24

First public release.

### Components

**Core**

- `map` — MapLibre GL JS map with reactive center, zoom, bearing, pitch, style
  and bounds

**Overlays**

- `marker` — markers with drag & drop and attached popups
- `popup` — standalone popups with HTML content and programmatic control

**Layers**

- `geojson_layer` — generic GeoJSON rendering with clustering and feature events
- `circle_layer`, `line_layer`, `fill_layer`, `symbol_layer`, `heatmap_layer`,
  `fill_extrusion_layer`, `background_layer`, `hillshade_layer`, `raster_layer`

**Sources**

- `vector_tile_source`, `raster_tile_source`, `raster_dem_source`,
  `image_source`, `video_source`

**Controls**

- `navigation_control`, `scale_control`, `fullscreen_control`,
  `geolocate_control`, `attribution_control`, `terrain_control`
- `control`, `control_button`, `control_group`, `zoom_range` — building blocks
  for custom controls

**3D & terrain**

- `terrain` — 3D terrain with configurable exaggeration
- `sky` — atmospheric sky layer for 3D views

**Advanced integrations**

- `deckgl_layer` — deck.gl layers, lazy-loaded on first use
- `custom_layer` — custom WebGL layers with user-supplied GLSL shaders

### Fixed

- Source components no longer send `minzoom`, `maxzoom`, `tileSize`, `scheme`
  or `encoding` unless set explicitly. They defaulted to MapLibre's own values
  and were serialised unconditionally, which overrode whatever the TileJSON
  declared — a terrarium DEM was decoded as Mapbox Terrain-RGB and rendered
  as spikes, and `maxzoom: 22` requested tiles servers do not have.
- `map` accepts `min_pitch` and `max_pitch`. MapLibre caps pitch at 60 and
  silently clamps anything above it, so a 3D terrain view asking for 70 was
  flattened with no indication why.
- `map`'s numeric attributes are no longer typed `:integer`. `zoom={3.5}`,
  `bearing={-17.6}` and fractional pitch are all valid MapLibre values.

- The map container is rendered with `phx-update="ignore"`. Without it, any
  LiveView re-render that touched the map element's dynamics patched the
  container away: MapLibre kept rendering into a detached node while the page
  showed an empty `<div>`. LiveView still merges `data-*` attributes onto
  ignored elements, so reactivity is unaffected.
- `FullscreenControl` events are subscribed on the control rather than on the
  map. `FullscreenControl` is its own `Evented` and never fires through the
  map, so `fullscreen:entered` and `fullscreen:exited` had never reached
  LiveView.

### Architecture

- TypeScript hook layer with a singleton `MapManager` and a bidirectional
  `EventDispatcher`
- Map commands (`fly_to`, `jump_to`, `fit_bounds`, `set_style`, `zoom_in`,
  `zoom_out`, `reset_north`) run client-side via `Phoenix.LiveView.JS.dispatch/3`,
  with no server round-trip
- `map:moved` is debounced by 150 ms to cut socket traffic during continuous
  pan and zoom
- deck.gl is dynamically imported the first time a `deckgl_layer` mounts. The
  layer factory and overlay manager resolve their constructors through the
  lazy loader rather than importing them, so the split actually holds — an
  earlier static import in `deckgl-manager` and `deckgl-layer-factory` had been
  pulling all of deck.gl into the main chunk
- Debug logging is gated behind `window.__MAPLIBREX_DEBUG__` or a map's
  `debug` attribute; warnings and errors always reach the console
- 405 tests covering rendered component output, attribute validation and
  edge cases

### Compatibility

- Requires Elixir 1.15 or later. `phoenix_live_view` requires it, so the
  earlier `~> 1.14` requirement was never actually satisfiable.

- Supports `maplibre-gl` `>=5.0.0 <7.0.0`. Verified in a browser against
  v5.24.0 and v6.6.0: all nine demo pages render, and reactivity, marker
  add/remove, client-side map commands and paint updates all behave the same
  on both.
- `<.deckgl_layer>` requires maplibre-gl v5. `@deck.gl/mapbox` reads the
  internal `map.transform` that v6 removed, so a deck.gl layer under v6 raises
  a message naming the constraint instead of failing inside deck.gl with
  `Cannot read properties of undefined (reading '_nearZ')`.
- Sources use `import * as maplibregl from 'maplibre-gl'`: v6 is ESM-only and
  dropped the default export. The namespace import works on both majors.

### Packaging

- Ships a prebuilt ESM bundle at
  `priv/static/assets/js/maplibrex.js` (~65 KB, 12 KB gzipped)
- `maplibre-gl` and the `@deck.gl/*` packages are peer dependencies rather than
  bundled, so an application never loads two copies of MapLibre GL

[#2]: https://github.com/CountlinkX-Solutions/maplibrex/issues/2
[#6]: https://github.com/CountlinkX-Solutions/maplibrex/issues/6
[#7]: https://github.com/CountlinkX-Solutions/maplibrex/issues/7
[#8]: https://github.com/CountlinkX-Solutions/maplibrex/issues/8
[#9]: https://github.com/CountlinkX-Solutions/maplibrex/issues/9
[Unreleased]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/CountlinkX-Solutions/maplibrex/releases/tag/v0.1.0
