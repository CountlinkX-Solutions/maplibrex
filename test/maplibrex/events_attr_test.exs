defmodule MaplibreX.EventsAttrTest do
  use ExUnit.Case, async: true

  import Phoenix.LiveViewTest, only: [rendered_to_string: 1]

  # Every component that pushes events to the LiveView takes an optional
  # `events` list (#45). Given, it goes into `data-config` and the hook pushes
  # only the events named in it; absent, the config has no `events` key and
  # every event is pushed, as before.

  alias MaplibreX.Components, as: C

  @corners [[-80.4, 46.4], [-71.5, 46.4], [-71.5, 37.9], [-80.4, 37.9]]
  # {module, function, the least each needs to render}
  @components [
    {C.Map, :map, %{id: "map"}},
    {C.Marker, :marker, %{id: "pin", map_id: "map", lng_lat: [0, 0]}},
    {C.Popup, :popup, %{id: "tip", map_id: "map", inner_block: :slot}},
    {C.GeolocateControl, :geolocate_control, %{id: "geo", map_id: "map"}},
    {C.FullscreenControl, :fullscreen_control, %{id: "fs", map_id: "map"}},
    {C.TerrainControl, :terrain_control, %{id: "tc", map_id: "map", terrain_source_id: "dem"}},
    {C.Terrain, :terrain, %{map_id: "map", source_id: "dem"}},
    {C.Sky, :sky, %{map_id: "map"}},
    {C.DeckGlLayer, :deckgl_layer,
     %{id: "arcs", map_id: "map", layer_type: "ScatterplotLayer", data: []}},
    {C.CircleLayer, :circle_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.LineLayer, :line_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.FillLayer, :fill_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.SymbolLayer, :symbol_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.FillExtrusionLayer, :fill_extrusion_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.HeatmapLayer, :heatmap_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.HillshadeLayer, :hillshade_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.RasterLayer, :raster_layer, %{id: "l", map_id: "map", source_id: "s"}},
    {C.BackgroundLayer, :background_layer, %{id: "l", map_id: "map"}},
    {C.GeoJSONLayer, :geojson_layer,
     %{
       id: "points",
       map_id: "map",
       type: "circle",
       data: %{"type" => "FeatureCollection", "features" => []}
     }},
    {C.VectorTileSource, :vector_tile_source,
     %{id: "s", map_id: "map", url: "https://tiles.example.com/a.json"}},
    {C.RasterTileSource, :raster_tile_source,
     %{id: "s", map_id: "map", tiles: ["https://a.example.com/{z}/{x}/{y}.png"]}},
    {C.RasterDEMSource, :raster_dem_source,
     %{id: "s", map_id: "map", url: "https://dem.example.com/a.json"}},
    {C.ImageSource, :image_source,
     %{id: "s", map_id: "map", url: "https://img.example.com/a.png", coordinates: @corners}},
    {C.VideoSource, :video_source,
     %{id: "s", map_id: "map", urls: ["https://video.example.com/a.mp4"], coordinates: @corners}}
  ]

  # The `data-config` of the first element in `html`, decoded.
  defp config(html) do
    [_, attribute] = Regex.run(~r/data-config="([^"]*)"/, html)

    attribute
    |> String.replace("&quot;", "\"")
    |> String.replace("&#39;", "'")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> String.replace("&amp;", "&")
    |> Jason.decode!()
  end

  # `inner_block: :slot` in the table stands for slot content, which a module
  # attribute cannot hold.
  defp render(module, fun, assigns) do
    assigns =
      case assigns do
        %{inner_block: :slot} ->
          %{assigns | inner_block: [%{__slot__: :inner_block, inner_block: fn _, _ -> "Hi" end}]}

        _ ->
          assigns
      end

    module
    |> apply(fun, [Map.put(assigns, :__changed__, nil)])
    |> rendered_to_string()
  end

  # The event names listed in the "## Events" sections of `module`'s docs.
  defp documented_events(module) do
    {:docs_v1, _, _, _, moduledoc, _, docs} = Code.fetch_docs(module)
    texts = [moduledoc | Enum.map(docs, fn {_, _, _, doc, _} -> doc end)]

    for %{"en" => text} <- texts,
        section <- String.split(text, ~r/^## /m),
        String.starts_with?(section, "Events"),
        [_, event] <- Regex.scan(~r/[`"]([a-z_]+:[a-z_]+)[`"]/, section),
        uniq: true,
        do: event
  end

  test "every component whose docs list events is in the table, and no other" do
    {:ok, modules} = :application.get_key(:maplibrex, :modules)

    documenting =
      for module <- modules,
          String.starts_with?(inspect(module), "MaplibreX.Components."),
          documented_events(module) != [],
          do: module

    assert Enum.sort(documenting) == Enum.sort(Enum.map(@components, &elem(&1, 0)))
  end

  for {module, fun, assigns} <- @components do
    describe "#{inspect(module)}.#{fun}/1" do
      test "declares events as an optional list" do
        attr =
          unquote(module).__components__()
          |> Map.fetch!(unquote(fun))
          |> Map.fetch!(:attrs)
          |> Enum.find(&(&1.name == :events))

        assert %{type: :list, required: false, opts: opts} = attr
        assert Keyword.fetch!(opts, :default) == nil
      end

      test "puts events into data-config only when given" do
        assigns = unquote(Macro.escape(assigns))

        refute Map.has_key?(config(render(unquote(module), unquote(fun), assigns)), "events")

        given = Map.put(assigns, :events, ["first:event", "second:event"])

        assert config(render(unquote(module), unquote(fun), given))["events"] == [
                 "first:event",
                 "second:event"
               ]

        assert config(render(unquote(module), unquote(fun), Map.put(assigns, :events, [])))[
                 "events"
               ] == []
      end
    end
  end
end
