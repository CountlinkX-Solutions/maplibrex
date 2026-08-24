# Análisis del Código TypeScript de MaplibreX

## 📊 Estado Actual

### ✅ Aspectos Bien Implementados

1. **Arquitectura Limpia**
   - Separación clara de responsabilidades (MapManager, EventDispatcher, Hooks)
   - Uso de TypeScript para type safety
   - Patrón Singleton para MapManager
   - Event dispatcher bidireccional

2. **Ciclo de Vida del Hook**
   - `mounted()`: Crea mapa correctamente
   - `updated()`: Actualiza propiedades del mapa
   - `destroyed()`: Limpia recursos
   - `disconnected()/reconnected()`: Maneja navegación LiveView

3. **Eventos del Mapa → LiveView**
   ```typescript
   // Estos funcionan perfectamente ✅
   - map:moved (moveend)
   - map:clicked (click)
   - map:loaded (load)
   - map:zoom_changed (zoomend)
   - map:error (error)
   ```

4. **Código Defensivo**
   - Try-catch blocks en lugares críticos
   - Null checks antes de operaciones
   - Logging detallado para debugging

### ❌ Problema Principal: Comandos JS No Funcionan

**El Issue:**
```typescript
// En event-dispatcher.ts línea 110-191
setupLiveViewHandlers(): void {
  this.onLiveViewEvent('map:fly_to', (payload: any) => {
    // Este handler NUNCA se ejecuta
  });
  
  this.onLiveViewEvent('map:zoom_in', () => {
    // Este handler NUNCA se ejecuta
  });
}
```

**¿Por qué no funcionan?**

1. **Método `onLiveViewEvent` usa `hook.handleEvent()`**
   ```typescript
   // Línea 201
   onLiveViewEvent(event: string, handler: EventHandler): void {
     this.hook.handleEvent(event, handler);
   }
   ```

2. **`hook.handleEvent()` es para eventos server → client via `push_event()`**
   - NO para eventos que vienen de `JS.push()`

3. **Los comandos de MaplibreX.Components.Map usan `JS.push()`**
   ```elixir
   # En map.ex
   def fly_to(map_id, center, zoom, opts \\ []) do
     JS.push("map:fly_to", target: "##{map_id}", value: payload)
   end
   ```

4. **`JS.push()` envía al servidor, no al hook directamente**
   - El servidor recibe el evento
   - El servidor debe hacer algo (pero no re-envía al hook)

## 🔧 Soluciones Propuestas

### Solución 1: Cambiar a `phx-hook` directo (Recomendado)

**Modificar el Hook para escuchar eventos client-side:**

```typescript
// En map-hook.ts
export const MapHook: LiveViewHook = {
  mounted(this: any) {
    // ... código existente ...
    
    // Agregar event listeners directos en el elemento
    el.addEventListener('fly-to', (e: CustomEvent) => {
      const { center, zoom, duration } = e.detail;
      state.map.flyTo({ center, zoom, duration: duration || 1000 });
    });
    
    el.addEventListener('zoom-in', () => {
      state.map.zoomIn();
    });
    
    el.addEventListener('zoom-out', () => {
      state.map.zoomOut();
    });
  }
}
```

**Y en el LiveView:**

```elixir
<button phx-click={JS.dispatch("fly-to", to: "#demo-map", 
  detail: %{center: [-73.98, 40.75], zoom: 12})}>
  Fly to NYC
</button>
```

### Solución 2: Usar `push_event` correctamente

**El servidor envía comandos al hook:**

```elixir
def handle_event("fly_to_nyc", _params, socket) do
  {:noreply, push_event(socket, "map:fly_to", %{
    center: [-73.98, 40.75],
    zoom: 12,
    duration: 1000
  })}
end
```

**Y modificar el hook para escuchar estos eventos:**

```typescript
// El dispatcher ya tiene los handlers, solo necesitan conectarse
mounted(this: any) {
  // ... código existente ...
  
  // IMPORTANTE: Conectar los event handlers del dispatcher
  this.handleEvent("map:fly_to", (payload) => {
    state.dispatcher.handleLiveViewEvent("map:fly_to", payload);
  });
  
  this.handleEvent("map:zoom_in", () => {
    state.map.zoomIn();
  });
  
  this.handleEvent("map:zoom_out", () => {
    state.map.zoomOut();
  });
}
```

### Solución 3: Usar comandos JS directos (Más simple)

**En lugar de eventos, usar JS commands directos:**

```elixir
def fly_to(map_id, center, zoom, opts \\ []) do
  duration = Keyword.get(opts, :duration, 1000)
  
  JS.dispatch("phx:map-command", to: "##{map_id}", detail: %{
    command: "flyTo",
    params: %{center: center, zoom: zoom, duration: duration}
  })
end
```

```typescript
el.addEventListener('phx:map-command', (e: CustomEvent) => {
  const { command, params } = e.detail;
  
  switch (command) {
    case 'flyTo':
      map.flyTo(params);
      break;
    case 'zoomIn':
      map.zoomIn();
      break;
    case 'zoomOut':
      map.zoomOut();
      break;
  }
});
```

## 🎯 Mejoras Recomendadas

### 1. Agregar Handler Missing en el Hook

```typescript
// En map-hook.ts, agregar después de mounted:
mounted(this: any) {
  // ... código existente ...
  
  // NUEVO: Conectar handlers del servidor
  this.handleEvent("fly_to", (payload: any) => {
    const { center, zoom, duration } = payload;
    state.map.flyTo({ 
      center: center as [number, number], 
      zoom, 
      duration: duration || 1000 
    });
  });
  
  this.handleEvent("zoom_in", () => {
    state.map.zoomIn();
  });
  
  this.handleEvent("zoom_out", () => {
    state.map.zoomOut();
  });
}
```

### 2. Mejorar Type Safety

```typescript
// Definir tipos más específicos
interface MapCommand {
  type: 'flyTo' | 'jumpTo' | 'zoomIn' | 'zoomOut' | 'fitBounds';
  payload?: any;
}

interface FlyToPayload {
  center: [number, number];
  zoom: number;
  duration?: number;
  bearing?: number;
  pitch?: number;
}
```

### 3. Agregar Debouncing para Eventos Frecuentes

```typescript
// Para eventos como moveend que se disparan mucho
private debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Usar en setupDefaultMapEvents
this.onMapEvent('moveend', this.debounce(() => {
  // ... código existente ...
}, 100)); // Solo enviar cada 100ms
```

### 4. Mejor Manejo de Errores

```typescript
setupLiveViewHandlers(): void {
  this.onLiveViewEvent('map:fly_to', (payload: any) => {
    try {
      const { center, zoom, duration, bearing, pitch } = payload;
      
      // Validar datos
      if (!Array.isArray(center) || center.length !== 2) {
        throw new Error('Invalid center coordinates');
      }
      
      if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) {
        throw new Error('Invalid zoom level');
      }
      
      this.map.flyTo({
        center: center as [number, number],
        zoom: zoom,
        duration: duration || 1000,
        bearing: bearing,
        pitch: pitch,
        essential: true
      });
    } catch (error) {
      console.error('[MaplibreX] Error in fly_to:', error);
      this.pushToLiveView('map:error', { 
        error: error.message,
        command: 'fly_to'
      });
    }
  });
}
```

### 5. Agregar Método de Cleanup en Disconnected

```typescript
disconnected(this: any) {
  const state: MapHookState | undefined = (this as any)._maplibrex;
  if (state) {
    // Pausar animaciones para ahorrar recursos
    state.map.stop();
    console.log('[MaplibreX] Map disconnected (paused)');
  }
}

reconnected(this: any) {
  const state: MapHookState | undefined = (this as any)._maplibrex;
  if (state && state.map) {
    state.map.resize();
    // Reanudar si estaba pausado
    console.log('[MaplibreX] Map reconnected (resumed)');
  }
}
```

## 📋 Checklist de Mejoras

- [ ] Agregar handlers `handleEvent` en el hook para comandos del servidor
- [ ] Implementar debouncing para eventos frecuentes
- [ ] Mejorar validación de payloads
- [ ] Agregar más logging en desarrollo
- [ ] Documentar el flujo de eventos en el README
- [ ] Agregar tests unitarios para el dispatcher
- [ ] Implementar retry logic para operaciones que pueden fallar
- [ ] Agregar telemetría/métricas opcionales

## 🎓 Conclusión

El código TypeScript está bien estructurado pero tiene una **desconexión entre cómo se envían los comandos (JS.push) y cómo el hook los espera (handleEvent)**. 

**La solución más simple es agregar los handlers en el hook:**

```typescript
this.handleEvent("fly_to", (payload) => { ... });
this.handleEvent("zoom_in", () => { ... });
this.handleEvent("zoom_out", () => { ... });
```

Esto permitirá que `push_event` desde el servidor llegue correctamente al hook.
