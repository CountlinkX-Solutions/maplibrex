defmodule MaplibreX.Components.CustomLayerTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components.CustomLayer

  describe "custom_layer/1 component" do
    test "renders custom layer with required attributes" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
        />
        """)

      assert html =~ ~s(id="test-custom-layer")
      assert html =~ ~s(phx-hook="CustomLayerHook")
      assert html =~ ~s(data-config=)
      assert html =~ "display:none"
    end

    test "includes correct configuration in data-config" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
        />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;test-custom-layer&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;preset&quot;:&quot;ocean_currents&quot;)
    end

    test "renders with wind_flow preset" do
      assigns = %{
        id: "wind-layer",
        map_id: "test-map",
        preset: "wind_flow"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
        />
        """)

      assert html =~ ~s(&quot;preset&quot;:&quot;wind_flow&quot;)
    end

    test "renders with custom uniforms" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        uniforms: %{
          u_color: [0.2, 0.6, 0.9],
          u_opacity: 0.8,
          u_point_size: 3.0
        }
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          uniforms={@uniforms}
        />
        """)

      assert html =~ ~s(&quot;uniforms&quot;)
      assert html =~ ~s(&quot;u_color&quot;)
      assert html =~ ~s(&quot;u_opacity&quot;)
      assert html =~ ~s(&quot;u_point_size&quot;)
    end

    test "renders with custom vertex shader" do
      assigns = %{
        id: "custom-shader-layer",
        map_id: "test-map",
        vertex_shader: "attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          vertex_shader={@vertex_shader}
        />
        """)

      assert html =~ ~s(&quot;vertexShader&quot;)
      assert html =~ "attribute vec2 a_position"
    end

    test "renders with custom fragment shader" do
      assigns = %{
        id: "custom-shader-layer",
        map_id: "test-map",
        fragment_shader: "precision mediump float; void main() { gl_FragColor = vec4(1.0); }"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          fragment_shader={@fragment_shader}
        />
        """)

      assert html =~ ~s(&quot;fragmentShader&quot;)
      assert html =~ "precision mediump float"
    end

    test "renders with before_id parameter" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        before_id: "water-layer"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          before_id={@before_id}
        />
        """)

      assert html =~ ~s(&quot;beforeId&quot;:&quot;water-layer&quot;)
    end

    test "renders with zoom constraints" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        min_zoom: 3,
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minZoom&quot;:3)
      assert html =~ ~s(&quot;maxZoom&quot;:15)
    end

    test "renders with custom class" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        class: "my-custom-class"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          class={@class}
        />
        """)

      assert html =~ ~s(class="my-custom-class")
    end

    test "handles nil uniforms gracefully" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        uniforms: nil
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          uniforms={@uniforms}
        />
        """)

      assert html =~ ~s(id="test-custom-layer")
      # Should not crash
    end

    test "omits nil optional parameters from config" do
      assigns = %{
        id: "test-custom-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        before_id: nil,
        min_zoom: nil,
        max_zoom: nil
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          before_id={@before_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      # Should not include nil values in JSON
      refute html =~ ~s(&quot;beforeId&quot;:null)
      refute html =~ ~s(&quot;minZoom&quot;:null)
      refute html =~ ~s(&quot;maxZoom&quot;:null)
    end

    test "complex example with all parameters" do
      assigns = %{
        id: "ocean-currents",
        map_id: "ocean-map",
        preset: "ocean_currents",
        uniforms: %{
          u_color: [0.2, 0.6, 0.9],
          u_opacity: 0.8,
          u_point_size: 3.0
        },
        before_id: "labels",
        min_zoom: 0,
        max_zoom: 18,
        class: "ocean-layer"
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          uniforms={@uniforms}
          before_id={@before_id}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          class={@class}
        />
        """)

      assert html =~ ~s(id="ocean-currents")
      assert html =~ ~s(class="ocean-layer")
      assert html =~ ~s(&quot;preset&quot;:&quot;ocean_currents&quot;)
      assert html =~ ~s(&quot;uniforms&quot;)
      assert html =~ ~s(&quot;beforeId&quot;:&quot;labels&quot;)
      assert html =~ ~s(&quot;minZoom&quot;:0)
      assert html =~ ~s(&quot;maxZoom&quot;:18)
    end

    test "formats uniforms with string keys" do
      assigns = %{
        id: "test-layer",
        map_id: "test-map",
        preset: "wind_flow",
        uniforms: %{
          :u_color => [1.0, 1.0, 1.0],
          "u_opacity" => 0.5
        }
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          uniforms={@uniforms}
        />
        """)

      # Both atom and string keys should be converted to strings
      assert html =~ ~s(&quot;u_color&quot;)
      assert html =~ ~s(&quot;u_opacity&quot;)
    end

    test "multiple custom layers can coexist" do
      assigns = %{
        layers: [
          %{id: "currents", preset: "ocean_currents"},
          %{id: "winds", preset: "wind_flow"}
        ],
        map_id: "multi-map"
      }

      html =
        rendered_to_string(~H"""
        <%= for layer <- @layers do %>
          <.custom_layer
            id={layer.id}
            map_id={@map_id}
            preset={layer.preset}
          />
        <% end %>
        """)

      assert html =~ ~s(id="currents")
      assert html =~ ~s(id="winds")
      assert html =~ ~s(&quot;preset&quot;:&quot;ocean_currents&quot;)
      assert html =~ ~s(&quot;preset&quot;:&quot;wind_flow&quot;)
    end

    test "supports empty uniforms map" do
      assigns = %{
        id: "test-layer",
        map_id: "test-map",
        preset: "ocean_currents",
        uniforms: %{}
      }

      html =
        rendered_to_string(~H"""
        <.custom_layer
          id={@id}
          map_id={@map_id}
          preset={@preset}
          uniforms={@uniforms}
        />
        """)

      assert html =~ ~s(&quot;uniforms&quot;:{})
    end
  end
end
