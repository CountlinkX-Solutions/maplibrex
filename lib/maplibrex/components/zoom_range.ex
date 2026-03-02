defmodule MaplibreX.Components.ZoomRange do
  @moduledoc """
  ZoomRange component for showing/hiding content based on map zoom level.

  This component wraps content that should only be visible within a specific zoom range.
  It listens to map zoom events and automatically shows or hides the content using CSS.

  ## Examples

  Show content only at high zoom levels:

      <.zoom_range
        id="detail-view"
        map_id="my-map"
        min={12}
      >
        <div class="detail-panel">
          Detailed information visible only when zoomed in
        </div>
      </.zoom_range>

  Show content only at low zoom levels:

      <.zoom_range
        id="overview"
        map_id="my-map"
        max={8}
      >
        <div class="overview-panel">
          Overview visible only when zoomed out
        </div>
      </.zoom_range>

  Show content within a specific zoom range:

      <.zoom_range
        id="mid-zoom-info"
        map_id="my-map"
        min={8}
        max={14}
      >
        <div class="info-box">
          Information for medium zoom levels (8-14)
        </div>
      </.zoom_range>

  Conditional UI based on zoom:

      def render(assigns) do
        ~H\"\"\"
        <.map id="my-map" center={[-74.5, 40]} zoom={9} style={@style} class="h-96" />

        <.zoom_range id="zoom-in-msg" map_id="my-map" max={10}>
          <div class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 p-2 rounded">
            Zoom in to see building details
          </div>
        </.zoom_range>

        <.zoom_range id="building-details" map_id="my-map" min={14}>
          <div class="absolute bottom-4 right-4 bg-white p-3 rounded shadow">
            <h3>Building Details</h3>
            <p>Detailed building information</p>
          </div>
        </.zoom_range>
        \"\"\"
      end

  Complex example with multiple ranges:

      <.zoom_range id="country-level" map_id="my-map" max={4}>
        <div>Country view</div>
      </.zoom_range>

      <.zoom_range id="state-level" map_id="my-map" min={4} max={8}>
        <div>State view</div>
      </.zoom_range>

      <.zoom_range id="city-level" map_id="my-map" min={8} max={12}>
        <div>City view</div>
      </.zoom_range>

      <.zoom_range id="street-level" map_id="my-map" min={12}>
        <div>Street view</div>
      </.zoom_range>
  """

  use Phoenix.Component

  @doc """
  Renders content that is conditionally visible based on zoom level.

  ## Attributes

  * `id` (required) - Unique identifier for the zoom range component
  * `map_id` (required) - ID of the map to monitor for zoom changes
  * `min` - Minimum zoom level (inclusive). If not provided, no minimum constraint
  * `max` - Maximum zoom level (inclusive). If not provided, no maximum constraint

  ## Slots

  * `inner_block` (required) - The content to show/hide based on zoom level

  ## Events

  This component does not emit custom events. It only listens to map zoom changes.

  ## Notes

  - Content is always rendered in the DOM, only visibility is toggled with CSS (`display: none/block`)
  - For map layers, it's more efficient to use the native `min_zoom`/`max_zoom` properties
  - This component is best for UI elements that need zoom-based visibility
  - The component automatically cleans up event listeners when destroyed
  - At least one of `min` or `max` should be provided for meaningful behavior
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :min, :integer, default: nil
  attr :max, :integer, default: nil
  attr :rest, :global

  slot :inner_block, required: true

  def zoom_range(assigns) do
    # Validate that at least min or max is provided
    if is_nil(assigns.min) and is_nil(assigns.max) do
      IO.warn(
        "ZoomRange component #{assigns.id} has neither min nor max zoom specified. " <>
          "Content will always be visible. Consider specifying at least one constraint."
      )
    end

    # Validate min < max if both provided
    if !is_nil(assigns.min) and !is_nil(assigns.max) and assigns.min > assigns.max do
      raise ArgumentError,
            "Invalid zoom range: min (#{assigns.min}) must be less than or equal to max (#{assigns.max})"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      min: assigns.min,
      max: assigns.max
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ZoomRangeHook"
      data-config={@config}
      {@rest}
    >
      <div id={"#{@id}-content"}>
        <%= render_slot(@inner_block) %>
      </div>
    </div>
    """
  end
end
