defmodule MaplibreX.Components.ControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.Control

  describe "control/1" do
    test "renders basic control with required attributes and slot content" do
      assigns = %{
        id: "my-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div>Custom Content</div>
        </.control>
        """)

      assert html =~ ~s(id="my-control")
      assert html =~ ~s(phx-hook="ControlHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(id="my-control-content")
      assert html =~ "Custom Content"
    end

    test "renders with default position" do
      assigns = %{
        id: "my-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "my-control",
        map_id: "test-map",
        position: "bottom-left"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id} position={@position}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with custom class" do
      assigns = %{
        id: "my-control",
        map_id: "test-map",
        class: "custom-control-class"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id} class={@class}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(&quot;className&quot;:&quot;custom-control-class&quot;)
      assert html =~ ~s(class="custom-control-class")
    end

    test "renders with empty class by default" do
      assigns = %{
        id: "my-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(&quot;className&quot;:&quot;&quot;)
    end

    test "validates position" do
      assigns = %{
        id: "my-control",
        map_id: "test-map",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id} position={@position}>
          <div>Content</div>
        </.control>
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "control-#{position}",
          map_id: "test-map",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.control id={@id} map_id={@map_id} position={@position}>
            <div>Content</div>
          </.control>
          """)

        assert html =~ ~s(id="control-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "control container has display: none style" do
      assigns = %{
        id: "my-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(style="display: none;")
    end

    test "renders with complex slot content" do
      assigns = %{
        id: "complex-control",
        map_id: "test-map",
        show_layer_1: true,
        show_layer_2: false
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div class="bg-white p-3">
            <h3>Layers</h3>
            <label>
              <input type="checkbox" checked={@show_layer_1} />
              <span>Layer 1</span>
            </label>
            <label>
              <input type="checkbox" checked={@show_layer_2} />
              <span>Layer 2</span>
            </label>
          </div>
        </.control>
        """)

      assert html =~ "Layers"
      assert html =~ "Layer 1"
      assert html =~ "Layer 2"
      assert html =~ ~s(type="checkbox")
      assert html =~ ~s(checked)
    end

    test "renders with LiveView event bindings in slot" do
      assigns = %{
        id: "action-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id}>
          <div>
            <button phx-click="my_action">Click Me</button>
          </div>
        </.control>
        """)

      assert html =~ ~s(phx-click="my_action")
      assert html =~ "Click Me"
    end

    test "config contains all required fields" do
      assigns = %{
        id: "full-control",
        map_id: "my-map",
        position: "top-left",
        class: "my-class"
      }

      html =
        rendered_to_string(~H"""
        <.control id={@id} map_id={@map_id} position={@position} class={@class}>
          <div>Content</div>
        </.control>
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-control&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;my-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
      assert html =~ ~s(&quot;className&quot;:&quot;my-class&quot;)
    end

    test "renders multiple controls with different content" do
      assigns = %{
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.control id="control-1" map_id={@map_id} position="top-left">
          <div>Control 1</div>
        </.control>
        <.control id="control-2" map_id={@map_id} position="top-right">
          <div>Control 2</div>
        </.control>
        """)

      assert html =~ ~s(id="control-1")
      assert html =~ ~s(id="control-2")
      assert html =~ "Control 1"
      assert html =~ "Control 2"
      assert html =~ ~s(&quot;position&quot;:&quot;top-left&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end
  end
end
