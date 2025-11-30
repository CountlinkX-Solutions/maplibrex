defmodule MaplibreX do
  @moduledoc """
  MaplibreX - MapLibre GL JS Components for Phoenix LiveView

  MaplibreX provides declarative and reactive Phoenix LiveView components for
  integrating MapLibre GL JS maps into your Elixir applications.

  ## Installation

  Add `maplibrex` to your list of dependencies in `mix.exs`:

      def deps do
        [
          {:maplibrex, "~> 0.1.0"}
        ]
      end

  ## Configuration

  Configure MaplibreX in your `config/config.exs`:

      config :maplibrex,
        default_style: "https://demotiles.maplibre.org/style.json",
        default_center: [0, 0],
        default_zoom: 10

  ## Setup

  In your assets JavaScript file (e.g., `assets/js/app.js`), import and register the hooks:

      import { MapHooks } from "../deps/maplibrex/priv/static/assets/js/maplibrex"

      let liveSocket = new LiveSocket("/live", Socket, {
        hooks: MapHooks,
        params: {_csrf_token: csrfToken}
      })

  ## Usage

  Import the components in your LiveView module:

      defmodule MyAppWeb.MapLive do
        use MyAppWeb, :live_view
        import MaplibreX.Components

        def render(assigns) do
          ~H\"\"\"
          <.map
            id="my-map"
            center={[-74.5, 40]}
            zoom={9}
            style="https://demotiles.maplibre.org/style.json"
            class="h-96"
          />
          \"\"\"
        end
      end

  ## Components

  - `MaplibreX.Components.Map` - Main map component
  - `MaplibreX.Components.Marker` - Marker component (coming soon)
  - `MaplibreX.Components.Popup` - Popup component (coming soon)
  - `MaplibreX.Components.GeoJSONLayer` - GeoJSON layer component (coming soon)

  ## Events

  MaplibreX components emit various events that you can handle in your LiveView:

  - `map:moved` - When the map is moved
  - `map:clicked` - When the map is clicked
  - `map:loaded` - When the map finishes loading
  - `map:zoom_changed` - When the zoom level changes
  - `map:error` - When an error occurs

  Example event handling:

      def handle_event("map:clicked", %{"lngLat" => [lng, lat]}, socket) do
        IO.puts("Map clicked at: \#{lng}, \#{lat}")
        {:noreply, socket}
      end

  ## JavaScript Commands

  You can send commands to the map from your LiveView:

      # Fly to a location
      push_event(socket, "map:fly_to", %{
        center: [-74.5, 40],
        zoom: 12,
        duration: 2000
      })

      # Fit to bounds
      push_event(socket, "map:fit_bounds", %{
        bounds: [[-74, 40], [-73, 41]],
        padding: 50
      })
  """

  @doc """
  Returns the default configuration for MaplibreX.
  """
  def config do
    Application.get_all_env(:maplibrex)
  end

  @doc """
  Returns the default map style URL.
  """
  def default_style do
    Application.get_env(:maplibrex, :default_style, "https://demotiles.maplibre.org/style.json")
  end

  @doc """
  Returns the default map center coordinates.
  """
  def default_center do
    Application.get_env(:maplibrex, :default_center, [0, 0])
  end

  @doc """
  Returns the default zoom level.
  """
  def default_zoom do
    Application.get_env(:maplibrex, :default_zoom, 10)
  end
end
