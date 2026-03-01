defmodule MaplibreX.Components.RasterTileSource do
  @moduledoc """
  Raster tile source component for MapLibre maps in Phoenix LiveView.

  This component defines a raster tile source that provides raster (image)
  tiles for use with raster layers. Common use cases include satellite imagery,
  terrain maps, and other image-based map layers.

  ## Examples

  Using TileJSON URL:

      <.raster_tile_source
        id="satellite"
        map_id="my-map"
        url="https://example.com/satellite.json"
        tile_size={256}
        attribution="© Satellite Provider"
      />

  Using direct tile URLs with multiple servers:

      <.raster_tile_source
        id="satellite"
        map_id="my-map"
        tiles={[
          "https://a.example.com/satellite/{z}/{x}/{y}.png",
          "https://b.example.com/satellite/{z}/{x}/{y}.png",
          "https://c.example.com/satellite/{z}/{x}/{y}.png"
        ]}
        tile_size={512}
        min_zoom={0}
        max_zoom={18}
        attribution="© Satellite Provider"
      />

  Using the source with a raster layer:

      <.raster_tile_source
        id="satellite"
        map_id="my-map"
        tiles={["https://example.com/satellite/{z}/{x}/{y}.png"]}
        tile_size={256}
      />

      <.raster_layer
        id="satellite-layer"
        map_id="my-map"
        source_id="satellite"
        paint={%{"raster-opacity" => 0.85}}
      />

  ## Events

  The raster tile source can emit the following events to LiveView:

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
  Renders a raster tile source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `url` - TileJSON URL (either url or tiles must be provided)
  * `tiles` - List of tile URL templates (e.g., ["https://a.tile.com/{z}/{x}/{y}.png"])
  * `tile_size` - Size of tiles in pixels (default: 512, common values: 256, 512)
  * `min_zoom` - Minimum zoom level (default: 0)
  * `max_zoom` - Maximum zoom level (default: 22)
  * `attribution` - Attribution text
  * `bounds` - Geographic bounds [west, south, east, north]
  * `scheme` - Tile scheme: "xyz" (default) or "tms"
  * `tms` - Whether the tiles use TMS coordinate scheme (default: false)
  * `volatile` - Whether data should be cached (default: false)

  ## Tile URL Template

  Tile URLs use template placeholders:
  - `{z}` - Zoom level
  - `{x}` - X coordinate
  - `{y}` - Y coordinate

  Example: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`

  ## Tile Size

  The `tile_size` determines the dimensions of the raster tiles:
  - 256 - Traditional tile size, better for slower connections
  - 512 - Higher resolution, better quality on retina displays (default)

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

  The source itself doesn't render anything - it only provides data to raster layers.
  You need to add a raster_layer that references this source to actually see the
  imagery on the map.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :url, :string, default: nil
  attr :tiles, :list, default: nil
  attr :tile_size, :integer, default: 512
  attr :min_zoom, :integer, default: 0
  attr :max_zoom, :integer, default: 22
  attr :attribution, :string, default: nil
  attr :bounds, :list, default: nil
  attr :scheme, :string, default: "xyz"
  attr :tms, :boolean, default: false
  attr :volatile, :boolean, default: false

  def raster_tile_source(assigns) do
    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        url: assigns.url,
        tiles: assigns.tiles,
        tileSize: assigns.tile_size,
        minzoom: assigns.min_zoom,
        maxzoom: assigns.max_zoom,
        attribution: assigns.attribution,
        bounds: assigns.bounds,
        scheme: assigns.scheme,
        tms: assigns.tms,
        volatile: assigns.volatile
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    # Validate that either url or tiles is provided
    unless Map.has_key?(config, :url) or Map.has_key?(config, :tiles) do
      raise ArgumentError, "RasterTileSource requires either 'url' or 'tiles' attribute"
    end

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="RasterTileSourceHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
