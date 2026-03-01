defmodule MaplibreX.Components.TerrainControl do
  @moduledoc """
  Terrain Control component for toggling 3D terrain on/off in MapLibre maps.

  This component provides a UI control button that allows users to easily
  enable or disable 3D terrain visualization. It requires a RasterDEMSource
  to be configured on the map.

  ## Examples

  Basic terrain control with Mapbox terrain:

      <.raster_dem_source
        id="mapbox-dem"
        map_id="my-map"
        url="mapbox://mapbox.terrain-rgb"
        tile_size={512}
      />

      <.terrain_control
        id="terrain-toggle"
        map_id="my-map"
        position="top-right"
        terrain_source_id="mapbox-dem"
        exaggeration={1.5}
      />

  Custom styling:

      <.terrain_control
        id="terrain-toggle"
        map_id="my-map"
        position="bottom-left"
        terrain_source_id="mapbox-dem"
        exaggeration={2.0}
        enabled={true}
      />

  ## Events

  The terrain control can emit the following events to LiveView:

      def handle_event("terrain_control:toggled", %{"enabled" => enabled}, socket) do
        IO.inspect(enabled, label: "Terrain toggled")
        {:noreply, socket}
      end

  ## Notes

  - Requires a RasterDEMSource to be configured first
  - Shows a 3D/terrain icon button
  - Toggles between enabled/disabled states
  - Can be positioned like other map controls
  """

  use Phoenix.Component

  @doc """
  Renders a terrain control component.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map
  * `position` - Position on map: "top-left", "top-right", "bottom-left", "bottom-right" (default: "top-right")
  * `terrain_source_id` (required) - ID of the RasterDEMSource to use
  * `exaggeration` - Terrain exaggeration factor when enabled (default: 1.5)
  * `enabled` - Initial terrain state (default: false)

  ## Events

  * `terrain_control:toggled` - Fired when terrain is toggled on/off
  * `terrain_control:error` - Fired when there's an error

  ## Styling

  The control uses standard MapLibre control styling and can be customized
  with CSS targeting the `.maplibregl-ctrl-terrain` class.
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :terrain_source_id, :string, required: true
  attr :exaggeration, :float, default: 1.5
  attr :enabled, :boolean, default: false

  def terrain_control(assigns) do
    # Validate position
    valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

    unless assigns.position in valid_positions do
      raise ArgumentError,
            "Invalid position '#{assigns.position}'. Must be one of: #{Enum.join(valid_positions, ", ")}"
    end

    # Validate exaggeration
    if assigns.exaggeration < 0 do
      raise ArgumentError, "Terrain exaggeration must be >= 0"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      position: assigns.position,
      terrainSourceId: assigns.terrain_source_id,
      exaggeration: assigns.exaggeration,
      enabled: assigns.enabled
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="TerrainControlHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
