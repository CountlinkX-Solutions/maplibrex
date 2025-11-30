defmodule MaplibreX.Components.ScaleControl do
  @moduledoc """
  Scale Control component for adding a scale bar to MapLibre maps.

  This component displays a scale bar showing the ratio of a distance on the map
  to the corresponding distance on the ground. The scale automatically updates
  as the map zoom level changes.

  ## Examples

  Basic scale control:

      <.scale_control
        id="scale-control"
        map_id="my-map"
      />

  Scale control with custom position:

      <.scale_control
        id="scale-control"
        map_id="my-map"
        position="bottom-left"
      />

  Control with all options:

      <.scale_control
        id="full-scale-control"
        map_id="my-map"
        position="bottom-right"
        max_width={150}
        unit="metric"
      />

  Multiple scales with different units:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.scale_control
          id="scale-metric"
          map_id="my-map"
          position="bottom-left"
          unit="metric"
        />

        <.scale_control
          id="scale-imperial"
          map_id="my-map"
          position="bottom-right"
          unit="imperial"
        />
        \"\"\"
      end
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)
  @valid_units ~w(imperial metric nautical)

  @doc """
  Renders a scale control on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to add the control to
  * `position` - Control position: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. Defaults to `"bottom-left"`
  * `max_width` - Maximum width of the scale control in pixels. Defaults to `100`
  * `unit` - Unit of measurement: `"imperial"` (miles/feet), `"metric"` (kilometers/meters), or `"nautical"` (nautical miles). Defaults to `"metric"`

  ## Slots

  None - This component has no slots

  ## Events

  This component does not emit custom events. It uses the native MapLibre control behavior.

  ## Notes

  - The scale control is a native MapLibre GL JS control
  - The scale automatically updates as the map zoom level changes
  - Multiple scale controls can be added to show different units simultaneously
  - The control displays the most appropriate unit based on the current zoom level
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "bottom-left"
  attr :max_width, :integer, default: 100
  attr :unit, :string, default: "metric"
  attr :rest, :global

  def scale_control(assigns) do
    # Validate position
    unless assigns.position in @valid_positions do
      raise ArgumentError,
            "Invalid position: #{assigns.position}. Must be one of: #{Enum.join(@valid_positions, ", ")}"
    end

    # Validate unit
    unless assigns.unit in @valid_units do
      raise ArgumentError,
            "Invalid unit: #{assigns.unit}. Must be one of: #{Enum.join(@valid_units, ", ")}"
    end

    # Build control configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      position: assigns.position,
      maxWidth: assigns.max_width,
      unit: assigns.unit
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ScaleControlHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    />
    """
  end
end
