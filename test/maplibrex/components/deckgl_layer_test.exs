defmodule MaplibreX.Components.DeckGlLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "deckgl_layer/1 - basic rendering" do
    test "renders with required attributes" do
      assigns = %{
        id: "deck-layer-1",
        map_id: "test-map",
        layer_type: "ScatterplotLayer",
        data: [%{"coordinates" => [-122.4, 37.8]}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
        />
        """)

      assert html =~ ~s(id="deck-layer-1")
      assert html =~ ~s(phx-hook="DeckGlLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "points",
        map_id: "my-map",
        layer_type: "ScatterplotLayer",
        data: [%{"pos" => [0, 0]}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
        />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;points&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;my-map&quot;)
      assert html =~ ~s(&quot;layerType&quot;:&quot;ScatterplotLayer&quot;)
      assert html =~ ~s(&quot;data&quot;:)
    end
  end

  describe "deckgl_layer/1 - layer types" do
    test "renders ScatterplotLayer" do
      assigns = %{
        id: "scatter",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;ScatterplotLayer&quot;)
    end

    test "renders ArcLayer" do
      assigns = %{
        id: "arcs",
        map_id: "map",
        layer_type: "ArcLayer",
        data: [%{"from" => [0, 0], "to" => [1, 1]}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;ArcLayer&quot;)
    end

    test "renders HexagonLayer" do
      assigns = %{
        id: "hexagons",
        map_id: "map",
        layer_type: "HexagonLayer",
        data: [%{"position" => [0, 0]}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;HexagonLayer&quot;)
    end

    test "renders GeoJsonLayer" do
      assigns = %{
        id: "geojson",
        map_id: "map",
        layer_type: "GeoJsonLayer",
        data: [%{"type" => "Feature"}]
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;GeoJsonLayer&quot;)
    end
  end

  describe "deckgl_layer/1 - validations" do
    test "raises on invalid layer_type" do
      assert_raise ArgumentError, ~r/Invalid layer_type/, fn ->
        assigns = %{
          id: "test",
          map_id: "map",
          layer_type: "InvalidLayer",
          data: []
        }

        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)
      end
    end

    test "raises when opacity is less than 0" do
      assert_raise ArgumentError, ~r/opacity must be between 0 and 1/, fn ->
        assigns = %{
          id: "test",
          map_id: "map",
          layer_type: "ScatterplotLayer",
          data: [],
          opacity: -0.5
        }

        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          opacity={@opacity}
        />
        """)
      end
    end

    test "raises when opacity is greater than 1" do
      assert_raise ArgumentError, ~r/opacity must be between 0 and 1/, fn ->
        assigns = %{
          id: "test",
          map_id: "map",
          layer_type: "ScatterplotLayer",
          data: [],
          opacity: 1.5
        }

        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          opacity={@opacity}
        />
        """)
      end
    end

    test "raises when data is not a list" do
      assert_raise ArgumentError, ~r/data must be a list/, fn ->
        assigns = %{
          id: "test",
          map_id: "map",
          layer_type: "ScatterplotLayer",
          data: "not a list"
        }

        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)
      end
    end
  end

  describe "deckgl_layer/1 - props and options" do
    test "renders with custom props" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        props: %{
          "getPosition" => "coordinates",
          "getRadius" => 1000,
          "getFillColor" => [255, 140, 0]
        }
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          props={@props}
        />
        """)

      assert html =~ ~s(&quot;getPosition&quot;:&quot;coordinates&quot;)
      assert html =~ ~s(&quot;getRadius&quot;:1000)
      assert html =~ ~s(&quot;getFillColor&quot;:[255,140,0])
    end

    test "renders with pickable true" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        pickable: true
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          pickable={@pickable}
        />
        """)

      assert html =~ ~s(&quot;pickable&quot;:true)
    end

    test "renders with auto_highlight enabled" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        auto_highlight: true
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          auto_highlight={@auto_highlight}
        />
        """)

      assert html =~ ~s(&quot;autoHighlight&quot;:true)
    end

    test "renders with custom opacity" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        opacity: 0.5
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          opacity={@opacity}
        />
        """)

      assert html =~ ~s(&quot;opacity&quot;:0.5)
    end

    test "renders with visible false" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        visible: false
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          visible={@visible}
        />
        """)

      assert html =~ ~s(&quot;visible&quot;:false)
    end

    test "renders with before_id for layer ordering" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        before_id: "other-layer"
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;other-layer&quot;)
    end

    test "renders with update_triggers" do
      assigns = %{
        id: "points",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [%{}],
        update_triggers: %{"getPosition" => 1}
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          update_triggers={@update_triggers}
        />
        """)

      assert html =~ ~s(&quot;updateTriggers&quot;:{&quot;getPosition&quot;:1})
    end
  end

  describe "deckgl_layer/1 - complete examples" do
    test "renders complete ScatterplotLayer configuration" do
      assigns = %{
        id: "earthquakes",
        map_id: "my-map",
        layer_type: "ScatterplotLayer",
        data: [
          %{"coordinates" => [-122.4, 37.8], "magnitude" => 4.5},
          %{"coordinates" => [-118.2, 34.0], "magnitude" => 3.2}
        ],
        pickable: true,
        auto_highlight: true,
        opacity: 0.8,
        visible: true,
        props: %{
          "getPosition" => "coordinates",
          "getRadius" => 1000,
          "getFillColor" => [255, 140, 0],
          "radiusMinPixels" => 2
        }
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          pickable={@pickable}
          auto_highlight={@auto_highlight}
          opacity={@opacity}
          visible={@visible}
          props={@props}
        />
        """)

      assert html =~ ~s(id="earthquakes")
      assert html =~ ~s(&quot;layerType&quot;:&quot;ScatterplotLayer&quot;)
      assert html =~ ~s(&quot;pickable&quot;:true)
      assert html =~ ~s(&quot;autoHighlight&quot;:true)
      assert html =~ ~s(&quot;opacity&quot;:0.8)
      assert html =~ ~s(&quot;getPosition&quot;:&quot;coordinates&quot;)
    end

    test "renders ArcLayer with source and target" do
      assigns = %{
        id: "flights",
        map_id: "world-map",
        layer_type: "ArcLayer",
        data: [
          %{"from" => [-122.4, 37.8], "to" => [-74.0, 40.7]}
        ],
        pickable: true,
        props: %{
          "getSourcePosition" => "from",
          "getTargetPosition" => "to",
          "getSourceColor" => [255, 140, 0],
          "getTargetColor" => [255, 200, 0],
          "getWidth" => 2
        }
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          pickable={@pickable}
          props={@props}
        />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;ArcLayer&quot;)
      assert html =~ ~s(&quot;getSourcePosition&quot;:&quot;from&quot;)
      assert html =~ ~s(&quot;getTargetPosition&quot;:&quot;to&quot;)
    end

    test "renders HexagonLayer with aggregation props" do
      assigns = %{
        id: "hex-density",
        map_id: "map",
        layer_type: "HexagonLayer",
        data: [%{"location" => [0, 0]}],
        props: %{
          "getPosition" => "location",
          "elevationScale" => 4,
          "radius" => 200,
          "extruded" => true,
          "coverage" => 0.9
        }
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          props={@props}
        />
        """)

      assert html =~ ~s(&quot;layerType&quot;:&quot;HexagonLayer&quot;)
      assert html =~ ~s(&quot;elevationScale&quot;:4)
      assert html =~ ~s(&quot;radius&quot;:200)
      assert html =~ ~s(&quot;extruded&quot;:true)
    end
  end

  describe "deckgl_layer/1 - multiple layers" do
    test "renders multiple layers with different IDs" do
      assigns = %{
        layer1: %{
          id: "points-1",
          map_id: "map-1",
          layer_type: "ScatterplotLayer",
          data: [%{}]
        },
        layer2: %{
          id: "arcs-1",
          map_id: "map-1",
          layer_type: "ArcLayer",
          data: [%{}]
        }
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@layer1.id}
          map_id={@layer1.map_id}
          layer_type={@layer1.layer_type}
          data={@layer1.data}
        />
        <.deckgl_layer
          id={@layer2.id}
          map_id={@layer2.map_id}
          layer_type={@layer2.layer_type}
          data={@layer2.data}
        />
        """)

      assert html =~ ~s(id="points-1")
      assert html =~ ~s(id="arcs-1")
      assert html =~ ~s(&quot;layerType&quot;:&quot;ScatterplotLayer&quot;)
      assert html =~ ~s(&quot;layerType&quot;:&quot;ArcLayer&quot;)
    end
  end

  describe "deckgl_layer/1 - default values" do
    test "uses default opacity of 1.0" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: []
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;opacity&quot;:1.0)
    end

    test "uses default visible of true" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: []
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;visible&quot;:true)
    end

    test "uses default pickable of false" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: []
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;pickable&quot;:false)
    end

    test "uses default auto_highlight of false" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: []
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;autoHighlight&quot;:false)
    end
  end

  describe "deckgl_layer/1 - edge cases" do
    test "handles empty data array" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: []
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer id={@id} map_id={@map_id} layer_type={@layer_type} data={@data} />
        """)

      assert html =~ ~s(&quot;data&quot;:[])
    end

    test "handles opacity of 0" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [],
        opacity: 0
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          opacity={@opacity}
        />
        """)

      assert html =~ ~s(&quot;opacity&quot;:0)
    end

    test "handles opacity of 1" do
      assigns = %{
        id: "test",
        map_id: "map",
        layer_type: "ScatterplotLayer",
        data: [],
        opacity: 1
      }

      html =
        rendered_to_string(~H"""
        <.deckgl_layer
          id={@id}
          map_id={@map_id}
          layer_type={@layer_type}
          data={@data}
          opacity={@opacity}
        />
        """)

      assert html =~ ~s(&quot;opacity&quot;:1)
    end
  end
end
