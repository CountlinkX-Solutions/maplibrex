defmodule MaplibreX.Components.HeatmapLayer do
  @moduledoc """
  Heatmap layer component for MapLibre maps in Phoenix LiveView.

  This component renders point data as a heatmap visualization showing density
  and concentration of data points with smooth color gradients.

  ## Examples

  Basic heatmap:

      <.heatmap_layer
        id="earthquake-heat"
        map_id="my-map"
        source_id="earthquakes"
        paint={%{
          "heatmap-radius" => 20,
          "heatmap-opacity" => 0.8
        }}
      />

  Heatmap with zoom-based intensity:

      <.heatmap_layer
        id="event-density"
        map_id="my-map"
        source_id="events"
        paint={%{
          "heatmap-weight" => [
            "interpolate",
            ["linear"],
            ["get", "magnitude"],
            0, 0,
            6, 1
          ],
          "heatmap-intensity" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 1,
            9, 3
          ],
          "heatmap-radius" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 2,
            9, 20
          ],
          "heatmap-opacity" => 1
        }}
      />

  Custom color gradient:

      <.heatmap_layer
        id="density-map"
        map_id="my-map"
        source_id="points"
        paint={%{
          "heatmap-color" => [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            1, "rgb(178,24,43)"
          ],
          "heatmap-radius" => 30,
          "heatmap-weight" => ["get", "value"]
        }}
        min_zoom={0}
        max_zoom={15}
      />

  ## Events

  The heatmap layer can emit the following events to LiveView:

      def handle_event("layer:added", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Heatmap layer added")
        {:noreply, socket}
      end

      def handle_event("layer:removed", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Heatmap layer removed")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a heatmap layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (heatmap-radius, heatmap-color, heatmap-weight, etc.)
  * `filter` - Filter expression to show subset of features
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

  ## Paint Properties

  - `heatmap-radius` - Radius of influence of one heatmap point (pixels)
  - `heatmap-weight` - Measure of how much an individual point contributes to the heatmap
  - `heatmap-intensity` - Controls the intensity of the heatmap globally
  - `heatmap-color` - Defines the color of each pixel based on density
  - `heatmap-opacity` - Global opacity of the heatmap layer

  All paint properties support data-driven styling and interpolation expressions.

  ## Events

  * `layer:added` - Fired when layer is added to map
  * `layer:removed` - Fired when layer is removed from map

  Note: Individual feature events (click, hover) are not available for heatmap layers
  as they represent aggregate density rather than discrete features.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :source_id, :string, required: true
  attr :source_layer, :string, default: nil
  attr :paint, :map, default: %{}
  attr :filter, :any, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil

  def heatmap_layer(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        sourceId: assigns.source_id,
        sourceLayer: assigns.source_layer,
        paint: assigns.paint,
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
      phx-hook="HeatmapLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
