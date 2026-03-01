defmodule MaplibreX.Components.TerrainTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "terrain/1" do
    test "renders with required attributes" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="terrain-test-map")
      assert html =~ ~s(phx-hook="TerrainHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sourceId&quot;:&quot;terrain-source&quot;)
      assert html =~ ~s(&quot;exaggeration&quot;:1.0)
    end

    test "renders with custom exaggeration" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: 2.5
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:2.5)
    end

    test "renders with exaggeration 1.0 (realistic)" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: 1.0
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:1.0)
    end

    test "renders with low exaggeration (flattened)" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: 0.5
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:0.5)
    end

    test "renders with high exaggeration (dramatic)" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: 3.0
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:3.0)
    end

    test "renders with zero exaggeration (flat)" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: 0.0
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:0.0)
    end

    test "raises error with negative exaggeration" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source",
        exaggeration: -1.0
      }

      assert_raise ArgumentError, ~r/exaggeration must be >= 0/, fn ->
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} exaggeration={@exaggeration} />
        """)
      end
    end

    test "uses default exaggeration when not specified" do
      assigns = %{
        map_id: "test-map",
        source_id: "terrain-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} />
        """)

      # Default is 1.0
      assert html =~ ~s(&quot;exaggeration&quot;:1.0)
    end

    test "terrain ID includes map_id for uniqueness" do
      assigns = %{
        map_id: "my-special-map",
        source_id: "terrain-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain map_id={@map_id} source_id={@source_id} />
        """)

      assert html =~ ~s(id="terrain-my-special-map")
    end
  end
end
