defmodule MaplibreX.Components.DeckGlLayer do
  @moduledoc """
  Componente para renderizar capas de deck.gl en el mapa.

  deck.gl es una biblioteca de visualización WebGL para grandes datasets.
  Este componente permite integrar capas de deck.gl con MapLibre GL JS
  en el contexto de Phoenix LiveView.

  ## Atributos

    * `id` (required) - Identificador único del layer
    * `map_id` (required) - ID del mapa donde se renderizará
    * `layer_type` (required) - Tipo de deck.gl layer (ej: "ScatterplotLayer", "ArcLayer")
    * `data` (required) - Lista de datos a visualizar
    * `props` - Mapa con propiedades específicas del layer (default: %{})
    * `before_id` - ID de capa antes de la cual insertar (default: nil)
    * `opacity` - Opacidad del layer 0-1 (default: 1.0)
    * `visible` - Visibilidad del layer (default: true)
    * `pickable` - Si el layer es clickeable (default: false)
    * `auto_highlight` - Highlight automático en hover (default: false)
    * `update_triggers` - Mapa de triggers para actualización (default: %{})

  ## Tipos de Layers Soportados

  ### Layers Básicos
    * `ScatterplotLayer` - Puntos con radio variable
    * `ArcLayer` - Arcos entre puntos
    * `LineLayer` - Líneas y rutas
    * `PolygonLayer` - Polígonos 2D
    * `PathLayer` - Caminos
    * `ColumnLayer` - Columnas 3D
    * `TextLayer` - Etiquetas de texto
    * `IconLayer` - Iconos

  ### Layers de Agregación
    * `HexagonLayer` - Hexágonos agregados
    * `GridLayer` - Grid de celdas
    * `ScreenGridLayer` - Grid en coordenadas de pantalla
    * `HeatmapLayer` - Mapa de calor
    * `ContourLayer` - Líneas de contorno

  ### Layers Avanzados
    * `GeoJsonLayer` - Renderizado de GeoJSON

  ## Eventos

  Este componente emite los siguientes eventos:

    * `deckgl:layer_loaded` - Layer cargado exitosamente
    * `deckgl:click` - Click en un objeto del layer
    * `deckgl:hover` - Hover sobre un objeto del layer
    * `deckgl:drag_start` - Inicio de drag en un objeto
    * `deckgl:drag` - Dragging de un objeto
    * `deckgl:drag_end` - Fin de drag
    * `deckgl:error` - Error al procesar el layer

  ## Ejemplos

      # ScatterplotLayer básico
      <.deckgl_layer
        id="points"
        map_id="my-map"
        layer_type="ScatterplotLayer"
        data={@points}
        pickable={true}
        props=%{
          "getPosition" => "coordinates",
          "getRadius" => 1000,
          "getFillColor" => [255, 140, 0],
          "radiusMinPixels" => 2
        }
      />

      # ArcLayer para visualizar conexiones
      <.deckgl_layer
        id="arcs"
        map_id="my-map"
        layer_type="ArcLayer"
        data={@flights}
        pickable={true}
        auto_highlight={true}
        props=%{
          "getSourcePosition" => "from",
          "getTargetPosition" => "to",
          "getSourceColor" => [255, 140, 0],
          "getTargetColor" => [255, 200, 0],
          "getWidth" => 2
        }
      />

      # HexagonLayer para densidad
      <.deckgl_layer
        id="hexagons"
        map_id="my-map"
        layer_type="HexagonLayer"
        data={@events}
        props=%{
          "getPosition" => "location",
          "elevationScale" => 4,
          "radius" => 200,
          "extruded" => true,
          "coverage" => 0.9
        }
      />

  ## Manejo de Eventos

      def handle_event("deckgl:click", %{"object" => object, "coordinate" => coord}, socket) do
        # object contiene los datos del feature clickeado
        # coordinate contiene [lng, lat]
        {:noreply, socket}
      end

      def handle_event("deckgl:hover", %{"object" => object}, socket) do
        {:noreply, assign(socket, :hovered_object, object)}
      end

  ## Accessors

  Los accessors pueden especificarse de varias formas:

      # Como string (nombre de propiedad)
      "getPosition" => "coordinates"  # d => d.coordinates

      # Como array MapLibre-style
      "getPosition" => ["get", "coords"]  # d => d.coords

      # Como valor constante
      "getFillColor" => [255, 0, 0]  # Siempre rojo

  ## Performance

  Para datasets grandes (>100k puntos):

    * Use `HexagonLayer` o `GridLayer` en lugar de `ScatterplotLayer`
    * Configure `updateTriggers` apropiadamente
    * Considere filtrado de datos en el servidor
    * Use layers de agregación cuando sea posible

  ## Referencias

    * deck.gl Documentation: https://deck.gl/docs
    * Layer Catalog: https://deck.gl/docs/api-reference/layers
  """

  use Phoenix.Component

  @valid_layer_types ~w(
    ScatterplotLayer ArcLayer LineLayer HexagonLayer GridLayer
    ColumnLayer PathLayer PolygonLayer GeoJsonLayer ScreenGridLayer
    HeatmapLayer ContourLayer TextLayer IconLayer
  )

  @doc """
  Renderiza un deck.gl layer.

  ## Ejemplo

      <.deckgl_layer
        id="my-layer"
        map_id="map"
        layer_type="ScatterplotLayer"
        data={@points}
        props=%{"getPosition" => "coords"}
      />
  """
  attr :id, :string, required: true, doc: "Identificador único del layer"
  attr :map_id, :string, required: true, doc: "ID del mapa"
  attr :layer_type, :string, required: true, doc: "Tipo de deck.gl layer"
  attr :data, :list, required: true, doc: "Datos a visualizar"
  attr :props, :map, default: %{}, doc: "Propiedades del layer"
  attr :before_id, :string, default: nil, doc: "ID de capa para ordenamiento"
  attr :opacity, :float, default: 1.0, doc: "Opacidad (0-1)"
  attr :visible, :boolean, default: true, doc: "Visibilidad"
  attr :pickable, :boolean, default: false, doc: "Si es clickeable"
  attr :auto_highlight, :boolean, default: false, doc: "Highlight en hover"
  attr :update_triggers, :map, default: %{}, doc: "Triggers de actualización"

  def deckgl_layer(assigns) do
    # Validaciones
    validate_layer_type!(assigns.layer_type)
    validate_opacity!(assigns.opacity)
    validate_data!(assigns.data)

    # Build configuration
    config =
      build_layer_config(assigns)
      |> Jason.encode!()

    assigns = assign(assigns, :config, config)

    ~H"""
    <div
      id={@id}
      phx-hook="DeckGlLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end

  # Private functions

  defp build_layer_config(assigns) do
    %{
      id: assigns.id,
      mapId: assigns.map_id,
      layerType: assigns.layer_type,
      data: assigns.data,
      props:
        Map.merge(
          %{
            id: assigns.id,
            pickable: assigns.pickable,
            autoHighlight: assigns.auto_highlight,
            opacity: assigns.opacity,
            visible: assigns.visible
          },
          assigns.props
        ),
      beforeId: assigns.before_id,
      updateTriggers: assigns.update_triggers
    }
  end

  defp validate_layer_type!(layer_type) do
    unless layer_type in @valid_layer_types do
      raise ArgumentError, """
      Invalid layer_type: #{inspect(layer_type)}

      Supported layer types:
      #{Enum.map_join(@valid_layer_types, "\n", &"  * #{&1}")}
      """
    end
  end

  defp validate_opacity!(opacity) when is_float(opacity) or is_integer(opacity) do
    unless opacity >= 0 and opacity <= 1 do
      raise ArgumentError, "opacity must be between 0 and 1, got: #{opacity}"
    end
  end

  defp validate_opacity!(opacity) do
    raise ArgumentError, "opacity must be a number, got: #{inspect(opacity)}"
  end

  defp validate_data!(data) when is_list(data), do: :ok

  defp validate_data!(data) do
    raise ArgumentError, "data must be a list, got: #{inspect(data)}"
  end
end
