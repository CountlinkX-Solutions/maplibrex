defmodule MaplibreX.Components.GeolocateControlTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "geolocate_control/1" do
    test "renders with required attributes" do
      assigns = %{id: "geolocate-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(id="geolocate-1")
      assert html =~ ~s(phx-hook="GeolocateControlHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{id: "geolocate-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;geolocate-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)
    end

    test "renders with custom position" do
      assigns = %{id: "geolocate-1", map_id: "test-map", position: "bottom-left"}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} position={@position} />
        """)

      assert html =~ ~s(&quot;position&quot;:&quot;bottom-left&quot;)
    end

    test "renders with tracking enabled" do
      assigns = %{id: "geolocate-1", map_id: "test-map", track: true}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} track_user_location={@track} />
        """)

      assert html =~ ~s(&quot;trackUserLocation&quot;:true)
    end

    test "renders with accuracy circle disabled" do
      assigns = %{id: "geolocate-1", map_id: "test-map", show_circle: false}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} show_accuracy_circle={@show_circle} />
        """)

      assert html =~ ~s(&quot;showAccuracyCircle&quot;:false)
    end

    test "renders with user heading enabled" do
      assigns = %{id: "geolocate-1", map_id: "test-map", show_heading: true}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} show_user_heading={@show_heading} />
        """)

      assert html =~ ~s(&quot;showUserHeading&quot;:true)
    end

    test "renders with fit bounds options" do
      assigns = %{
        id: "geolocate-1",
        map_id: "test-map",
        fit_options: %{maxZoom: 15, padding: 50}
      }

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} fit_bounds_options={@fit_options} />
        """)

      assert html =~ ~s(&quot;maxZoom&quot;:15)
      assert html =~ ~s(&quot;padding&quot;:50)
    end

    test "accepts all valid positions" do
      valid_positions = ~w(top-left top-right bottom-left bottom-right)

      for position <- valid_positions do
        assigns = %{id: "geolocate-1", map_id: "test-map", position: position}

        html =
          rendered_to_string(~H"""
          <.geolocate_control id={@id} map_id={@map_id} position={@position} />
          """)

        assert html =~ ~s(&quot;position&quot;:&quot;#{position}&quot;)
      end
    end

    test "raises error for invalid position" do
      assigns = %{id: "geolocate-1", map_id: "test-map", position: "invalid"}

      assert_raise ArgumentError, ~r/Invalid position/, fn ->
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} position={@position} />
        """)
      end
    end

    test "renders with all options combined" do
      assigns = %{
        id: "geolocate-full",
        map_id: "test-map",
        position: "bottom-right",
        track: true,
        show_circle: true,
        show_heading: true,
        fit_options: %{maxZoom: 18}
      }

      html =
        rendered_to_string(~H"""
        <.geolocate_control
          id={@id}
          map_id={@map_id}
          position={@position}
          track_user_location={@track}
          show_accuracy_circle={@show_circle}
          show_user_heading={@show_heading}
          fit_bounds_options={@fit_options}
        />
        """)

      assert html =~ ~s(id="geolocate-full")
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;position&quot;:&quot;bottom-right&quot;)
      assert html =~ ~s(&quot;trackUserLocation&quot;:true)
      assert html =~ ~s(&quot;showAccuracyCircle&quot;:true)
      assert html =~ ~s(&quot;showUserHeading&quot;:true)
      assert html =~ ~s(&quot;maxZoom&quot;:18)
    end

    test "renders multiple instances with different IDs" do
      assigns = %{
        geolocate1: %{id: "geolocate-1", map_id: "map-1"},
        geolocate2: %{id: "geolocate-2", map_id: "map-2"}
      }

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@geolocate1.id} map_id={@geolocate1.map_id} />
        <.geolocate_control id={@geolocate2.id} map_id={@geolocate2.map_id} />
        """)

      assert html =~ ~s(id="geolocate-1")
      assert html =~ ~s(id="geolocate-2")
      assert html =~ ~s(&quot;mapId&quot;:&quot;map-1&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;map-2&quot;)
    end

    test "default values are set correctly" do
      assigns = %{id: "geolocate-1", map_id: "test-map"}

      html =
        rendered_to_string(~H"""
        <.geolocate_control id={@id} map_id={@map_id} />
        """)

      # Default position: top-right
      assert html =~ ~s(&quot;position&quot;:&quot;top-right&quot;)

      # Default trackUserLocation: false
      assert html =~ ~s(&quot;trackUserLocation&quot;:false)

      # Default showAccuracyCircle: true
      assert html =~ ~s(&quot;showAccuracyCircle&quot;:true)

      # Default showUserHeading: true
      assert html =~ ~s(&quot;showUserHeading&quot;:true)

      # Default fitBoundsOptions: {}
      assert html =~ ~s(&quot;fitBoundsOptions&quot;:{})
    end
  end
end
