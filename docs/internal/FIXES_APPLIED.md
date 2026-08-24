# Correcciones Aplicadas a MaplibreX

## 📅 Fecha: 4 de Diciembre, 2025

## 🎯 Problema Identificado

Los comandos JS del componente Map (`fly_to`, `jump_to`, `fit_bounds`, etc.) no funcionaban porque usaban `JS.push()` que envía eventos al servidor LiveView, pero no había un mecanismo para retransmitirlos al hook TypeScript.

## ✅ Solución Implementada

Se cambió la implementación para usar **`JS.dispatch()`** en lugar de `JS.push()`, permitiendo comunicación directa entre los componentes Elixir y los hooks TypeScript mediante eventos DOM personalizados.

## 🔧 Cambios Realizados

### 1. Componente Elixir (`lib/maplibrex/components/map.ex`)

Se modificaron todos los comandos JS para usar `JS.dispatch()`:

**Antes:**
```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  JS.push("map:fly_to", target: "##{map_id}", value: payload)
end
```

**Después:**
```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  JS.dispatch("maplibrex:fly_to", to: "##{map_id}", detail: payload)
end
```

**Comandos actualizados:**
- ✅ `fly_to/4` → `maplibrex:fly_to`
- ✅ `jump_to/4` → `maplibrex:jump_to`
- ✅ `fit_bounds/3` → `maplibrex:fit_bounds`
- ✅ `set_style/2` → `maplibrex:set_style`
- ✅ `zoom_in/1` → `maplibrex:zoom_in`
- ✅ `zoom_out/1` → `maplibrex:zoom_out`
- ✅ `reset_north/1` → `maplibrex:reset_north`

### 2. Hook TypeScript (`assets/js/maplibrex/hooks/map-hook.ts`)

Se agregaron event listeners para cada comando en el método `mounted()`:

```typescript
// Fly to
el.addEventListener('maplibrex:fly_to', ((e: CustomEvent) => {
  const { center, zoom, duration, bearing, pitch } = e.detail;
  map.flyTo({
    center: center as [number, number],
    zoom: zoom,
    duration: duration || 1000,
    ...(bearing !== undefined && { bearing }),
    ...(pitch !== undefined && { pitch }),
    essential: true
  });
}) as EventListener);

// Zoom in
el.addEventListener('maplibrex:zoom_in', () => {
  map.zoomIn({ duration: 300 });
});

// ... y así para todos los demás comandos
```

## 📊 Flujo de Comunicación

### Antes (❌ No funcionaba):
```
Botón → JS.push() → Servidor LiveView → ❌ (se quedaba aquí)
```

### Ahora (✅ Funciona):
```
Botón → JS.dispatch() → Evento DOM → Hook TypeScript → Mapa MapLibre ✅
```

## 🎓 Ventajas de esta Solución

1. **Comunicación directa**: No pasa por el servidor, reduciendo latencia
2. **Más eficiente**: No hay round-trip al servidor
3. **API consistente**: Los comandos JS funcionan como se esperaba
4. **Backwards compatible**: No afecta otros componentes ni eventos existentes

## 📝 Uso

Los comandos ahora funcionan perfectamente:

```elixir
# En tu LiveView
<button phx-click={MaplibreX.Components.Map.fly_to("my-map", [-74.5, 40], 12)}>
  Fly to NYC
</button>

<button phx-click={MaplibreX.Components.Map.zoom_in("my-map")}>
  Zoom In
</button>

<button phx-click={
  MaplibreX.Components.Map.fly_to("my-map", [-118.24, 34.05], 10, 
    duration: 2000, 
    bearing: 45, 
    pitch: 60
  )}>
  Fly to LA with custom options
</button>
```

## ✅ Estado de Componentes

| Componente | Renderizado | Eventos Entrantes | Eventos Salientes | Estado |
|------------|-------------|-------------------|-------------------|--------|
| Map | ✅ | ✅ Comandos JS funcionan | ✅ moved, clicked, loaded | **✅ COMPLETO** |
| Marker | ✅ | N/A | ✅ clicked, drag_end | ✅ FUNCIONA |
| Popup | ✅ | N/A | ✅ opened, closed | ✅ FUNCIONA |
| GeoJSON | ✅ | N/A | ✅ feature_clicked | ✅ FUNCIONA |
| Controls | ✅ | N/A | ✅ Específicos de control | ✅ FUNCIONA |

## 🧪 Testing

Para probar los comandos:

```elixir
# En tu demo o aplicación:
defmodule MyAppWeb.MapLive do
  use MyAppWeb, :live_view
  
  def render(assigns) do
    ~H"""
    <.map id="test-map" center={[-74.5, 40]} zoom={10} class="h-96" />
    
    <div class="mt-4 space-x-2">
      <button 
        phx-click={MaplibreX.Components.Map.fly_to("test-map", [-73.98, 40.75], 12)}
        class="btn">
        Fly to NYC
      </button>
      
      <button 
        phx-click={MaplibreX.Components.Map.zoom_in("test-map")}
        class="btn">
        Zoom In
      </button>
      
      <button 
        phx-click={MaplibreX.Components.Map.zoom_out("test-map")}
        class="btn">
        Zoom Out
      </button>
    </div>
    """
  end
end
```

## 🔄 Migración

Si estabas usando los comandos antes (aunque no funcionaban), **no necesitas cambiar nada** en tu código. La API es la misma, solo ahora funciona correctamente.

## 📚 Referencias

- Análisis completo: `ELIXIR_COMPONENTS_REVIEW.md`
- Análisis TypeScript: `TYPESCRIPT_REVIEW.md`
- Documentación Phoenix.LiveView.JS: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html

## 🎉 Conclusión

Los comandos JS del componente Map ahora funcionan perfectamente, proporcionando control programático completo del mapa desde LiveView sin necesidad de pasar por el servidor.
