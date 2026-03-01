defmodule MaplibreX.Components.FillExtrusionLayer do
  @moduledoc """
  Fill extrusion layer component for MapLibre maps in Phoenix LiveView.

  This component renders 3D extruded polygons, commonly used for buildings
  and data visualizations with height/elevation dimensions.

  ## Examples

  Basic 3D buildings:

      <.fill_extrusion_layer
        id="buildings-3d"
        map_id="my-map"
        source_id="buildings"
        paint={%{
          "fill-extrusion-color" => "#aaa",
          "fill-extrusion-height" => ["get", "height"],
          "fill-extrusion-base" => 0,
          "fill-extrusion-opacity" => 0.6
        }}
      />

  Buildings with base height and vertical gradient:

      <.fill_extrusion_layer
        id="buildings-gradient"
        map_id="my-map"
        source_id="buildings"
        paint={%{
          "fill-extrusion-color" => [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0, "#fbb03b",
            50, "#223b53",
            100, "#e55e5e"
          ],
          "fill-extrusion-height" => ["get", "height"],
          "fill-extrusion-base" => ["get", "min_height"],
          "fill-extrusion-opacity" => 0.9,
          "fill-extrusion-vertical-gradient" => true
        }}
        filter={["==", "extrude", "true"]}
      />

  Data visualization with extrusion:

      <.fill_extrusion_layer
        id="population-3d"
        map_id="my-map"
        source_id="counties"
        paint={%{
          "fill-extrusion-color" => "#00f",
          "fill-extrusion-height" => [
            "*",
            ["get", "population"],
            0.001
          ],
          "fill-extrusion-base" => 0,
          "fill-extrusion-opacity" => 0.7
        }}
      />

  ## Events

  The fill extrusion layer can emit the following events to LiveView:

      def handle_event("layer:feature_clicked", %{"layer_id" => layer_id, "features" => features}, socket) do
        IO.inspect(features, label: "Clicked buildings")
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseenter", %{"layer_id" => layer_id, "features" => features}, socket) do
        IO.inspect(features, label: "Hovering over building")
        {:noreply, socket}
      end

      def handle_event("layer:added", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "3D layer added")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a fill extrusion layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (fill-extrusion-color, fill-extrusion-height, etc.)
  * `layout` - Layout properties (visibility, etc.)
  * `filter` - Filter expression to show subset of features
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

  ## Paint Properties

  - `fill-extrusion-color` - Color of the extruded polygons
  - `fill-extrusion-height` - Height of the extrusion (meters or expression)
  - `fill-extrusion-base` - Base height of the extrusion (default: 0)
  - `fill-extrusion-opacity` - Opacity of the extrusion (0-1)
  - `fill-extrusion-pattern` - Name of image in sprite for pattern fill
  - `fill-extrusion-translate` - Offset distance [x, y] in pixels
  - `fill-extrusion-translate-anchor` - "map" or "viewport"
  - `fill-extrusion-vertical-gradient` - Apply vertical color gradient (default: true)

  All paint properties support data-driven styling and interpolation expressions.

  ## Layout Properties

  - `visibility` - "visible" or "none" (default: "visible")

  ## Events

  * `layer:feature_clicked` - Fired when a feature is clicked
  * `layer:feature_mouseenter` - Fired when mouse enters a feature
  * `layer:feature_mouseleave` - Fired when mouse leaves a feature
  * `layer:added` - Fired when layer is added to map
  * `layer:removed` - Fired when layer is removed from map
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :source_id, :string, required: true
  attr :source_layer, :string, default: nil
  attr :paint, :map, default: %{}
  attr :layout, :map, default: %{}
  attr :filter, :any, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil

  def fill_extrusion_layer(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        sourceId: assigns.source_id,
        sourceLayer: assigns.source_layer,
        paint: assigns.paint,
        layout: assigns.layout,
        filter: assigns.filter,
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
      phx-hook="FillExtrusionLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
