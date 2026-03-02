defmodule MaplibreX.Components.ControlGroup do
  @moduledoc """
  Control group component for grouping multiple controls together on MapLibre maps.

  This component provides a container for grouping multiple button controls or other
  custom controls visually together, creating a cohesive control panel on the map.

  ## Examples

  Basic control group with buttons:

      <.control_group
        id="actions-group"
        map_id="my-map"
        position="top-right"
      >
        <.control_button icon="+" tooltip="Zoom In" phx-click="zoom_in" />
        <.control_button icon="-" tooltip="Zoom Out" phx-click="zoom_out" />
        <.control_button icon="🏠" tooltip="Home" phx-click="go_home" />
      </.control_group>

  Horizontal control group:

      <.control_group
        id="tools-group"
        map_id="my-map"
        position="top-left"
        orientation="horizontal"
      >
        <.control_button icon="✏️" tooltip="Draw" phx-click="start_draw" />
        <.control_button icon="📐" tooltip="Measure" phx-click="start_measure" />
        <.control_button icon="🗑️" tooltip="Clear" phx-click="clear_all" />
      </.control_group>

  Group with mixed content:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.control_group
          id="layer-controls"
          map_id="my-map"
          position="top-right"
          class="layer-controls-group"
        >
          <.control_button
            icon="🗺️"
            tooltip="Layers"
            active={@layers_visible}
            phx-click="toggle_layers"
          />
          <.control_button
            icon="🔍"
            tooltip="Search"
            active={@search_visible}
            phx-click="toggle_search"
          />
          <.control_button
            icon="ℹ️"
            tooltip="Info"
            phx-click="show_info"
          />
        </.control_group>
        \"\"\"
      end

  Multiple groups at different positions:

      <.control_group id="nav-group" map_id="my-map" position="top-right">
        <.control_button icon="⬆️" tooltip="North" phx-click="face_north" />
        <.control_button icon="📍" tooltip="Location" phx-click="my_location" />
      </.control_group>

      <.control_group id="tool-group" map_id="my-map" position="top-left">
        <.control_button icon="📏" tooltip="Measure" phx-click="measure" />
        <.control_button icon="✏️" tooltip="Draw" phx-click="draw" />
      </.control_group>
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)
  @valid_orientations ~w(vertical horizontal)

  @doc """
  Renders a control group on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control group
  * `map_id` (required) - ID of the map to add the control group to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"top-right"`
  * `orientation` - Layout orientation: `"vertical"` or `"horizontal"`. Defaults to `"vertical"`
  * `class` - Additional CSS classes to apply to the control group container

  ## Slots

  * `inner_block` (required) - The controls to group together

  ## Events

  This component does not emit custom events. Child controls can use standard Phoenix
  event bindings (`phx-click`, etc.).

  ## Notes

  - The control group acts as a single visual unit in the map's control system
  - Child controls should typically be `control_button` components but can be any content
  - The group automatically applies proper spacing and styling to child elements
  - Orientation affects the layout direction of grouped controls
  - Multiple groups can be placed at different positions on the map
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :orientation, :string, default: "vertical"
  attr :class, :string, default: ""
  attr :rest, :global

  slot :inner_block, required: true

  def control_group(assigns) do
    # Validate position
    unless assigns.position in @valid_positions do
      raise ArgumentError,
            "Invalid position: #{assigns.position}. Must be one of: #{Enum.join(@valid_positions, ", ")}"
    end

    # Validate orientation
    unless assigns.orientation in @valid_orientations do
      raise ArgumentError,
            "Invalid orientation: #{assigns.orientation}. Must be one of: #{Enum.join(@valid_orientations, ", ")}"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      position: assigns.position,
      orientation: assigns.orientation,
      className: assigns.class
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ControlGroupHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    >
      <div id={"#{@id}-content"} class={"control-group-#{@orientation} #{@class}"}>
        <%= render_slot(@inner_block) %>
      </div>
    </div>
    """
  end
end
