defmodule MaplibreX.Components.RasterLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.RasterLayer

  describe "raster_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "satellite-1", map_id: "test-map", source_id: "satellite"}

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="satellite-1")
      assert html =~ ~s(phx-hook="RasterLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "satellite-1", map_id: "test-map", source_id: "satellite"}

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;satellite-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;satellite&quot;)
    end

    test "renders with opacity paint property" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        paint: %{
          "raster-opacity" => 0.85
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;raster-opacity&quot;:0.85)
    end

    test "renders with multiple paint properties" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "terrain",
        paint: %{
          "raster-opacity" => 1.0,
          "raster-hue-rotate" => 90,
          "raster-brightness-min" => 0.1,
          "raster-brightness-max" => 0.9,
          "raster-saturation" => -0.5,
          "raster-contrast" => 0.2
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;raster-opacity&quot;:1.0)
      assert html =~ ~s(&quot;raster-hue-rotate&quot;:90)
      assert html =~ ~s(&quot;raster-brightness-min&quot;:0.1)
      assert html =~ ~s(&quot;raster-brightness-max&quot;:0.9)
      assert html =~ ~s(&quot;raster-saturation&quot;:-0.5)
      assert html =~ ~s(&quot;raster-contrast&quot;:0.2)
    end

    test "renders with fade duration" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        paint: %{
          "raster-fade-duration" => 500
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;raster-fade-duration&quot;:500)
    end

    test "renders with resampling method" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        paint: %{
          "raster-resampling" => "nearest"
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;raster-resampling&quot;:&quot;nearest&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        layout: %{"visibility" => "none"}
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;layout&quot;:{&quot;visibility&quot;:&quot;none&quot;})
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        min_zoom: 5,
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:5)
      assert html =~ ~s(&quot;maxZoom&quot;:15)
    end

    test "renders with before_id parameter" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite",
        before_id: "water"
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;water&quot;)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "satellite-layer",
        map_id: "test-map",
        source_id: "satellite",
        paint: %{
          "raster-opacity" => 0.9,
          "raster-fade-duration" => 300,
          "raster-resampling" => "linear"
        },
        layout: %{"visibility" => "visible"},
        min_zoom: 0,
        max_zoom: 18,
        before_id: "labels"
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          paint={@paint}
          layout={@layout}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="satellite-layer")
      assert html =~ ~s(&quot;sourceId&quot;:&quot;satellite&quot;)
      assert html =~ ~s(&quot;raster-opacity&quot;:0.9)
      assert html =~ ~s(&quot;raster-fade-duration&quot;:300)
      assert html =~ ~s(&quot;raster-resampling&quot;:&quot;linear&quot;)
      assert html =~ ~s(&quot;layout&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:18)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
    end

    test "omits nil and empty values from configuration" do
      assigns = %{
        id: "raster-1",
        map_id: "test-map",
        source_id: "satellite"
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      # Should not include layout, minZoom, maxZoom, beforeId when nil/empty
      refute html =~ ~s(&quot;layout&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end

    test "works with image source" do
      assigns = %{
        id: "radar-layer",
        map_id: "test-map",
        source_id: "radar-overlay",
        paint: %{
          "raster-opacity" => 0.7,
          "raster-fade-duration" => 0
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;sourceId&quot;:&quot;radar-overlay&quot;)
      assert html =~ ~s(&quot;raster-opacity&quot;:0.7)
      assert html =~ ~s(&quot;raster-fade-duration&quot;:0)
    end

    test "works with video source" do
      assigns = %{
        id: "drone-layer",
        map_id: "test-map",
        source_id: "drone-footage",
        paint: %{
          "raster-opacity" => 1.0
        }
      }

      html =
        rendered_to_string(~H"""
        <.raster_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;sourceId&quot;:&quot;drone-footage&quot;)
    end
  end
end
