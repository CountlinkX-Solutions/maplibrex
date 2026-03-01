defmodule MaplibreX.Components.ImageSourceTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "image_source/1" do
    test "renders with required attributes" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80.425, 46.437],
          [-71.516, 46.437],
          [-71.516, 37.936],
          [-80.425, 37.936]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(id="radar")
      assert html =~ ~s(phx-hook="ImageSourceHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80.425, 46.437],
          [-71.516, 46.437],
          [-71.516, 37.936],
          [-80.425, 37.936]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;radar&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;url&quot;:&quot;/images/radar.png&quot;)
      assert html =~ ~s(&quot;coordinates&quot;)
    end

    test "renders coordinates correctly" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80.425, 46.437],
          [-71.516, 46.437],
          [-71.516, 37.936],
          [-80.425, 37.936]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(-80.425)
      assert html =~ ~s(46.437)
      assert html =~ ~s(-71.516)
      assert html =~ ~s(37.936)
    end

    test "renders with absolute URL" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "https://example.com/radar.png",
        coordinates: [
          [-80.0, 46.0],
          [-71.0, 46.0],
          [-71.0, 37.0],
          [-80.0, 37.0]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(https://example.com/radar.png)
    end

    test "renders with different coordinate sets" do
      assigns = %{
        id: "historical",
        map_id: "test-map",
        url: "/images/nyc-1880.jpg",
        coordinates: [
          [-74.05, 40.75],
          [-73.95, 40.75],
          [-73.95, 40.65],
          [-74.05, 40.65]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(-74.05)
      assert html =~ ~s(40.75)
      assert html =~ ~s(-73.95)
      assert html =~ ~s(40.65)
    end

    test "raises error with less than 4 coordinates" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80.0, 46.0],
          [-71.0, 46.0],
          [-71.0, 37.0]
        ]
      }

      assert_raise ArgumentError, ~r/requires exactly 4 coordinates/, fn ->
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)
      end
    end

    test "raises error with more than 4 coordinates" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80.0, 46.0],
          [-71.0, 46.0],
          [-71.0, 37.0],
          [-80.0, 37.0],
          [-75.0, 41.0]
        ]
      }

      assert_raise ArgumentError, ~r/requires exactly 4 coordinates/, fn ->
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)
      end
    end

    test "renders with integer coordinates" do
      assigns = %{
        id: "radar",
        map_id: "test-map",
        url: "/images/radar.png",
        coordinates: [
          [-80, 46],
          [-71, 46],
          [-71, 37],
          [-80, 37]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.image_source id={@id} map_id={@map_id} url={@url} coordinates={@coordinates} />
        """)

      assert html =~ ~s(-80)
      assert html =~ ~s(46)
      assert html =~ ~s(-71)
      assert html =~ ~s(37)
    end
  end
end
