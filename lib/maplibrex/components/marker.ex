defmodule MaplibreX.Components.Marker do
  @moduledoc """
  Marker component for adding markers to MapLibre maps.

  ## Examples

  Basic marker:

      <.marker
        id="marker-1"
        map_id="my-map"
        lng_lat={[-74.5, 40]}
      />

  Styled marker with popup:

      <.marker
        id="marker-nyc"
        map_id="my-map"
        lng_lat={[-74.5, 40]}
        color="red"
        scale={1.2}
        popup_text="New York City - The Big Apple"
      />

  Draggable marker with events:

      <.marker
        id="draggable-marker"
        map_id="my-map"
        lng_lat={@marker_position}
        draggable
      />

      def handle_event("marker:drag_end", %{"markerId" => id, "lngLat" => lngLat}, socket) do
        {:noreply, assign(socket, marker_position: lngLat)}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a marker on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the marker
  * `map_id` (required) - ID of the map to add the marker to
  * `lng_lat` (required) - Marker position as `[longitude, latitude]`
  * `color` - Marker color (hex or named color). Defaults to `"#3FB1CE"`
  * `scale` - Marker scale. Defaults to `1`
  * `rotation` - Marker rotation in degrees. Defaults to `0`
  * `draggable` - Whether the marker can be dragged. Defaults to `false`
  * `anchor` - Marker anchor point. One of: `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, etc.
  * `offset` - Pixel offset as `[x, y]`
  * `pitch_alignment` - How marker is aligned to pitch. One of: `"map"`, `"viewport"`, `"auto"`
  * `rotation_alignment` - How marker is aligned to rotation. One of: `"map"`, `"viewport"`, `"auto"`

  ## Events

  The marker emits the following events:

  * `marker:clicked` - Fired when the marker is clicked
  * `marker:drag_start` - Fired when drag starts (if draggable)
  * `marker:dragging` - Fired while dragging
  * `marker:drag_end` - Fired when drag ends

  ## Slots

  * `popup` - Optional popup content to display when marker is clicked
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :lng_lat, :list, required: true
  attr :color, :string, default: "#3FB1CE"
  attr :scale, :float, default: 1.0
  attr :rotation, :integer, default: 0
  attr :draggable, :boolean, default: false
  attr :anchor, :string, default: nil
  attr :offset, :list, default: nil
  attr :pitch_alignment, :string, default: "auto"
  attr :rotation_alignment, :string, default: "auto"
  attr :rest, :global

  attr :popup_text, :string, default: nil
  attr :popup_html, :string, default: nil

  def marker(assigns) do
    # Build popup configuration if text or HTML provided
    popup_config =
      cond do
        assigns.popup_text ->
          %{
            id: "#{assigns.id}-popup",
            text: assigns.popup_text,
            closeButton: true,
            closeOnClick: true,
            maxWidth: "240px"
          }

        assigns.popup_html ->
          %{
            id: "#{assigns.id}-popup",
            html: assigns.popup_html,
            closeButton: true,
            closeOnClick: true,
            maxWidth: "240px"
          }

        true ->
          nil
      end

    # Build marker configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        lngLat: assigns.lng_lat,
        color: assigns.color,
        scale: assigns.scale,
        rotation: assigns.rotation,
        draggable: assigns.draggable,
        pitchAlignment: assigns.pitch_alignment,
        rotationAlignment: assigns.rotation_alignment
      }
      |> maybe_put(:anchor, assigns.anchor)
      |> maybe_put(:offset, assigns.offset)
      |> maybe_put(:popup, popup_config)

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="MarkerHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    />
    """
  end

  # Private helper to conditionally add keys to a map
  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
