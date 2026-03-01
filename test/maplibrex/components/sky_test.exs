defmodule MaplibreX.Components.SkyTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "sky/1" do
    test "renders with required attributes" do
      assigns = %{
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} />
        """)

      assert html =~ ~s(id="sky-test-map")
      assert html =~ ~s(phx-hook="SkyHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration for atmosphere type" do
      assigns = %{
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} />
        """)

      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;sky-type&quot;:&quot;atmosphere&quot;)
      assert html =~ ~s(&quot;sky-atmosphere-sun&quot;:[0.0,90.0])
      assert html =~ ~s(&quot;sky-atmosphere-sun-intensity&quot;:10)
    end

    test "renders with custom atmosphere sun position" do
      assigns = %{
        map_id: "test-map",
        atmosphere_sun: [180.0, 45.0]
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} atmosphere_sun={@atmosphere_sun} />
        """)

      assert html =~ ~s(&quot;sky-atmosphere-sun&quot;:[180.0,45.0])
    end

    test "renders with custom atmosphere sun intensity" do
      assigns = %{
        map_id: "test-map",
        atmosphere_sun_intensity: 15
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} atmosphere_sun_intensity={@atmosphere_sun_intensity} />
        """)

      assert html =~ ~s(&quot;sky-atmosphere-sun-intensity&quot;:15)
    end

    test "renders gradient type sky" do
      assigns = %{
        map_id: "test-map",
        type: "gradient"
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} type={@type} />
        """)

      assert html =~ ~s(&quot;sky-type&quot;:&quot;gradient&quot;)
      assert html =~ ~s(&quot;sky-gradient-center&quot;:[0,0])
      assert html =~ ~s(&quot;sky-gradient-radius&quot;:90)
    end

    test "renders gradient with custom colors" do
      assigns = %{
        map_id: "test-map",
        type: "gradient",
        gradient: ["#FF0000", "#00FF00", "#0000FF"]
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} type={@type} gradient={@gradient} />
        """)

      assert html =~ ~s(&quot;sky-gradient&quot;:[&quot;#FF0000&quot;,&quot;#00FF00&quot;,&quot;#0000FF&quot;])
    end

    test "renders with custom atmosphere colors" do
      assigns = %{
        map_id: "test-map",
        atmosphere_color: "rgba(255, 100, 50, 1)",
        atmosphere_halo_color: "rgba(255, 255, 0, 1)"
      }

      html =
        rendered_to_string(~H"""
        <.sky
          map_id={@map_id}
          atmosphere_color={@atmosphere_color}
          atmosphere_halo_color={@atmosphere_halo_color}
        />
        """)

      assert html =~ "sky-atmosphere-color"
      assert html =~ "rgba(255, 100, 50, 1)"
      assert html =~ "sky-atmosphere-halo-color"
      assert html =~ "rgba(255, 255, 0, 1)"
    end

    test "raises error with invalid type" do
      assigns = %{
        map_id: "test-map",
        type: "invalid-type"
      }

      assert_raise ArgumentError, ~r/Invalid sky type/, fn ->
        rendered_to_string(~H"""
        <.sky map_id={@map_id} type={@type} />
        """)
      end
    end

    test "uses default values when not specified" do
      assigns = %{
        map_id: "test-map"
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} />
        """)

      # Defaults: type="atmosphere", sun=[0.0, 90.0], intensity=10
      assert html =~ ~s(&quot;sky-type&quot;:&quot;atmosphere&quot;)
      assert html =~ ~s(&quot;sky-atmosphere-sun&quot;:[0.0,90.0])
      assert html =~ ~s(&quot;sky-atmosphere-sun-intensity&quot;:10)
      assert html =~ "sky-atmosphere-color"
      assert html =~ "rgba(135, 206, 235, 1)"
    end

    test "sky ID includes map_id for uniqueness" do
      assigns = %{
        map_id: "my-special-map"
      }

      html =
        rendered_to_string(~H"""
        <.sky map_id={@map_id} />
        """)

      assert html =~ ~s(id="sky-my-special-map")
    end
  end
end
