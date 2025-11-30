defmodule MaplibreX.Components.ScaleControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.ScaleControl

  describe "scale_control/1" do
    test "renders basic scale control with required attributes" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="scale-control")
      assert html =~ ~s(phx-hook="ScaleControlHook")
      assert html =~ ~s(data-config=)
    end

    test "renders with default position" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with custom position" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        position: "top-right"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with default max_width" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;maxWidth&quot;:100)
    end

    test "renders with custom max_width" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        max_width: 150
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} max_width={@max_width} />
        """)

      assert html =~ ~s(&quot;maxWidth&quot;:150)
    end

    test "renders with default unit" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;unit&quot;:&quot;metric&quot;)
    end

    test "renders with imperial unit" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        unit: "imperial"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} unit={@unit} />
        """)

      assert html =~ ~s(&quot;unit&quot;:&quot;imperial&quot;)
    end

    test "renders with nautical unit" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        unit: "nautical"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} unit={@unit} />
        """)

      assert html =~ ~s(&quot;unit&quot;:&quot;nautical&quot;)
    end

    test "renders with all options" do
      assigns = %{
        id: "full-scale-control",
        map_id: "test-map",
        position: "bottom-right",
        max_width: 200,
        unit: "imperial"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control
          id={@id}
          map_id={@map_id}
          position={@position}
          max_width={@max_width}
          unit={@unit}
        />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;full-scale-control&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)
      assert html =~ ~s(&quot;maxWidth&quot;:200)
      assert html =~ ~s(&quot;unit&quot;:&quot;imperial&quot;)
    end

    test "validates position" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        position: "invalid-position"
      }

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} position={@position} />
        """)
      end
    end

    test "validates unit" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map",
        unit: "invalid-unit"
      }

      assert_raise ArgumentError, ~r/Invalid unit/, fn ->
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} unit={@unit} />
        """)
      end
    end

    test "accepts all valid positions" do
      valid_positions = ["top-left", "top-right", "bottom-left", "bottom-right"]

      for position <- valid_positions do
        assigns = %{
          id: "scale-#{position}",
          map_id: "test-map",
          position: position
        }

        html =
          rendered_to_string(~H"""
          <.scale_control id={@id} map_id={@map_id} position={@position} />
          """)

        assert html =~ ~s(id="scale-#{position}")
        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "accepts all valid units" do
      valid_units = ["imperial", "metric", "nautical"]

      for unit <- valid_units do
        assigns = %{
          id: "scale-#{unit}",
          map_id: "test-map",
          unit: unit
        }

        html =
          rendered_to_string(~H"""
          <.scale_control id={@id} map_id={@map_id} unit={@unit} />
          """)

        assert html =~ ~s(id="scale-#{unit}")
        assert html =~ ~s(&quot;unit&quot;:&quot;#{unit}&quot;)
      end
    end

    test "control container has display: none style" do
      assigns = %{
        id: "scale-control",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.scale_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(style="display: none;")
    end
  end
end
