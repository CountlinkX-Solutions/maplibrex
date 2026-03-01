defmodule MaplibreX.Components.LineLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "line_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "lines-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="lines-1")
      assert html =~ ~s(phx-hook="LineLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "lines-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;lines-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;test-source&quot;)
    end

    test "renders with paint properties" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{"line-width" => 3, "line-color" => "#007cbf"}
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;line-width&quot;:3)
      assert html =~ ~s(&quot;line-color&quot;:&quot;#007cbf&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        layout: %{"line-cap" => "round", "line-join" => "round"}
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;line-cap&quot;:&quot;round&quot;)
      assert html =~ ~s(&quot;line-join&quot;:&quot;round&quot;)
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        source_layer: "roads"
      }

      html =
        rendered_to_string(~H"""
        <.line_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;roads&quot;)
    end

    test "renders with filter expression" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        filter: ["in", "class", "motorway", "trunk"]
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} filter={@filter} />
        """)

      assert html =~ ~s(&quot;filter&quot;:[&quot;in&quot;,&quot;class&quot;,&quot;motorway&quot;,&quot;trunk&quot;])
    end

    test "renders with min_zoom constraint" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        min_zoom: 5
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} min_zoom={@min_zoom} />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:5)
    end

    test "renders with max_zoom constraint" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} max_zoom={@max_zoom} />
        """)

      assert html =~ ~s(&quot;maxZoom&quot;:15)
    end

    test "renders with before_id for layer ordering" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source",
        before_id: "other-layer"
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} before_id={@before_id} />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;other-layer&quot;)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "roads",
        map_id: "test-map",
        source_id: "road-data",
        source_layer: "roads",
        paint: %{
          "line-width" => 4,
          "line-color" => "#ff6600",
          "line-opacity" => 0.8,
          "line-dasharray" => [2, 4]
        },
        layout: %{"line-cap" => "round", "line-join" => "round"},
        filter: ["==", "type", "highway"],
        min_zoom: 5,
        max_zoom: 22,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.line_layer
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

      assert html =~ ~s(id="roads")
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;road-data&quot;)
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;roads&quot;)
      assert html =~ ~s(&quot;line-opacity&quot;:0.8)
      assert html =~ ~s(&quot;line-cap&quot;:&quot;round&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:5)
      assert html =~ ~s(&quot;maxZoom&quot;:22)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "renders multiple layers with different IDs" do
      assigns = %{
        layer1: %{id: "lines-1", map_id: "map-1", source_id: "source-1"},
        layer2: %{id: "lines-2", map_id: "map-2", source_id: "source-2"}
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@layer1.id} map_id={@layer1.map_id} source_id={@layer1.source_id} />
        <.line_layer id={@layer2.id} map_id={@layer2.map_id} source_id={@layer2.source_id} />
        """)

      assert html =~ ~s(id="lines-1")
      assert html =~ ~s(id="lines-2")
      assert html =~ ~s(&quot;sourceId&quot;:&quot;source-1&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;source-2&quot;)
    end

    test "omits nil values from configuration" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      # Should not include sourceLayer, filter, minZoom, maxZoom, beforeId when nil
      refute html =~ ~s(&quot;sourceLayer&quot;)
      refute html =~ ~s(&quot;filter&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end

    test "includes empty paint and layout by default" do
      assigns = %{
        id: "lines-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.line_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;paint&quot;:{})
      assert html =~ ~s(&quot;layout&quot;:{})
    end
  end
end
