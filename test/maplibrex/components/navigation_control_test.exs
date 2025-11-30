defmodule MaplibreX.Components.NavigationControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.NavigationControl

  describe "navigation_control/1" do
    test "renders basic navigation control with required attributes" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="nav-control")
      assert html =~ ~s(phx-hook="NavigationControlHook")
      assert html =~ ~s(data-config=)
    end

    test "renders with default position" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map",
        position: "top-left"
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
    end

    test "renders with show_compass option" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map",
        show_compass: false
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} show_compass={@show_compass} />
        """)

      assert html =~ ~s(&quot;showCompass&quot;:false)
    end

    test "renders with show_zoom option" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map",
        show_zoom: false
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} show_zoom={@show_zoom} />
        """)

      assert html =~ ~s(&quot;showZoom&quot;:false)
    end

    test "renders with visualize_pitch option" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map",
        visualize_pitch: true
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} visualize_pitch={@visualize_pitch} />
        """)

      assert html =~ ~s(&quot;visualizePitch&quot;:true)
    end

    test "renders with all options" do
      assigns = %{
        id: "full-nav-control",
        map_id: "test-map",
        position: "bottom-right",
        show_compass: true,
        show_zoom: true,
        visualize_pitch: true
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control
          id={@id}
          map_id={@map_id}
          position={@position}
          show_compass={@show_compass}
          show_zoom={@show_zoom}
          visualize_pitch={@visualize_pitch}
        />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-nav-control&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)
      assert html =~ ~s(&quot;showCompass&quot;:true)
      assert html =~ ~s(&quot;showZoom&quot;:true)
      assert html =~ ~s(&quot;visualizePitch&quot;:true)
    end

    test "validates position" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} position={@position} />
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "nav-#{position}",
          map_id: "test-map",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.navigation_control id={@id} map_id={@map_id} position={@position} />
          """)

        assert html =~ ~s(id="nav-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "control container has display: none style" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(style="display: none;")
    end

    test "default values for boolean options" do
      assigns = %{
        id: "nav-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.navigation_control id={@id} map_id={@map_id} />
        """)

      # By default show_compass and show_zoom should be true
      assert html =~ ~s(&quot;showCompass&quot;:true)
      assert html =~ ~s(&quot;showZoom&quot;:true)
      # visualize_pitch should be false by default
      assert html =~ ~s(&quot;visualizePitch&quot;:false)
    end
  end
end
