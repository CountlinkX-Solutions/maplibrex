# Análisis de Componentes Elixir de MaplibreX

## 📊 Componentes Disponibles

1. ✅ **Map** (`map.ex`) - Componente principal del mapa
2. ✅ **Marker** (`marker.ex`) - Marcadores en el mapa  
3. ✅ **Popup** (`popup.ex`) - Ventanas emergentes
4. ✅ **GeoJSONLayer** (`geojson_layer.ex`) - Capas GeoJSON
5. ✅ **NavigationControl** (`navigation_control.ex`) - Controles de navegación
6. ✅ **ScaleControl** (`scale_control.ex`) - Barra de escala
7. ✅ **FullscreenControl** (`fullscreen_control.ex`) - Control de pantalla completa

## 🔍 Análisis Detallado

### 1. Map Component ✅ FUNCIONA

**Ubicación:** `lib/maplibrex/components/map.ex`

**Estado:** ✅ **Funcionando correctamente**

**Código revisado:**
```elixir
def map(assigns) do
  # Asigna valores por defecto
  assigns = assigns
    |> assign_new(:center, fn -> MaplibreX.default_center() end)
    |> assign_new(:zoom, fn -> MaplibreX.default_zoom() end)
    |> assign_new(:style, fn -> MaplibreX.default_style() end)

  # Construye configuración
  config = %{
    id: assigns.id,
    center: assigns.center,
    zoom: assigns.zoom,
    style: assigns.style,
    # ... más opciones
  }

  # Renderiza con phx-hook="MapHook"
  ~H"""
  <div
    id={@id}
    phx-hook="MapHook"
    data-config={@config}
    class={@class}
  />
  """
end
```

**✅ Correcto:**
- Usa `phx-hook="MapHook"` correctamente
- Pasa configuración via `data-config`
- ID único requerido
- Valores por defecto bien implementados

**❌ Problema con comandos JS:**
```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  JS.push("map:fly_to", target: "##{map_id}", value: payload)
end
```

**Issue:** `JS.push()` envía al servidor, no directamente al hook.

**Solución propuesta:**
```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  duration = Keyword.get(opts, :duration, 1000)
  
  JS.dispatch("phx:fly-to", 
    to: "##{map_id}",
    detail: %{
      center: center,
      zoom: zoom,
      duration: duration
    }
  )
end
```

### 2. Marker Component ✅ FUNCIONA

**Ubicación:** `lib/maplibrex/components/marker.ex`

**Estado:** ✅ **Funcionando correctamente**

**Código revisado:**
```elixir
def marker(assigns) do
  config = %{
    id: assigns.id,
    mapId: assigns.map_id,
    lngLat: assigns.lng_lat,
    color: assigns.color,
    scale: assigns.scale,
    rotation: assigns.rotation,
    draggable: assigns.draggable,
    # ... opciones de popup
  }

  ~H"""
  <div
    id={@id}
    phx-hook="MarkerHook"
    data-config={@config}
    style="display: none;"
  />
  """
end
```

**✅ Correcto:**
- Usa `phx-hook="MarkerHook"`
- Referencia correcta al `map_id`
- Configuración JSON bien formada
- `style="display: none;"` correcto (el hook crea el marcador en el mapa)
- Soporte para popups simples

**✅ En nuestro demo:**
- Los 3 marcadores se crean correctamente
- El marcador draggable (azul) funciona
- Eventos `marker:drag_end` funcionan

### 3. Comandos JS ❌ PROBLEM

**Todos estos NO funcionan actualmente:**

```elixir
# En map.ex
def fly_to(map_id, center, zoom, opts)
def jump_to(map_id, center, zoom, opts)
def fit_bounds(map_id, bounds, opts)
def set_style(map_id, style)
def zoom_in(map_id)
def zoom_out(map_id)
def reset_north(map_id)
```

**Razón:**
1. Usan `JS.push("event", target: "#id", value: payload)`
2. Esto envía evento al servidor LiveView
3. El servidor recibe pero no reenvía al hook
4. El hook TypeScript tiene handlers pero nunca se ejecutan

**Flujo actual (NO funciona):**
```
Botón → JS.push() → Servidor LiveView → ❌ (se queda aquí)
```

**Flujo esperado:**
```
Botón → JS.push() → Servidor → push_event() → Hook → Mapa ✅
```

## 🔧 Problemas Identificados

### Problema 1: Comandos JS no llegan al Hook

**Código problemático:**
```elixir
# map.ex línea 184-192
def fly_to(map_id, center, zoom, opts \\ []) do
  payload = %{center: center, zoom: zoom, duration: duration}
  JS.push("map:fly_to", target: "##{map_id}", value: payload)
end
```

**Por qué falla:**
- `JS.push()` dispara un evento al servidor LiveView
- El servidor necesita un `handle_event` que haga `push_event` al hook
- Actualmente no hay conexión servidor → hook

### Problema 2: Hook TypeScript no registra handlers

**En `map-hook.ts`:**
```typescript
mounted(this: any) {
  // Crea mapa ✅
  // Crea dispatcher ✅
  
  // FALTA: Registrar handlers para eventos del servidor
  // this.handleEvent("fly_to", ...) ❌ NO EXISTE
}
```

## ✅ Soluciones

### Solución A: Cambiar componentes Elixir a usar JS.dispatch

**Modificar todos los comandos en `map.ex`:**

```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  duration = Keyword.get(opts, :duration, 1000)
  
  # Usar JS.dispatch en lugar de JS.push
  JS.dispatch("phx:map-command",
    to: "##{map_id}",
    detail: %{
      command: "flyTo",
      center: center,
      zoom: zoom,
      duration: duration
    }
  )
end

def zoom_in(map_id) do
  JS.dispatch("phx:map-command",
    to: "##{map_id}",
    detail: %{command: "zoomIn"}
  )
end

def zoom_out(map_id) do
  JS.dispatch("phx:map-command",
    to: "##{map_id}",
    detail: %{command: "zoomOut"}
  )
end
```

**Y en el hook TypeScript:**

```typescript
mounted(this: any) {
  // ... código existente ...
  
  // Escuchar comandos directos
  el.addEventListener('phx:map-command', (e: CustomEvent) => {
    const { command, ...params } = e.detail;
    
    switch (command) {
      case 'flyTo':
        state.map.flyTo({
          center: params.center,
          zoom: params.zoom,
          duration: params.duration || 1000
        });
        break;
      
      case 'zoomIn':
        state.map.zoomIn();
        break;
      
      case 'zoomOut':
        state.map.zoomOut();
        break;
      
      // ... más comandos
    }
  });
}
```

### Solución B: Mantener JS.push pero agregar handlers en el hook

**Mantener los componentes como están, pero modificar el hook:**

```typescript
// En map-hook.ts
mounted(this: any) {
  // ... código existente ...
  
  // Registrar handlers para eventos del servidor
  this.handleEvent("fly_to", (payload: any) => {
    const { center, zoom, duration } = payload;
    state.map.flyTo({ center, zoom, duration: duration || 1000 });
  });
  
  this.handleEvent("zoom_in", () => {
    state.map.zoomIn();
  });
  
  this.handleEvent("zoom_out", () => {
    state.map.zoomOut();
  });
}
```

**Y en el LiveView del usuario:**

```elixir
def handle_event("fly_to_nyc", _params, socket) do
  {:noreply, push_event(socket, "fly_to", %{
    center: [-73.98, 40.75],
    zoom: 12,
    duration: 1000
  })}
end
```

## 📊 Resumen de Estado

| Componente | Estado | Eventos Entrantes | Eventos Salientes |
|------------|--------|-------------------|-------------------|
| Map | ✅ Renderiza | ❌ Comandos JS | ✅ moved, clicked, loaded |
| Marker | ✅ Funciona | N/A | ✅ clicked, drag_end |
| Popup | ✅ Funciona | N/A | ✅ opened, closed |
| GeoJSON | ✅ Funciona | N/A | ✅ feature_clicked |
| Controls | ✅ Funcionan | N/A | ✅ Específicos de control |

## 🎯 Recomendaciones

### Para el Desarrollador de maplibrex:

1. **Cambiar todos los comandos JS a usar `JS.dispatch()`**
   - Más directo, sin pasar por el servidor
   - Menos latencia
   - Más simple

2. **O agregar handlers `handleEvent` en el hook**
   - Mantiene la API actual
   - Requiere cambios solo en TypeScript

3. **Documentar el flujo correcto**
   - Aclarar que `JS.push()` necesita `handle_event` + `push_event`
   - Dar ejemplos completos

4. **Agregar tests**
   - Tests E2E para comandos JS
   - Verificar que los botones realmente funcionan

### Para el Usuario de maplibrex:

1. **Usar eventos del mapa (funcionan perfecto)**
   - `map:moved` ✅
   - `map:clicked` ✅
   - `marker:drag_end` ✅

2. **Para comandos programáticos, implementar handlers**
   ```elixir
   def handle_event("my_fly_to", _params, socket) do
     {:noreply, push_event(socket, "fly_to", %{...})}
   end
   ```

3. **O esperar fix en la librería**

## 💡 Conclusión

Los componentes Elixir de maplibrex están **bien diseñados** pero tienen un **bug de implementación en los comandos JS**:

- ✅ **Renderizado**: Perfecto
- ✅ **Configuración**: Excelente
- ✅ **Eventos Map → LiveView**: Funcionan al 100%
- ❌ **Comandos LiveView → Map**: No funcionan (desconectados)

**La solución más simple es usar `JS.dispatch()` en lugar de `JS.push()`** para comandos, evitando el servidor completamente.
