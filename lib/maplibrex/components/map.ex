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
  * `zoom` - Initial zoom level. Defaults to `10`
  * `style` - Map style URL or style object. Defaults to MaplibreX config
  * `min_zoom` - Minimum zoom level. Optional
  * `max_zoom` - Maximum zoom level. Optional
  * `bearing` - Initial bearing (rotation). Defaults to `0`
  * `pitch` - Initial pitch (tilt). Defaults to `0`
  * `bounds` - Fit map to bounds `[[west, south], [east, north]]`. Optional
  * `max_bounds` - Maximum bounds the map can be panned to. Optional
  * `interactive` - Whether the map is interactive. Defaults to `true`
  * `attribution_control` - Show attribution control. Defaults to `true`
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
  attr :zoom, :integer, default: nil
  attr :style, :any, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :bearing, :integer, default: 0
  attr :pitch, :integer, default: 0
  attr :bounds, :list, default: nil
  attr :max_bounds, :list, default: nil
  attr :interactive, :boolean, default: true
  attr :attribution_control, :boolean, default: true
  attr :class, :string, default: "maplibrex-map"
  attr :testid, :string, default: nil
  attr :rest, :global

  slot :inner_block, required: false

  def map(assigns) do
    # Set defaults from config if not provided
    assigns =
      assigns
      |> assign_new(:center, fn -> MaplibreX.default_center() end)
      |> assign_new(:zoom, fn -> MaplibreX.default_zoom() end)
      |> assign_new(:style, fn -> MaplibreX.default_style() end)

    # Build configuration object
    config =
      %{
        id: assigns.id,
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
      id={@id}
      phx-hook="MapHook"
      phx-update="ignore"
      data-config={@config}
      data-testid={@testid || "maplibrex-map-#{@id}"}
      class={@class}
      {@rest}
    >
      <%= render_slot(@inner_block) %>
    </div>
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
