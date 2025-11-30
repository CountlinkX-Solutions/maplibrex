defmodule MaplibreX.Components.MapTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.Map

  describe "map/1 component" do
    test "renders map with required attributes" do
      assigns = %{
        id: "test-map",
        center: [-74.5, 40],
        zoom: 9,
        style: "https://demotiles.maplibre.org/style.json"
      }

      html =
        rendered_to_string(~H"""
        <.map
          id={@id}
          center={@center}
          zoom={@zoom}
          style={@style}
        />
        """)

      assert html =~ ~s(id="test-map")
      assert html =~ ~s(phx-hook="MapHook")
      assert html =~ ~s(data-config=)
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "test-map",
        center: [-74.5, 40],
        zoom: 9,
        style: "https://demotiles.maplibre.org/style.json"
      }

      html =
        rendered_to_string(~H"""
        <.map
          id={@id}
          center={@center}
          zoom={@zoom}
          style={@style}
        />
        """)

      # La configuración está en formato JSON
      assert html =~ ~s("id":"test-map")
      assert html =~ ~s("center":[-74.5,40])
      assert html =~ ~s("zoom":9)
    end

    test "renders map with optional attributes" do
      assigns = %{
        id: "test-map",
        center: [-74.5, 40],
        zoom: 9,
        style: "https://demotiles.maplibre.org/style.json",
        min_zoom: 5,
        max_zoom: 15,
        bearing: 45,
        pitch: 30
      }

      html =
        rendered_to_string(~H"""
        <.map
          id={@id}
          center={@center}
          zoom={@zoom}
          style={@style}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          bearing={@bearing}
          pitch={@pitch}
        />
        """)

      assert html =~ ~s("minZoom":5)
      assert html =~ ~s("maxZoom":15)
      assert html =~ ~s("bearing":45)
      assert html =~ ~s("pitch":30)
    end

    test "renders map with bounds" do
      assigns = %{
        id: "test-map",
        center: [-74.5, 40],
        zoom: 9,
        style: "https://demotiles.maplibre.org/style.json",
        bounds: [[-75, 39], [-74, 41]]
      }

      html =
        rendered_to_string(~H"""
        <.map
          id={@id}
          center={@center}
          zoom={@zoom}
          style={@style}
          bounds={@bounds}
        />
        """)

      assert html =~ ~s("bounds":[[-75,39],[-74,41]])
    end

    test "renders map with custom class" do
      assigns = %{
        id: "test-map",
        center: [-74.5, 40],
        zoom: 9,
        style: "https://demotiles.maplibre.org/style.json"
      }

      html =
        rendered_to_string(~H"""
        <.map
          id={@id}
          center={@center}
          zoom={@zoom}
          style={@style}
          class="h-96 w-full"
        />
        """)

      assert html =~ ~s(class="h-96 w-full")
    end

    test "fly_to/4 generates correct JS command" do
      command = MaplibreX.Components.Map.fly_to("test-map", [-73.98, 40.75], 12)

      assert command.js
      assert command.params["center"] == [-73.98, 40.75]
      assert command.params["zoom"] == 12
    end

    test "jump_to/4 generates correct JS command" do
      command = MaplibreX.Components.Map.jump_to("test-map", [-73.98, 40.75], 12)

      assert command.js
      assert command.params["center"] == [-73.98, 40.75]
      assert command.params["zoom"] == 12
    end

    test "fit_bounds/3 generates correct JS command" do
      bounds = [[-75, 39], [-74, 41]]
      command = MaplibreX.Components.Map.fit_bounds("test-map", bounds)

      assert command.js
      assert command.params["bounds"] == bounds
    end

    test "set_style/2 generates correct JS command" do
      style = "mapbox://styles/mapbox/dark-v11"
      command = MaplibreX.Components.Map.set_style("test-map", style)

      assert command.js
      assert command.params["style"] == style
    end

    test "zoom_in/1 generates correct JS command" do
      command = MaplibreX.Components.Map.zoom_in("test-map")

      assert command.js
    end

    test "zoom_out/1 generates correct JS command" do
      command = MaplibreX.Components.Map.zoom_out("test-map")

      assert command.js
    end

    test "reset_north/1 generates correct JS command" do
      command = MaplibreX.Components.Map.reset_north("test-map")

      assert command.js
    end
  end
end
