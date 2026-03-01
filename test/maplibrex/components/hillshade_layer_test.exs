defmodule MaplibreX.Components.HillshadeLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "hillshade_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "hillshade-1", map_id: "test-map", source_id: "terrain-dem"}

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="hillshade-1")
      assert html =~ ~s(phx-hook="HillshadeLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "hillshade-1", map_id: "test-map", source_id: "terrain-dem"}

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;hillshade-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;terrain-dem&quot;)
    end

    test "renders with illumination direction" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        paint: %{
          "hillshade-illumination-direction" => 335
        }
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;hillshade-illumination-direction&quot;:335)
    end

    test "renders with exaggeration" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        paint: %{
          "hillshade-exaggeration" => 0.8
        }
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;hillshade-exaggeration&quot;:0.8)
    end

    test "renders with shadow and highlight colors" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        paint: %{
          "hillshade-shadow-color" => "#000",
          "hillshade-highlight-color" => "#fff"
        }
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;hillshade-shadow-color&quot;:&quot;#000&quot;)
      assert html =~ ~s(&quot;hillshade-highlight-color&quot;:&quot;#fff&quot;)
    end

    test "renders with accent color" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        paint: %{
          "hillshade-accent-color" => "#8a7f71"
        }
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;hillshade-accent-color&quot;:&quot;#8a7f71&quot;)
    end

    test "renders with illumination anchor" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        paint: %{
          "hillshade-illumination-anchor" => "viewport"
        }
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;hillshade-illumination-anchor&quot;:&quot;viewport&quot;)
    end

    test "renders with source_layer for vector tiles" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        source_layer: "contours"
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
        />
        """)

      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;contours&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        layout: %{"visibility" => "visible"}
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;layout&quot;:{&quot;visibility&quot;:&quot;visible&quot;})
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem",
        min_zoom: 0,
        max_zoom: 12
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:12)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "custom-hillshade",
        map_id: "test-map",
        source_id: "terrain-dem",
        source_layer: "contours",
        paint: %{
          "hillshade-illumination-direction" => 335,
          "hillshade-illumination-anchor" => "viewport",
          "hillshade-exaggeration" => 1.2,
          "hillshade-shadow-color" => "#000",
          "hillshade-highlight-color" => "#fff",
          "hillshade-accent-color" => "#8a7f71"
        },
        layout: %{"visibility" => "visible"},
        min_zoom: 0,
        max_zoom: 12,
        before_id: "water"
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer
          id={@id}
          map_id={@map_id}
          source_id={@source_id}
          source_layer={@source_layer}
          paint={@paint}
          layout={@layout}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="custom-hillshade")
      assert html =~ ~s(&quot;sourceLayer&quot;:&quot;contours&quot;)
      assert html =~ ~s(&quot;hillshade-illumination-direction&quot;:335)
      assert html =~ ~s(&quot;hillshade-exaggeration&quot;:1.2)
      assert html =~ ~s(&quot;hillshade-shadow-color&quot;:&quot;#000&quot;)
      assert html =~ ~s(&quot;hillshade-highlight-color&quot;:&quot;#fff&quot;)
      assert html =~ ~s(&quot;hillshade-accent-color&quot;:&quot;#8a7f71&quot;)
      assert html =~ ~s(&quot;layout&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:12)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;water&quot;)
    end

    test "omits nil and empty values from configuration" do
      assigns = %{
        id: "hillshade-1",
        map_id: "test-map",
        source_id: "terrain-dem"
      }

      html =
        rendered_to_string(~H"""
        <.hillshade_layer id={@id} map_id={@map_id} source_id={@source_id} />
        """)

      # Should not include sourceLayer, layout, minZoom, maxZoom, beforeId when nil/empty
      refute html =~ ~s(&quot;sourceLayer&quot;)
      refute html =~ ~s(&quot;layout&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end
  end
end
