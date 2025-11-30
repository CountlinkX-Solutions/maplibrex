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

      assert html =~ ~s(&quot;id&quot;:&quot;test-marker&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;lngLat&quot;:[-74.5,40])
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

      assert html =~ ~s(&quot;color&quot;:&quot;#3FB1CE&quot;)
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

      assert html =~ ~s(&quot;color&quot;:&quot;red&quot;)
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

      assert html =~ ~s(&quot;scale&quot;:1.5)
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

      assert html =~ ~s(&quot;rotation&quot;:45)
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

      assert html =~ ~s(&quot;draggable&quot;:true)
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

      assert html =~ ~s(&quot;anchor&quot;:&quot;bottom&quot;)
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

      assert html =~ ~s(&quot;offset&quot;:[10,20])
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

      assert html =~ ~s(&quot;popup&quot;:{)
      assert html =~ ~s(&quot;text&quot;:&quot;Hello World&quot;)
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

      assert html =~ ~s(&quot;popup&quot;:{)
      assert html =~ ~s(&quot;html&quot;:&quot;&lt;h1&gt;Title&lt;/h1&gt;&quot;)
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

      assert html =~ ~s(&quot;pitchAlignment&quot;:&quot;viewport&quot;)
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

      assert html =~ ~s(&quot;rotationAlignment&quot;:&quot;map&quot;)
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
