defmodule MaplibreX.Components.Terrain do
  @moduledoc """
  Terrain component for enabling 3D terrain visualization in MapLibre maps.

  This component enables 3D terrain rendering using a RasterDEMSource.

  The terrain is turned on as soon as the map exists, its style can take it
  and the DEM source is on the map, whatever the order of the components in
  the template: a terrain rendered before its map or its source waits for
  them, however late the source comes. It follows changes to `source_id` and
  `exaggeration`, is turned back on after the map style changes, and is turned
  off when the component is removed.

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

  - Needs a RasterDEMSource with the id given as `source_id`; until it is on
    the map the terrain waits for it, with one console warning (none when a
    source component is about to add it) and no `terrain:error`
  - Exaggeration values typically range from 0.5 to 3.0
  - Higher exaggeration makes terrain more dramatic
  - Terrain rendering requires WebGL support
  - Best viewed with pitch and bearing camera angles
  """

  use Phoenix.Component
  alias MaplibreX.Components.Events

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
  * `events` - List of the events to push to the LiveView, e.g.
    `["terrain:enabled"]`. Optional: without it, every event listed under Events
    is pushed

  ## Events

  * `terrain:enabled` - Fired once, the first time the terrain is on, with
    `source_id` and `exaggeration`. Not fired again when a style change or a
    new assign turns it on again
  * `terrain:disabled` - Fired when the component is removed and turns the
    terrain off. A terrain that is no longer the component's own (another one
    was set since) is left on, and the event is not fired
  * `terrain:error` - Fired, with `error`, when MapLibre fails to enable the
    terrain. A source that is not on the map yet is not an error

  ## Requirements

  - The source_id must name a RasterDEMSource, rendered before or after this
    component
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
  attr :events, :list, default: nil

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

    assigns = assign(assigns, :config, Jason.encode!(Events.put(config, assigns.events)))

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
