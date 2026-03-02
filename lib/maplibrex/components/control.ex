defmodule MaplibreX.Components.Control do
  @moduledoc """
  Generic Control component for creating custom controls on MapLibre maps.

  This component provides a base for creating custom UI controls that can be positioned
  at the corners of the map. It accepts arbitrary HTML content via slots, making it
  flexible for any custom control needs.

  ## Examples

  Basic custom control:

      <.control
        id="my-control"
        map_id="my-map"
        position="top-left"
      >
        <div class="bg-white p-2 rounded shadow">
          <button phx-click="my_action">Custom Action</button>
        </div>
      </.control>

  Control with multiple buttons:

      <.control
        id="custom-panel"
        map_id="my-map"
        position="top-right"
        class="custom-control-panel"
      >
        <div class="flex flex-col gap-2 p-2 bg-white rounded shadow">
          <button phx-click="action_one" class="btn">Action 1</button>
          <button phx-click="action_two" class="btn">Action 2</button>
          <button phx-click="action_three" class="btn">Action 3</button>
        </div>
      </.control>

  Control with LiveView bindings:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.control
          id="layer-toggle"
          map_id="my-map"
          position="top-right"
        >
          <div class="bg-white p-3 rounded shadow">
            <h3 class="font-bold mb-2">Layers</h3>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={@show_layer_1}
                phx-click="toggle_layer_1"
              />
              <span>Layer 1</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={@show_layer_2}
                phx-click="toggle_layer_2"
              />
              <span>Layer 2</span>
            </label>
          </div>
        </.control>
        \"\"\"
      end

  Info control with dynamic content:

      <.control
        id="info-box"
        map_id="my-map"
        position="bottom-left"
      >
        <div class="bg-white p-3 rounded shadow max-w-xs">
          <h4 class="font-bold"><%= @selected_feature.name %></h4>
          <p class="text-sm text-gray-600"><%= @selected_feature.description %></p>
        </div>
      </.control>
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders a custom control on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to add the control to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"top-right"`
  * `class` - Additional CSS classes to apply to the control container

  ## Slots

  * `inner_block` (required) - The HTML content of the control

  ## Events

  This component does not emit custom events. Controls can use standard Phoenix event
  bindings (`phx-click`, etc.) on elements within the slot content.

  ## Notes

  - The control content is rendered as a MapLibre IControl implementation
  - Content can include any HTML and Phoenix LiveView bindings
  - Multiple custom controls can be added to the same map at different positions
  - The control automatically integrates with the map's container
  - Use `phx-update="ignore"` on slot content if you need to prevent LiveView updates
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right"
  attr :class, :string, default: ""
  attr :rest, :global

  slot :inner_block, required: true

  def control(assigns) do
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
      className: assigns.class
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ControlHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    >
      <div id={"#{@id}-content"} class={@class}>
        <%= render_slot(@inner_block) %>
      </div>
    </div>
    """
  end
end
