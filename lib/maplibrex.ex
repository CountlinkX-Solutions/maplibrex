defmodule MaplibreX do
  @moduledoc """
  MapLibre GL JS components for Phoenix LiveView.

  MaplibreX exposes MapLibre GL JS as declarative LiveView components: the map
  follows your assigns, and map interactions arrive as ordinary
  `handle_event/3` callbacks. See the [README](readme.html) for installation and
  the full component list.

  ## Quick start

      defmodule MyAppWeb.MapLive do
        use MyAppWeb, :live_view
        import MaplibreX.Components

        def mount(_params, _session, socket) do
          {:ok, assign(socket, center: [-74.5, 40], zoom: 9)}
        end

        def render(assigns) do
          ~H\"\"\"
          <.map id="my-map" center={@center} zoom={@zoom} class="h-96 w-full" />
          <.navigation_control id="nav" map_id="my-map" position="top-left" />
          \"\"\"
        end

        def handle_event("map:moved", %{"center" => center, "zoom" => zoom}, socket) do
          {:noreply, assign(socket, center: center, zoom: zoom)}
        end
      end

  ## Configuration

  Every value is optional; these are the defaults:

      config :maplibrex,
        default_style: "https://demotiles.maplibre.org/style.json",
        default_center: [0, 0],
        default_zoom: 10

  ## Events

  Components push these to your LiveView:

    * `map:loaded` - the map finished loading
    * `map:moved` - the map was panned, zoomed, rotated or pitched (debounced 150ms)
    * `map:clicked` - the map was clicked
    * `map:zoom_changed` - the zoom level changed
    * `map:error` - MapLibre reported an error
    * `marker:clicked`, `marker:drag_start`, `marker:dragging`, `marker:drag_end`
    * `layer:feature_click`, `layer:feature_mouseenter`, `layer:feature_mouseleave`

  ## Controlling the map

  Map commands are `Phoenix.LiveView.JS` structs, so they execute on the client
  with no server round-trip:

      alias MaplibreX.Components.Map

      <button phx-click={Map.fly_to("my-map", [-74.5, 40], 12)}>Fly to NYC</button>
      <button phx-click={Map.zoom_in("my-map")}>Zoom in</button>

  See `MaplibreX.Components.Map` for the full command set.
  """

  @default_style "https://demotiles.maplibre.org/style.json"
  @default_center [0, 0]
  @default_zoom 10

  @doc """
  Returns every configured value for `:maplibrex`.
  """
  @spec config() :: keyword()
  def config do
    Application.get_all_env(:maplibrex)
  end

  @doc """
  Returns the configured default map style URL.

  Defaults to `#{@default_style}`.
  """
  @spec default_style() :: String.t() | map()
  def default_style do
    Application.get_env(:maplibrex, :default_style, @default_style)
  end

  @doc """
  Returns the configured default map center as `[longitude, latitude]`.

  Defaults to `#{inspect(@default_center)}`.
  """
  @spec default_center() :: [number()]
  def default_center do
    Application.get_env(:maplibrex, :default_center, @default_center)
  end

  @doc """
  Returns the configured default zoom level.

  Defaults to `#{@default_zoom}`.
  """
  @spec default_zoom() :: number()
  def default_zoom do
    Application.get_env(:maplibrex, :default_zoom, @default_zoom)
  end

  @doc """
  Returns the installed MaplibreX version.
  """
  @spec version() :: String.t()
  def version do
    Application.spec(:maplibrex, :vsn) |> to_string()
  end
end
