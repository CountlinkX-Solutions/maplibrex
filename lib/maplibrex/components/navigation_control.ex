defmodule MaplibreX.Components.NavigationControl do
  @moduledoc """
  Navigation Control component for adding zoom and rotation controls to MapLibre maps.

  This component provides standard navigation controls including zoom buttons (+/-),
  compass for rotation, and optional pitch visualization.

  ## Examples

  Basic navigation control:

      <.navigation_control
        id="nav-control"
        map_id="my-map"
      />

  Navigation control with custom position:

      <.navigation_control
        id="nav-control"
        map_id="my-map"
        position="top-left"
      />

  Control with all options:

      <.navigation_control
        id="full-nav-control"
        map_id="my-map"
        position="top-right"
        show_compass={true}
        show_zoom={true}
        visualize_pitch={true}
      />

  Multiple controls on same map:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.navigation_control
          id="nav-zoom"
          map_id="my-map"
          position="top-right"
          show_compass={false}
          show_zoom={true}
        />

        <.navigation_control
          id="nav-compass"
          map_id="my-map"
          position="bottom-right"
          show_compass={true}
          show_zoom={false}
        />
        \"\"\"
      end
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders a navigation control on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to add the control to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"top-right"`
  * `show_compass` - Show compass button for rotation. Defaults to `true`
  * `show_zoom` - Show zoom buttons (+/-). Defaults to `true`
  * `visualize_pitch` - Show pitch visualization in compass. Defaults to `false`

  ## Slots

  None - This component has no slots

  ## Events

  This component does not emit custom events. It uses the native MapLibre control behavior.

  ## Notes

  - The navigation control is a native MapLibre GL JS control
  - Multiple navigation controls can be added to the same map at different positions
  - The control automatically adapts to the map's style and theme
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :show_compass, :boolean, default: true
  attr :show_zoom, :boolean, default: true
  attr :visualize_pitch, :boolean, default: false
  attr :rest, :global

  def navigation_control(assigns) do
    # Validate position
    unless assigns.position in @valid_positions do
      raise ArgumentError,
            "Invalid position: #{assigns.position}. Must be one of: #{Enum.join(@valid_positions, ", ")}"
    end

    # Build control configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      position: assigns.position,
      showCompass: assigns.show_compass,
      showZoom: assigns.show_zoom,
      visualizePitch: assigns.visualize_pitch
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="NavigationControlHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    />
    """
  end
end
