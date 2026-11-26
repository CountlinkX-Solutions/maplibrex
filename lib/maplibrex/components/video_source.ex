defmodule MaplibreX.Components.VideoSource do
  @moduledoc """
  Video source component for MapLibre maps in Phoenix LiveView.

  This component defines a georeferenced video source that can be used with
  raster layers. Common use cases include drone footage overlays, surveillance
  camera feeds, and time-lapse videos displayed at specific geographic locations.

  ## Examples

  Basic drone footage overlay:

      <.video_source
        id="drone-footage"
        map_id="my-map"
        urls={[
          "/videos/drone.mp4",
          "/videos/drone.webm"
        ]}
        coordinates={[
          [-122.51596391201019, 37.56238816766053],
          [-122.51467645168304, 37.56410183312965],
          [-122.51309394836426, 37.563391708549425],
          [-122.51423120498657, 37.56161849366671]
        ]}
      />

      <.raster_layer
        id="drone-layer"
        map_id="my-map"
        source_id="drone-footage"
      />

  ## Events

  The video source can emit the following events to LiveView:

      def handle_event("source:added", %{"source_id" => source_id}, socket) do
        IO.inspect(source_id, label: "Video source added")
        {:noreply, socket}
      end

      def handle_event("source:error", %{"source_id" => source_id, "error" => error}, socket) do
        IO.inspect({source_id, error}, label: "Video error")
        {:noreply, socket}
      end
  """

  use Phoenix.Component
  alias MaplibreX.Components.Events

  @doc """
  Renders a video source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `urls` (required) - Array of video URLs (provide multiple formats for browser compatibility)
  * `coordinates` (required) - Array of 4 coordinates [lng, lat] defining the corners
    in clockwise order: [top-left, top-right, bottom-right, bottom-left]
  * `events` - List of the events to push to the LiveView, e.g.
    `["source:error"]`. Optional: without it, every event listed under Events
    is pushed

  ## Video Formats

  For maximum browser compatibility, provide multiple video formats:
  - MP4 (H.264) - Widest compatibility
  - WebM - Better compression, modern browsers
  - OGV - Alternative format

  Example:
  ```elixir
  urls={[
    "/videos/drone.mp4",
    "/videos/drone.webm",
    "/videos/drone.ogv"
  ]}
  ```

  ## Coordinates

  The coordinates define the four corners where the video will be displayed:

  1. Top-left corner [lng, lat]
  2. Top-right corner [lng, lat]
  3. Bottom-right corner [lng, lat]
  4. Bottom-left corner [lng, lat]

  ## Events

  * `source:added` - Fired once, with `source_id`, the first time the source
    is on the map (not again when a style change puts it back)
  * `source:removed` - Fired, with `source_id`, once the source is gone after
    the component is removed, if `source:added` was fired
  * `source:error` - Fired, with `source_id` and `error`, when MapLibre fails
    to add or replace the source

  ## Notes

  - The video will be stretched to fit the coordinates
  - Video playback is controlled by the browser
  - The source requires a raster_layer to visualize
  - Consider video file size and bandwidth
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :urls, :list, required: true
  attr :coordinates, :list, required: true
  attr :events, :list, default: nil

  def video_source(assigns) do
    # Validate coordinates
    if length(assigns.coordinates) != 4 do
      raise ArgumentError,
            "VideoSource requires exactly 4 coordinates (top-left, top-right, bottom-right, bottom-left)"
    end

    # Validate URLs
    if assigns.urls == [] do
      raise ArgumentError, "VideoSource requires at least one video URL"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      urls: assigns.urls,
      coordinates: assigns.coordinates
    }

    assigns = assign(assigns, :config, Jason.encode!(Events.put(config, assigns.events)))

    ~H"""
    <div
      id={@id}
      phx-hook="VideoSourceHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
