defmodule MaplibreX.Components.FullscreenControl do
  @moduledoc """
  Fullscreen Control component for adding fullscreen toggle to MapLibre maps.

  This component provides a button to toggle fullscreen mode for the map.
  It automatically detects browser fullscreen capabilities and handles
  enter/exit fullscreen states.

  ## Examples

  Basic fullscreen control:

      <.fullscreen_control
        id="fullscreen-control"
        map_id="my-map"
      />

  Fullscreen control with custom position:

      <.fullscreen_control
        id="fullscreen-control"
        map_id="my-map"
        position="top-left"
      />

  Fullscreen for a specific container:

      <.fullscreen_control
        id="fullscreen-control"
        map_id="my-map"
        container_id="map-container"
      />

  With all options:

      def render(assigns) do
        ~H\"\"\"
        <div id="map-wrapper" class="relative">
          <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

          <.fullscreen_control
            id="fullscreen-control"
            map_id="my-map"
            position="top-right"
            container_id="map-wrapper"
          />
        </div>
        \"\"\"
      end
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders a fullscreen control on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to add the control to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"top-right"`
  * `container_id` - ID of the HTML element to make fullscreen. If not provided, defaults to the map container

  ## Slots

  None - This component has no slots

  ## Events

  The control emits the following events:

  * `fullscreen:entered` - Fired when entering fullscreen mode
  * `fullscreen:exited` - Fired when exiting fullscreen mode

  ## Notes

  - The fullscreen control is a native MapLibre GL JS control
  - Browser fullscreen API support is automatically detected
  - The control is hidden in browsers that don't support fullscreen
  - The ESC key can be used to exit fullscreen mode
  - Some browsers may require user interaction before allowing fullscreen
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :container_id, :string, default: nil
  attr :rest, :global

  def fullscreen_control(assigns) do
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
      containerSelector: assigns.container_id
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="FullscreenControlHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    />
    """
  end
end
