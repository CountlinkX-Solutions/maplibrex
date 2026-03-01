defmodule MaplibreX.Components.FillLayer do
  @moduledoc """
  Fill layer component for MapLibre maps in Phoenix LiveView.

  This component renders polygon data as filled areas with customizable styling
  for regions, zones, and administrative boundaries.

  ## Examples

  Basic fill layer:

      <.fill_layer
        id="states"
        map_id="my-map"
        source_id="state-data"
        paint={%{
          "fill-color" => "#088",
          "fill-opacity" => 0.4
        }}
      />

  Data-driven styling with outline:

      <.fill_layer
        id="countries"
        map_id="my-map"
        source_id="country-data"
        paint={%{
          "fill-color" => [
            "match",
            ["get", "continent"],
            "North America", "#1f78b4",
            "Europe", "#33a02c",
            "Asia", "#e31a1c",
            "Africa", "#ff7f00",
            "#808080"
          ],
          "fill-opacity" => 0.6,
          "fill-outline-color" => "#000"
        }}
      />

  With filters and pattern:

      <.fill_layer
        id="parks"
        map_id="my-map"
        source_id="land-use"
        source_layer="parks"
        filter={["==", "type", "park"]}
        paint={%{
          "fill-color" => "#00ff00",
          "fill-opacity" => 0.3,
          "fill-outline-color" => "#006600"
        }}
        min_zoom={10}
        max_zoom={22}
      />

  ## Events

  The fill layer can emit the following events to LiveView:

      def handle_event("layer:feature_clicked", %{"layer_id" => id, "feature" => feature}, socket) do
        IO.inspect(feature, label: "Clicked region")
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseenter", %{"layer_id" => id, "feature" => feature}, socket) do
        # Highlight region, show info, etc.
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseleave", %{"layer_id" => id}, socket) do
        # Reset highlight
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a fill layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (fill-color, fill-opacity, fill-outline-color, fill-pattern, etc.)
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

  def fill_layer(assigns) do
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
      phx-hook="FillLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
