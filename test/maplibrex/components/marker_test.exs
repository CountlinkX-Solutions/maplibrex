defmodule MaplibreX.Components.MarkerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.Marker

  describe "marker/1 component" do
    test "renders marker with required attributes" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
        />
        """)

      assert html =~ ~s(id="test-marker")
      assert html =~ ~s(phx-hook="MarkerHook")
      assert html =~ ~s(data-config=)
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
        />
        """)

      assert html =~ ~s("id":"test-marker")
      assert html =~ ~s("mapId":"test-map")
      assert html =~ ~s("lngLat":[-74.5,40])
    end

    test "renders marker with default color" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
        />
        """)

      assert html =~ ~s("color":"#3FB1CE")
    end

    test "renders marker with custom color" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        color: "red"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          color={@color}
        />
        """)

      assert html =~ ~s("color":"red")
    end

    test "renders marker with scale" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        scale: 1.5
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          scale={@scale}
        />
        """)

      assert html =~ ~s("scale":1.5)
    end

    test "renders marker with rotation" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        rotation: 45
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          rotation={@rotation}
        />
        """)

      assert html =~ ~s("rotation":45)
    end

    test "renders draggable marker" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        draggable: true
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          draggable={@draggable}
        />
        """)

      assert html =~ ~s("draggable":true)
    end

    test "renders marker with anchor" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        anchor: "bottom"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          anchor={@anchor}
        />
        """)

      assert html =~ ~s("anchor":"bottom")
    end

    test "renders marker with offset" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        offset: [10, 20]
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          offset={@offset}
        />
        """)

      assert html =~ ~s("offset":[10,20])
    end

    test "renders marker with popup text" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        popup_text: "Hello World"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          popup_text={@popup_text}
        />
        """)

      assert html =~ ~s("popup":{)
      assert html =~ ~s("text":"Hello World")
    end

    test "renders marker with popup html" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        popup_html: "<h1>Title</h1>"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          popup_html={@popup_html}
        />
        """)

      assert html =~ ~s("popup":{)
      assert html =~ ~s("html":"<h1>Title</h1>")
    end

    test "renders marker with pitch alignment" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        pitch_alignment: "viewport"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          pitch_alignment={@pitch_alignment}
        />
        """)

      assert html =~ ~s("pitchAlignment":"viewport")
    end

    test "renders marker with rotation alignment" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40],
        rotation_alignment: "map"
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
          rotation_alignment={@rotation_alignment}
        />
        """)

      assert html =~ ~s("rotationAlignment":"map")
    end

    test "marker is hidden by default with display:none" do
      assigns = %{
        id: "test-marker",
        map_id: "test-map",
        lng_lat: [-74.5, 40]
      }

      html =
        rendered_to_string(~H"""
        <.marker
          id={@id}
          map_id={@map_id}
          lng_lat={@lng_lat}
        />
        """)

      assert html =~ ~s(style="display: none;")
    end
  end
end
