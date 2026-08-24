defmodule MaplibreX.Components.DeckGlLayer do
  @moduledoc """
  Renders a deck.gl layer on top of a MapLibre map.

  deck.gl is a WebGL visualisation library for large datasets. This component
  wires deck.gl layers into MapLibre GL JS from Phoenix LiveView.

  The deck.gl packages are lazy-loaded the first time a layer mounts, so
  applications that never use this component pay nothing for it. They are
  optional peer dependencies — see the installation guide in the README.

  > #### Requires maplibre-gl v5 {: .warning}
  >
  > `@deck.gl/mapbox` reads MapLibre's internal `map.transform`, which
  > maplibre-gl v6 removed, and every published version still does. Under v6
  > this component raises with a message naming the constraint. The rest of
  > MaplibreX works on both v5 and v6.

  ## Attributes

    * `id` (required) - Unique layer identifier
    * `map_id` (required) - Id of the map to render into
    * `layer_type` (required) - deck.gl layer type, e.g. `"ScatterplotLayer"`, `"ArcLayer"`
    * `data` (required) - List of records to visualise
    * `props` - Layer-specific properties (default: `%{}`)
    * `before_id` - Insert the layer before this layer id (default: `nil`)
    * `opacity` - Layer opacity, 0-1 (default: `1.0`)
    * `visible` - Layer visibility (default: `true`)
    * `pickable` - Whether the layer responds to pointer events (default: `false`)
    * `auto_highlight` - Highlight objects on hover (default: `false`)
    * `update_triggers` - deck.gl update triggers (default: `%{}`)

  ## Supported layer types

  ### Basic layers

    * `ScatterplotLayer` - Points with a variable radius
    * `ArcLayer` - Arcs between point pairs
    * `LineLayer` - Lines and routes
    * `PolygonLayer` - 2D polygons
    * `PathLayer` - Paths
    * `ColumnLayer` - 3D columns
    * `TextLayer` - Text labels
    * `IconLayer` - Icons

  ### Aggregation layers

    * `HexagonLayer` - Aggregated hexagonal bins
    * `GridLayer` - Grid cells
    * `ScreenGridLayer` - Grid in screen coordinates
    * `HeatmapLayer` - Heatmap
    * `ContourLayer` - Contour lines

  ### Advanced layers

    * `GeoJsonLayer` - GeoJSON rendering

  ## Events

  This component emits:

    * `deckgl:layer_loaded` - Layer loaded successfully
    * `deckgl:click` - An object in the layer was clicked
    * `deckgl:hover` - The pointer entered an object
    * `deckgl:drag_start` - Drag started on an object
    * `deckgl:drag` - Object is being dragged
    * `deckgl:drag_end` - Drag finished
    * `deckgl:error` - The layer failed to process

  ## Examples

  A basic `ScatterplotLayer`:

      <.deckgl_layer
        id="points"
        map_id="my-map"
        layer_type="ScatterplotLayer"
        data={@points}
        pickable={true}
        props={%{
          "getPosition" => "coordinates",
          "getRadius" => 1000,
          "getFillColor" => [255, 140, 0],
          "radiusMinPixels" => 2
        }}
      />

  An `ArcLayer` visualising connections:

      <.deckgl_layer
        id="arcs"
        map_id="my-map"
        layer_type="ArcLayer"
        data={@flights}
        pickable={true}
        auto_highlight={true}
        props={%{
          "getSourcePosition" => "from",
          "getTargetPosition" => "to",
          "getSourceColor" => [255, 140, 0],
          "getTargetColor" => [255, 200, 0],
          "getWidth" => 2
        }}
      />

  A `HexagonLayer` showing density:

      <.deckgl_layer
        id="hexagons"
        map_id="my-map"
        layer_type="HexagonLayer"
        data={@events}
        props={%{
          "getPosition" => "location",
          "elevationScale" => 4,
          "radius" => 200,
          "extruded" => true,
          "coverage" => 0.9
        }}
      />

  ## Handling events

      def handle_event("deckgl:click", %{"object" => object, "coordinate" => coord}, socket) do
        # `object` holds the clicked feature's data, `coord` is [lng, lat]
        {:noreply, socket}
      end

      def handle_event("deckgl:hover", %{"object" => object}, socket) do
        {:noreply, assign(socket, :hovered_object, object)}
      end

  ## Accessors

  Accessors accept several forms:

      # A string naming a property
      "getPosition" => "coordinates"       # d => d.coordinates

      # A MapLibre-style expression
      "getPosition" => ["get", "coords"]   # d => d.coords

      # A constant value
      "getFillColor" => [255, 0, 0]        # always red

  ## Performance

  For large datasets (>100k points):

    * Prefer `HexagonLayer` or `GridLayer` over `ScatterplotLayer`
    * Set `update_triggers` so deck.gl only recomputes what changed
    * Filter data server-side before sending it to the client
    * Reach for aggregation layers wherever they fit

  ## References

    * deck.gl documentation: https://deck.gl/docs
    * Layer catalog: https://deck.gl/docs/api-reference/layers
  """

  use Phoenix.Component

  @valid_layer_types ~w(
    ScatterplotLayer ArcLayer LineLayer HexagonLayer GridLayer
    ColumnLayer PathLayer PolygonLayer GeoJsonLayer ScreenGridLayer
    HeatmapLayer ContourLayer TextLayer IconLayer
  )

  @doc """
  Renders a deck.gl layer.

  ## Example

      <.deckgl_layer
        id="my-layer"
        map_id="map"
        layer_type="ScatterplotLayer"
        data={@points}
        props={%{"getPosition" => "coords"}}
      />
  """
  attr :id, :string, required: true, doc: "Unique layer identifier"
  attr :map_id, :string, required: true, doc: "Id of the map to render into"
  attr :layer_type, :string, required: true, doc: "deck.gl layer type"
  attr :data, :list, required: true, doc: "Records to visualise"
  attr :props, :map, default: %{}, doc: "Layer-specific properties"
  attr :before_id, :string, default: nil, doc: "Insert before this layer id"
  attr :opacity, :float, default: 1.0, doc: "Opacity, 0-1"
  attr :visible, :boolean, default: true, doc: "Layer visibility"
  attr :pickable, :boolean, default: false, doc: "Whether the layer responds to pointer events"
  attr :auto_highlight, :boolean, default: false, doc: "Highlight objects on hover"
  attr :update_triggers, :map, default: %{}, doc: "deck.gl update triggers"

  def deckgl_layer(assigns) do
    validate_layer_type!(assigns.layer_type)
    validate_opacity!(assigns.opacity)
    validate_data!(assigns.data)

    # Build configuration
    config =
      build_layer_config(assigns)
      |> Jason.encode!()

    assigns = assign(assigns, :config, config)

    ~H"""
    <div
      id={@id}
      phx-hook="DeckGlLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end

  # Private functions

  defp build_layer_config(assigns) do
    %{
      id: assigns.id,
      mapId: assigns.map_id,
      layerType: assigns.layer_type,
      data: assigns.data,
      props:
        Map.merge(
          %{
            id: assigns.id,
            pickable: assigns.pickable,
            autoHighlight: assigns.auto_highlight,
            opacity: assigns.opacity,
            visible: assigns.visible
          },
          assigns.props
        ),
      beforeId: assigns.before_id,
      updateTriggers: assigns.update_triggers
    }
  end

  defp validate_layer_type!(layer_type) do
    unless layer_type in @valid_layer_types do
      raise ArgumentError, """
      Invalid layer_type: #{inspect(layer_type)}

      Supported layer types:
      #{Enum.map_join(@valid_layer_types, "\n", &"  * #{&1}")}
      """
    end
  end

  defp validate_opacity!(opacity) when is_float(opacity) or is_integer(opacity) do
    unless opacity >= 0 and opacity <= 1 do
      raise ArgumentError, "opacity must be between 0 and 1, got: #{opacity}"
    end
  end

  defp validate_opacity!(opacity) do
    raise ArgumentError, "opacity must be a number, got: #{inspect(opacity)}"
  end

  defp validate_data!(data) when is_list(data), do: :ok

  defp validate_data!(data) do
    raise ArgumentError, "data must be a list, got: #{inspect(data)}"
  end
end
