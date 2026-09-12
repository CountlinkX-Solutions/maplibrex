defmodule MaplibreX.Components.Map do
  @moduledoc """
  Map component for rendering MapLibre GL JS maps in Phoenix LiveView.

  ## Examples

  Basic map:

      <.map
        id="my-map"
        center={[-74.5, 40]}
        zoom={9}
        style="https://demotiles.maplibre.org/style.json"
        class="h-96"
      />

  Map with all options:

      <.map
        id="detailed-map"
        center={[-74.5, 40]}
        zoom={9}
        style="https://demotiles.maplibre.org/style.json"
        min_zoom={5}
        max_zoom={15}
        bearing={0}
        pitch={0}
        interactive={true}
        attribution_control={true}
        class="h-screen w-full"
      />

  Map with event handling:

      def render(assigns) do
        ~H\"\"\"
        <.map
          id="interactive-map"
          center={@center}
          zoom={@zoom}
          style={@map_style}
          phx-click="map_clicked"
          class="h-96"
        />
        \"\"\"
      end

      def handle_event("map:clicked", %{"lngLat" => lngLat}, socket) do
        IO.inspect(lngLat, label: "Map clicked at")
        {:noreply, socket}
      end

      def handle_event("map:moved", %{"center" => center, "zoom" => zoom}, socket) do
        {:noreply, assign(socket, center: center, zoom: zoom)}
      end
  """

  use Phoenix.Component
  alias Phoenix.LiveView.JS

  @type center :: {float(), float()} | list(float())
  @type bounds :: {center(), center()} | list(center())

  @doc """
  Renders a MapLibre GL JS map component.

  ## Attributes

  * `id` (required) - Unique identifier for the map
  * `center` - Map center coordinates as `[longitude, latitude]`. Defaults to `[0, 0]`
  * `zoom` - Initial zoom level, fractional values allowed. Defaults to `10`
  * `style` - Map style URL or style object. Defaults to MaplibreX config
  * `min_zoom` - Minimum zoom level. Optional
  * `max_zoom` - Maximum zoom level. Optional
  * `min_pitch` - Minimum pitch in degrees. Optional
  * `max_pitch` - Maximum pitch in degrees, 0-85. Optional. MapLibre caps pitch
    at 60 by default and silently clamps anything above it, so a 3D terrain
    view that wants a steeper camera has to raise this
  * `bearing` - Initial bearing (rotation). Defaults to `0`
  * `pitch` - Initial pitch (tilt). Defaults to `0`
  * `fly` - Whether to add an initial `fly_to` once the map renders.
    When this attribute is given, the user can specify a number of
    flight parameters which control the initial `fly_to`. If no parameters
    are given, the `map` component has suitable defaults for all of them
    which work reasonably well independently of the center of the map.
  * `flight_duration` - Duration of the initial `fly_to` in milliseconds.
    Has no effect if `fly` is `false`.
  * `flight_speed` - Speed of the initial `fly_to`.
    Has no effect if `fly` is `false`.
  * `flight_curve` - Curve of the initial `fly_to`.
    Has no effect if `fly` is `false`.
  * `fly_from_center` - The initial map center before the `fly_to`.
    Has no effect if `fly` is `false`.
  * `fly_from_zoom` - The initial map zoom before the `fly_to`.
    Has no effect if `fly` is `false`.
  * `fly_from_bearing` - The initial map bearing before the `fly_to`.
    Has no effect if `fly` is `false`.
  * `fly_from_pitch` - The initial map pitch before the `fly_to`.
    Has no effect if `fly` is `false`.
  * `bounds` - Fit map to bounds `[[west, south], [east, north]]`. Optional
  * `max_bounds` - Maximum bounds the map can be panned to. Optional
  * `interactive` - Whether the map is interactive. Defaults to `true`
  * `attribution_control` - Show attribution control. Defaults to `true`
  * `loader_bg` - Background for the loader elemnt, which exists to hide
    the map. This should match either the background of the page or the
    background of the map when the projection is a globe so that it appears
    that the globe appears all at once fully rendered.
    Default: `"#050810"`
  * `loader_fade_out_transition` - CSS transition for when the opacity of the loader
    is set to `0` so that the transition is a bit more gradual and less abrupt.
    Default: `"opacity 0.3s ease"`.
  * `loader_fade_out_transition` - CSS transition for when the opacity of the map
    is set to `1` so that the transition is a bit more gradual and less abrupt.
    Default: `"opacity 0.3s ease"`.
  * `class` - CSS classes for the map container
  * `testid` - Test ID for the map element

  ## Events

  The map emits the following events to LiveView:

  * `map:moved` - Fired when the map is moved (pan, zoom, rotate, pitch)
  * `map:clicked` - Fired when the map is clicked
  * `map:loaded` - Fired when the map finishes loading
  * `map:zoom_changed` - Fired when zoom level changes
  * `map:error` - Fired when an error occurs

  ## Slots

  * `inner_block` - Optional content to render inside the map container
  """
  attr :id, :string, required: true
  attr :center, :list, default: nil
  attr :zoom, :any, default: nil, doc: "number"
  attr :style, :any, default: nil
  attr :min_zoom, :any, default: nil, doc: "number"
  attr :max_zoom, :any, default: nil, doc: "number"
  attr :min_pitch, :any, default: nil, doc: "number, degrees"
  attr :max_pitch, :any, default: nil, doc: "number, degrees 0-85"
  attr :bearing, :any, default: 0, doc: "number, degrees"
  attr :pitch, :any, default: 0, doc: "number, degrees"
  attr :fly, :boolean, default: false, doc: "whether to add an initial `fly_to`."
  attr :flight_duration, :integer, default: nil, doc: "duration of the initial `fly_to`"
  attr :flight_speed, :float, default: nil, doc: "speed of the initial `fly_to`"
  attr :flight_curve, :float, default: nil, doc: "curve of the initial `fly_to`"
  attr :fly_from_center, :float, default: nil, doc: "the center before the initial `fly_to`"
  attr :fly_from_zoom, :float, default: nil, doc: "zoom before the initial `fly_to`"
  attr :fly_from_bearing, :float, default: nil, doc: "bearing the initial `fly_to`"
  attr :fly_from_pitch, :float, default: nil, doc: "pitch before the initial `fly_to`"
  attr :bounds, :list, default: nil
  attr :max_bounds, :list, default: nil
  attr :interactive, :boolean, default: true
  attr :attribution_control, :boolean, default: true
  attr :loader_bg, :string, default: "#050810", doc: "background for the loader"
  attr :loader_fade_out_transition, :string, default: "opacity 0.3s ease"
  attr :map_fade_in_transition, :string, default: "opacity 0.3s ease"
  attr :class, :string, default: "maplibrex-map"
  attr :testid, :string, default: nil
  attr :rest, :global

  slot :inner_block, required: false

  def map(assigns) do
    map_id = assigns[:id]
    loader_id = assigns[:id] <> "-loader"
    wrapper_id = assigns[:id] <> "-wrapper"
    # Set defaults from config if not provided
    assigns =
      assigns
      |> assign(:map_id, map_id)
      |> assign(:wrapper_id, wrapper_id)
      |> assign(:loader_id, loader_id)
      |> assign_new(:center, fn -> MaplibreX.default_center() end)
      |> assign_new(:zoom, fn -> MaplibreX.default_zoom() end)
      |> assign_new(:style, fn -> MaplibreX.default_style() end)

    # Build configuration object
    config =
      %{
        id: map_id,
        loaderId: loader_id,
        fly: assigns[:fly],
        flightDuration: assigns[:flight_duration] || MaplibreX.default_flight_duration(),
        flightSpeed: assigns[:flight_speed] || MaplibreX.default_flight_speed(),
        flightCurve: assigns[:flight_curve] || MaplibreX.default_flight_curve(),
        flyFromCenter: assigns[:fly_from_center] || MaplibreX.default_fly_from_center(),
        flyFromZoom: assigns[:fly_from_zoom] || MaplibreX.default_fly_from_zoom(),
        flyFromBearing: assigns[:fly_from_bearing] || MaplibreX.default_fly_from_bearing(),
        flyFromPitch: assigns[:fly_from_pitch] || MaplibreX.default_fly_from_pitch(),
        center: assigns.center,
        zoom: assigns.zoom,
        style: assigns.style,
        bearing: assigns.bearing,
        pitch: assigns.pitch,
        interactive: assigns.interactive,
        attributionControl: assigns.attribution_control
      }
      |> maybe_put(:minZoom, assigns.min_zoom)
      |> maybe_put(:maxZoom, assigns.max_zoom)
      |> maybe_put(:minPitch, assigns.min_pitch)
      |> maybe_put(:maxPitch, assigns.max_pitch)
      |> maybe_put(:bounds, assigns.bounds)
      |> maybe_put(:maxBounds, assigns.max_bounds)

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <%!--
      phx-update="ignore" is required, not optional. MapLibre GL JS builds its
      canvas inside this container and adds its own classes to it. Without it,
      any LiveView re-render that touches this element's dynamics patches the
      container and destroys the map — leaving a blank div and a live Map
      instance rendering into a detached node.

      LiveView still merges `data-*` attributes onto ignored elements, so
      `data-config` keeps flowing and MapHook.updated/0 stays reactive.
    --%>
    <div
      id={@wrapper_id}
      phx-hook="MapHook"
      phx-update="ignore"
      data-config={@config}
      data-testid={@testid || "maplibrex-map-#{@id}"}
      class={@class}
      {@rest}
    >
      <div id={@loader_id} style={[
          "position: absolute; inset: 0; display: flex; align-items: center; ",
          "justify-content: center; opacity: 1; z-index: 999; ",
          "transition: ",
          @loader_fade_out_transition,
          "; ",
          "background: ",
          @loader_bg
        ]}>
        <div class="width: 50%; height: 50%">
          <.pulse_map_loader/>
        </div>
      </div>

      <!-- Map container kept in DOM flow with opacity 0 -->
      <div id={@map_id} style={[
          "width: 100%; height: 100%; opacity: 0; ",
          "transition: ",
          @map_fade_in_transition
        ]}></div>
      <%= render_slot(@inner_block) %>
    </div>
    """
  end

  @doc """
  A spinner loading widget to show while the map is rendering
  so that the user doesn't see any glitchy map rendering.
  """

  attr :color, :string, default: "#3b82f6",
    doc: "color of the pulse"

  def spinner_map_loader(assigns) do
    ~H"""
    <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="status"
        aria-label="Loading">
      <!-- Animated Arc -->
      <circle cx="50" cy="50" r="40" fill="none" stroke={@color} stroke-width="8" stroke-linecap="round"
              stroke-dasharray="160, 400" stroke-dashoffset="0">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0; -80; -240"
          dur="1.4s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
    """
  end

  @doc """
  A spinner loading widget to show while the map is rendering
  so that the user doesn't see any glitchy map rendering.
  """

  attr :color, :string, default: "#3b82f6",
    doc: "color of the pulse"

  def pulse_map_loader(assigns) do
    ~H"""
    <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="status"
        aria-label="Loading">
      <circle cx="50" cy="50" r="10" fill="none" stroke={@color} stroke-width="6" opacity="1">
        <animate attributeName="r" values="10; 44" dur="1.2s" repeatCount="indefinite" begin="0s" />
        <animate attributeName="opacity" values="1; 0" dur="1.2s" repeatCount="indefinite" begin="0s" />
      </circle>
      <circle cx="50" cy="50" r="10" fill="none" stroke={@color} stroke-width="6" opacity="1">
        <animate attributeName="r" values="10; 44" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
        <animate attributeName="opacity" values="1; 0" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
      </circle>
    </svg>
    """
  end

  def orbiting_dots_loader(assigns) do
    ~H"""
    <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="status"
        aria-label="Loading">
      <g>
        <circle cx="50" cy="12" r="8" fill="#3b82f6" opacity="1" />
        <circle cx="88" cy="50" r="7" fill="#3b82f6" opacity="0.75" />
        <circle cx="50" cy="88" r="6" fill="#3b82f6" opacity="0.5" />
        <circle cx="12" cy="50" r="5" fill="#3b82f6" opacity="0.25" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
    """
  end

  def vertical_equalizer_bars(assigns) do
    ~H"""
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="status" aria-label="Loading">
      <rect x="15%" y="30%" width="12%" height="40%" rx="6%" fill="#3b82f6">
        <animate attributeName="height" values="20%; 60%; 20%" dur="0.8s" repeatCount="indefinite" begin="0s" />
        <animate attributeName="y" values="40%; 20%; 40%" dur="0.8s" repeatCount="indefinite" begin="0s" />
      </rect>
      <rect x="44%" y="30%" width="12%" height="40%" rx="6%" fill="#3b82f6">
        <animate attributeName="height" values="20%; 60%; 20%" dur="0.8s" repeatCount="indefinite" begin="0.2s" />
        <animate attributeName="y" values="40%; 20%; 40%" dur="0.8s" repeatCount="indefinite" begin="0.2s" />
      </rect>
      <rect x="73%" y="30%" width="12%" height="40%" rx="6%" fill="#3b82f6">
        <animate attributeName="height" values="20%; 60%; 20%" dur="0.8s" repeatCount="indefinite" begin="0.4s" />
        <animate attributeName="y" values="40%; 20%; 40%" dur="0.8s" repeatCount="indefinite" begin="0.4s" />
      </rect>
    </svg>
    """
  end

  @doc """
  Creates a JS command to fly the map to a specific location.

  ## Examples

      <button phx-click={MaplibreX.Components.Map.fly_to("my-map", [-74.5, 40], 12)}>
        Fly to NYC
      </button>

  With custom duration:

      fly_to("my-map", [-74.5, 40], 12, duration: 3000)
  """
  @spec fly_to(String.t(), center(), integer(), keyword()) :: Phoenix.LiveView.JS.t()
  def fly_to(map_id, center, zoom, opts \\ []) do
    duration = Keyword.get(opts, :duration, 1000)
    bearing = Keyword.get(opts, :bearing)
    pitch = Keyword.get(opts, :pitch)

    payload =
      %{center: center, zoom: zoom, duration: duration}
      |> maybe_put(:bearing, bearing)
      |> maybe_put(:pitch, pitch)

    JS.dispatch("maplibrex:fly_to", to: "##{map_id}", detail: payload)
  end

  @doc """
  Creates a JS command to jump the map to a specific location (no animation).

  ## Examples

      <button phx-click={MaplibreX.Components.Map.jump_to("my-map", [-74.5, 40], 12)}>
        Jump to NYC
      </button>
  """
  @spec jump_to(String.t(), center(), integer(), keyword()) :: Phoenix.LiveView.JS.t()
  def jump_to(map_id, center, zoom, opts \\ []) do
    bearing = Keyword.get(opts, :bearing)
    pitch = Keyword.get(opts, :pitch)

    payload =
      %{center: center, zoom: zoom}
      |> maybe_put(:bearing, bearing)
      |> maybe_put(:pitch, pitch)

    JS.dispatch("maplibrex:jump_to", to: "##{map_id}", detail: payload)
  end

  @doc """
  Creates a JS command to fit the map to specific bounds.

  ## Examples

      bounds = [[-74, 40], [-73, 41]]
      <button phx-click={MaplibreX.Components.Map.fit_bounds("my-map", bounds)}>
        Fit to bounds
      </button>

  With padding and max zoom:

      fit_bounds("my-map", bounds, padding: 50, max_zoom: 15)
  """
  @spec fit_bounds(String.t(), bounds(), keyword()) :: Phoenix.LiveView.JS.t()
  def fit_bounds(map_id, bounds, opts \\ []) do
    padding = Keyword.get(opts, :padding, 50)
    max_zoom = Keyword.get(opts, :max_zoom)
    duration = Keyword.get(opts, :duration, 1000)

    payload =
      %{bounds: bounds, padding: padding, duration: duration}
      |> maybe_put(:maxZoom, max_zoom)

    JS.dispatch("maplibrex:fit_bounds", to: "##{map_id}", detail: payload)
  end

  @doc """
  Creates a JS command to set the map style.

  ## Examples

      <button phx-click={MaplibreX.Components.Map.set_style("my-map", "new-style-url")}>
        Change Style
      </button>
  """
  @spec set_style(String.t(), String.t() | map()) :: Phoenix.LiveView.JS.t()
  def set_style(map_id, style) do
    JS.dispatch("maplibrex:set_style", to: "##{map_id}", detail: %{style: style})
  end

  @doc """
  Creates a JS command to zoom in.
  """
  @spec zoom_in(String.t()) :: Phoenix.LiveView.JS.t()
  def zoom_in(map_id) do
    JS.dispatch("maplibrex:zoom_in", to: "##{map_id}")
  end

  @doc """
  Creates a JS command to zoom out.
  """
  @spec zoom_out(String.t()) :: Phoenix.LiveView.JS.t()
  def zoom_out(map_id) do
    JS.dispatch("maplibrex:zoom_out", to: "##{map_id}")
  end

  @doc """
  Creates a JS command to reset the map's bearing to north.
  """
  @spec reset_north(String.t()) :: Phoenix.LiveView.JS.t()
  def reset_north(map_id) do
    JS.dispatch("maplibrex:reset_north", to: "##{map_id}")
  end

  # Private helper to conditionally add keys to a map
  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
