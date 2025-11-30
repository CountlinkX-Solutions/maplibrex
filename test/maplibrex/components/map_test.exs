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

      # La configuración está en formato JSON (escapado como &quot;)
      assert html =~ ~s(&quot;id&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;center&quot;:[-74.5,40])
      assert html =~ ~s(&quot;zoom&quot;:9)
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

      assert html =~ ~s(&quot;minZoom&quot;:5)
      assert html =~ ~s(&quot;maxZoom&quot;:15)
      assert html =~ ~s(&quot;bearing&quot;:45)
      assert html =~ ~s(&quot;pitch&quot;:30)
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

      assert html =~ ~s(&quot;bounds&quot;:[[-75,39],[-74,41]])
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

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:fly_to", target: "#test-map", value: value}]] = command.ops
      assert value.center == [-73.98, 40.75]
      assert value.zoom == 12
    end

    test "jump_to/4 generates correct JS command" do
      command = MaplibreX.Components.Map.jump_to("test-map", [-73.98, 40.75], 12)

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:jump_to", target: "#test-map", value: value}]] = command.ops
      assert value.center == [-73.98, 40.75]
      assert value.zoom == 12
    end

    test "fit_bounds/3 generates correct JS command" do
      bounds = [[-75, 39], [-74, 41]]
      command = MaplibreX.Components.Map.fit_bounds("test-map", bounds)

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:fit_bounds", target: "#test-map", value: value}]] = command.ops
      assert value.bounds == bounds
    end

    test "set_style/2 generates correct JS command" do
      style = "mapbox://styles/mapbox/dark-v11"
      command = MaplibreX.Components.Map.set_style("test-map", style)

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:set_style", target: "#test-map", value: value}]] = command.ops
      assert value.style == style
    end

    test "zoom_in/1 generates correct JS command" do
      command = MaplibreX.Components.Map.zoom_in("test-map")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:zoom_in", target: "#test-map"}]] = command.ops
    end

    test "zoom_out/1 generates correct JS command" do
      command = MaplibreX.Components.Map.zoom_out("test-map")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:zoom_out", target: "#test-map"}]] = command.ops
    end

    test "reset_north/1 generates correct JS command" do
      command = MaplibreX.Components.Map.reset_north("test-map")

      assert %Phoenix.LiveView.JS{} = command
      assert [["push", %{event: "map:reset_north", target: "#test-map"}]] = command.ops
    end
  end
end
