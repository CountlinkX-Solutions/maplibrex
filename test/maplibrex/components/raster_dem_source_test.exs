defmodule MaplibreX.Components.RasterDEMSourceTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "raster_dem_source/1" do
    test "renders with TileJSON URL" do
      assigns = %{id: "terrain", map_id: "test-map", url: "mapbox://mapbox.terrain-rgb"}

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(id="terrain")
      assert html =~ ~s(phx-hook="RasterDEMSourceHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration with URL in data-config" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb"
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;terrain&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;url&quot;:&quot;mapbox://mapbox.terrain-rgb&quot;)
    end

    test "renders with tile URLs" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} tiles={@tiles} />
        """)

      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(elevation-tiles-prod)
    end

    test "renders with custom tile size" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        tile_size: 256
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} tile_size={@tile_size} />
        """)

      assert html =~ ~s(&quot;tileSize&quot;:256)
    end

    test "renders with min and max zoom" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        min_zoom: 0,
        max_zoom: 15
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source
          id={@id}
          map_id={@map_id}
          url={@url}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:15)
    end

    test "renders with attribution" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        attribution: "© Mapbox"
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} attribution={@attribution} />
        """)

      assert html =~ ~s(&quot;attribution&quot;:&quot;© Mapbox&quot;)
    end

    test "renders with bounds" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        bounds: [-180, -85, 180, 85]
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} bounds={@bounds} />
        """)

      assert html =~ ~s(&quot;bounds&quot;:[-180,-85,180,85])
    end

    test "renders with mapbox encoding" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        encoding: "mapbox"
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} encoding={@encoding} />
        """)

      assert html =~ ~s(&quot;encoding&quot;:&quot;mapbox&quot;)
    end

    test "renders with terrarium encoding" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium"
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} tiles={@tiles} encoding={@encoding} />
        """)

      assert html =~ ~s(&quot;encoding&quot;:&quot;terrarium&quot;)
    end

    test "renders with volatile flag" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb",
        volatile: true
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} volatile={@volatile} />
        """)

      assert html =~ ~s(&quot;volatile&quot;:true)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "terrain-full",
        map_id: "test-map",
        tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
        tile_size: 512,
        min_zoom: 0,
        max_zoom: 15,
        attribution: "© DEM Provider",
        bounds: [-180, -85, 180, 85],
        encoding: "terrarium",
        volatile: false
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source
          id={@id}
          map_id={@map_id}
          tiles={@tiles}
          tile_size={@tile_size}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          attribution={@attribution}
          bounds={@bounds}
          encoding={@encoding}
          volatile={@volatile}
        />
        """)

      assert html =~ ~s(id="terrain-full")
      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(&quot;tileSize&quot;:512)
      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:15)
      assert html =~ ~s(&quot;attribution&quot;)
      assert html =~ ~s(&quot;bounds&quot;)
      assert html =~ ~s(&quot;encoding&quot;:&quot;terrarium&quot;)
      assert html =~ ~s(&quot;volatile&quot;:false)
    end

    test "raises error when neither url nor tiles provided" do
      assigns = %{id: "terrain", map_id: "test-map"}

      assert_raise ArgumentError, ~r/requires either 'url' or 'tiles'/, fn ->
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} />
        """)
      end
    end

    test "omits TileJSON-declared properties so the server values win" do
      assigns = %{
        id: "terrain",
        map_id: "test-map",
        url: "mapbox://mapbox.terrain-rgb"
      }

      html =
        rendered_to_string(~H"""
        <.raster_dem_source id={@id} map_id={@map_id} url={@url} />
        """)

      # Sending these would override the TileJSON. Decoding a terrarium DEM as
      # Mapbox Terrain-RGB renders the terrain as spikes, and forcing maxzoom
      # 22 requests tiles the server does not have. MapLibre's own defaults are
      # the same values, so omitting them costs nothing.
      refute html =~ "tileSize"
      refute html =~ "minzoom"
      refute html =~ "maxzoom"
      refute html =~ "encoding"
      assert html =~ ~s(&quot;volatile&quot;:false)
    end

    test "sends the properties when they are set explicitly" do
      assigns = %{id: "terrain", map_id: "test-map", url: "https://example.com/dem.json"}

      html =
        rendered_to_string(~H"""
        <.raster_dem_source
          id={@id}
          map_id={@map_id}
          url={@url}
          encoding="terrarium"
          tile_size={256}
          max_zoom={14}
        />
        """)

      assert html =~ ~s(&quot;encoding&quot;:&quot;terrarium&quot;)
      assert html =~ ~s(&quot;tileSize&quot;:256)
      assert html =~ ~s(&quot;maxzoom&quot;:14)
    end
  end
end
