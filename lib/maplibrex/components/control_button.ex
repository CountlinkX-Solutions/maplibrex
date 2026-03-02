defmodule MaplibreX.Components.ControlButton do
  @moduledoc """
  Reusable button control for MapLibre maps.

  This component provides a standardized button control with optional icons,
  tooltips, and active state styling. It can display either a text icon name
  or custom HTML/SVG content via slot.

  ## Examples

  Button with text icon:

      <.control_button
        id="layers-btn"
        map_id="my-map"
        icon="layers"
        tooltip="Toggle Layers"
        phx-click="toggle_layers"
      />

  Button with custom SVG icon:

      <.control_button
        id="custom-btn"
        map_id="my-map"
        tooltip="Custom Action"
        phx-click="custom_action"
      >
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="currentColor"/>
        </svg>
      </.control_button>

  Button with active state:

      <.control_button
        id="filter-btn"
        map_id="my-map"
        icon="filter"
        tooltip="Filter"
        active={@filter_active}
        phx-click="toggle_filter"
      />

  Multiple buttons at different positions:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.control_button
          id="zoom-in"
          map_id="my-map"
          position="top-right"
          icon="+"
          tooltip="Zoom In"
          phx-click="zoom_in"
        />

        <.control_button
          id="zoom-out"
          map_id="my-map"
          position="top-right"
          icon="-"
          tooltip="Zoom Out"
          phx-click="zoom_out"
        />

        <.control_button
          id="my-location"
          map_id="my-map"
          position="bottom-right"
          icon="📍"
          tooltip="My Location"
          phx-click="go_to_location"
        />
        \"\"\"
      end

  Button with Heroicons (if using heroicons library):

      <.control_button
        id="settings"
        map_id="my-map"
        tooltip="Settings"
        phx-click="open_settings"
      >
        <.icon name="hero-cog" class="w-5 h-5" />
      </.control_button>
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders a button control on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control button
  * `map_id` (required) - ID of the map to add the control to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"top-right"`
  * `icon` - Text icon or emoji to display (if no slot provided)
  * `tooltip` - Tooltip text shown on hover
  * `active` - Whether the button is in active state (for styling). Defaults to `false`
  * `class` - Additional CSS classes to apply to the button

  ## Slots

  * `inner_block` - Custom HTML/SVG icon content (alternative to `icon` attribute)

  ## Events

  This component does not emit custom events. Use standard Phoenix event bindings
  (`phx-click`, etc.) on the component itself.

  ## Notes

  - Either `icon` attribute OR slot content should be provided (not both)
  - If both are provided, slot content takes precedence
  - The button integrates with MapLibre's control system
  - Active state adds visual styling to indicate button state
  - Compatible with any icon library (Heroicons, FontAwesome, etc.)
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :icon, :string, default: nil
  attr :tooltip, :string, default: nil
  attr :active, :boolean, default: false
  attr :class, :string, default: ""
  attr :rest, :global

  slot :inner_block

  def control_button(assigns) do
    # Validate position
    unless assigns.position in @valid_positions do
      raise ArgumentError,
            "Invalid position: #{assigns.position}. Must be one of: #{Enum.join(@valid_positions, ", ")}"
    end

    # Warn if neither icon nor slot provided
    has_icon = !is_nil(assigns.icon) && assigns.icon != ""
    has_slot = assigns[:inner_block] != nil && length(assigns.inner_block) > 0

    if !has_icon && !has_slot do
      IO.warn(
        "ControlButton #{assigns.id} has neither icon attribute nor slot content. " <>
          "The button will be empty. Consider providing an icon or custom content."
      )
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      position: assigns.position,
      tooltip: assigns.tooltip,
      active: assigns.active,
      hasSlot: has_slot,
      icon: assigns.icon
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ControlButtonHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    >
      <button
        id={"#{@id}-button"}
        type="button"
        class={"maplibregl-ctrl-icon #{@class}"}
        title={@tooltip}
        aria-label={@tooltip}
      >
        <%= if @inner_block != nil && length(@inner_block) > 0 do %>
          <%= render_slot(@inner_block) %>
        <% else %>
          <%= @icon %>
        <% end %>
      </button>
    </div>
    """
  end
end
