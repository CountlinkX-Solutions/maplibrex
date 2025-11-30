defmodule MaplibreX.Components.FullscreenControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.FullscreenControl

  describe "fullscreen_control/1" do
    test "renders basic fullscreen control with required attributes" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="fullscreen-control")
      assert html =~ ~s(phx-hook="FullscreenControlHook")
      assert html =~ ~s(data-config=)
    end

    test "renders with default position" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map",
        position: "bottom-left"
      }

      html =
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with container_id" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map",
        container_id: "map-wrapper"
      }

      html =
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} container_id={@container_id} />
        """)

      assert html =~ ~s(&quot;containerSelector&quot;:&quot;map-wrapper&quot;)
    end

    test "validates position" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} position={@position} />
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "fs-#{position}",
          map_id: "test-map",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.fullscreen_control id={@id} map_id={@map_id} position={@position} />
          """)

        assert html =~ ~s(id="fs-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "control container has display: none style" do
      assigns = %{
        id: "fullscreen-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.fullscreen_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(style="display: none;")
    end
  end
end
