# MaplibreX

[![Hex.pm](https://img.shields.io/hexpm/v/maplibrex.svg)](https://hex.pm/packages/maplibrex)
[![Documentation](https://img.shields.io/badge/hexdocs-documentation-blue)](https://hexdocs.pm/maplibrex)
[![License](https://img.shields.io/hexpm/l/maplibrex.svg)](https://github.com/CountlinkX-Solutions/maplibrex/blob/main/LICENSE)

[MapLibre GL JS](https://maplibre.org/) as declarative Phoenix LiveView components.
Build interactive maps with assigns and `handle_event/3` instead of hand-written
JavaScript.

Inspired by [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre).

```elixir
def render(assigns) do
  ~H"""
  <.map id="map" center={@center} zoom={@zoom} class="h-96 w-full" />
  <.navigation_control id="nav" map_id="map" position="top-left" />

  <.marker :for={city <- @cities} id={city.id} map_id="map"
           lng_lat={city.coords} color="#22d3ee" popup_text={city.name} />
  """
end

def handle_event("map:moved", %{"center" => center, "zoom" => zoom}, socket) do
  {:noreply, assign(socket, center: center, zoom: zoom)}
end
```

## Why

- **Declarative** — components and assigns, not imperative JS glue.
- **Reactive** — the map follows your assigns; events flow back into `handle_event/3`.
- **Small** — the published bundle is ~65 KB (12 KB gzipped). MapLibre GL is a
  peer dependency, so there is never a second copy of it on the page.
- **Complete** — 32 components covering layers, sources, controls, 3D terrain,
  deck.gl and custom WebGL layers.
- **Typed** — the hook layer is written in TypeScript, type-checked in CI.
- **Tested** — 405 tests against the rendered component output.

## Installation

### 1. Add the dependency

```elixir
def deps do
  [
    {:maplibrex, "~> 0.1.0"}
  ]
end
```

### 2. Install the JavaScript peer dependencies

MaplibreX does not bundle MapLibre GL — your application owns that version.

```bash
npm install --prefix assets maplibre-gl
```

Only if you plan to use `<.deckgl_layer>` (these are lazy-loaded at runtime, so
skip them otherwise):

```bash
npm install --prefix assets @deck.gl/core @deck.gl/layers \
                            @deck.gl/aggregation-layers @deck.gl/mapbox
```

#### Which MapLibre GL version?

MaplibreX supports `>=5.0.0 <7.0.0`.

| | maplibre-gl v5 | maplibre-gl v6 |
| --- | --- | --- |
| Every component except `deckgl_layer` | ✅ | ✅ |
| `<.deckgl_layer>` | ✅ | ❌ |

deck.gl is the single exception: `@deck.gl/mapbox` reads MapLibre's internal
`map.transform`, which v6 removed. Every published version, including the 9.4
alphas, still does. If you use `<.deckgl_layer>`, pin `maplibre-gl` to
`^5.0.0`; MaplibreX raises a message saying exactly this rather than letting
deck.gl fail with an opaque error.

Note that maplibre-gl v6 is ESM-only, so your `app.js` must be loaded as
`<script type="module">`.

### 3. Register the hooks

In `assets/js/app.js`:

```javascript
import { MapHooks } from "maplibrex"

let liveSocket = new LiveSocket("/live", Socket, {
  hooks: { ...MapHooks },
  params: { _csrf_token: csrfToken }
})
```

The bare `"maplibrex"` import resolves through `NODE_PATH`, the same mechanism
Phoenix already uses for `phoenix` and `phoenix_live_view`. A generated Phoenix
app has this in `config/config.exs` already — confirm the `env:` line is there:

```elixir
config :esbuild,
  version: "0.25.4",
  my_app: [
    args: ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]
```

If you would rather not rely on `NODE_PATH`, import the bundle by path:

```javascript
import { MapHooks } from "../../deps/maplibrex/priv/static/assets/js/maplibrex.js"
```

### 4. Import the stylesheet

In `assets/css/app.css`:

```css
@import "maplibre-gl/dist/maplibre-gl.css";
@import "../../deps/maplibrex/assets/css/maplibrex.css";
```

### 5. Import the components

```elixir
defmodule MyAppWeb.MapLive do
  use MyAppWeb, :live_view
  import MaplibreX.Components

  # ...
end
```

## Configuration

Optional defaults, in `config/config.exs`:

```elixir
config :maplibrex,
  default_style: "https://demotiles.maplibre.org/style.json",
  default_center: [0, 0],
  default_zoom: 10
```

To see MaplibreX's lifecycle logging in the browser console, set
`window.__MAPLIBREX_DEBUG__ = true` before the bundle loads, or pass
`debug={true}` to a `<.map>`. Warnings and errors are always logged.

## Components

**Core** — `map`

**Overlays** — `marker`, `popup`

**Layers** — `geojson_layer`, `circle_layer`, `line_layer`, `fill_layer`,
`symbol_layer`, `heatmap_layer`, `fill_extrusion_layer`, `background_layer`,
`hillshade_layer`, `raster_layer`

**Sources** — `vector_tile_source`, `raster_tile_source`, `raster_dem_source`,
`image_source`, `video_source`

**Controls** — `navigation_control`, `scale_control`, `fullscreen_control`,
`geolocate_control`, `attribution_control`, `terrain_control`, `control`,
`control_button`, `control_group`, `zoom_range`

**3D & terrain** — `terrain`, `sky`

**Advanced** — `deckgl_layer`, `custom_layer`

Every component is documented with attributes, events and examples on
[HexDocs](https://hexdocs.pm/maplibrex).

## Events

Map events arrive in your LiveView as ordinary `handle_event/3` calls:

| Event | Payload |
| --- | --- |
| `map:loaded` | `%{"mapId" => id}` |
| `map:moved` | `%{"center" => [lng, lat], "zoom" => z, "bearing" => b, "pitch" => p}` |
| `map:clicked` | `%{"lngLat" => [lng, lat], "point" => [x, y]}` |
| `map:zoom_changed` | `%{"zoom" => z}` |
| `map:error` | `%{"error" => message}` |
| `marker:clicked` | `%{"markerId" => id, "lngLat" => [lng, lat]}` |
| `marker:drag_start` / `marker:dragging` / `marker:drag_end` | `%{"markerId" => id, "lngLat" => [lng, lat]}` |
| `layer:feature_click` | `%{"layerId" => id, "feature" => feature}` |

`map:moved` is debounced by 150 ms so continuous panning does not flood the
socket.

## Controlling the map

Map commands are `Phoenix.LiveView.JS` structs, so they run entirely on the
client with no server round-trip:

```elixir
alias MaplibreX.Components.Map

<button phx-click={Map.fly_to("map", [-74.5, 40], 12)}>Fly to NYC</button>
<button phx-click={Map.zoom_in("map")}>Zoom in</button>
<button phx-click={Map.fit_bounds("map", [[-74, 40], [-73, 41]], padding: 50)}>Fit</button>
```

Available: `fly_to/4`, `jump_to/4`, `fit_bounds/3`, `set_style/2`, `zoom_in/1`,
`zoom_out/1`, `reset_north/1`.

## Demo

A full Phoenix application exercising every component:
**[maplibrex_demo](https://github.com/CountlinkX-Solutions/maplibrex_demo)**

## Development

```bash
mix setup          # deps + npm install
mix test           # 405 tests
mix typecheck      # tsc --noEmit
mix ci             # format check, warnings-as-errors, credo, tests
mix assets.build   # development bundle
mix assets.watch   # rebuild on change
```

Publishing (the alias builds `priv/static` first — never run `mix hex.publish`
directly, or the package ships without its JavaScript):

```bash
MIX_ENV=prod mix publish
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and pull requests are
welcome.

## License

MIT — see [LICENSE](LICENSE).
