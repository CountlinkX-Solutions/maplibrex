defmodule MaplibreX.Components.Sky do
  @moduledoc """
  Sky component for adding atmospheric sky rendering to MapLibre maps.

  This component adds a realistic sky layer that responds to map pitch and bearing,
  enhancing 3D terrain and building visualizations. The sky appearance changes
  dynamically based on the sun position.

  ## Examples

  Basic sky with default atmosphere:

      <.sky
        map_id="my-map"
        type="atmosphere"
      />

  Custom sky with specific sun position:

      <.sky
        map_id="my-map"
        type="atmosphere"
        atmosphere_sun={[0.0, 90.0]}
        atmosphere_sun_intensity={5}
      />

  Gradient sky:

      <.sky
        map_id="my-map"
        type="gradient"
        gradient_center={[0, 0]}
        gradient_radius={90}
        gradient={["#87CEEB", "#E0F6FF", "#98D3E8"]}
      />

  Custom sky color:

      <.sky
        map_id="my-map"
        type="atmosphere"
        atmosphere_color="rgba(135, 206, 235, 1)"
        atmosphere_halo_color="rgba(255, 255, 255, 1)"
      />

  ## Events

  The sky component can emit the following events to LiveView:

      def handle_event("sky:added", _params, socket) do
        IO.puts("Sky layer added")
        {:noreply, socket}
      end

      def handle_event("sky:removed", _params, socket) do
        IO.puts("Sky layer removed")
        {:noreply, socket}
      end

  ## Notes

  - Best used with pitched views (pitch: 45-60 degrees)
  - Enhances 3D terrain and building visualizations
  - Sky type can be "atmosphere" or "gradient"
  - Sun position affects atmosphere rendering
  - Automatically responds to camera bearing changes
  """

  use Phoenix.Component

  @doc """
  Renders a sky layer component.

  ## Attributes

  * `map_id` (required) - ID of the map
  * `type` - Sky type: "atmosphere" or "gradient" (default: "atmosphere")
  * `atmosphere_sun` - Sun position [azimuth, polar] in degrees (default: [0.0, 90.0])
  * `atmosphere_sun_intensity` - Sun intensity (default: 10)
  * `atmosphere_color` - Sky atmosphere color (default: "rgba(135, 206, 235, 1)")
  * `atmosphere_halo_color` - Halo color around sun (default: "rgba(255, 255, 255, 1)")
  * `gradient_center` - Gradient center [azimuth, polar] (default: [0, 0])
  * `gradient_radius` - Gradient radius in degrees (default: 90)
  * `gradient` - Array of gradient colors (default: ["#87CEEB", "#E0F6FF", "#98D3E8"])

  ## Sky Types

  * `atmosphere` - Realistic atmospheric sky with sun simulation
  * `gradient` - Simple gradient sky

  ## Atmosphere Properties

  When using type="atmosphere":
  - `atmosphere_sun`: [azimuth, polar] where azimuth is 0-360 and polar is 0-180
    - [0, 90] = sun directly overhead
    - [0, 0] = sun on horizon to north
    - [180, 0] = sun on horizon to south
  - `atmosphere_sun_intensity`: brightness of sun (typically 5-15)
  - `atmosphere_color`: base sky color
  - `atmosphere_halo_color`: glow around sun

  ## Best Practices

  - Use with pitched views for best effect
  - Combine with terrain for realistic landscapes
  - Adjust sun position to match time of day
  - Use gradient type for simpler, less realistic sky
  """
  attr :map_id, :string, required: true
  attr :type, :string, default: "atmosphere"
  attr :atmosphere_sun, :list, default: [0.0, 90.0]
  attr :atmosphere_sun_intensity, :integer, default: 10
  attr :atmosphere_color, :string, default: "rgba(135, 206, 235, 1)"
  attr :atmosphere_halo_color, :string, default: "rgba(255, 255, 255, 1)"
  attr :gradient_center, :list, default: [0, 0]
  attr :gradient_radius, :integer, default: 90
  attr :gradient, :list, default: ["#87CEEB", "#E0F6FF", "#98D3E8"]

  def sky(assigns) do
    # Validate sky type
    valid_types = ["atmosphere", "gradient"]

    unless assigns.type in valid_types do
      raise ArgumentError,
            "Invalid sky type '#{assigns.type}'. Must be one of: #{Enum.join(valid_types, ", ")}"
    end

    # Build paint configuration based on type
    paint =
      case assigns.type do
        "atmosphere" ->
          %{
            "sky-type" => "atmosphere",
            "sky-atmosphere-sun" => assigns.atmosphere_sun,
            "sky-atmosphere-sun-intensity" => assigns.atmosphere_sun_intensity,
            "sky-atmosphere-color" => assigns.atmosphere_color,
            "sky-atmosphere-halo-color" => assigns.atmosphere_halo_color
          }

        "gradient" ->
          %{
            "sky-type" => "gradient",
            "sky-gradient-center" => assigns.gradient_center,
            "sky-gradient-radius" => assigns.gradient_radius,
            "sky-gradient" => assigns.gradient
          }
      end

    config = %{
      mapId: assigns.map_id,
      paint: paint
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={"sky-#{@map_id}"}
      phx-hook="SkyHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
