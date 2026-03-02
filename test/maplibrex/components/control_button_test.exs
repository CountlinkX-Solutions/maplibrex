defmodule MaplibreX.Components.ControlButtonTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.ControlButton
  import ExUnit.CaptureIO

  describe "control_button/1" do
    test "renders basic control button with icon" do
      assigns = %{
        id: "my-btn",
        map_id: "test-map",
        icon: "🔍"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} />
        """)

      assert html =~ ~s(id="my-btn")
      assert html =~ ~s(phx-hook="ControlButtonHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(id="my-btn-button")
      assert html =~ "🔍"
    end

    test "renders with custom SVG slot content" do
      assigns = %{
        id: "svg-btn",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id}>
          <svg width="20" height="20"><circle cx="10" cy="10" r="5"/></svg>
        </.control_button>
        """)

      assert html =~ ~s(<svg width="20" height="20")
      assert html =~ ~s(<circle)
    end

    test "renders with default position" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "X"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "X",
        position: "bottom-left"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with tooltip" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "🔎",
        tooltip: "Search"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} tooltip={@tooltip} />
        """)

      assert html =~ ~s(title="Search")
      assert html =~ ~s(aria-label="Search")
      assert html =~ ~s(&quot;tooltip&quot;:&quot;Search&quot;)
    end

    test "renders with active state" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "⭐",
        active: true
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} active={@active} />
        """)

      assert html =~ ~s(&quot;active&quot;:true)
    end

    test "renders with active false by default" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "X"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} />
        """)

      assert html =~ ~s(&quot;active&quot;:false)
    end

    test "renders with custom class" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "💡",
        class: "custom-btn-class"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} class={@class} />
        """)

      assert html =~ ~s(class="maplibregl-ctrl-icon custom-btn-class")
    end

    test "validates position" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "X",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} position={@position} />
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "btn-#{position}",
          map_id: "test-map",
          icon: "X",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.control_button id={@id} map_id={@map_id} icon={@icon} position={@position} />
          """)

        assert html =~ ~s(id="btn-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "warns if neither icon nor slot provided" do
      assigns = %{
        id: "empty-btn",
        map_id: "test-map"
      }

      output =
        capture_io(:stderr, fn ->
          _html =
            rendered_to_string(~H"""
            <.control_button id={@id} map_id={@map_id} />
            """)
        end)

      assert output =~ "has neither icon attribute nor slot content"
    end

    test "slot content takes precedence over icon" do
      assigns = %{
        id: "both-btn",
        map_id: "test-map",
        icon: "Text"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon}>
          <span>Slot Content</span>
        </.control_button>
        """)

      assert html =~ "Slot Content"
      refute html =~ ">Text<"
    end

    test "config contains all fields" do
      assigns = %{
        id: "full-btn",
        map_id: "my-map",
        position: "top-left",
        icon: "★",
        tooltip: "Favorite",
        active: true
      }

      html =
        rendered_to_string(~H"""
        <.control_button
          id={@id}
          map_id={@map_id}
          position={@position}
          icon={@icon}
          tooltip={@tooltip}
          active={@active}
        />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-btn&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;my-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
      assert html =~ ~s(&quot;tooltip&quot;:&quot;Favorite&quot;)
      assert html =~ ~s(&quot;active&quot;:true)
      assert html =~ ~s(&quot;hasSlot&quot;:false)
    end

    test "hasSlot is true when slot provided" do
      assigns = %{
        id: "slot-btn",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control_button>
        """)

      assert html =~ ~s(&quot;hasSlot&quot;:true)
    end

    test "renders with phx-click binding" do
      assigns = %{
        id: "action-btn",
        map_id: "test-map",
        icon: "🎯"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} phx-click="do_action" />
        """)

      assert html =~ ~s(phx-click="do_action")
    end

    test "button has correct type and classes" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "+"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} />
        """)

      assert html =~ ~s(type="button")
      assert html =~ "maplibregl-ctrl-icon"
    end

    test "container has display none" do
      assigns = %{
        id: "btn",
        map_id: "test-map",
        icon: "X"
      }

      html =
        rendered_to_string(~H"""
        <.control_button id={@id} map_id={@map_id} icon={@icon} />
        """)

      assert html =~ ~s(style="display: none;")
    end
  end
end
