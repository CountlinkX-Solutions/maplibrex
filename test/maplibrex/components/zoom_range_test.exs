defmodule MaplibreX.Components.ZoomRangeTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.ZoomRange
  import ExUnit.CaptureIO

  describe "zoom_range/1" do
    test "renders basic zoom range with required attributes and slot content" do
      assigns = %{
        id: "my-zoom-range",
        map_id: "test-map",
        min: 10
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min}>
          <div>Zoom Content</div>
        </.zoom_range>
        """)

      assert html =~ ~s(id="my-zoom-range")
      assert html =~ ~s(phx-hook="ZoomRangeHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(id="my-zoom-range-content")
      assert html =~ "Zoom Content"
    end

    test "renders with only min zoom" do
      assigns = %{
        id: "min-only",
        map_id: "test-map",
        min: 12
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min}>
          <div>Content</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:12)
      assert html =~ ~s(&quot;max&quot;:null)
    end

    test "renders with only max zoom" do
      assigns = %{
        id: "max-only",
        map_id: "test-map",
        max: 8
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} max={@max}>
          <div>Content</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:null)
      assert html =~ ~s(&quot;max&quot;:8)
    end

    test "renders with both min and max zoom" do
      assigns = %{
        id: "range",
        map_id: "test-map",
        min: 8,
        max: 14
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Content</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:8)
      assert html =~ ~s(&quot;max&quot;:14)
    end

    test "renders with neither min nor max (shows warning)" do
      assigns = %{
        id: "no-constraints",
        map_id: "test-map"
      }

      output =
        capture_io(:stderr, fn ->
          _html =
            rendered_to_string(~H"""
            <.zoom_range id={@id} map_id={@map_id}>
              <div>Always Visible</div>
            </.zoom_range>
            """)
        end)

      assert output =~ "has neither min nor max zoom specified"
    end

    test "validates min < max when both provided" do
      assigns = %{
        id: "invalid-range",
        map_id: "test-map",
        min: 15,
        max: 10
      }

      assert_raise ArgumentError, ~r/Invalid zoom range/, fn ->
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Content</div>
        </.zoom_range>
        """)
      end
    end

    test "allows min equal to max" do
      assigns = %{
        id: "exact-zoom",
        map_id: "test-map",
        min: 10,
        max: 10
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Exact Zoom Level</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:10)
      assert html =~ ~s(&quot;max&quot;:10)
    end

    test "renders with complex slot content" do
      assigns = %{
        id: "complex-zoom",
        map_id: "test-map",
        min: 12,
        building_count: 42
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min}>
          <div class="info-panel">
            <h3>Building Details</h3>
            <p>Buildings: <%= @building_count %></p>
            <button phx-click="show_more">Show More</button>
          </div>
        </.zoom_range>
        """)

      assert html =~ "Building Details"
      assert html =~ "Buildings: 42"
      assert html =~ ~s(phx-click="show_more")
    end

    test "config contains all required fields" do
      assigns = %{
        id: "full-config",
        map_id: "my-map",
        min: 5,
        max: 15
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Content</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-config&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;my-map&quot;)
      assert html =~ ~s(&quot;min&quot;:5)
      assert html =~ ~s(&quot;max&quot;:15)
    end

    test "renders multiple zoom ranges with different constraints" do
      assigns = %{
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id="country" map_id={@map_id} max={4}>
          <div>Country View</div>
        </.zoom_range>
        <.zoom_range id="city" map_id={@map_id} min={8} max={12}>
          <div>City View</div>
        </.zoom_range>
        <.zoom_range id="street" map_id={@map_id} min={12}>
          <div>Street View</div>
        </.zoom_range>
        """)

      assert html =~ ~s(id="country")
      assert html =~ ~s(id="city")
      assert html =~ ~s(id="street")
      assert html =~ "Country View"
      assert html =~ "City View"
      assert html =~ "Street View"
    end

    test "renders with zero as min zoom" do
      assigns = %{
        id: "from-zero",
        map_id: "test-map",
        min: 0,
        max: 5
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Low Zoom</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:0)
      assert html =~ ~s(&quot;max&quot;:5)
    end

    test "renders with high zoom values" do
      assigns = %{
        id: "high-zoom",
        map_id: "test-map",
        min: 18,
        max: 22
      }

      html =
        rendered_to_string(~H"""
        <.zoom_range id={@id} map_id={@map_id} min={@min} max={@max}>
          <div>Very High Zoom</div>
        </.zoom_range>
        """)

      assert html =~ ~s(&quot;min&quot;:18)
      assert html =~ ~s(&quot;max&quot;:22)
    end
  end
end
