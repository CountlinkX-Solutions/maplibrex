defmodule MaplibreX.Components.VectorTileSourceTest do
  use ExUnit.Case, async: true
  import Phoenix.Component
  import Phoenix.LiveViewTest
  import MaplibreX.Components

  describe "vector_tile_source/1" do
    test "renders with TileJSON URL" do
      assigns = %{id: "osm", map_id: "test-map", url: "https://example.com/tiles.json"}

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(id="osm")
      assert html =~ ~s(phx-hook="VectorTileSourceHook")
      assert html =~ ~s(data-config=)
      assert html =~ ~s(style="display: none;")
    end

    test "includes correct configuration with URL in data-config" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json"
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      assert html =~ ~s(&quot;id&quot;:&quot;osm&quot;)
      assert html =~ ~s(&quot;mapId&quot;:&quot;test-map&quot;)
      assert html =~ ~s(&quot;url&quot;:&quot;https://example.com/tiles.json&quot;)
    end

    test "renders with tile URLs" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        tiles: [
          "https://a.example.com/tiles/{z}/{x}/{y}.pbf",
          "https://b.example.com/tiles/{z}/{x}/{y}.pbf"
        ]
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} tiles={@tiles} />
        """)

      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(https://a.example.com)
      assert html =~ ~s(https://b.example.com)
    end

    test "renders with min and max zoom" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        min_zoom: 0,
        max_zoom: 14
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source
          id={@id}
          map_id={@map_id}
          url={@url}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
        />
        """)

      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:14)
    end

    test "renders with attribution" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        attribution: "© OpenStreetMap contributors"
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source
          id={@id}
          map_id={@map_id}
          url={@url}
          attribution={@attribution}
        />
        """)

      assert html =~ ~s(&quot;attribution&quot;:&quot;© OpenStreetMap contributors&quot;)
    end

    test "renders with bounds" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        bounds: [-180, -85, 180, 85]
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} bounds={@bounds} />
        """)

      assert html =~ ~s(&quot;bounds&quot;:[-180,-85,180,85])
    end

    test "renders with scheme" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        scheme: "tms"
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} scheme={@scheme} />
        """)

      assert html =~ ~s(&quot;scheme&quot;:&quot;tms&quot;)
    end

    test "renders with promote_id" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        promote_id: %{"natural" => "id"}
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} promote_id={@promote_id} />
        """)

      assert html =~ ~s(&quot;promoteId&quot;)
      assert html =~ ~s(&quot;natural&quot;)
    end

    test "renders with volatile flag" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json",
        volatile: true
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} volatile={@volatile} />
        """)

      assert html =~ ~s(&quot;volatile&quot;:true)
    end

    test "renders with all options combined" do
      assigns = %{
        id: "osm-full",
        map_id: "test-map",
        tiles: [
          "https://a.example.com/{z}/{x}/{y}.pbf",
          "https://b.example.com/{z}/{x}/{y}.pbf"
        ],
        min_zoom: 0,
        max_zoom: 14,
        attribution: "© OSM",
        bounds: [-180, -85, 180, 85],
        scheme: "xyz",
        promote_id: %{"id" => "osm_id"},
        volatile: false
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source
          id={@id}
          map_id={@map_id}
          tiles={@tiles}
          min_zoom={@min_zoom}
          max_zoom={@max_zoom}
          attribution={@attribution}
          bounds={@bounds}
          scheme={@scheme}
          promote_id={@promote_id}
          volatile={@volatile}
        />
        """)

      assert html =~ ~s(id="osm-full")
      assert html =~ ~s(&quot;tiles&quot;)
      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:14)
      assert html =~ ~s(&quot;attribution&quot;)
      assert html =~ ~s(&quot;bounds&quot;)
      assert html =~ ~s(&quot;scheme&quot;:&quot;xyz&quot;)
      assert html =~ ~s(&quot;promoteId&quot;)
      assert html =~ ~s(&quot;volatile&quot;:false)
    end

    test "raises error when neither url nor tiles provided" do
      assigns = %{id: "osm", map_id: "test-map"}

      assert_raise ArgumentError, ~r/requires either 'url' or 'tiles'/, fn ->
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} />
        """)
      end
    end

    test "omits nil values from configuration" do
      assigns = %{
        id: "osm",
        map_id: "test-map",
        url: "https://example.com/tiles.json"
      }

      html =
        rendered_to_string(~H"""
        <.vector_tile_source id={@id} map_id={@map_id} url={@url} />
        """)

      # Should not include bounds, promoteId, tiles, attribution when nil
      refute html =~ ~s(&quot;bounds&quot;)
      refute html =~ ~s(&quot;promoteId&quot;)
      refute html =~ ~s(&quot;tiles&quot;)
      refute html =~ ~s(&quot;attribution&quot;)

      # But should include defaults: minzoom, maxzoom, scheme, volatile
      assert html =~ ~s(&quot;minzoom&quot;:0)
      assert html =~ ~s(&quot;maxzoom&quot;:22)
      assert html =~ ~s(&quot;scheme&quot;:&quot;xyz&quot;)
      assert html =~ ~s(&quot;volatile&quot;:false)
    end
  end
end
