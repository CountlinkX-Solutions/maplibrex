defmodule MaplibreX.Components.RasterTileSourceTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "raster_tile_source/1" do
    test "renders with TileJSON URL" do
      assigns = %{id: "satellite", map_id: "test-map", url: "https://example.com/satellite.json"}

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(id="satellite")
      assert html =~ ~s(phx-hook="RasterTileSourceHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration with URL in data-config" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json"
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;satellite&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;url&quot;:&quot;https://example.com/satellite.json&quot;)
    end

    test "renders with tile URLs" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        tiles: [
          "https://a.example.com/satellite/{z}/{x}/{y}.png",
          "https://b.example.com/satellite/{z}/{x}/{y}.png"
        ]
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} tiles={@tiles} />
        """)

      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(https://a.example.com)
      assert html =~ ~s(https://b.example.com)
    end

    test "renders with custom tile size" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        tile_size: 256
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} tile_size={@tile_size} />
        """)

      assert html =~ ~s(&quot;tileSize&quot;:256)
    end

    test "renders with min and max zoom" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        min_zoom: 0,
        max_zoom: 18
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source
          id={@id}
          map_id={@map_id}
          url={@url}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:18)
    end

    test "renders with attribution" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        attribution: "© Satellite Provider"
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source
          id={@id}
          map_id={@map_id}
          url={@url}
          attribution={@attribution}
        />
        """)

      assert html =~ ~s(&quot;attribution&quot;:&quot;© Satellite Provider&quot;)
    end

    test "renders with bounds" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        bounds: [-180, -85, 180, 85]
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} bounds={@bounds} />
        """)

      assert html =~ ~s(&quot;bounds&quot;:[-180,-85,180,85])
    end

    test "renders with TMS scheme" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        tms: true
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} tms={@tms} />
        """)

      assert html =~ ~s(&quot;tms&quot;:true)
    end

    test "renders with scheme" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        scheme: "tms"
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} scheme={@scheme} />
        """)

      assert html =~ ~s(&quot;scheme&quot;:&quot;tms&quot;)
    end

    test "renders with volatile flag" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json",
        volatile: true
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} volatile={@volatile} />
        """)

      assert html =~ ~s(&quot;volatile&quot;:true)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "satellite-full",
        map_id: "test-map",
        tiles: [
          "https://a.example.com/{z}/{x}/{y}.png",
          "https://b.example.com/{z}/{x}/{y}.png"
        ],
        tile_size: 256,
        min_zoom: 0,
        max_zoom: 18,
        attribution: "© Satellite",
        bounds: [-180, -85, 180, 85],
        scheme: "xyz",
        tms: false,
        volatile: false
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source
          id={@id}
          map_id={@map_id}
          tiles={@tiles}
          tile_size={@tile_size}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          attribution={@attribution}
          bounds={@bounds}
          scheme={@scheme}
          tms={@tms}
          volatile={@volatile}
        />
        """)

      assert html =~ ~s(id="satellite-full")
      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(&quot;tileSize&quot;:256)
      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:18)
      assert html =~ ~s(&quot;attribution&quot;)
      assert html =~ ~s(&quot;bounds&quot;)
      assert html =~ ~s(&quot;scheme&quot;:&quot;xyz&quot;)
      assert html =~ ~s(&quot;tms&quot;:false)
      assert html =~ ~s(&quot;volatile&quot;:false)
    end

    test "raises error when neither url nor tiles provided" do
      assigns = %{id: "satellite", map_id: "test-map"}

      assert_raise ArgumentError, ~r/requires either 'url' or 'tiles'/, fn ->
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} />
        """)
      end
    end

    test "includes default values in configuration" do
      assigns = %{
        id: "satellite",
        map_id: "test-map",
        url: "https://example.com/satellite.json"
      }

      html =
        rendered_to_string(~H"""
        <.raster_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      # Should include defaults: tileSize, minzoom, maxzoom, scheme, tms, volatile
      assert html =~ ~s(&quot;tileSize&quot;:512)
      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:22)
      assert html =~ ~s(&quot;scheme&quot;:&quot;xyz&quot;)
      assert html =~ ~s(&quot;tms&quot;:false)
      assert html =~ ~s(&quot;volatile&quot;:false)
    end
  end
end
