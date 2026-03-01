defmodule MaplibreX.Components.BackgroundLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "background_layer/1" do
    test "renders with required attributes" do
      assigns = %{id: "bg-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="bg-1")
      assert html =~ ~s(phx-hook="BackgroundLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "bg-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;bg-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
    end

    test "renders with solid color paint" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map",
        paint: %{
          "background-color" => "#f0f0f0"
        }
      }

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;background-color&quot;:&quot;#f0f0f0&quot;)
    end

    test "renders with color and opacity" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map",
        paint: %{
          "background-color" => "#000",
          "background-opacity" => 0.5
        }
      }

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;background-color&quot;:&quot;#000&quot;)
      assert html =~ ~s(&quot;background-opacity&quot;:0.5)
    end

    test "renders with pattern" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map",
        paint: %{
          "background-pattern" => "dots"
        }
      }

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} paint={@paint} />
        """)

      assert html =~ ~s(&quot;background-pattern&quot;:&quot;dots&quot;)
    end

    test "renders with layout properties" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map",
        layout: %{"visibility" => "none"}
      }

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} layout={@layout} />
        """)

      assert html =~ ~s(&quot;layout&quot;:{&quot;visibility&quot;:&quot;none&quot;})
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map",
        min_zoom: 0,
        max_zoom: 10
      }

      html =
        rendered_to_string(~H"""
        <.background_layer
          id={@id}
          map_id={@map_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:10)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "custom-bg",
        map_id: "test-map",
        paint: %{
          "background-color" => "#e0e0e0",
          "background-opacity" => 0.8
        },
        layout: %{"visibility" => "visible"},
        min_zoom: 0,
        max_zoom: 22,
        before_id: "water"
      }

      html =
        rendered_to_string(~H"""
        <.background_layer
          id={@id}
          map_id={@map_id}
          paint={@paint}
          layout={@layout}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(id="custom-bg")
      assert html =~ ~s(&quot;background-color&quot;:&quot;#e0e0e0&quot;)
      assert html =~ ~s(&quot;background-opacity&quot;:0.8)
      assert html =~ ~s(&quot;layout&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:22)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;water&quot;)
    end

    test "omits nil and empty values from configuration" do
      assigns = %{
        id: "bg-1",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.background_layer id={@id} map_id={@map_id} />
        """)

      # Should not include layout, minZoom, maxZoom, beforeId when nil/empty
      refute html =~ ~s(&quot;layout&quot;)
      refute html =~ ~s(&quot;minZoom&quot;)
      refute html =~ ~s(&quot;maxZoom&quot;)
      refute html =~ ~s(&quot;beforeId&quot;)
    end
  end
end
