defmodule MaplibreX.Components.RasterLayer do
  @moduledoc """
  Raster layer component for MapLibre maps in Phoenix LiveView.

  This component renders raster image tiles from raster sources such as
  RasterTileSource, ImageSource, or VideoSource. It's used for displaying
  satellite imagery, terrain maps, weather overlays, and other raster data.

  ## Examples

  Basic raster layer with satellite imagery:

      <.raster_tile_source
        id="satellite"
        map_id="my-map"
        tiles={["https://example.com/satellite/{z}/{x}/{y}.png"]}
      />

      <.raster_layer
        id="satellite-layer"
        map_id="my-map"
        source_id="satellite"
        paint={%{
          "raster-opacity" => 0.85
        }}
      />

  With custom styling:

      <.raster_layer
        id="terrain-layer"
        map_id="my-map"
        source_id="terrain"
        paint={%{
          "raster-opacity" => 1.0,
          "raster-hue-rotate" => 0,
          "raster-brightness-min" => 0,
          "raster-brightness-max" => 1,
          "raster-saturation" => 0,
          "raster-contrast" => 0,
          "raster-fade-duration" => 300
        }}
      />

  With georeferenced image:

      <.image_source
        id="radar-overlay"
        map_id="my-map"
        url="/images/weather-radar.png"
        coordinates={[
          [-80.425, 46.437],
          [-71.516, 46.437],
          [-71.516, 37.936],
          [-80.425, 37.936]
        ]}
      />

      <.raster_layer
        id="radar-layer"
        map_id="my-map"
        source_id="radar-overlay"
        paint={%{
          "raster-opacity" => 0.7,
          "raster-fade-duration" => 0
        }}
      />

  With zoom constraints:

      <.raster_layer
        id="detailed-imagery"
        map_id="my-map"
        source_id="high-res-satellite"
        min_zoom={12}
        max_zoom={18}
        paint={%{
          "raster-opacity" => 0.9
        }}
      />

  ## Paint Properties

  The `paint` map supports the following raster-specific properties:

  * `raster-opacity` - Opacity of the entire layer (0 to 1, default: 1)
  * `raster-hue-rotate` - Rotates hues around the color wheel (degrees, default: 0)
  * `raster-brightness-min` - Minimum brightness (0 to 1, default: 0)
  * `raster-brightness-max` - Maximum brightness (0 to 1, default: 1)
  * `raster-saturation` - Color saturation (-1 to 1, default: 0)
  * `raster-contrast` - Color contrast (-1 to 1, default: 0)
  * `raster-fade-duration` - Fade-in duration for new tiles (ms, default: 300)
  * `raster-resampling` - Resampling method ("linear" or "nearest", default: "linear")

  ## Events

  The raster layer emits basic lifecycle events:

      def handle_event("layer:added", %{"layer_id" => layer_id}, socket) do
        IO.inspect("Raster layer added: \#{layer_id}")
        {:noreply, socket}
      end

      def handle_event("layer:removed", %{"layer_id" => layer_id}, socket) do
        IO.inspect("Raster layer removed: \#{layer_id}")
        {:noreply, socket}
      end
  """

  use Phoenix.Component
  alias MaplibreX.Components.Events

  @doc """
  Renders a raster layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the raster data source
  * `paint` - Paint properties (raster-opacity, raster-hue-rotate, etc.)
  * `layout` - Layout properties (visibility)
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before
  * `events` - List of the events to push to the LiveView, e.g.
    `["layer:added"]`. Optional: without it, every event listed under Events
    is pushed

  ## Events

  * `layer:added` - Fired once, the first time the layer is on the map (not
    again when a style change puts it back)
  * `layer:removed` - Fired when the component is removed, if `layer:added`
    was fired
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :source_id, :string, required: true
  attr :paint, :map, default: %{}
  attr :layout, :map, default: %{}
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil
  attr :events, :list, default: nil

  def raster_layer(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        sourceId: assigns.source_id,
        paint: assigns.paint,
        layout: assigns.layout,
        minZoom: assigns.min_zoom,
        maxZoom: assigns.max_zoom,
        beforeId: assigns.before_id
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) or v == %{} end)
      |> Map.new()

    assigns = assign(assigns, :config, Jason.encode!(Events.put(config, assigns.events)))

    ~H"""
    <div
      id={@id}
      phx-hook="RasterLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
