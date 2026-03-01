defmodule MaplibreX.Components.SymbolLayer do
  @moduledoc """
  Symbol layer component for MapLibre maps in Phoenix LiveView.

  This component renders point data as symbols (icons and/or text labels) with
  customizable styling for POI labels, place names, and custom markers.

  ## Examples

  Basic text labels:

      <.symbol_layer
        id="city-labels"
        map_id="my-map"
        source_id="places"
        layout={%{
          "text-field" => ["get", "name"],
          "text-size" => 12
        }}
      />

  Icons with text:

      <.symbol_layer
        id="poi-labels"
        map_id="my-map"
        source_id="points-of-interest"
        layout={%{
          "text-field" => ["get", "name"],
          "text-font" => ["Open Sans Regular"],
          "text-size" => 12,
          "text-anchor" => "top",
          "text-offset" => [0, 0.5],
          "icon-image" => ["get", "icon"],
          "icon-size" => 1.0,
          "icon-allow-overlap" => false,
          "text-allow-overlap" => false
        }}
        paint={%{
          "text-color" => "#000",
          "text-halo-color" => "#fff",
          "text-halo-width" => 2,
          "icon-opacity" => 1
        }}
      />

  Data-driven styling:

      <.symbol_layer
        id="markers"
        map_id="my-map"
        source_id="locations"
        layout={%{
          "icon-image" => [
            "match",
            ["get", "type"],
            "restaurant", "restaurant-15",
            "hotel", "lodging-15",
            "shop", "shop-15",
            "marker-15"
          ],
          "icon-size" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 0.5,
            15, 1.5
          ],
          "text-field" => ["get", "name"],
          "text-size" => 11,
          "text-anchor" => "top",
          "text-offset" => [0, 1.2]
        }}
        paint={%{
          "text-color" => "#333",
          "text-halo-color" => "#fff",
          "text-halo-width" => 1.5
        }}
        min_zoom={10}
      />

  ## Events

  The symbol layer can emit the following events to LiveView:

      def handle_event("layer:feature_clicked", %{"layer_id" => id, "feature" => feature}, socket) do
        IO.inspect(feature, label: "Clicked symbol")
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseenter", %{"layer_id" => id, "feature" => feature}, socket) do
        # Show tooltip, highlight symbol, etc.
        {:noreply, socket}
      end

      def handle_event("layer:feature_mouseleave", %{"layer_id" => id}, socket) do
        # Hide tooltip, reset highlight
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a symbol layer component.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to attach to
  * `source_id` (required) - ID of the data source
  * `source_layer` - Layer name in the source (for vector tiles)
  * `paint` - Paint properties (text-color, text-halo-color, icon-opacity, etc.)
  * `layout` - Layout properties (text-field, text-font, icon-image, etc.)
  * `filter` - Filter expression to show subset of features
  * `min_zoom` - Minimum zoom level for layer visibility
  * `max_zoom` - Maximum zoom level for layer visibility
  * `before_id` - ID of layer to insert this layer before

  ## Paint Properties

  Text paint properties:
  - `text-color` - Color of the text
  - `text-halo-color` - Color of the text's halo
  - `text-halo-width` - Width of the text's halo
  - `text-halo-blur` - Blur of the text's halo
  - `text-opacity` - Opacity of the text

  Icon paint properties:
  - `icon-color` - Color of the icon
  - `icon-halo-color` - Color of the icon's halo
  - `icon-halo-width` - Width of the icon's halo
  - `icon-halo-blur` - Blur of the icon's halo
  - `icon-opacity` - Opacity of the icon

  ## Layout Properties

  Text layout properties:
  - `text-field` - Value to use for text content
  - `text-font` - Font stack to use for displaying text
  - `text-size` - Font size in pixels
  - `text-anchor` - Part of the text placed closest to the anchor
  - `text-offset` - Offset distance of text from its anchor
  - `text-allow-overlap` - If true, the text will be visible even if it collides
  - `text-ignore-placement` - If true, other symbols can be visible even if they collide with the text

  Icon layout properties:
  - `icon-image` - Name of image in sprite to use for drawing an image background
  - `icon-size` - Scale factor for the icon
  - `icon-offset` - Offset distance of icon from its anchor
  - `icon-anchor` - Part of the icon placed closest to the anchor
  - `icon-allow-overlap` - If true, the icon will be visible even if it collides
  - `icon-ignore-placement` - If true, other symbols can be visible even if they collide with the icon

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

  def symbol_layer(assigns) do
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
      phx-hook="SymbolLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
