defmodule MaplibreX.Components.ControlGroupTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.ControlGroup

  describe "control_group/1" do
    test "renders basic control group with slot content" do
      assigns = %{
        id: "my-group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <div>Control 1</div>
          <div>Control 2</div>
        </.control_group>
        """)

      assert html =~ ~s(id="my-group")
      assert html =~ ~s(phx-hook="ControlGroupHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(id="my-group-content")
      assert html =~ "Control 1"
      assert html =~ "Control 2"
    end

    test "renders with default position" do
      assigns = %{
        id: "group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "group",
        map_id: "test-map",
        position: "bottom-left"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id} position={@position}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with default orientation (vertical)" do
      assigns = %{
        id: "group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;orientation&quot;:&quot;vertical&quot;)
      assert html =~ ~s(class="control-group-vertical)
    end

    test "renders with horizontal orientation" do
      assigns = %{
        id: "group",
        map_id: "test-map",
        orientation: "horizontal"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id} orientation={@orientation}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;orientation&quot;:&quot;horizontal&quot;)
      assert html =~ ~s(class="control-group-horizontal)
    end

    test "renders with custom class" do
      assigns = %{
        id: "group",
        map_id: "test-map",
        class: "custom-group-class"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id} class={@class}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;className&quot;:&quot;custom-group-class&quot;)
      assert html =~ "custom-group-class"
    end

    test "validates position" do
      assigns = %{
        id: "group",
        map_id: "test-map",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id} position={@position}>
          <div>Content</div>
        </.control_group>
        """)
      end
    end

    test "validates orientation" do
      assigns = %{
        id: "group",
        map_id: "test-map",
        orientation: "diagonal"
      }

      assert_raise ArgumentError, ~r/Invalid orientation/, fn ->
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id} orientation={@orientation}>
          <div>Content</div>
        </.control_group>
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "group-#{position}",
          map_id: "test-map",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.control_group id={@id} map_id={@map_id} position={@position}>
            <div>Content</div>
          </.control_group>
          """)

        assert html =~ ~s(id="group-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "accepts all valid orientations" do
      valid_orientations = ["vertical", "horizontal"]

      for orientation <- valid_orientations do
        assigns = %{
          id: "group-#{orientation}",
          map_id: "test-map",
          orientation: orientation
        }

        html =
          rendered_to_string(~H"""
          <.control_group id={@id} map_id={@map_id} orientation={@orientation}>
            <div>Content</div>
          </.control_group>
          """)

        assert html =~ ~s(&quot;orientation&quot;:&quot;#{orientation}&quot;)
        assert html =~ ~s(class="control-group-#{orientation})
      end
    end

    test "config contains all required fields" do
      assigns = %{
        id: "full-group",
        map_id: "my-map",
        position: "top-left",
        orientation: "horizontal",
        class: "my-group"
      }

      html =
        rendered_to_string(~H"""
        <.control_group
          id={@id}
          map_id={@map_id}
          position={@position}
          orientation={@orientation}
          class={@class}
        >
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-group&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;my-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
      assert html =~ ~s(&quot;orientation&quot;:&quot;horizontal&quot;)
      assert html =~ ~s(&quot;className&quot;:&quot;my-group&quot;)
    end

    test "container has display none" do
      assigns = %{
        id: "group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control_group>
        """)

      assert html =~ ~s(style="display: none;")
    end

    test "renders with multiple child elements" do
      assigns = %{
        id: "multi-group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <button>Button 1</button>
          <button>Button 2</button>
          <button>Button 3</button>
        </.control_group>
        """)

      assert html =~ "Button 1"
      assert html =~ "Button 2"
      assert html =~ "Button 3"
    end

    test "renders with phx-click bindings on children" do
      assigns = %{
        id: "action-group",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control_group id={@id} map_id={@map_id}>
          <button phx-click="action1">Action 1</button>
          <button phx-click="action2">Action 2</button>
        </.control_group>
        """)

      assert html =~ ~s(phx-click="action1")
      assert html =~ ~s(phx-click="action2")
    end
  end
end
