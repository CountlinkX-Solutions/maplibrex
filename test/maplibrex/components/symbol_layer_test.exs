defmodule MaplibreX.Components.SymbolLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "symbol_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "symbols-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="symbols-1")
      assert html =~ ~s(phx-hook="SymbolLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "symbols-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;symbols-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;test-source&quot;)
    end

    test "renders with text layout properties" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        layout: %{
          "text-field" => ["get", "name"],
          "text-font" => ["Open Sans Regular"],
          "text-size" => 12
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;text-field&quot;:[&quot;get&quot;,&quot;name&quot;])
      assert html =~ ~s(&quot;text-font&quot;:[&quot;Open Sans Regular&quot;])
      assert html =~ ~s(&quot;text-size&quot;:12)
    end

    test "renders with icon layout properties" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        layout: %{
          "icon-image" => "marker-15",
          "icon-size" => 1.5,
          "icon-anchor" => "bottom"
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;icon-image&quot;:&quot;marker-15&quot;)
      assert html =~ ~s(&quot;icon-size&quot;:1.5)
      assert html =~ ~s(&quot;icon-anchor&quot;:&quot;bottom&quot;)
    end

    test "renders with text paint properties" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "text-color" => "#000",
          "text-halo-color" => "#fff",
          "text-halo-width" => 2
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;text-color&quot;:&quot;#000&quot;)
      assert html =~ ~s(&quot;text-halo-color&quot;:&quot;#fff&quot;)
      assert html =~ ~s(&quot;text-halo-width&quot;:2)
    end

    test "renders with icon paint properties" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "icon-opacity" => 0.8,
          "icon-color" => "#ff0000"
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;icon-opacity&quot;:0.8)
      assert html =~ ~s(&quot;icon-color&quot;:&quot;#ff0000&quot;)
    end

    test "renders with text and icon combined" do
      assigns = %{
        id: "poi-labels",
        map_id: "test-map",
        source_id: "pois",
        layout: %{
          "text-field" => ["get", "name"],
          "text-anchor" => "top",
          "text-offset" => [0, 0.5],
          "icon-image" => ["get", "icon"],
          "icon-size" => 1.0
        },
        paint: %{
          "text-color" => "#000",
          "text-halo-color" => "#fff",
          "icon-opacity" => 1
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          layout={@layout}
          paint={@paint}
        />
        """)

      assert html =~ ~s(&quot;text-field&quot;:[&quot;get&quot;,&quot;name&quot;])
      assert html =~ ~s(&quot;text-anchor&quot;:&quot;top&quot;)
      assert html =~ ~s(&quot;icon-image&quot;:[&quot;get&quot;,&quot;icon&quot;])
      assert html =~ ~s(&quot;icon-opacity&quot;:1)
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        source_layer: "poi_label"
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;poi_label&quot;)
    end

    test "renders with filter expression" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        filter: ["==", "type", "restaurant"]
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} filter={@filter} />
        """)

      assert html =~ ~s(&quot;filter&quot;:[&quot;==&quot;,&quot;type&quot;,&quot;restaurant&quot;])
    end

    test "renders with min_zoom constraint" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        min_zoom: 10
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} min_zoom={@min_zoom} />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:10)
    end

    test "renders with max_zoom constraint" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        max_zoom: 18
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} max_zoom={@max_zoom} />
        """)

      assert html =~ ~s(&quot;maxZoom&quot;:18)
    end

    test "renders with before_id for layer ordering" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source",
        before_id: "water-layer"
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} before_id={@before_id} />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;water-layer&quot;)
    end

    test "renders with data-driven styling" do
      assigns = %{
        id: "poi-symbols",
        map_id: "test-map",
        source_id: "pois",
        layout: %{
          "icon-image" => [
            "match",
            ["get", "type"],
            "restaurant", "restaurant-15",
            "hotel", "lodging-15",
            "marker-15"
          ],
          "icon-size" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 0.5,
            15, 1.5
          ]
        }
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;match&quot;)
      assert html =~ ~s(&quot;restaurant-15&quot;)
      assert html =~ ~s(&quot;interpolate&quot;)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "complex-symbols",
        map_id: "test-map",
        source_id: "places",
        source_layer: "poi_label",
        layout: %{
          "text-field" => ["get", "name"],
          "text-font" => ["Open Sans Regular"],
          "text-size" => 11,
          "text-anchor" => "top",
          "text-offset" => [0, 1.2],
          "icon-image" => ["get", "icon"],
          "icon-size" => 1.0,
          "icon-allow-overlap" => false,
          "text-allow-overlap" => false
        },
        paint: %{
          "text-color" => "#333",
          "text-halo-color" => "#fff",
          "text-halo-width" => 1.5,
          "icon-opacity" => 0.9
        },
        filter: ["==", "category", "poi"],
        min_zoom: 10,
        max_zoom: 20,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
          layout={@layout}
          paint={@paint}
          filter={@filter}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="complex-symbols")
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;poi_label&quot;)
      assert html =~ ~s(&quot;text-field&quot;:[&quot;get&quot;,&quot;name&quot;])
      assert html =~ ~s(&quot;icon-image&quot;:[&quot;get&quot;,&quot;icon&quot;])
      assert html =~ ~s(&quot;text-color&quot;:&quot;#333&quot;)
      assert html =~ ~s(&quot;icon-opacity&quot;:0.9)
      assert html =~ ~s(&quot;minZoom&quot;:10)
      assert html =~ ~s(&quot;maxZoom&quot;:20)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "omits nil values from configuration" do
      assigns = %{
        id: "symbols-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.symbol_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      # Should not include sourceLayer, filter, minZoom, maxZoom, beforeId when nil
      refute html =~ ~s(&quot;sourceLayer&quot;)
      refute html =~ ~s(&quot;filter&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end
  end
end
