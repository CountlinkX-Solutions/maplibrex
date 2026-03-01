defmodule MaplibreX.Components.RasterDEMSource do
  @moduledoc """
  Raster DEM (Digital Elevation Model) source component for MapLibre maps.

  This component defines a raster DEM source that provides elevation data
  for use with hillshade layers and 3D terrain. Common use cases include
  terrain visualization, hillshading, and 3D terrain rendering.

  ## Examples

  Using Mapbox Terrain-RGB tiles:

      <.raster_dem_source
        id="mapbox-dem"
        map_id="my-map"
        url="mapbox://mapbox.terrain-rgb"
        tile_size={512}
        encoding="mapbox"
      />

      <.hillshade_layer
        id="hillshade"
        map_id="my-map"
        source_id="mapbox-dem"
      />

  Using Terrarium format tiles:

      <.raster_dem_source
        id="terrarium"
        map_id="my-map"
        tiles={["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]}
        encoding="terrarium"
        tile_size={256}
        max_zoom={15}
      />

  ## Encoding Formats

  * `mapbox` - Mapbox Terrain-RGB format (default)
  * `terrarium` - Mapzen Terrarium format

  ## Events

  The raster DEM source can emit the following events to LiveView:

      def handle_event("source:data", %{"source_id" => source_id}, socket) do
        IO.inspect(source_id, label: "DEM data loaded")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a raster DEM source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `url` - TileJSON URL (either url or tiles must be provided)
  * `tiles` - List of tile URL templates
  * `tile_size` - Size of tiles in pixels (default: 512)
  * `min_zoom` - Minimum zoom level (default: 0)
  * `max_zoom` - Maximum zoom level (default: 22)
  * `attribution` - Attribution text
  * `bounds` - Geographic bounds [west, south, east, north]
  * `encoding` - Encoding format: "mapbox" (default) or "terrarium"
  * `volatile` - Whether data should be cached (default: false)

  ## Encoding

  Different DEM tile sources use different encoding schemes:

  - **mapbox**: Mapbox Terrain-RGB format (default)
    - Elevation = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)

  - **terrarium**: Mapzen Terrarium format
    - Elevation = (R * 256 + G + B / 256) - 32768

  ## Events

  * `source:data` - Fired when source data is loaded or updated
  * `source:error` - Fired when there's an error loading the source

  ## Notes

  - Requires hillshade_layer or terrain configuration to visualize
  - DEM sources are used for elevation data, not direct rendering
  - Common tile sizes: 256 or 512 pixels
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
  attr :encoding, :string, default: "mapbox"
  attr :volatile, :boolean, default: false

  def raster_dem_source(assigns) do
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
        encoding: assigns.encoding,
        volatile: assigns.volatile
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    # Validate that either url or tiles is provided
    unless Map.has_key?(config, :url) or Map.has_key?(config, :tiles) do
      raise ArgumentError, "RasterDEMSource requires either 'url' or 'tiles' attribute"
    end

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="RasterDEMSourceHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
