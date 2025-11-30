# MaplibreX

[![Hex.pm](https://img.shields.io/hexpm/v/maplibrex.svg)](https://hex.pm/packages/maplibrex)
[![Documentation](https://img.shields.io/badge/documentation-gray)](https://hexdocs.pm/maplibrex)
[![License](https://img.shields.io/hexpm/l/maplibrex.svg)](https://github.com/tu-usuario/maplibrex/blob/main/LICENSE)

MapLibre GL JS components for Phoenix LiveView. Build interactive, declarative maps in your Elixir applications with ease.

Inspired by [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre), MaplibreX brings the same declarative approach to Phoenix LiveView.

## Features

- 🗺️ **Declarative Components** - Use familiar Phoenix LiveView component syntax
- ⚡ **Reactive** - Maps automatically update when assigns change
- 🎯 **Type-Safe** - Built with TypeScript for better DX
- 🔄 **Bidirectional Events** - Full event handling between LiveView and MapLibre
- 🎨 **Customizable** - Style maps with any MapLibre-compatible style
- 📦 **Self-Contained** - All assets bundled, no CDN required
- 🧪 **Well-Tested** - Comprehensive unit and E2E tests

## Installation

Add `maplibrex` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:maplibrex, "~> 0.1.0"}
  ]
end
```

Then run:

```bash
mix deps.get
cd assets && npm install
```

## Setup

### 1. Configure esbuild

MaplibreX requires esbuild for bundling. Add this to your `config/config.exs`:

```elixir
config :esbuild,
  version: "0.17.11",
  default: [
    args: ~w(js/app.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/*),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]
```

### 2. Import and register hooks

In your `assets/js/app.js`, import and register the MaplibreX hooks:

```javascript
import { Socket } from "phoenix"
import { LiveSocket } from "phoenix_live_view"
import { MapHooks } from "../../deps/maplibrex/priv/static/assets/js/maplibrex"

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
let liveSocket = new LiveSocket("/live", Socket, {
  hooks: MapHooks,
  params: {_csrf_token: csrfToken}
})

liveSocket.connect()
```

### 3. Import CSS

In your `assets/css/app.css`, import the MaplibreX styles:

```css
@import "../../deps/maplibrex/priv/static/assets/css/maplibrex.css";
```

### 4. Configure (Optional)

Optionally configure default values in `config/config.exs`:

```elixir
config :maplibrex,
  default_style: "https://demotiles.maplibre.org/style.json",
  default_center: [0, 0],
  default_zoom: 10
```

## Usage

### Basic Map

```elixir
defmodule MyAppWeb.MapLive do
  use MyAppWeb, :live_view
  import MaplibreX.Components

  def render(assigns) do
    ~H"""
    <.map
      id="my-map"
      center={[-74.5, 40]}
      zoom={9}
      style="https://demotiles.maplibre.org/style.json"
      class="h-96"
    />
    """
  end
end
```

### Interactive Map with Event Handling

```elixir
defmodule MyAppWeb.InteractiveMapLive do
  use MyAppWeb, :live_view
  import MaplibreX.Components

  def mount(_params, _session, socket) do
    {:ok,
     assign(socket,
       center: [-74.5, 40],
       zoom: 9,
       clicked_location: nil
     )}
  end

  def render(assigns) do
    ~H"""
    <div class="space-y-4">
      <.map
        id="interactive-map"
        center={@center}
        zoom={@zoom}
        style="https://demotiles.maplibre.org/style.json"
        class="h-96"
      />

      <div :if={@clicked_location}>
        Clicked at: <%= inspect(@clicked_location) %>
      </div>

      <div class="flex gap-2">
        <button
          phx-click={MaplibreX.Components.Map.fly_to("interactive-map", [-73.98, 40.75], 12)}
          class="btn"
        >
          Fly to NYC
        </button>

        <button
          phx-click={MaplibreX.Components.Map.zoom_in("interactive-map")}
          class="btn"
        >
          Zoom In
        </button>

        <button
          phx-click={MaplibreX.Components.Map.zoom_out("interactive-map")}
          class="btn"
        >
          Zoom Out
        </button>
      </div>
    </div>
    """
  end

  def handle_event("map:clicked", %{"lngLat" => lngLat}, socket) do
    {:noreply, assign(socket, clicked_location: lngLat)}
  end

  def handle_event("map:moved", %{"center" => center, "zoom" => zoom}, socket) do
    {:noreply, assign(socket, center: center, zoom: zoom)}
  end
end
```

### Map with Custom Styling

```elixir
<.map
  id="styled-map"
  center={[-122.4, 37.8]}
  zoom={10}
  style="https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY"
  bearing={45}
  pitch={60}
  min_zoom={5}
  max_zoom={18}
  class="h-screen w-full rounded-lg shadow-lg"
/>
```

## Available Components

### Map Component

The main map component with full configuration options.

**Attributes:**
- `id` (required) - Unique identifier
- `center` - Center coordinates `[lng, lat]`
- `zoom` - Zoom level (0-22)
- `style` - Map style URL or object
- `bearing` - Map rotation (0-360)
- `pitch` - Map tilt (0-60)
- `min_zoom` - Minimum zoom level
- `max_zoom` - Maximum zoom level
- `bounds` - Fit map to bounds
- `max_bounds` - Restrict panning to bounds
- `interactive` - Enable/disable interactions
- `attribution_control` - Show/hide attribution

**Events:**
- `map:moved` - Map moved (pan, zoom, rotate)
- `map:clicked` - Map clicked
- `map:loaded` - Map finished loading
- `map:zoom_changed` - Zoom level changed
- `map:error` - Error occurred

### Marker Component

Add markers to your map with full customization.

**Attributes:**
- `id` (required) - Unique identifier
- `map_id` (required) - ID of the map
- `lng_lat` (required) - Position `[lng, lat]`
- `color` - Marker color
- `scale` - Marker size
- `rotation` - Rotation in degrees
- `draggable` - Enable dragging
- `popup_text` - Simple popup text
- `popup_html` - Custom popup HTML

**Events:**
- `marker:clicked` - Marker clicked
- `marker:drag_start` - Drag started
- `marker:dragging` - While dragging
- `marker:drag_end` - Drag ended

### Popup Component

Display popups on the map at specific coordinates.

**Attributes:**
- `id` (required) - Unique identifier
- `map_id` (required) - ID of the map
- `lng_lat` - Position `[lng, lat]` (optional, can be set later)
- `max_width` - Maximum popup width
- `close_button` - Show close button
- `close_on_click` - Close on map click
- `close_on_move` - Close on map move
- `anchor` - Anchor position
- `offset` - Pixel offset
- `open` - Initially open/closed

**Events:**
- `popup:opened` - Popup opened
- `popup:closed` - Popup closed

### GeoJSON Layer Component

Render GeoJSON data with full styling control.

**Attributes:**
- `id` (required) - Unique identifier
- `map_id` (required) - ID of the map
- `data` (required) - GeoJSON data
- `type` (required) - Layer type: `fill`, `line`, `circle`, `symbol`, `heatmap`, `fill-extrusion`
- `paint` - Paint properties for styling
- `layout` - Layout properties
- `filter` - Filter expression
- `min_zoom` / `max_zoom` - Zoom constraints
- `cluster` - Enable point clustering
- `cluster_max_zoom` / `cluster_radius` - Clustering options

**Events:**
- `layer:feature_clicked` - Feature clicked
- `layer:feature_mouseenter` - Mouse enters feature
- `layer:feature_mouseleave` - Mouse leaves feature
- `layer:source_loaded` - Source data loaded

### Navigation Control Component

Add standard navigation controls (zoom and compass) to your map.

**Attributes:**
- `id` (required) - Unique identifier
- `map_id` (required) - ID of the map
- `position` - Control position (`top-left`, `top-right`, `bottom-left`, `bottom-right`)
- `show_compass` - Show compass button (default: `true`)
- `show_zoom` - Show zoom buttons (default: `true`)
- `visualize_pitch` - Show pitch visualization (default: `false`)

### Scale Control Component

Display a scale bar showing map distance ratios.

**Attributes:**
- `id` (required) - Unique identifier
- `map_id` (required) - ID of the map
- `position` - Control position (default: `bottom-left`)
- `max_width` - Maximum width in pixels (default: `100`)
- `unit` - Unit of measurement: `imperial`, `metric`, `nautical` (default: `metric`)

## JavaScript Commands

Send commands from LiveView to control the map:

```elixir
# Fly to a location with animation
MaplibreX.Components.Map.fly_to("map-id", [-74.5, 40], 12, duration: 2000)

# Jump to a location instantly
MaplibreX.Components.Map.jump_to("map-id", [-74.5, 40], 12)

# Fit to bounds
MaplibreX.Components.Map.fit_bounds("map-id", [[-74, 40], [-73, 41]], padding: 50)

# Change style
MaplibreX.Components.Map.set_style("map-id", "new-style-url")

# Zoom in/out
MaplibreX.Components.Map.zoom_in("map-id")
MaplibreX.Components.Map.zoom_out("map-id")

# Reset bearing to north
MaplibreX.Components.Map.reset_north("map-id")
```

## Development

```bash
# Install dependencies
mix deps.get
cd assets && npm install

# Run tests
mix test

# Build assets
mix assets.build

# Watch assets during development
mix assets.watch

# Generate documentation
mix docs
```

## Testing

MaplibreX includes comprehensive testing support:

```elixir
# In your test file
defmodule MyAppWeb.MapLiveTest do
  use MyAppWeb.ConnCase, async: true
  import Phoenix.LiveViewTest

  test "renders map", %{conn: conn} do
    {:ok, view, html} = live(conn, "/map")
    
    assert html =~ "maplibrex-map"
    assert has_element?(view, "#my-map")
  end

  test "handles map click events", %{conn: conn} do
    {:ok, view, _html} = live(conn, "/map")
    
    # Simulate map click
    view
    |> element("#my-map")
    |> render_hook("map:clicked", %{
      "lngLat" => [-74.5, 40],
      "point" => [100, 200]
    })
    
    # Assert state updated
    assert view |> element("#clicked-location") |> render() =~ "-74.5"
  end
end
```

## Architecture

MaplibreX follows best practices from both the Elixir and JavaScript ecosystems:

- **TypeScript Core**: Type-safe JavaScript with full MapLibre GL JS types
- **Singleton Pattern**: Efficient map instance management
- **Event Dispatcher**: Bidirectional communication between LiveView and MapLibre
- **Reactive Components**: Automatic updates when assigns change
- **Hook Lifecycle**: Proper cleanup and reconnection handling

## Inspiration

This library is inspired by [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre) and aims to bring the same declarative, component-based approach to Phoenix LiveView.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MaplibreX is released under the MIT License. See [LICENSE](LICENSE) for details.

## Credits

- MapLibre GL JS team for the excellent mapping library
- [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre) for inspiration
- Phoenix and Elixir communities

## Support

- 📚 [Documentation](https://hexdocs.pm/maplibrex)
- 🐛 [Issue Tracker](https://github.com/tu-usuario/maplibrex/issues)
- 💬 [Discussions](https://github.com/tu-usuario/maplibrex/discussions)
