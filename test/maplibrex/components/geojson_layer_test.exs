defmodule MaplibreX.Components.GeoJSONLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.GeoJSONLayer

  @sample_geojson %{
    "type" => "FeatureCollection",
    "features" => [
      %{
        "type" => "Feature",
        "geometry" => %{
          "type" => "Point",
          "coordinates" => [-74.5, 40]
        },
        "properties" => %{"name" => "Test Point"}
      }
    ]
  }

  describe "geojson_layer/1" do
    test "renders basic GeoJSON layer with required attributes" do
      assigns = %{
        id: "test-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "circle"
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
        />
        """)

      assert html =~ ~s(id="test-layer")
      assert html =~ ~s(phx-hook="GeoJSONLayerHook")
      assert html =~ ~s(data-config=)
    end

    test "renders layer with paint properties" do
      assigns = %{
        id: "styled-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "fill",
        paint: %{"fill-color" => "#088", "fill-opacity" => 0.4}
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
          paint={@paint}
        />
        """)

      assert html =~ ~s(&quot;fill-color&quot;:&quot;#088&quot;)
      assert html =~ ~s(&quot;fill-opacity&quot;:0.4)
    end

    test "renders layer with layout properties" do
      assigns = %{
        id: "line-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "line",
        layout: %{"line-cap" => "round", "line-join" => "round"}
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
          layout={@layout}
        />
        """)

      assert html =~ ~s(&quot;line-cap&quot;:&quot;round&quot;)
      assert html =~ ~s(&quot;line-join&quot;:&quot;round&quot;)
    end

    test "renders layer with clustering enabled" do
      assigns = %{
        id: "cluster-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "circle",
        cluster: true,
        cluster_max_zoom: 14,
        cluster_radius: 50
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
          cluster={@cluster}
          cluster_max_zoom={@cluster_max_zoom}
          cluster_radius={@cluster_radius}
        />
        """)

      assert html =~ ~s(&quot;cluster&quot;:true)
      assert html =~ ~s(&quot;clusterMaxZoom&quot;:14)
      assert html =~ ~s(&quot;clusterRadius&quot;:50)
    end

    test "renders layer with min and max zoom" do
      assigns = %{
        id: "zoom-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "fill",
        min_zoom: 5,
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minzoom&quot;:5)
      assert html =~ ~s(&quot;maxzoom&quot;:15)
    end

    test "validates layer type" do
      assigns = %{
        id: "invalid-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "invalid-type"
      }

      assert_raise ArgumentError, ~r/Invalid layer type/, fn ->
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
        />
        """)
      end
    end

    test "accepts all valid layer types" do
      valid_types = ["fill", "line", "circle", "symbol", "heatmap", "fill-extrusion"]

      for type <- valid_types do
        assigns = %{
          id: "layer-#{type}",
          map_id: "test-map",
          data: @sample_geojson,
          type: type
        }

        html =
          rendered_to_string(~H"""
          <.geojson_layer
            id={@id}
            map_id={@map_id}
            data={@data}
            type={@type}
          />
          """)

        assert html =~ ~s(id="layer-#{type}")
        assert html =~ ~s(&quot;type&quot;:&quot;#{type}&quot;)
      end
    end

    test "layer container has display: none style" do
      assigns = %{
        id: "hidden-layer",
        map_id: "test-map",
        data: @sample_geojson,
        type: "fill"
      }

      html =
        rendered_to_string(~H"""
        <.geojson_layer
          id={@id}
          map_id={@map_id}
          data={@data}
          type={@type}
        />
        """)

      assert html =~ ~s(style="display: none;")
    end
  end

  describe "JS commands" do
    test "set_paint_property/3 generates correct JS command" do
      command = MaplibreX.Components.GeoJSONLayer.set_paint_property("layer-id", "fill-color", "#ff0000")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_paint_property", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.property == "fill-color"
      assert value.value == "#ff0000"
    end

    test "set_layout_property/3 generates correct JS command" do
      command = MaplibreX.Components.GeoJSONLayer.set_layout_property("layer-id", "visibility", "none")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_layout_property", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.property == "visibility"
      assert value.value == "none"
    end

    test "set_filter/2 generates correct JS command" do
      filter = ["==", ["get", "type"], "park"]
      command = MaplibreX.Components.GeoJSONLayer.set_filter("layer-id", filter)

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_filter", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.filter == filter
    end

    test "set_data/2 generates correct JS command" do
      new_data = %{"type" => "FeatureCollection", "features" => []}
      command = MaplibreX.Components.GeoJSONLayer.set_data("layer-id", new_data)

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_data", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.data == new_data
    end

    test "show/1 generates correct JS command" do
      command = MaplibreX.Components.GeoJSONLayer.show("layer-id")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_layout_property", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.property == "visibility"
      assert value.value == "visible"
    end

    test "hide/1 generates correct JS command" do
      command = MaplibreX.Components.GeoJSONLayer.hide("layer-id")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "layer:set_layout_property", target: "#layer-id", value: value}]] = command.ops
      assert value.layer_id == "layer-id"
      assert value.property == "visibility"
      assert value.value == "none"
    end
  end
end
