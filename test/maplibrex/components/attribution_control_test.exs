defmodule MaplibreX.Components.AttributionControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "attribution_control/1" do
    test "renders with required attributes" do
      assigns = %{id: "attribution-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="attribution-1")
      assert html =~ ~s(phx-hook="AttributionControlHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "attribution-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;attribution-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{id: "attribution-1", map_id: "test-map", position: "top-left"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
    end

    test "renders with compact mode disabled" do
      assigns = %{id: "attribution-1", map_id: "test-map", compact: false}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} compact={@compact} />
        """)

      assert html =~ ~s(&quot;compact&quot;:false)
    end

    test "renders with compact mode enabled (default)" do
      assigns = %{id: "attribution-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;compact&quot;:true)
    end

    test "renders with custom attribution" do
      assigns = %{
        id: "attribution-1",
        map_id: "test-map",
        custom_attr: "© My Company 2024"
      }

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} custom_attribution={@custom_attr} />
        """)

      assert html =~ ~s(&quot;customAttribution&quot;:&quot;© My Company 2024&quot;)
    end

    test "renders without custom attribution when not provided" do
      assigns = %{id: "attribution-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;customAttribution&quot;:null)
    end

    test "accepts all valid positions" do
      valid_positions = ~w(top-left top-right bottom-left bottom-right)

      for position <- valid_positions do
        assigns = %{id: "attribution-1", map_id: "test-map", position: position}

        html =
          rendered_to_string(~H"""
          <.attribution_control id={@id} map_id={@map_id} position={@position} />
          """)

        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "raises error for invalid position" do
      assigns = %{id: "attribution-1", map_id: "test-map", position: "invalid"}

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} position={@position} />
        """)
      end
    end

    test "renders with all options combined" do
      assigns = %{
        id: "attribution-full",
        map_id: "test-map",
        position: "top-left",
        compact: false,
        custom_attr: "© Custom Attribution 2024"
      }

      html =
        rendered_to_string(~H"""
        <.attribution_control
          id={@id}
          map_id={@map_id}
          position={@position}
          compact={@compact}
          custom_attribution={@custom_attr}
        />
        """)

      assert html =~ ~s(id="attribution-full")
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
      assert html =~ ~s(&quot;compact&quot;:false)
      assert html =~ ~s(&quot;customAttribution&quot;:&quot;© Custom Attribution 2024&quot;)
    end

    test "renders multiple instances with different IDs" do
      assigns = %{
        attr1: %{id: "attribution-1", map_id: "map-1"},
        attr2: %{id: "attribution-2", map_id: "map-2"}
      }

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@attr1.id} map_id={@attr1.map_id} />
        <.attribution_control id={@attr2.id} map_id={@attr2.map_id} />
        """)

      assert html =~ ~s(id="attribution-1")
      assert html =~ ~s(id="attribution-2")
      assert html =~ ~s(&quot;mapId&quot;:&quot;map-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;map-2&quot;)
    end

    test "default values are set correctly" do
      assigns = %{id: "attribution-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.attribution_control id={@id} map_id={@map_id} />
        """)

      # Default position: bottom-right
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)

      # Default compact: true
      assert html =~ ~s(&quot;compact&quot;:true)

      # Default customAttribution: null
      assert html =~ ~s(&quot;customAttribution&quot;:null)
    end
  end
end
