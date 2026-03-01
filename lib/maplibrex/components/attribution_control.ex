defmodule MaplibreX.Components.AttributionControl do
  @moduledoc """
  Attribution control component for MapLibre maps in Phoenix LiveView.

  This component adds an attribution control that displays map attribution information
  in a customizable format.

  ## Examples

  Basic attribution control:

      <.attribution_control
        id="attribution-1"
        map_id="my-map"
        position="bottom-right"
      />

  With compact mode disabled:

      <.attribution_control
        id="attribution-1"
        map_id="my-map"
        position="bottom-left"
        compact={false}
      />

  With custom attribution:

      <.attribution_control
        id="attribution-1"
        map_id="my-map"
        position="bottom-right"
        custom_attribution="© My Company 2024 | Custom Data Provider"
      />

  ## Notes

  - The attribution control automatically displays attribution from the map style and sources
  - Custom attribution can be added to supplement the automatic attribution
  - In compact mode, the attribution is collapsed to an info icon that expands on hover/click
  - This is a display-only control with no user events

  ## Position

  The control can be positioned in any corner of the map:
  - `"top-left"`
  - `"top-right"`
  - `"bottom-left"`
  - `"bottom-right"` (default)
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders an attribution control component.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to attach to
  * `position` - Position of the control. One of: `#{inspect(@valid_positions)}`. Defaults to `"bottom-right"`
  * `compact` - If true, displays attribution in compact mode (collapsed). Defaults to `true`
  * `custom_attribution` - Additional custom attribution text to display (optional)
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "bottom-right", values: @valid_positions
  attr :compact, :boolean, default: true
  attr :custom_attribution, :string, default: nil

  def attribution_control(assigns) do
    # Validate position
    unless assigns.position in @valid_positions do
      raise ArgumentError,
            "Invalid position #{inspect(assigns.position)}. Must be one of: #{inspect(@valid_positions)}"
    end

    # Build configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        position: assigns.position,
        compact: assigns.compact,
        customAttribution: assigns.custom_attribution
      }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="AttributionControlHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
