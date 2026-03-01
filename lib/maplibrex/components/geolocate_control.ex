defmodule MaplibreX.Components.GeolocateControl do
  @moduledoc """
  Geolocate control component for MapLibre maps in Phoenix LiveView.

  This component adds a geolocate button that allows users to find their current location
  and optionally track their movement in real-time.

  ## Examples

  Basic geolocate control:

      <.geolocate_control
        id="geolocate-1"
        map_id="my-map"
        position="top-right"
      />

  With tracking enabled:

      <.geolocate_control
        id="geolocate-1"
        map_id="my-map"
        position="top-right"
        track_user_location={true}
        show_accuracy_circle={true}
        show_user_heading={true}
      />

  With custom fit bounds options:

      <.geolocate_control
        id="geolocate-1"
        map_id="my-map"
        position="top-right"
        fit_bounds_options={%{maxZoom: 15, padding: 50}}
      />

  ## Events

  The geolocate control emits the following events to LiveView:

      def handle_event("geolocate:location_found", %{"coords" => coords}, socket) do
        # coords = %{"latitude" => lat, "longitude" => lng, "accuracy" => acc}
        IO.inspect(coords, label: "User location found")
        {:noreply, socket}
      end

      def handle_event("geolocate:location_error", %{"code" => code, "message" => msg}, socket) do
        IO.inspect({code, msg}, label: "Geolocation error")
        {:noreply, socket}
      end

      def handle_event("geolocate:tracking_started", _params, socket) do
        IO.puts("Location tracking started")
        {:noreply, socket}
      end

      def handle_event("geolocate:tracking_stopped", _params, socket) do
        IO.puts("Location tracking stopped")
        {:noreply, socket}
      end

      def handle_event("geolocate:user_location_updated", %{"coords" => coords}, socket) do
        IO.inspect(coords, label: "User location updated")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @valid_positions ~w(top-left top-right bottom-left bottom-right)

  @doc """
  Renders a geolocate control component.

  ## Attributes

  * `id` (required) - Unique identifier for the control
  * `map_id` (required) - ID of the map to attach to
  * `position` - Position of the control. One of: `#{inspect(@valid_positions)}`. Defaults to `"top-right"`
  * `track_user_location` - If true, the control will actively track user's location. Defaults to `false`
  * `show_accuracy_circle` - Show a circle representing location accuracy. Defaults to `true`
  * `show_user_heading` - Show user's heading/direction as they move. Defaults to `true`
  * `fit_bounds_options` - Options for fitting map bounds when location is found. Map with keys like `maxZoom`, `padding`

  ## Events

  * `geolocate:location_found` - Fired when user's location is found
  * `geolocate:location_error` - Fired when there's an error getting location
  * `geolocate:tracking_started` - Fired when location tracking starts
  * `geolocate:tracking_stopped` - Fired when location tracking stops
  * `geolocate:user_location_updated` - Fired when user's location is updated (during tracking)
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :position, :string, default: "top-right", values: @valid_positions
  attr :track_user_location, :boolean, default: false
  attr :show_accuracy_circle, :boolean, default: true
  attr :show_user_heading, :boolean, default: true
  attr :fit_bounds_options, :map, default: %{}

  def geolocate_control(assigns) do
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
        trackUserLocation: assigns.track_user_location,
        showAccuracyCircle: assigns.show_accuracy_circle,
        showUserHeading: assigns.show_user_heading,
        fitBoundsOptions: assigns.fit_bounds_options
      }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="GeolocateControlHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
