defmodule MaplibreX.Components.PopupTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.Popup

  describe "popup/1" do
    test "renders basic popup with required attributes" do
      assigns = %{
        id: "test-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat}>
          <p>Test content</p>
        </.popup>
        """)

      assert html =~ ~s(id="test-popup")
      assert html =~ ~s(phx-hook="PopupHook")
      assert html =~ ~s(data-config=)
      assert html =~ "Test content"
    end

    test "renders popup without lng_lat (not initially positioned)" do
      assigns = %{
        id: "test-popup",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(id="test-popup")
      assert html =~ ~s(phx-hook="PopupHook")
    end

    test "includes all optional attributes in config" do
      assigns = %{
        id: "styled-popup",
        map_id: "test-map",
        lng_lat: [-122.4, 37.8],
        max_width: "300px",
        close_button: false,
        close_on_click: false,
        close_on_move: true,
        anchor: "bottom",
        offset: [10, 20],
        class_name: "custom-popup"
      }

      html =
        rendered_to_string(~H"""
        <.popup
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          max_width={@max_width}
          close_button={@close_button}
          close_on_click={@close_on_click}
          close_on_move={@close_on_move}
          anchor={@anchor}
          offset={@offset}
          class_name={@class_name}
        >
          <h3>Title</h3>
        </.popup>
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;styled-popup&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;lngLat&quot;:[-122.4,37.8])
      assert html =~ ~s(&quot;maxWidth&quot;:&quot;300px&quot;)
      assert html =~ ~s(&quot;closeButton&quot;:false)
      assert html =~ ~s(&quot;closeOnClick&quot;:false)
      assert html =~ ~s(&quot;closeOnMove&quot;:true)
      assert html =~ ~s(&quot;anchor&quot;:&quot;bottom&quot;)
      assert html =~ ~s(&quot;offset&quot;:[10,20])
      assert html =~ ~s(&quot;className&quot;:&quot;custom-popup&quot;)
      assert html =~ "<h3>Title</h3>"
    end

    test "renders with HTML content" do
      assigns = %{
        id: "html-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat}>
          <div class="popup-content">
            <h3>San Francisco</h3>
            <p>Golden Gate Bridge</p>
            <button>More Info</button>
          </div>
        </.popup>
        """)

      assert html =~ "popup-content"
      assert html =~ "San Francisco"
      assert html =~ "Golden Gate Bridge"
      assert html =~ "More Info"
    end

    test "respects open attribute when true" do
      assigns = %{
        id: "open-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        open: true
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat} open={@open}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(&quot;open&quot;:true)
    end

    test "respects open attribute when false" do
      assigns = %{
        id: "closed-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        open: false
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat} open={@open}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(&quot;open&quot;:false)
    end

    test "open defaults to true when lng_lat is provided" do
      assigns = %{
        id: "default-open-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(&quot;open&quot;:true)
    end

    test "open defaults to false when lng_lat is not provided" do
      assigns = %{
        id: "no-position-popup",
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(&quot;open&quot;:false)
    end

    test "includes data-popup-content attribute on content div" do
      assigns = %{
        id: "content-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat}>
          <p>Test</p>
        </.popup>
        """)

      assert html =~ ~s(data-popup-content)
      assert html =~ ~s(id="content-popup-content")
    end

    test "popup container has display: none style" do
      assigns = %{
        id: "hidden-popup",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.popup id={@id} map_id={@map_id} lng_lat={@lng_lat}>
          <p>Content</p>
        </.popup>
        """)

      assert html =~ ~s(style="display: none;")
    end
  end

  describe "JS commands" do
    test "open/2 generates correct JS command" do
      command = MaplibreX.Components.Popup.open("my-popup", [-74.5, 40])

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "popup:open", target: "#my-popup", value: value}]] = command.ops
      assert value.popup_id == "my-popup"
      assert value.lng_lat == [-74.5, 40]
    end

    test "close/1 generates correct JS command" do
      command = MaplibreX.Components.Popup.close("my-popup")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "popup:close", target: "#my-popup", value: value}]] = command.ops
      assert value.popup_id == "my-popup"
    end

    test "toggle/1 generates correct JS command" do
      command = MaplibreX.Components.Popup.toggle("my-popup")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "popup:toggle", target: "#my-popup", value: value}]] = command.ops
      assert value.popup_id == "my-popup"
    end

    test "set_location/2 generates correct JS command" do
      command = MaplibreX.Components.Popup.set_location("my-popup", [-122.4, 37.8])

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "popup:set_location", target: "#my-popup", value: value}]] = command.ops
      assert value.popup_id == "my-popup"
      assert value.lng_lat == [-122.4, 37.8]
    end
  end
end
