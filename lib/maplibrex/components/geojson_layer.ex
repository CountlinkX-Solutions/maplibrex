defmodule MaplibreX.Components.GeoJSONLayer do
  @moduledoc """
  GeoJSON Layer component for rendering GeoJSON data on MapLibre maps.

  This component allows you to display GeoJSON data with full styling control
  and support for various layer types including fill, line, circle, symbol, and heatmap.

  ## Examples

  Basic GeoJSON fill layer:

      <.geojson_layer
        id="countries"
        map_id="my-map"
        data={@countries_geojson}
        type="fill"
        paint=%{
          "fill-color" => "#088",
          "fill-opacity" => 0.4
        }
      />

  Line layer with styling:

      <.geojson_layer
        id="routes"
        map_id="my-map"
        data={@routes_geojson}
        type="line"
        paint=%{
          "line-color" => "#f00",
          "line-width" => 3
        }
        layout=%{
          "line-cap" => "round",
          "line-join" => "round"
        }
      />

  Circle layer with data-driven styling:

      <.geojson_layer
        id="cities"
        map_id="my-map"
        data={@cities_geojson}
        type="circle"
        paint=%{
          "circle-radius" => [
            "interpolate", ["linear"], ["get", "population"],
            0, 4,
            1000000, 20
          ],
          "circle-color" => "#ff0000"
        }
      />

  Heatmap layer:

      <.geojson_layer
        id="earthquake-heat"
        map_id="my-map"
        data={@earthquakes_geojson}
        type="heatmap"
        paint=%{
          "heatmap-weight" => ["get", "magnitude"],
          "heatmap-intensity" => 1,
          "heatmap-radius" => 20
        }
      />

  Layer with clustering:

      <.geojson_layer
        id="poi-clusters"
        map_id="my-map"
        data={@poi_geojson}
        type="circle"
        cluster={true}
        cluster_max_zoom={14}
        cluster_radius={50}
        paint=%{
          "circle-color" => "#51bbd6",
          "circle-radius" => 10
        }
      />

  Layer with event handling:

      def render(assigns) do
        ~H\"\"\"
        <.geojson_layer
          id="interactive-layer"
          map_id="my-map"
          data={@features}
          type="fill"
          paint=%{"fill-color" => "#088"}
        />
        \"\"\"
      end

      def handle_event("layer:feature_clicked", %{"layerId" => id, "feature" => feature}, socket) do
        IO.inspect(feature, label: "Clicked feature")
        {:noreply, socket}
      end
  """

  use Phoenix.Component
  alias Phoenix.LiveView.JS

  @valid_types ~w(fill line circle symbol heatmap fill-extrusion)

  @doc """
  Renders a GeoJSON layer on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the layer
  * `map_id` (required) - ID of the map to add the layer to
  * `data` (required) - GeoJSON data as a map or JSON string
  * `type` (required) - Layer type: `"fill"`, `"line"`, `"circle"`, `"symbol"`, `"heatmap"`, or `"fill-extrusion"`
  * `paint` - Paint properties for styling the layer
  * `layout` - Layout properties for the layer
  * `filter` - Filter expression to show only specific features
  * `min_zoom` - Minimum zoom level to show the layer
  * `max_zoom` - Maximum zoom level to show the layer
  * `before_id` - ID of layer to insert this layer before
  * `source_layer` - For vector sources, the source layer to use
  * `cluster` - Enable point clustering. Defaults to `false`
  * `cluster_max_zoom` - Maximum zoom to cluster points. Defaults to `14`
  * `cluster_radius` - Cluster radius in pixels. Defaults to `50`
  * `cluster_properties` - Aggregate properties for clusters
  * `generate_id` - Generate unique IDs for features. Defaults to `false`

  ## Slots

  None - This component has no slots

  ## Events

  The layer emits the following events:

  * `layer:feature_clicked` - Fired when a feature is clicked
  * `layer:feature_mouseenter` - Fired when mouse enters a feature
  * `layer:feature_mouseleave` - Fired when mouse leaves a feature
  * `layer:source_loaded` - Fired when the source data is loaded

  ## JavaScript Commands

  You can control layers from LiveView using:

      # Update layer paint properties
      MaplibreX.Components.GeoJSONLayer.set_paint_property("layer-id", "fill-color", "#ff0000")

      # Update layer layout properties
      MaplibreX.Components.GeoJSONLayer.set_layout_property("layer-id", "visibility", "none")

      # Update layer filter
      MaplibreX.Components.GeoJSONLayer.set_filter("layer-id", ["==", ["get", "type"], "park"])

      # Update source data
      MaplibreX.Components.GeoJSONLayer.set_data("layer-id", new_geojson_data)
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :data, :any, required: true
  attr :type, :string, required: true
  attr :paint, :map, default: %{}
  attr :layout, :map, default: %{}
  attr :filter, :any, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :before_id, :string, default: nil
  attr :source_layer, :string, default: nil
  attr :cluster, :boolean, default: false
  attr :cluster_max_zoom, :integer, default: 14
  attr :cluster_radius, :integer, default: 50
  attr :cluster_properties, :map, default: nil
  attr :generate_id, :boolean, default: false
  attr :rest, :global

  def geojson_layer(assigns) do
    # Validate layer type
    unless assigns.type in @valid_types do
      raise ArgumentError,
            "Invalid layer type: #{assigns.type}. Must be one of: #{Enum.join(@valid_types, ", ")}"
    end

    # Parse data if it's a string
    data =
      case assigns.data do
        data when is_binary(data) -> Jason.decode!(data)
        data when is_map(data) -> data
        _ -> raise ArgumentError, "data must be a GeoJSON map or JSON string"
      end

    # Build source configuration
    source_config =
      %{
        type: "geojson",
        data: data,
        generateId: assigns.generate_id
      }
      |> maybe_put(:cluster, assigns.cluster)
      |> maybe_put(:clusterMaxZoom, assigns.cluster && assigns.cluster_max_zoom)
      |> maybe_put(:clusterRadius, assigns.cluster && assigns.cluster_radius)
      |> maybe_put(:clusterProperties, assigns.cluster_properties)

    # Build layer configuration
    layer_config =
      %{
        id: assigns.id,
        type: assigns.type,
        source: "#{assigns.id}-source",
        paint: assigns.paint,
        layout: assigns.layout
      }
      |> maybe_put(:filter, assigns.filter)
      |> maybe_put(:minzoom, assigns.min_zoom)
      |> maybe_put(:maxzoom, assigns.max_zoom)
      |> maybe_put(:"source-layer", assigns.source_layer)

    # Build complete configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        source: source_config,
        layer: layer_config,
        beforeId: assigns.before_id
      }

    assigns = assign(assigns, :config, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="GeoJSONLayerHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    />
    """
  end

  # Private helper to conditionally add keys to a map
  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, _key, false), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  @doc """
  Sets a paint property on a layer.

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.set_paint_property("layer-id", "fill-color", "#ff0000")}>
        Change Color
      </button>
  """
  def set_paint_property(layer_id, property, value) do
    JS.push("layer:set_paint_property",
      value: %{layer_id: layer_id, property: property, value: value},
      target: "##{layer_id}"
    )
  end

  @doc """
  Sets a layout property on a layer.

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.set_layout_property("layer-id", "visibility", "none")}>
        Hide Layer
      </button>
  """
  def set_layout_property(layer_id, property, value) do
    JS.push("layer:set_layout_property",
      value: %{layer_id: layer_id, property: property, value: value},
      target: "##{layer_id}"
    )
  end

  @doc """
  Sets a filter on a layer.

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.set_filter("layer-id", ["==", ["get", "type"], "park"])}>
        Show Parks Only
      </button>
  """
  def set_filter(layer_id, filter) do
    JS.push("layer:set_filter",
      value: %{layer_id: layer_id, filter: filter},
      target: "##{layer_id}"
    )
  end

  @doc """
  Updates the source data for a layer.

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.set_data("layer-id", @new_data)}>
        Update Data
      </button>
  """
  def set_data(layer_id, data) do
    JS.push("layer:set_data",
      value: %{layer_id: layer_id, data: data},
      target: "##{layer_id}"
    )
  end

  @doc """
  Shows a layer by setting visibility to "visible".

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.show("layer-id")}>
        Show Layer
      </button>
  """
  def show(layer_id) do
    set_layout_property(layer_id, "visibility", "visible")
  end

  @doc """
  Hides a layer by setting visibility to "none".

  ## Examples

      <button phx-click={MaplibreX.Components.GeoJSONLayer.hide("layer-id")}>
        Hide Layer
      </button>
  """
  def hide(layer_id) do
    set_layout_property(layer_id, "visibility", "none")
  end
end
