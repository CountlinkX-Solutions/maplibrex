defmodule MaplibreX.Components.Terrain do
  @moduledoc """
  Terrain component for enabling 3D terrain visualization in MapLibre maps.

  This component enables 3D terrain rendering using a RasterDEMSource.
  It requires a RasterDEMSource to be configured on the map first.

  ## Examples

  Basic terrain setup with Mapbox terrain tiles:

      <.raster_dem_source
        id="mapbox-dem"
        map_id="my-map"
        url="mapbox://mapbox.terrain-rgb"
        tile_size={512}
        max_zoom={14}
      />

      <.terrain
        map_id="my-map"
        source_id="mapbox-dem"
        exaggeration={1.5}
      />

  Terrain with custom DEM source:

      <.raster_dem_source
        id="custom-dem"
        map_id="my-map"
        tiles={["https://example.com/dem/{z}/{x}/{y}.png"]}
        encoding="terrarium"
      />

      <.terrain
        map_id="my-map"
        source_id="custom-dem"
        exaggeration={2.0}
      />

  ## Events

  The terrain component can emit the following events to LiveView:

      def handle_event("terrain:enabled", %{"exaggeration" => exag}, socket) do
        IO.inspect(exag, label: "Terrain enabled with exaggeration")
        {:noreply, socket}
      end

      def handle_event("terrain:disabled", _params, socket) do
        IO.puts("Terrain disabled")
        {:noreply, socket}
      end

  ## Notes

  - Requires a RasterDEMSource to be configured first
  - Exaggeration values typically range from 0.5 to 3.0
  - Higher exaggeration makes terrain more dramatic
  - Terrain rendering requires WebGL support
  - Best viewed with pitch and bearing camera angles
  """

  use Phoenix.Component

  @doc """
  Renders a terrain component.

  ## Attributes

  * `map_id` (required) - ID of the map to enable terrain on
  * `source_id` (required) - ID of the RasterDEMSource to use for terrain data
  * `exaggeration` - Vertical exaggeration factor (default: 1.0)
    - Values between 0.5 and 3.0 are typical
    - 1.0 = realistic terrain
    - >1.0 = more dramatic/exaggerated terrain
    - <1.0 = flattened terrain

  ## Events

  * `terrain:enabled` - Fired when terrain is successfully enabled
  * `terrain:disabled` - Fired when terrain is disabled
  * `terrain:error` - Fired when there's an error enabling terrain

  ## Requirements

  - A RasterDEMSource must be added to the map before enabling terrain
  - The source_id must match an existing RasterDEMSource
  - The map must support WebGL

  ## Camera Settings

  For best terrain visualization, consider setting:
  - pitch: 45-60 degrees
  - bearing: any angle for orientation
  - zoom: depends on terrain detail
  """
  attr :map_id, :string, required: true
  attr :source_id, :string, required: true
  attr :exaggeration, :float, default: 1.0

  def terrain(assigns) do
    # Validate exaggeration range
    if assigns.exaggeration < 0 do
      raise ArgumentError, "Terrain exaggeration must be >= 0"
    end

    # Build configuration
    config = %{
      mapId: assigns.map_id,
      sourceId: assigns.source_id,
      exaggeration: assigns.exaggeration
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={"terrain-#{@map_id}"}
      phx-hook="TerrainHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
