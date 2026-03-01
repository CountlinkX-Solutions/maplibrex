defmodule MaplibreX.Components.VideoSourceTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "video_source/1" do
    test "renders with required attributes" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)

      assert html =~ ~s(id="drone")
      assert html =~ ~s(phx-hook="VideoSourceHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;drone&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;urls&quot;)
      assert html =~ ~s(&quot;coordinates&quot;)
    end

    test "renders with multiple video URLs" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4", "/videos/drone.webm", "/videos/drone.ogv"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)

      assert html =~ ~s(drone.mp4)
      assert html =~ ~s(drone.webm)
      assert html =~ ~s(drone.ogv)
    end

    test "renders coordinates correctly" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)

      assert html =~ ~s(-122.516)
      assert html =~ ~s(37.562)
      assert html =~ ~s(-122.515)
      assert html =~ ~s(37.564)
    end

    test "renders with absolute URLs" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["https://example.com/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      html =
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)

      assert html =~ ~s(https://example.com/videos/drone.mp4)
    end

    test "raises error with less than 4 coordinates" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563]
        ]
      }

      assert_raise ArgumentError, ~r/requires exactly 4 coordinates/, fn ->
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)
      end
    end

    test "raises error with more than 4 coordinates" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: ["/videos/drone.mp4"],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562],
          [-122.512, 37.561]
        ]
      }

      assert_raise ArgumentError, ~r/requires exactly 4 coordinates/, fn ->
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)
      end
    end

    test "raises error with empty URLs list" do
      assigns = %{
        id: "drone",
        map_id: "test-map",
        urls: [],
        coordinates: [
          [-122.516, 37.562],
          [-122.515, 37.564],
          [-122.513, 37.563],
          [-122.514, 37.562]
        ]
      }

      assert_raise ArgumentError, ~r/requires at least one video URL/, fn ->
        rendered_to_string(~H"""
        <.video_source id={@id} map_id={@map_id} urls={@urls} coordinates={@coordinates} />
        """)
      end
    end
  end
end
