# MaplibreX Demo Examples

Este directorio contiene ejemplos de uso de MaplibreX en aplicaciones Phoenix LiveView.

## Demo LiveView

El archivo `demo_live.ex` es un ejemplo completo que demuestra todas las características principales de MaplibreX:

### Características Demostradas

1. **Mapa Básico** - Renderizado de un mapa interactivo con MapLibre
2. **Control Programático** - Botones para controlar el mapa desde LiveView
3. **Marcadores Interactivos** - Múltiples marcadores con diferentes estilos
4. **Drag & Drop** - Marcador azul draggable que actualiza su estado
5. **Popups** - Información contextual en marcadores
6. **Eventos Bidireccionales** - LiveView ↔ MapLibre communication
7. **Estado Reactivo** - Actualización automática del UI

### Cómo Usar

Este archivo es solo de referencia y NO se compila con la librería. Para probarlo en tu aplicación Phoenix:

1. Copia el contenido a tu proyecto Phoenix
2. Ajusta el nombre del módulo según tu aplicación
3. Agrega una ruta en tu router:

```elixir
# router.ex
live "/map-demo", MaplibreXDemo.DemoLive
```

4. Asegúrate de tener MaplibreX configurado:

```javascript
// app.js
import { MapHooks } from "../deps/maplibrex/priv/static/assets/js/maplibrex"

let liveSocket = new LiveSocket("/live", Socket, {
  hooks: MapHooks,
  params: {_csrf_token: csrfToken}
})
```

### Código de Ejemplo

```elixir
# Mapa básico
<.map
  id="demo-map"
  center={[-74.5, 40]}
  zoom={9}
  style="https://demotiles.maplibre.org/style.json"
  class="w-full h-96"
/>

# Marcador con popup
<.marker
  id="marker-1"
  map_id="demo-map"
  lng_lat={[-74.5, 40]}
  color="red"
  popup_text="New York City"
/>

# Marcador draggable
<.marker
  id="marker-2"
  map_id="demo-map"
  lng_lat={@marker_position}
  draggable
/>

# Control programático desde LiveView
<button phx-click={MaplibreX.Components.Map.fly_to("demo-map", [-73.98, 40.75], 12)}>
  Fly to NYC
</button>

# Manejar eventos
def handle_event("marker:drag_end", %{"markerId" => id, "lngLat" => lngLat}, socket) do
  {:noreply, assign(socket, marker_position: lngLat)}
end
```

## Próximos Ejemplos

Planeamos agregar más ejemplos demostrando:
- Popups independientes
- Controles de navegación
- Capas GeoJSON
- Clustering de marcadores
- Mapas con múltiples estilos
- Integración con datos de base de datos

## Recursos

- [Documentación MaplibreX](../README.md)
- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js-docs/)
- [Phoenix LiveView Docs](https://hexdocs.pm/phoenix_live_view/)
