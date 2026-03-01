defmodule MaplibreX.Components.CustomLayer do
  @moduledoc """
  Custom WebGL layer component for advanced visualizations.

  Enables custom WebGL rendering with GLSL shaders for particle systems,
  vector fields, and other custom effects.

  ## Usage

      <.custom_layer
        id="ocean-currents"
        map_id="my-map"
        preset="ocean_currents"
        uniforms={%{
          u_color: [0.2, 0.6, 0.9],
          u_opacity: 0.8,
          u_point_size: 3.0
        }}
      />

  ## Presets

  - `ocean_currents` - Ocean current visualization
  - `wind_flow` - Wind flow visualization

  ## Custom Shaders

      <.custom_layer
        id="custom"
        map_id="my-map"
        vertex_shader={@vertex_glsl}
        fragment_shader={@fragment_glsl}
        uniforms={%{...}}
      />
  """

  use Phoenix.Component

  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :preset, :string, default: nil
  attr :vertex_shader, :string, default: nil
  attr :fragment_shader, :string, default: nil
  attr :uniforms, :map, default: %{}
  attr :before_id, :string, default: nil
  attr :min_zoom, :integer, default: nil
  attr :max_zoom, :integer, default: nil
  attr :class, :string, default: ""

  def custom_layer(assigns) do
    config =
      %{
        "id" => assigns.id,
        "mapId" => assigns.map_id,
        "type" => "particle_system",
        "preset" => assigns.preset,
        "vertexShader" => assigns.vertex_shader,
        "fragmentShader" => assigns.fragment_shader,
        "uniforms" => format_uniforms(assigns.uniforms),
        "beforeId" => assigns.before_id,
        "minZoom" => assigns.min_zoom,
        "maxZoom" => assigns.max_zoom
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Enum.into(%{})

    assigns = Map.put(assigns, :config_json, Jason.encode!(config))

    ~H"""
    <div
      id={@id}
      phx-hook="CustomLayerHook"
      data-config={@config_json}
      class={@class}
      style="display:none;"
    />
    """
  end

  defp format_uniforms(uniforms) when is_map(uniforms) do
    Enum.into(uniforms, %{}, fn {k, v} -> {to_string(k), v} end)
  end

  defp format_uniforms(_), do: %{}
end
