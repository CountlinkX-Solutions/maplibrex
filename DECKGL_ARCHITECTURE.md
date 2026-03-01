# DeckGlLayer - Arquitectura y Plan de Implementación

## 🎯 Objetivo

Integrar deck.gl con MapLibre GL JS a través de Phoenix LiveView, permitiendo visualizaciones 3D avanzadas con una API declarativa consistente con el resto de MaplibreX.

## 📊 Análisis de Requisitos

### Funcionalidades Core
- ✅ Soporte para múltiples tipos de layers de deck.gl
- ✅ Rendering eficiente de millones de puntos
- ✅ Interactividad (picking, hover, click, drag)
- ✅ Animaciones y transitions
- ✅ Tooltips personalizados
- ✅ Integración seamless con MapLibre
- ✅ API declarativa Elixir/LiveView

### Restricciones
- ⚠️ Bundle size: deck.gl es grande (~500kb+)
- ⚠️ Performance: WebGL rendering debe ser eficiente
- ⚠️ Compatibilidad: Debe funcionar con arquitectura existente
- ⚠️ LiveView: Actualizaciones de datos deben ser reactivas

## 🏗️ Arquitectura Propuesta

### Componente Elixir

```elixir
defmodule MaplibreX.Components.DeckGlLayer do
  use Phoenix.Component
  
  @doc """
  Renderiza una capa de deck.gl.
  
  ## Atributos
  
  * `id` (required) - Identificador único
  * `map_id` (required) - ID del mapa
  * `layer_type` (required) - Tipo de deck.gl layer
  * `data` (required) - Datos a visualizar
  * `props` - Propiedades específicas del layer
  * `before_id` - ID de capa para ordenamiento
  * `opacity` - Opacidad (0-1)
  * `visible` - Visibilidad
  * `pickable` - Si es clickeable
  * `auto_highlight` - Highlight automático en hover
  * `update_triggers` - Triggers para re-render
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :layer_type, :string, required: true
  attr :data, :list, required: true
  attr :props, :map, default: %{}
  attr :before_id, :string, default: nil
  attr :opacity, :float, default: 1.0
  attr :visible, :boolean, default: true
  attr :pickable, :boolean, default: false
  attr :auto_highlight, :boolean, default: false
  attr :update_triggers, :map, default: %{}
  
  def deckgl_layer(assigns) do
    # Validaciones
    validate_layer_type!(assigns.layer_type)
    validate_opacity!(assigns.opacity)
    
    # Build configuration
    config = build_layer_config(assigns)
    
    assigns = assign(assigns, :config, Jason.encode!(config))
    
    ~H"""
    <div
      id={@id}
      phx-hook="DeckGlLayerHook"
      data-config={@config}
      style="display: none;"
    />
    """
  end
  
  defp build_layer_config(assigns) do
    %{
      id: assigns.id,
      mapId: assigns.map_id,
      layerType: assigns.layer_type,
      data: assigns.data,
      props: Map.merge(
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
end
```

### TypeScript Hook

```typescript
// assets/js/maplibrex/hooks/deckgl-layer-hook.ts

import type { LiveViewHook } from '../types';
import { MapManager } from '../core/map-manager';
import { DeckGLLayerManager } from '../utils/deckgl-manager';
import type { DeckGLLayerConfig } from '../types/deckgl';

interface DeckGlLayerHookState {
  config: DeckGLLayerConfig;
  deckglManager: DeckGLLayerManager | null;
}

export const DeckGlLayerHook: LiveViewHook = {
  mounted(this: any) {
    const el = this.el as HTMLElement;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error('[MaplibreX] No config for DeckGL layer');
        return;
      }
      
      const config: DeckGLLayerConfig = JSON.parse(configStr);
      const map = MapManager.get(config.mapId);
      
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found`);
        return;
      }
      
      // Initialize DeckGL manager
      const deckglManager = new DeckGLLayerManager(map, this);
      
      // Add layer
      deckglManager.addLayer(config);
      
      // Store state
      (this as any)._maplibrex_deckgl = {
        config,
        deckglManager
      };
      
      this.pushEvent('deckgl:layer_loaded', { layerId: config.id });
      
    } catch (error) {
      console.error('[MaplibreX] Error mounting DeckGL layer:', error);
      this.pushEvent('deckgl:error', { error: String(error) });
    }
  },
  
  updated(this: any) {
    const el = this.el as HTMLElement;
    const state: DeckGlLayerHookState | undefined = (this as any)._maplibrex_deckgl;
    
    if (!state) return;
    
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      
      const newConfig: DeckGLLayerConfig = JSON.parse(configStr);
      
      // Update layer
      state.deckglManager?.updateLayer(newConfig);
      state.config = newConfig;
      
    } catch (error) {
      console.error('[MaplibreX] Error updating DeckGL layer:', error);
      this.pushEvent('deckgl:error', { error: String(error) });
    }
  },
  
  destroyed(this: any) {
    const state: DeckGlLayerHookState | undefined = (this as any)._maplibrex_deckgl;
    if (!state) return;
    
    try {
      state.deckglManager?.removeLayer(state.config.id);
      state.deckglManager?.destroy();
    } catch (error) {
      console.error('[MaplibreX] Error destroying DeckGL layer:', error);
    }
  }
};
```

### DeckGL Manager

```typescript
// assets/js/maplibrex/utils/deckgl-manager.ts

import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import type { Map } from 'maplibre-gl';
import { createDeckLayer } from './deckgl-layer-factory';
import type { DeckGLLayerConfig } from '../types/deckgl';

export class DeckGLLayerManager {
  private map: Map;
  private hook: any;
  private overlay: MapboxOverlay | null = null;
  private layers: Map<string, Layer> = new Map();
  
  constructor(map: Map, hook: any) {
    this.map = map;
    this.hook = hook;
    this.initializeOverlay();
  }
  
  private initializeOverlay(): void {
    this.overlay = new MapboxOverlay({
      interleaved: true,
      onClick: this.handleClick.bind(this),
      onHover: this.handleHover.bind(this),
      onDragStart: this.handleDragStart.bind(this),
      onDrag: this.handleDrag.bind(this),
      onDragEnd: this.handleDragEnd.bind(this)
    });
    
    this.map.addControl(this.overlay as any);
  }
  
  addLayer(config: DeckGLLayerConfig): void {
    const layer = createDeckLayer(config);
    this.layers.set(config.id, layer);
    this.updateOverlay();
  }
  
  updateLayer(config: DeckGLLayerConfig): void {
    const layer = createDeckLayer(config);
    this.layers.set(config.id, layer);
    this.updateOverlay();
  }
  
  removeLayer(layerId: string): void {
    this.layers.delete(layerId);
    this.updateOverlay();
  }
  
  private updateOverlay(): void {
    if (!this.overlay) return;
    
    const layersArray = Array.from(this.layers.values());
    this.overlay.setProps({ layers: layersArray });
  }
  
  private handleClick(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:click', {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y,
        coordinate: info.coordinate
      });
    }
  }
  
  private handleHover(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:hover', {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y
      });
    }
  }
  
  private handleDragStart(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:drag_start', {
        layerId: info.layer?.id,
        object: info.object
      });
    }
  }
  
  private handleDrag(info: PickingInfo): void {
    if (info.object) {
      this.hook.pushEvent('deckgl:drag', {
        layerId: info.layer?.id,
        object: info.object,
        coordinate: info.coordinate
      });
    }
  }
  
  private handleDragEnd(info: PickingInfo): void {
    this.hook.pushEvent('deckgl:drag_end', {
      layerId: info.layer?.id
    });
  }
  
  destroy(): void {
    if (this.overlay) {
      this.map.removeControl(this.overlay as any);
      this.overlay = null;
    }
    this.layers.clear();
  }
}
```

### Layer Factory

```typescript
// assets/js/maplibrex/utils/deckgl-layer-factory.ts

import {
  ScatterplotLayer,
  ArcLayer,
  LineLayer,
  HexagonLayer,
  GridLayer,
  ColumnLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  ScreenGridLayer,
  HeatmapLayer,
  ContourLayer,
  TextLayer,
  IconLayer
} from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { DeckGLLayerConfig } from '../types/deckgl';

const LAYER_CONSTRUCTORS: Record<string, any> = {
  ScatterplotLayer,
  ArcLayer,
  LineLayer,
  HexagonLayer,
  GridLayer,
  ColumnLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  ScreenGridLayer,
  HeatmapLayer,
  ContourLayer,
  TextLayer,
  IconLayer
};

export function createDeckLayer(config: DeckGLLayerConfig): Layer {
  const LayerConstructor = LAYER_CONSTRUCTORS[config.layerType];
  
  if (!LayerConstructor) {
    throw new Error(`Unknown deck.gl layer type: ${config.layerType}`);
  }
  
  return new LayerConstructor({
    ...config.props,
    id: config.id,
    data: config.data,
    updateTriggers: config.updateTriggers
  });
}
```

## 📦 Estructura de Archivos

```
lib/maplibrex/components/
  ├── deckgl_layer.ex           # Componente Elixir

assets/js/maplibrex/
  ├── hooks/
  │   └── deckgl-layer-hook.ts  # LiveView hook
  ├── utils/
  │   ├── deckgl-manager.ts     # Manager principal
  │   └── deckgl-layer-factory.ts # Factory de layers
  └── types/
      └── deckgl.ts             # Type definitions

test/maplibrex/components/
  └── deckgl_layer_test.exs     # Tests Elixir
```

## 🎨 API de Uso

### Ejemplo Básico

```elixir
defmodule MyApp.MapLive do
  use MyAppWeb, :live_view
  import MaplibreX.Components
  
  def mount(_params, _session, socket) do
    points = [
      %{position: [-122.4, 37.8], size: 100, color: [255, 0, 0]},
      %{position: [-118.2, 34.0], size: 150, color: [0, 255, 0]}
    ]
    
    {:ok, assign(socket, points: points)}
  end
  
  def render(assigns) do
    ~H"""
    <.map id="deck-map" center={[-120, 36]} zoom={6} />
    
    <.deckgl_layer
      id="scatterplot"
      map_id="deck-map"
      layer_type="ScatterplotLayer"
      data={@points}
      pickable={true}
      props={%{
        "getPosition" => :position,
        "getRadius" => :size,
        "getFillColor" => :color,
        "radiusMinPixels" => 2,
        "radiusMaxPixels" => 100
      }}
    />
    """
  end
  
  def handle_event("deckgl:click", %{"object" => object}, socket) do
    IO.inspect(object, label: "Clicked")
    {:noreply, socket}
  end
end
```

### Ejemplo Avanzado: Arcos Animados

```elixir
def render(assigns) do
  ~H"""
  <.map id="flights-map" center={[-95, 40]} zoom={4} pitch={45} />
  
  <.deckgl_layer
    id="flight-arcs"
    map_id="flights-map"
    layer_type="ArcLayer"
    data={@flights}
    pickable={true}
    auto_highlight={true}
    props={%{
      "getSourcePosition" => :from,
      "getTargetPosition" => :to,
      "getSourceColor" => [255, 140, 0],
      "getTargetColor" => [255, 200, 0],
      "getWidth" => 2,
      "greatCircle" => true
    }}
    update_triggers={%{
      "getSourcePosition" => @timestamp,
      "getTargetPosition" => @timestamp
    }}
  />
  
  <.deckgl_layer
    id="airports"
    map_id="flights-map"
    layer_type="ScatterplotLayer"
    data={@airports}
    props={%{
      "getPosition" => :coordinates,
      "getRadius" => 1000,
      "getFillColor" => [255, 140, 0]
    }}
  />
  """
end
```

## 🔄 Flujo de Datos

```
LiveView (Elixir)
    ↓ render
    ↓ data={@points}
DeckGlLayer Component
    ↓ Jason.encode!
    ↓ data-config
DeckGlLayerHook (mounted)
    ↓ parse config
DeckGLLayerManager
    ↓ createDeckLayer
    ↓ deck.gl Layer
MapboxOverlay
    ↓ render to WebGL
Map Canvas
    
User Interaction (click/hover)
    ↓ picking
MapboxOverlay callbacks
    ↓ handleClick/handleHover
Hook.pushEvent
    ↓ phx event
LiveView (handle_event)
```

## ⚡ Performance Considerations

### 1. **Data Update Strategy**

```elixir
# ❌ BAD: Re-envía todo en cada update
def handle_info(:update, socket) do
  {:noreply, assign(socket, points: fetch_all_points())}
end

# ✅ GOOD: Usa update_triggers para cambios específicos
def handle_info(:update, socket) do
  {:noreply, 
    socket
    |> assign(timestamp: System.system_time(:millisecond))
    |> update(:points, &update_only_changed/1)
  }
end
```

### 2. **Bundle Size Optimization**

```javascript
// package.json - Import solo lo necesario
{
  "dependencies": {
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",  // ~300kb
    "@deck.gl/mapbox": "^9.0.0"   // ~50kb
  }
}

// NO importar todo deck.gl (evitar +2MB bundle)
```

### 3. **Layer Lifecycle**

- Reutilizar layers cuando sea posible
- Usar `updateTriggers` para re-render selectivo
- Implementar `shouldUpdateState` para optimización

### 4. **Data Size**

- Para datasets grandes (>100k puntos), considerar:
  - Data filtering en el cliente
  - Binary data formats
  - Web Workers para procesamiento
  - Aggregation layers (HexagonLayer vs ScatterplotLayer)

## 🧪 Testing Strategy

### Tests Unitarios (Elixir)

```elixir
describe "deckgl_layer/1" do
  test "renders with required attributes"
  test "validates layer type"
  test "validates opacity range"
  test "encodes config correctly"
  test "handles data updates"
  test "supports all layer types"
  test "handles empty data"
  test "validates props structure"
end
```

### Integration Tests (E2E)

```javascript
// Wallaby or similar
test "renders ScatterplotLayer", %{session: session} do
  session
  |> visit("/deck-map")
  |> assert_has(css("[data-testid='deckgl-layer']"))
  |> find(css("canvas"))
  |> assert_attr("width", "800")
end
```

## 📋 Plan de Implementación

### Fase 1: Foundation (1 día)
- [ ] Instalar dependencias deck.gl
- [ ] Setup TypeScript types
- [ ] Estructura básica de archivos
- [ ] DeckGLLayerManager básico

### Fase 2: Core Layers (2-3 días)
- [ ] ScatterplotLayer
- [ ] ArcLayer
- [ ] LineLayer
- [ ] Componente Elixir base
- [ ] Tests básicos

### Fase 3: Aggregation Layers (2 días)
- [ ] HexagonLayer
- [ ] GridLayer
- [ ] HeatmapLayer
- [ ] ScreenGridLayer

### Fase 4: Advanced Layers (2 días)
- [ ] PolygonLayer
- [ ] PathLayer
- [ ] GeoJsonLayer
- [ ] ColumnLayer

### Fase 5: Interactivity (2 días)
- [ ] Click handlers
- [ ] Hover/tooltip system
- [ ] Drag support
- [ ] Event system completo

### Fase 6: Polish & Optimization (2 días)
- [ ] Performance tuning
- [ ] Bundle optimization
- [ ] Tests comprehensivos
- [ ] Documentación completa

## 🎯 Decisiones de Diseño Clave

### 1. **Props como Map vs Accessors**

**Decisión:** Usar ambos enfoques
```elixir
# Accessor como atom (simple)
props={%{"getPosition" => :coordinates}}

# Accessor como función inline (avanzado)
props={%{"getPosition" => ["get", "coords"]}}

# Accessor como función JS string (muy avanzado)
props={%{"getPosition" => "d => d.coordinates"}}
```

### 2. **Update Strategy**

**Decisión:** Lazy updates con `update_triggers`
- Solo re-render cuando específicamente indicado
- Mejor performance para datasets grandes

### 3. **Event Handling**

**Decisión:** Push all events to LiveView
- Consistente con arquitectura actual
- Permite reactive updates desde servidor

### 4. **Layer Ordering**

**Decisión:** Usar `before_id` como MapLibre
- API consistente
- Fácil interop con capas MapLibre nativas

## 📚 Referencias

- deck.gl Documentation: https://deck.gl/docs
- MapboxOverlay: https://deck.gl/docs/api-reference/mapbox/mapbox-overlay
- Ejemplos svelte-maplibre: https://github.com/dimfeld/svelte-maplibre

## ✅ Criterios de Éxito

- [ ] Soporte para 10+ layer types
- [ ] Performance: 60 FPS con 100k puntos
- [ ] Bundle size: <600kb adicional
- [ ] Tests: >90% coverage
- [ ] Documentación completa
- [ ] Demo funcional con 3+ ejemplos
- [ ] Zero breaking changes a API existente

---

**Última actualización:** 2024-12-04  
**Status:** Planning - Ready for implementation  
**Estimado:** 11-13 días de desarrollo
