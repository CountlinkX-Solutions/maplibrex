defmodule MaplibreX.Components.FillExtrusionLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "fill_extrusion_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "buildings-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="buildings-1")
      assert html =~ ~s(phx-hook="FillExtrusionLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "buildings-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;buildings-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;test-source&quot;)
    end

    test "renders with basic paint properties" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "fill-extrusion-color" => "#aaa",
          "fill-extrusion-height" => 10,
          "fill-extrusion-opacity" => 0.6
        }
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-extrusion-color&quot;:&quot;#aaa&quot;)
      assert html =~ ~s(&quot;fill-extrusion-height&quot;:10)
      assert html =~ ~s(&quot;fill-extrusion-opacity&quot;:0.6)
    end

    test "renders with data-driven height from properties" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "fill-extrusion-height" => ["get", "height"],
          "fill-extrusion-base" => ["get", "min_height"]
        }
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-extrusion-height&quot;:[&quot;get&quot;,&quot;height&quot;])
      assert html =~ ~s(&quot;fill-extrusion-base&quot;:[&quot;get&quot;,&quot;min_height&quot;])
    end

    test "renders with interpolated color based on height" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "fill-extrusion-color" => [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0,
            "#fbb03b",
            50,
            "#223b53",
            100,
            "#e55e5e"
          ]
        }
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-extrusion-color&quot;:[&quot;interpolate&quot;)
      assert html =~ ~s(&quot;height&quot;)
      assert html =~ ~s(#fbb03b)
    end

    test "renders with vertical gradient enabled" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "fill-extrusion-vertical-gradient" => true
        }
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-extrusion-vertical-gradient&quot;:true)
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        source_layer: "building"
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;building&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        layout: %{"visibility" => "visible"}
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;layout&quot;:{&quot;visibility&quot;:&quot;visible&quot;})
    end

    test "renders with filter expression" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        filter: ["==", "extrude", "true"]
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} filter={@filter} />
        """)

      assert html =~ ~s(&quot;filter&quot;:[&quot;==&quot;,&quot;extrude&quot;,&quot;true&quot;])
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source",
        min_zoom: 15,
        max_zoom: 22
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:15)
      assert html =~ ~s(&quot;maxZoom&quot;:22)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "buildings-3d",
        map_id: "test-map",
        source_id: "buildings",
        source_layer: "building",
        paint: %{
          "fill-extrusion-color" => [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0,
            "#fbb03b",
            100,
            "#e55e5e"
          ],
          "fill-extrusion-height" => ["get", "height"],
          "fill-extrusion-base" => ["get", "min_height"],
          "fill-extrusion-opacity" => 0.9,
          "fill-extrusion-vertical-gradient" => true
        },
        layout: %{"visibility" => "visible"},
        filter: ["==", "extrude", "true"],
        min_zoom: 15,
        max_zoom: 22,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
          paint={@paint}
          layout={@layout}
          filter={@filter}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="buildings-3d")
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;building&quot;)
      assert html =~ ~s(&quot;fill-extrusion-color&quot;)
      assert html =~ ~s(&quot;fill-extrusion-height&quot;)
      assert html =~ ~s(&quot;fill-extrusion-base&quot;)
      assert html =~ ~s(&quot;fill-extrusion-opacity&quot;:0.9)
      assert html =~ ~s(&quot;fill-extrusion-vertical-gradient&quot;:true)
      assert html =~ ~s(&quot;layout&quot;)
      assert html =~ ~s(&quot;filter&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:15)
      assert html =~ ~s(&quot;maxZoom&quot;:22)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "omits nil and empty values from configuration" do
      assigns = %{
        id: "buildings-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.fill_extrusion_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      # Should not include sourceLayer, layout, filter, minZoom, maxZoom, beforeId when nil/empty
      refute html =~ ~s(&quot;sourceLayer&quot;)
      refute html =~ ~s(&quot;layout&quot;)
      refute html =~ ~s(&quot;filter&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end
  end
end
