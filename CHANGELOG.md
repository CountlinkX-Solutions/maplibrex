# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/CountlinkX-Solutions/maplibrex/releases/tag/v0.1.0
