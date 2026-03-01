defmodule MaplibreX.Components.FillLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "fill_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "fills-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="fills-1")
      assert html =~ ~s(phx-hook="FillLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "fills-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;fills-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;test-source&quot;)
    end

    test "renders with paint properties" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{"fill-color" => "#088", "fill-opacity" => 0.4}
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-color&quot;:&quot;#088&quot;)
      assert html =~ ~s(&quot;fill-opacity&quot;:0.4)
    end

    test "renders with fill-outline-color" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{"fill-color" => "#088", "fill-outline-color" => "#000"}
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;fill-outline-color&quot;:&quot;#000&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        layout: %{"visibility" => "visible"}
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;visibility&quot;:&quot;visible&quot;)
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        source_layer: "admin"
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;admin&quot;)
    end

    test "renders with filter expression" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        filter: ["==", "type", "park"]
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} filter={@filter} />
        """)

      assert html =~ ~s(&quot;filter&quot;:[&quot;==&quot;,&quot;type&quot;,&quot;park&quot;])
    end

    test "renders with min_zoom constraint" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        min_zoom: 8
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} min_zoom={@min_zoom} />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:8)
    end

    test "renders with max_zoom constraint" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        max_zoom: 18
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} max_zoom={@max_zoom} />
        """)

      assert html =~ ~s(&quot;maxZoom&quot;:18)
    end

    test "renders with before_id for layer ordering" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source",
        before_id: "label-layer"
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} before_id={@before_id} />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;label-layer&quot;)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "countries",
        map_id: "test-map",
        source_id: "world-data",
        source_layer: "countries",
        paint: %{
          "fill-color" => "#ff6600",
          "fill-opacity" => 0.6,
          "fill-outline-color" => "#000"
        },
        layout: %{"visibility" => "visible"},
        filter: ["==", "continent", "Europe"],
        min_zoom: 3,
        max_zoom: 20,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer
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

      assert html =~ ~s(id="countries")
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;world-data&quot;)
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;countries&quot;)
      assert html =~ ~s(&quot;fill-opacity&quot;:0.6)
      assert html =~ ~s(&quot;fill-outline-color&quot;:&quot;#000&quot;)
      assert html =~ ~s(&quot;visibility&quot;:&quot;visible&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:3)
      assert html =~ ~s(&quot;maxZoom&quot;:20)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "renders multiple layers with different IDs" do
      assigns = %{
        layer1: %{id: "fills-1", map_id: "map-1", source_id: "source-1"},
        layer2: %{id: "fills-2", map_id: "map-2", source_id: "source-2"}
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@layer1.id} map_id={@layer1.map_id} source_id={@layer1.source_id} />
        <.fill_layer id={@layer2.id} map_id={@layer2.map_id} source_id={@layer2.source_id} />
        """)

      assert html =~ ~s(id="fills-1")
      assert html =~ ~s(id="fills-2")
      assert html =~ ~s(&quot;sourceId&quot;:&quot;source-1&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;source-2&quot;)
    end

    test "omits nil values from configuration" do
      assigns = %{
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} />
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
        id: "fills-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.fill_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;paint&quot;:{})
      assert html =~ ~s(&quot;layout&quot;:{})
    end
  end
end
