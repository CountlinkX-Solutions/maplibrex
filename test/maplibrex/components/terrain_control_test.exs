defmodule MaplibreX.Components.TerrainControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "terrain_control/1" do
    test "renders with required attributes" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control id={@id} map_id={@map_id} terrain_source_id={@terrain_source_id} />
        """)

      assert html =~ ~s(id="terrain-toggle")
      assert html =~ ~s(phx-hook="TerrainControlHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control id={@id} map_id={@map_id} terrain_source_id={@terrain_source_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;terrain-toggle&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;terrainSourceId&quot;:&quot;dem-source&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
      assert html =~ ~s(&quot;exaggeration&quot;:1.5)
      assert html =~ ~s(&quot;enabled&quot;:false)
    end

    test "renders with custom position" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source",
        position: "bottom-left"
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          position={@position}
        />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with custom exaggeration" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source",
        exaggeration: 2.0
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          exaggeration={@exaggeration}
        />
        """)

      assert html =~ ~s(&quot;exaggeration&quot;:2.0)
    end

    test "renders with enabled true" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source",
        enabled: true
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          enabled={@enabled}
        />
        """)

      assert html =~ ~s(&quot;enabled&quot;:true)
    end

    test "uses default values when not specified" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source"
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control id={@id} map_id={@map_id} terrain_source_id={@terrain_source_id} />
        """)

      # Defaults: position="top-right", exaggeration=1.5, enabled=false
      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
      assert html =~ ~s(&quot;exaggeration&quot;:1.5)
      assert html =~ ~s(&quot;enabled&quot;:false)
    end

    test "raises error with invalid position" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          position={@position}
        />
        """)
      end
    end

    test "raises error with negative exaggeration" do
      assigns = %{
        id: "terrain-toggle",
        map_id: "test-map",
        terrain_source_id: "dem-source",
        exaggeration: -1.0
      }

      assert_raise ArgumentError, ~r/exaggeration must be >= 0/, fn ->
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          exaggeration={@exaggeration}
        />
        """)
      end
    end

    test "renders with all valid positions" do
      for position <- ["top-left", "top-right", "bottom-left", "bottom-right"] do
        assigns = %{
          id: "terrain-toggle-#{position}",
          map_id: "test-map",
          terrain_source_id: "dem-source",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.terrain_control
            id={@id}
            map_id={@map_id}
            terrain_source_id={@terrain_source_id}
            position={@position}
          />
          """)

        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "renders with all options combined" do
      assigns = %{
        id: "terrain-full",
        map_id: "test-map",
        terrain_source_id: "custom-dem",
        position: "bottom-right",
        exaggeration: 2.5,
        enabled: true
      }

      html =
        rendered_to_string(~H"""
        <.terrain_control
          id={@id}
          map_id={@map_id}
          terrain_source_id={@terrain_source_id}
          position={@position}
          exaggeration={@exaggeration}
          enabled={@enabled}
        />
        """)

      assert html =~ ~s(id="terrain-full")
      assert html =~ ~s(&quot;terrainSourceId&quot;:&quot;custom-dem&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)
      assert html =~ ~s(&quot;exaggeration&quot;:2.5)
      assert html =~ ~s(&quot;enabled&quot;:true)
    end
  end
end
