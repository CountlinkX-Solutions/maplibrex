defmodule MaplibreX.Components.BackgroundLayer do
  @moduledoc """
  Background layer component for MapLibre maps in Phoenix LiveView.

  This component renders a solid color or pattern as the map background,
  typically used as the base layer before other map content.

  ## Examples

  Basic solid color background:

      <.background_layer
        id="bg"
        map_id="my-map"
        paint={%{
          "background-color" => "#f0f0f0"
        }}
      />

  Background with opacity:

      <.background_layer
        id="bg"
        map_id="my-map"
        paint={%{
          "background-color" => "#000",
          "background-opacity" => 0.5
        }}
      />

  Background with pattern (requires sprite):

      <.background_layer
        id="bg-pattern"
        map_id="my-map"
        paint={%{
          "background-pattern" => "dots"
        }}
      />

  ## Events

  The background layer can emit the following events to LiveView:

      def handle_event("layer:added", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Background layer added")
        {:noreply, socket}
      end

      def handle_event("layer:removed", %{"layer_id" => layer_id}, socket) do
        IO.inspect(layer_id, label: "Background layer removed")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a background layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `paint` - Paint properties (background-color, background-opacity, background-pattern)
  * `layout` - Layout properties (visibility)
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

  ## Paint Properties

  - `background-color` - Color of the background (default: "#000000")
  - `background-opacity` - Opacity of the background (0-1, default: 1)
  - `background-pattern` - Name of image in sprite to use as pattern

  ## Layout Properties

  - `visibility` - "visible" or "none" (default: "visible")

  ## Events

  * `layer:added` - Fired when layer is added to map
  * `layer:removed` - Fired when layer is removed from map

  Note: Background layers do not support feature interaction events as they
  represent the base layer without discrete features.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :paint, :map, default: %{}
  attr :layout, :map, default: %{}
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil

  def background_layer(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
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
      phx-hook="BackgroundLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
