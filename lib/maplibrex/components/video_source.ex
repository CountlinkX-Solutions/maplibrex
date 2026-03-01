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

      def handle_event("video:loaded", %{"source_id" => source_id}, socket) do
        IO.inspect(source_id, label: "Video loaded")
        {:noreply, socket}
      end

      def handle_event("video:error", %{"source_id" => source_id, "error" => error}, socket) do
        IO.inspect({source_id, error}, label: "Video error")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders a video source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `urls` (required) - Array of video URLs (provide multiple formats for browser compatibility)
  * `coordinates` (required) - Array of 4 coordinates [lng, lat] defining the corners
    in clockwise order: [top-left, top-right, bottom-right, bottom-left]

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

  * `video:loaded` - Fired when the video is loaded
  * `video:error` - Fired when there's an error loading the video

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

  def video_source(assigns) do
    # Validate coordinates
    if length(assigns.coordinates) != 4 do
      raise ArgumentError,
            "VideoSource requires exactly 4 coordinates (top-left, top-right, bottom-right, bottom-left)"
    end

    # Validate URLs
    if length(assigns.urls) == 0 do
      raise ArgumentError, "VideoSource requires at least one video URL"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      urls: assigns.urls,
      coordinates: assigns.coordinates
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

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
