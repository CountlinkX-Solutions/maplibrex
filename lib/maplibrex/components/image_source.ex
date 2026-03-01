defmodule MaplibreX.Components.ImageSource do
  @moduledoc """
  Image source component for MapLibre maps in Phoenix LiveView.

  This component defines a georeferenced image source that can be used with
  raster layers. Common use cases include weather radar overlays, historical
  maps, scanned maps, and any image that needs to be displayed at specific
  geographic coordinates.

  ## Examples

  Basic weather radar overlay:

      <.image_source
        id="radar"
        map_id="my-map"
        url="/images/weather-radar.png"
        coordinates={[
          [-80.425, 46.437],  # top-left
          [-71.516, 46.437],  # top-right
          [-71.516, 37.936],  # bottom-right
          [-80.425, 37.936]   # bottom-left
        ]}
      />

      <.raster_layer
        id="radar-layer"
        map_id="my-map"
        source_id="radar"
        paint={%{"raster-opacity" => 0.85}}
      />

  Historical map overlay:

      <.image_source
        id="historical-map"
        map_id="my-map"
        url="/images/nyc-1880.jpg"
        coordinates={[
          [-74.050, 40.750],
          [-73.950, 40.750],
          [-73.950, 40.650],
          [-74.050, 40.650]
        ]}
      />

  ## Events

  The image source can emit the following events to LiveView:

      def handle_event("source:loaded", %{"source_id" => source_id}, socket) do
        IO.inspect(source_id, label: "Image loaded")
        {:noreply, socket}
      end

      def handle_event("source:error", %{"source_id" => source_id, "error" => error}, socket) do
        IO.inspect({source_id, error}, label: "Image error")
        {:noreply, socket}
      end
  """

  use Phoenix.Component

  @doc """
  Renders an image source component.

  ## Attributes

  * `id` (required) - Unique identifier for the source
  * `map_id` (required) - ID of the map to attach to
  * `url` (required) - URL of the image
  * `coordinates` (required) - Array of 4 coordinates [lng, lat] defining the corners
    in clockwise order starting from top-left: [top-left, top-right, bottom-right, bottom-left]

  ## Coordinates

  The coordinates define the four corners of the image in geographic space.
  They must be provided in this specific order:

  1. Top-left corner [lng, lat]
  2. Top-right corner [lng, lat]
  3. Bottom-right corner [lng, lat]
  4. Bottom-left corner [lng, lat]

  Example for New York City area:
  ```elixir
  coordinates={[
    [-74.05, 40.75],  # NW corner
    [-73.95, 40.75],  # NE corner
    [-73.95, 40.65],  # SE corner
    [-74.05, 40.65]   # SW corner
  ]}
  ```

  ## Events

  * `source:loaded` - Fired when the image is successfully loaded
    - `source_id` - ID of the source

  * `source:error` - Fired when there's an error loading the image
    - `source_id` - ID of the source
    - `error` - Error message

  ## Notes

  - The image will be stretched to fit the coordinates provided
  - The source itself doesn't render anything - you need a raster_layer
  - Supported image formats: PNG, JPEG, GIF, WebP
  - The image URL can be relative or absolute
  - For best results, ensure your image covers the intended area accurately
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :url, :string, required: true
  attr :coordinates, :list, required: true

  def image_source(assigns) do
    # Validate coordinates
    if length(assigns.coordinates) != 4 do
      raise ArgumentError,
            "ImageSource requires exactly 4 coordinates (top-left, top-right, bottom-right, bottom-left)"
    end

    # Build configuration
    config = %{
      id: assigns.id,
      mapId: assigns.map_id,
      url: assigns.url,
      coordinates: assigns.coordinates
    }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="ImageSourceHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
end
