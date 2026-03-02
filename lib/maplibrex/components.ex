defmodule MaplibreX.Components do
  @moduledoc """
  Phoenix LiveView components for MaplibreX.

  This module provides function components for rendering MapLibre maps
  and related elements in Phoenix LiveView applications.
  """

  use Phoenix.Component

  @doc """
  Imports all MaplibreX components into the current scope.

  ## Usage

      import MaplibreX.Components
  """
  defmacro __using__(_opts) do
    quote do
      import MaplibreX.Components
    end
  end

  # Re-export individual component modules
  defdelegate map(assigns), to: MaplibreX.Components.Map
  defdelegate marker(assigns), to: MaplibreX.Components.Marker
  defdelegate popup(assigns), to: MaplibreX.Components.Popup
  defdelegate geojson_layer(assigns), to: MaplibreX.Components.GeoJSONLayer
  defdelegate navigation_control(assigns), to: MaplibreX.Components.NavigationControl
  defdelegate scale_control(assigns), to: MaplibreX.Components.ScaleControl
  defdelegate fullscreen_control(assigns), to: MaplibreX.Components.FullscreenControl
  defdelegate geolocate_control(assigns), to: MaplibreX.Components.GeolocateControl
  defdelegate attribution_control(assigns), to: MaplibreX.Components.AttributionControl
  defdelegate circle_layer(assigns), to: MaplibreX.Components.CircleLayer
  defdelegate line_layer(assigns), to: MaplibreX.Components.LineLayer
  defdelegate fill_layer(assigns), to: MaplibreX.Components.FillLayer
  defdelegate symbol_layer(assigns), to: MaplibreX.Components.SymbolLayer
  defdelegate heatmap_layer(assigns), to: MaplibreX.Components.HeatmapLayer
  defdelegate fill_extrusion_layer(assigns), to: MaplibreX.Components.FillExtrusionLayer
  defdelegate background_layer(assigns), to: MaplibreX.Components.BackgroundLayer
  defdelegate hillshade_layer(assigns), to: MaplibreX.Components.HillshadeLayer
  defdelegate raster_layer(assigns), to: MaplibreX.Components.RasterLayer
  defdelegate vector_tile_source(assigns), to: MaplibreX.Components.VectorTileSource
  defdelegate raster_tile_source(assigns), to: MaplibreX.Components.RasterTileSource
  defdelegate image_source(assigns), to: MaplibreX.Components.ImageSource
  defdelegate raster_dem_source(assigns), to: MaplibreX.Components.RasterDEMSource
  defdelegate video_source(assigns), to: MaplibreX.Components.VideoSource
  defdelegate terrain(assigns), to: MaplibreX.Components.Terrain
  defdelegate terrain_control(assigns), to: MaplibreX.Components.TerrainControl
  defdelegate sky(assigns), to: MaplibreX.Components.Sky
  defdelegate deckgl_layer(assigns), to: MaplibreX.Components.DeckGlLayer
  defdelegate custom_layer(assigns), to: MaplibreX.Components.CustomLayer
  defdelegate control(assigns), to: MaplibreX.Components.Control
  defdelegate zoom_range(assigns), to: MaplibreX.Components.ZoomRange
  defdelegate control_button(assigns), to: MaplibreX.Components.ControlButton
  defdelegate control_group(assigns), to: MaplibreX.Components.ControlGroup
end
