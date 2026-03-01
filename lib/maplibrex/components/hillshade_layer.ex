defmodule MaplibreX.Components.HillshadeLayer do
  @moduledoc """
  Hillshade layer component for MapLibre maps in Phoenix LiveView.

  This component renders terrain relief shading (hillshading) from a
  raster-dem source, creating a 3D visual effect on the map.

  ## Examples

  Basic hillshade with default settings:

      <.hillshade_layer
        id="hillshading"
        map_id="my-map"
        source_id="terrain-dem"
      />

  Hillshade with custom illumination:

      <.hillshade_layer
        id="hillshading"
        map_id="my-map"
        source_id="terrain-dem"
        paint={%{
          "hillshade-illumination-direction" => 335,
          "hillshade-exaggeration" => 0.8,
          "hillshade-shadow-color" => "#000",
          "hillshade-highlight-color" => "#fff"
        }}
      />

  Hillshade with accent color:

      <.hillshade_layer
        id="hillshading"
        map_id="my-map"
        source_id="terrain-dem"
        paint={%{
          "hillshade-accent-color" => "#8a7f71",
          "hillshade-exaggeration" => 1.2,
          "hillshade-illumination-anchor" => "viewport"
        }}
      />

  ## Events

  The hillshade layer can emit the following events to LiveView:

      def handle_event("layer:added", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Hillshade layer added")
        {:noreply, socket}
      end

      def handle_event("layer:removed", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Hillshade layer removed")
        {:noreply, socket}
      end

  ## Requirements

  This layer requires a raster-dem source. The source must be configured
  separately in your map style or using a RasterDEMSource component.
  """

  use Phoenix.Component

  @doc """
  Renders a hillshade layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the raster-dem source
  * `source_layer` - Layer in the source (for vector tiles, optional)
  * `paint` - Paint properties for hillshading effect
  * `layout` - Layout properties (visibility)
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

  ## Paint Properties

  - `hillshade-illumination-direction` - Direction of light (0-359 degrees, default: 335)
  - `hillshade-illumination-anchor` - "map" or "viewport" (default: "viewport")
  - `hillshade-exaggeration` - Intensity of shading (0-1, default: 0.5)
  - `hillshade-shadow-color` - Color of shadows (default: "#000000")
  - `hillshade-highlight-color` - Color of highlights (default: "#FFFFFF")
  - `hillshade-accent-color` - Overall tint color (optional)

  ## Layout Properties

  - `visibility` - "visible" or "none" (default: "visible")

  ## Events

  * `layer:added` - Fired when layer is added to map
  * `layer:removed` - Fired when layer is removed from map

  Note: Hillshade layers do not support feature interaction events as they
  render continuous terrain data rather than discrete features.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :source_id, :string, required: true
  attr :source_layer, :string, default: nil
  attr :paint, :map, default: %{}
  attr :layout, :map, default: %{}
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil

  def hillshade_layer(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        sourceId: assigns.source_id,
        sourceLayer: assigns.source_layer,
        paint: assigns.paint,
        layout: assigns.layout,
        minZoom: assigns.min_zoom,
        maxZoom: assigns.max_zoom,
        beforeId: assigns.before_id
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) || v == %{} end)
      |> Map.new()

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="HillshadeLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
