defmodule MaplibreX.Components.LineLayer do
  @moduledoc """
  Line layer component for MapLibre maps in Phoenix LiveView.

  This component renders line data with customizable styling for routes,
  paths, boundaries, and connections.

  ## Examples

  Basic line layer:

      <.line_layer
        id="route"
        map_id="my-map"
        source_id="route-data"
        paint={%{
          "line-width" => 3,
          "line-color" => "#007cbf"
        }}
      />

  Data-driven styling with dash pattern:

      <.line_layer
        id="roads"
        map_id="my-map"
        source_id="road-data"
        paint={%{
          "line-width" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 1,
            10, 2,
            15, 4
          ],
          "line-color" => [
            "match",
            ["get", "class"],
            "motorway", "#e06c00",
            "trunk", "#ff8c00",
            "primary", "#ffa500",
            "#808080"
          ],
          "line-opacity" => 0.8,
          "line-dasharray" => [2, 4]
        }}
        layout={%{
          "line-cap" => "round",
          "line-join" => "round"
        }}
      />

  With filters and zoom constraints:

      <.line_layer
        id="major-roads"
        map_id="my-map"
        source_id="roads"
        source_layer="road"
        filter={["in", "class", "motorway", "trunk"]}
        min_zoom={5}
        max_zoom={15}
        paint={%{
          "line-width" => 4,
          "line-color" => "#ff6600"
        }}
      />

  ## Events

  The line layer can emit the following events to LiveView:

      def handle_event("layer:feature_clicked", %{"layer_id" => id, "feature" => feature}, socket) do
        IO.inspect(feature, label: "Clicked road")
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseenter", %{"layer_id" => id, "feature" => feature}, socket) do
        # Highlight road, show info, etc.
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseleave", %{"layer_id" => id}, socket) do
        # Reset highlight
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a line layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (line-width, line-color, line-opacity, line-dasharray, etc.)
  * `layout` - Layout properties (line-cap, line-join, visibility, etc.)
  * `filter` - Filter expression to show subset of features
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

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

  def line_layer(assigns) do
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
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="LineLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
