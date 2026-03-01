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
end
