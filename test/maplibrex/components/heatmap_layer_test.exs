defmodule MaplibreX.Components.HeatmapLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "heatmap_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "heatmap-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="heatmap-1")
      assert html =~ ~s(phx-hook="HeatmapLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "heatmap-1", map_id: "test-map", source_id: "test-source"}

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;heatmap-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;test-source&quot;)
    end

    test "renders with basic paint properties" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "heatmap-radius" => 20,
          "heatmap-opacity" => 0.8
        }
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;heatmap-radius&quot;:20)
      assert html =~ ~s(&quot;heatmap-opacity&quot;:0.8)
    end

    test "renders with interpolated heatmap-weight" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "heatmap-weight" => [
            "interpolate",
            ["linear"],
            ["get", "magnitude"],
            0,
            0,
            6,
            1
          ]
        }
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;heatmap-weight&quot;:[&quot;interpolate&quot;)
      assert html =~ ~s(&quot;magnitude&quot;)
    end

    test "renders with interpolated heatmap-intensity" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "heatmap-intensity" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            9,
            3
          ]
        }
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;heatmap-intensity&quot;:[&quot;interpolate&quot;)
      assert html =~ ~s(&quot;zoom&quot;)
    end

    test "renders with custom color gradient" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        paint: %{
          "heatmap-color" => [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.5,
            "rgb(209,229,240)",
            1,
            "rgb(178,24,43)"
          ]
        }
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;heatmap-color&quot;:[&quot;interpolate&quot;)
      assert html =~ ~s(&quot;heatmap-density&quot;)
      assert html =~ "rgba(33,102,172,0)"
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        source_layer: "events"
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;events&quot;)
    end

    test "renders with filter expression" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        filter: [">=", "magnitude", 3]
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} filter={@filter} />
        """)

      assert html =~ ~s(&quot;filter&quot;:[&quot;&gt;=&quot;,&quot;magnitude&quot;,3])
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source",
        min_zoom: 0,
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:15)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "earthquake-heat",
        map_id: "test-map",
        source_id: "earthquakes",
        source_layer: "events",
        paint: %{
          "heatmap-weight" => [
            "interpolate",
            ["linear"],
            ["get", "mag"],
            0,
            0,
            6,
            1
          ],
          "heatmap-intensity" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            9,
            3
          ],
          "heatmap-color" => [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            1,
            "rgb(178,24,43)"
          ],
          "heatmap-radius" => [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            2,
            9,
            20
          ],
          "heatmap-opacity" => 1
        },
        filter: [">=", "mag", 2],
        min_zoom: 0,
        max_zoom: 15,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
          paint={@paint}
          filter={@filter}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="earthquake-heat")
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;events&quot;)
      assert html =~ ~s(&quot;heatmap-weight&quot;)
      assert html =~ ~s(&quot;heatmap-intensity&quot;)
      assert html =~ ~s(&quot;heatmap-color&quot;)
      assert html =~ ~s(&quot;heatmap-radius&quot;)
      assert html =~ ~s(&quot;heatmap-opacity&quot;:1)
      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:15)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "omits nil values from configuration" do
      assigns = %{
        id: "heatmap-1",
        map_id: "test-map",
        source_id: "test-source"
      }

      html =
        rendered_to_string(~H"""
        <.heatmap_layer id={@id} map_id={@map_id} source_id={@source_id} />
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
