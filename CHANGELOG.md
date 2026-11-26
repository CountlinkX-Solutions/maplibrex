# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An optional `events` attribute on every component that pushes events to
  the LiveView ([#45], in part): a list of event names, such as
  `events={["map:moved", "map:clicked"]}`. When it is given, the component
  pushes only those events, so a LiveView no longer needs a `handle_event/3`
  clause for the others and they cost no round trip; an empty list pushes
  none. Without it, every event is pushed, as before. It applies to `map`,
  `marker`, `popup`, `geolocate_control`, `fullscreen_control`,
  `terrain_control`, `terrain`, `sky`, `deckgl_layer`, `geojson_layer`, the
  layer components and the source components. [#45] stays open for 1.0,
  when components will push only the events asked for.

### Changed

- A layer or source component whose id is already on the map when it mounts,
  from the map style, your own code or another component, no longer removes
  that layer or source when the component is removed ([#46]). In 0.2.0 it
  did, so a component sharing an id with a basemap layer deleted that part of
  the basemap when it went away. The component still takes the layer or
  source over: it applies the changes MapLibre can make in place (paint,
  layout, filter, zoom range and `before_id` for layers; new tiles, URL, image
  or coordinates for sources) and logs one console warning saying that the id
  was already in use. It pushes no `layer:added`/`layer:removed` or
  `source:added`/`source:removed` for it, and a change that would mean
  removing it (a new `source_id` or `source_layer`, a zoom bound that is no
  longer set, a source change MapLibre cannot make in place) is not applied,
  with a console warning. This covers the source and layer of
  `geojson_layer` too.
- What a component removes now follows what it added. Once a map style
  change drops a layer or source the component took over and the component
  adds it itself, it is the component's own: `layer:added` or `source:added`
  is pushed then, and the component removes it, and pushes `layer:removed` or
  `source:removed`, when it goes. The other way round, when a style change
  puts a layer or source with the same id in place of the component's own,
  the component leaves the style's on the map; it still pushes
  `layer:removed` or `source:removed` for its own. `terrain` likewise turns
  off only the terrain it set, not one with the same settings that a style
  change loaded.

### Fixed

- Events that could not be delivered surfaced as unhandled promise rejections
  (`Uncaught (in promise)` in the browser console), one per event pushed
  while the LiveView was disconnected, for example while the socket
  reconnected after a deploy ([#23]). Every hook now pushes through one
  helper that drops such events quietly: they are notifications, and nobody
  waits for them.
- The docs of `image_source` and `video_source` listed events their hooks
  never push (`source:loaded`, `video:loaded`, `video:error`), and those of
  `vector_tile_source`, `raster_tile_source`, `raster_dem_source` and `sky`
  left out events they do push ([#28], in part). Each component's docs now
  list the events it pushes, the names the `events` attribute takes.

## [0.2.0] - 2026-11-26

Layers, sources and terrain now stay on the map for as long as their
components live. Component attributes, hook names, event names and payload
keys are unchanged, but some behaviour you can notice has changed: some events
arrive at a different moment or no longer at all, some console messages are
gone, and content nested in `<.map>` is now rendered after the map element.
See **Changed**.

### Added

- Source components apply changes after mount. New `tiles` or `url` on
  `vector_tile_source`, `raster_tile_source` and `raster_dem_source`, a new
  image `url` and new `coordinates` on `image_source`, and new `coordinates`
  on `video_source` are applied to the source in place. Any other change
  replaces the source: every layer using it, from a component, the basemap or
  your own code, is taken off and put back at its place in the layer order.
  If MapLibre refuses the new source, the previous one is put back, and
  `source:error` is pushed when MapLibre threw.
- `geojson_layer` follows every attribute: `min_zoom`, `max_zoom`,
  `before_id`, `type` and the clustering attributes as well as `data`,
  `paint`, `layout` and `filter`. What the server commands
  `layer:set_paint_property`, `layer:set_layout_property`, `layer:set_filter`
  and `layer:set_data` set now survives map style changes and re-renders that
  leave that property alone; a re-render that changes the same property, or a
  later command, wins.
- `MapManager.whenReady(mapId, callback)` in the JavaScript API calls back
  with the map as soon as it is registered (at once if it already is) and
  returns a function that cancels the wait.

### Changed

- Content nested in `<.map>` is rendered right after the map element, as its
  sibling, instead of inside it ([#15]). The map element itself is unchanged,
  and so is a map with nothing nested in it. Visible content in the slot (a
  legend, say) is no longer inside the map container: it is laid out after
  the map instead of over it, and it is not part of the map in fullscreen. To
  show your own content on the map, use `control`, `control_button` or
  `control_group`, or position it in a wrapper of your own; the
  `MaplibreX.Components.Map` docs show both.
- `layer:added`, `source:added` and `terrain:enabled` are pushed once, when
  the layer, source or terrain is actually on the map for the first time.
  That can be well after the component mounts (once its map, its style or its
  source is there), and they are not pushed again when a style change or an
  update puts the item back. In 0.1.1 `layer:added` was also pushed when
  MapLibre had refused the layer.
- `source:removed` is pushed only once the source is really gone ([#18]). A
  source component removed while layers still use the source now leaves the
  source on the map until the last of those layers is removed, then removes
  it and pushes `source:removed`. In 0.1.1 MapLibre refused the removal while
  `source:removed` was pushed anyway.
- `layer:removed` and `source:removed` are also pushed when the component's
  map was removed before the component; 0.1.1 skipped them then.
- A source or layer component whose id is already on the map (from the map
  style or from your own code) takes it over: it applies its own updates to
  it and removes it when the component is removed. Until the component adds
  the source or layer itself (after a map style change drops it, for
  example), it pushes no `source:added`/`source:removed` or
  `layer:added`/`layer:removed` for it. A layer taken over this way still
  reports clicks and hovers with `layer:feature_*`. In 0.1.1 a source
  component logged `Source "<id>" already exists` and left the source alone,
  and a layer component pushed `layer:added` although MapLibre had refused
  the duplicate layer.
- Layer, source, `geojson_layer` and `terrain` components no longer log
  `Map "<id>" not found` when they mount before their map: they wait for it.
- A layer whose source is not on the map yet logs one console warning (none
  when a source component with that id is about to add it) and is added once
  the source appears. A `before_id` naming a layer that is not on the map logs
  one warning; the layer is added on top and moves under that layer once it
  appears. In 0.1.1 both layers stayed off the map.
- `terrain` no longer logs an error and pushes `terrain:error` when its
  `raster_dem_source` is not on the map yet: it logs one warning (none when a
  source component is about to add the source) and turns the terrain on once
  the source appears. `terrain:error` now means MapLibre failed to set the
  terrain. `terrain:disabled` is pushed only when the component turns its own
  terrain off; a terrain set since by something else is left on.
- Fewer `map:error` events and `[MaplibreX] Map error` console messages: the
  components no longer make MapLibre refuse a layer whose id is already on
  the map, a `before_id` naming a missing layer, or the removal of a source
  that layers still use.

### Fixed

- Layer and source components ignored assign changes after mount ([#3], for
  layers and sources). The nine layer components now apply new `paint`,
  `layout`, `filter`, `min_zoom`, `max_zoom` and `before_id` in place; a
  paint or layout property or a filter removed from the assigns goes back to
  its default, and a new `source_id` or `source_layer`, or a zoom bound that
  is no longer set, re-adds the layer. Sources: see **Added**. `terrain` now
  applies a new `source_id` or `exaggeration` at any time; it dropped them
  while tiles were loading. Controls still ignore assign changes ([#3] stays
  open for them), and so does the map for `bounds`, `max_bounds`, the zoom
  and pitch limits, `interactive` and `attribution_control` ([#26]).
- Changing the map style removed every source, layer and terrain added by
  components ([#4]). Layer, source, `geojson_layer` and `terrain` components
  now put their content back after any style change, as currently
  configured. After a basemap switch a component layer with no `before_id`
  is on top again, one with a `before_id` is under that layer, and component
  layers keep the order they were first added in.
- A layer mounted before its source was never added ([#5]); a `terrain`
  mounted before its DEM source reported an error and stayed off. Both now
  wait for the source, however late it comes.
- Layers, sources and terrain mounted after the map's first load while tiles
  were still loading could be skipped: they waited for a `load` event that
  had already fired ([#12]). They are now added as soon as the style accepts
  them.
- Components nested in `<.map>` were never patched: they kept their first
  assigns, and nested components behind `:if` or `:for` never mounted or
  unmounted ([#15]). They now behave like components rendered next to the
  map.
- A map given a style object (an Elixir map rather than a URL) as its `style`
  called `setStyle` again on every change to any other map assign, and
  MapLibre's style diff dropped every source and layer the components had
  added ([#16]). The style is now compared by value and applied only when it
  really changes.
- Layer, source, `geojson_layer` and `terrain` components mounted before their
  map gave up for good ([#17]). They now attach once the map is registered,
  whatever the template order. Markers, popups and controls still need their
  map to be rendered first.
- A source removed while a layer still used it stayed on the map but reported
  `source:removed` ([#18]); see **Changed**.
- `geojson_layer` often never sent `layer:source_loaded`: its one-time
  `sourcedata` listener was taken by whichever source reported first, and it
  outlived the hook ([#20]). It is now pushed once, when the layer's own
  source has loaded, from a listener removed with the hook.
- The README's installation steps did not work in an application generated
  by `mix phx.new` ([#41], [#42]). They now add `assets/node_modules` to
  esbuild's `NODE_PATH`, mark deck.gl as external when it is not installed,
  serve maplibre-gl v6's worker files, and cover `path:` dependencies.

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
  final position. A rebuild requested while the user drags the marker waits
  for the drag to end, so it never cuts the drag or its `marker:drag_end`
  short, and a `lng_lat` sent during a drag is not applied.
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
[#3]: https://github.com/CountlinkX-Solutions/maplibrex/issues/3
[#4]: https://github.com/CountlinkX-Solutions/maplibrex/issues/4
[#5]: https://github.com/CountlinkX-Solutions/maplibrex/issues/5
[#6]: https://github.com/CountlinkX-Solutions/maplibrex/issues/6
[#7]: https://github.com/CountlinkX-Solutions/maplibrex/issues/7
[#8]: https://github.com/CountlinkX-Solutions/maplibrex/issues/8
[#9]: https://github.com/CountlinkX-Solutions/maplibrex/issues/9
[#12]: https://github.com/CountlinkX-Solutions/maplibrex/issues/12
[#15]: https://github.com/CountlinkX-Solutions/maplibrex/issues/15
[#16]: https://github.com/CountlinkX-Solutions/maplibrex/issues/16
[#17]: https://github.com/CountlinkX-Solutions/maplibrex/issues/17
[#18]: https://github.com/CountlinkX-Solutions/maplibrex/issues/18
[#20]: https://github.com/CountlinkX-Solutions/maplibrex/issues/20
[#23]: https://github.com/CountlinkX-Solutions/maplibrex/issues/23
[#26]: https://github.com/CountlinkX-Solutions/maplibrex/issues/26
[#28]: https://github.com/CountlinkX-Solutions/maplibrex/issues/28
[#41]: https://github.com/CountlinkX-Solutions/maplibrex/issues/41
[#42]: https://github.com/CountlinkX-Solutions/maplibrex/issues/42
[#45]: https://github.com/CountlinkX-Solutions/maplibrex/issues/45
[#46]: https://github.com/CountlinkX-Solutions/maplibrex/issues/46
[Unreleased]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/CountlinkX-Solutions/maplibrex/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/CountlinkX-Solutions/maplibrex/releases/tag/v0.1.0
