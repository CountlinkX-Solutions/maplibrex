defmodule MaplibreX.Components.CircleLayer do
  @moduledoc """
  Circle layer component for MapLibre maps in Phoenix LiveView.

  This component renders point data as circles with variable radius and styling.
  It's specialized for visualizing POIs, events, and point density with sizes that
  can be data-driven.

  ## Examples

  Basic circle layer:

      <.circle_layer
        id="pois"
        map_id="my-map"
        source_id="poi-data"
        paint={%{
          "circle-radius" => 5,
          "circle-color" => "#007cbf"
        }}
      />

  Data-driven styling:

      <.circle_layer
        id="earthquakes"
        map_id="my-map"
        source_id="earthquake-data"
        paint={%{
          "circle-radius" => ["get", "magnitude"],
          "circle-color" => [
            "interpolate",
            ["linear"],
            ["get", "magnitude"],
            1, "#ffffb2",
            3, "#fd8d3c",
            5, "#bd0026"
          ],
          "circle-opacity" => 0.8
        }}
      />

  With filters and zoom constraints:

      <.circle_layer
        id="large-cities"
        map_id="my-map"
        source_id="cities"
        source_layer="city-labels"
        filter={[">=", "population", 1000000]}
        min_zoom={4}
        max_zoom={10}
        paint={%{
          "circle-radius" => 8,
          "circle-color" => "#FF0000"
        }}
      />

  ## Events

  The circle layer can emit the following events to LiveView:

      def handle_event("layer:feature_clicked", %{"layer_id" => id, "feature" => feature}, socket) do
        IO.inspect(feature, label: "Clicked feature")
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseenter", %{"layer_id" => id, "feature" => feature}, socket) do
        # Change cursor, show tooltip, etc.
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseleave", %{"layer_id" => id}, socket) do
        # Reset cursor, hide tooltip, etc.
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a circle layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (circle-radius, circle-color, circle-opacity, etc.)
  * `layout` - Layout properties (visibility, etc.)
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

  def circle_layer(assigns) do
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
      phx-hook="CircleLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
