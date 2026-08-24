defmodule MaplibreX.Components.VectorTileSource do
  @moduledoc """
  Vector tile source component for MapLibre maps in Phoenix LiveView.

  This component defines a vector tile source that can be used by multiple
  layers. Vector tiles contain vector geometries and metadata encoded in
  Protocol Buffers format (.pbf).

  ## Examples

  Using TileJSON URL:

      <.vector_tile_source
        id="osm"
        map_id="my-map"
        url="https://example.com/tiles.json"
        attribution="© OpenStreetMap contributors"
      />

  Using direct tile URLs with multiple servers:

      <.vector_tile_source
        id="osm"
        map_id="my-map"
        tiles={[
          "https://a.example.com/tiles/{z}/{x}/{y}.pbf",
          "https://b.example.com/tiles/{z}/{x}/{y}.pbf",
          "https://c.example.com/tiles/{z}/{x}/{y}.pbf"
        ]}
        min_zoom={0}
        max_zoom={14}
        attribution="© OpenStreetMap contributors"
      />

  Using the source in layers:

      <.vector_tile_source
        id="osm"
        map_id="my-map"
        url="https://example.com/tiles.json"
      />

      <.circle_layer
        id="pois"
        map_id="my-map"
        source_id="osm"
        source_layer="poi"
        paint={%{"circle-radius" => 5}}
      />

      <.line_layer
        id="roads"
        map_id="my-map"
        source_id="osm"
        source_layer="road"
        paint={%{"line-width" => 2}}
      />

  ## Events

  The vector tile source can emit the following events to LiveView:

      def handle_event("source:data", %{"source_id" => source_id, "data_type" => type}, socket) do
        IO.inspect({source_id, type}, label: "Source data loaded")
        {:noreply, socket}
      end

      def handle_event("source:error", %{"source_id" => source_id, "error" => error}, socket) do
        IO.inspect({source_id, error}, label: "Source error")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a vector tile source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `url` - TileJSON URL (either url or tiles must be provided)
  * `tiles` - List of tile URL templates (e.g., ["https://a.tile.com/{z}/{x}/{y}.pbf"])
  * `min_zoom` - Minimum zoom level (default: 0)
  * `max_zoom` - Maximum zoom level (default: 22)
  * `attribution` - Attribution text
  * `bounds` - Geographic bounds [west, south, east, north]
  * `scheme` - Tile scheme: "xyz" (default) or "tms"
  * `promote_id` - Property to use as feature ID
  * `volatile` - Whether data should be cached (default: false)

  ## Tile URL Template

  Tile URLs use template placeholders:
  - `{z}` - Zoom level
  - `{x}` - X coordinate
  - `{y}` - Y coordinate

  Example: `https://tile.openstreetmap.org/{z}/{x}/{y}.pbf`

  ## TileJSON

  When using a TileJSON URL, the source specification is fetched from that
  URL and may override some of the provided properties.

  ## Events

  * `source:data` - Fired when source data is loaded or updated
    - `source_id` - ID of the source
    - `data_type` - Type of data ("source" or "metadata")
    - `tile` - Tile coordinates if applicable

  * `source:error` - Fired when there's an error loading the source
    - `source_id` - ID of the source
    - `error` - Error message

  ## Notes

  The source itself doesn't render anything - it only provides data to layers.
  You need to add layers (circle_layer, line_layer, etc.) that reference this
  source to actually see the data on the map.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :url, :string, default: nil
  attr :tiles, :list, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :attribution, :string, default: nil
  attr :bounds, :list, default: nil
  attr :scheme, :string, default: nil
  attr :promote_id, :map, default: nil
  attr :volatile, :boolean, default: false

  def vector_tile_source(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        url: assigns.url,
        tiles: assigns.tiles,
        minzoom: assigns.min_zoom,
        maxzoom: assigns.max_zoom,
        attribution: assigns.attribution,
        bounds: assigns.bounds,
        scheme: assigns.scheme,
        promoteId: assigns.promote_id,
        volatile: assigns.volatile
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    # Validate that either url or tiles is provided
    unless Map.has_key?(config, :url) or Map.has_key?(config, :tiles) do
      raise ArgumentError, "VectorTileSource requires either 'url' or 'tiles' attribute"
    end

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="VectorTileSourceHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
