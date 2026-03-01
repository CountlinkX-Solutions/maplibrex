# MaplibreX - Roadmap para Paridad con svelte-maplibre

## 🎯 Objetivo

Alcanzar paridad de funcionalidades con [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre), agregando componentes especializados de capas, fuentes, controles y características avanzadas, manteniendo la arquitectura y prácticas actuales del proyecto.

## 📊 Estado Actual (v0.3.0-dev)

### ✅ Componentes Implementados (10)

1. **Map** - Componente principal del mapa con comandos JS funcionando
2. **Marker** - Marcadores con popups y drag & drop
3. **Popup** - Ventanas emergentes independientes
4. **GeoJSONLayer** - Renderizado de datos GeoJSON (genérico, soporta todos los tipos)
5. **NavigationControl** - Controles de navegación (zoom, brújula)
6. **ScaleControl** - Barra de escala
7. **FullscreenControl** - Toggle de pantalla completa
8. **GeolocateControl** ✨ - Control de geolocalización con tracking (Fase 1.1)
9. **AttributionControl** ✨ - Control de atribución personalizable (Fase 1.2)
10. **CircleLayer** ✨ NEW! - Capa de círculos con estilos data-driven (Fase 2.1)

**Métricas:**
- ✅ 124 tests pasando (87 + 12 + 12 + 13 nuevos)
- ✅ Comandos JS funcionando con `JS.dispatch()`
- ✅ Arquitectura TypeScript sólida
- ✅ Sistema de eventos bidireccional
- ✅ Demo funcionando: https://github.com/roger120981/maplibrex_demo
- ✅ **FASE 1 COMPLETADA** (Essential Controls)
- 🟡 **FASE 2 EN PROGRESO** (Layer Components - 1/8 completados)

---

## 🚀 Plan de Implementación

### **FASE 1: Controles Esenciales (v0.2.0)** ✅ COMPLETADA
**Duración estimada:** 1-2 semanas  
**Duración real:** 1 día  
**Prioridad:** ALTA  
**Estado:** ✅ COMPLETADA (2/2 componentes)  
**Fecha inicio:** 2024-12-04  
**Fecha fin:** 2024-12-04

#### 1.1 GeolocateControl ✅ COMPLETADO

**Status:** ✅ Implementado en commit `3b51a3b`  
**Fecha:** 2024-12-04  
**Tests:** 12/12 pasando  

**Descripción:** Control de geolocalización del usuario con seguimiento en tiempo real.

**API Propuesta:**
```elixir
<.geolocate_control
  id="geolocate-1"
  map_id="my-map"
  position="top-right"
  track_user_location={true}
  show_accuracy_circle={true}
  show_user_heading={true}
  fit_bounds_options={%{maxZoom: 15}}
/>
```

**Atributos:**
- `id` (required) - Identificador único
- `map_id` (required) - ID del mapa
- `position` - Posición del control (default: `"top-right"`)
- `track_user_location` - Seguir ubicación del usuario (default: `false`)
- `show_accuracy_circle` - Mostrar círculo de precisión (default: `true`)
- `show_user_heading` - Mostrar dirección del usuario (default: `true`)
- `fit_bounds_options` - Opciones para ajustar bounds

**Eventos:**
- `geolocate:location_found` - Ubicación encontrada
- `geolocate:location_error` - Error de geolocalización
- `geolocate:tracking_started` - Seguimiento iniciado
- `geolocate:tracking_stopped` - Seguimiento detenido
- `geolocate:user_location_updated` - Ubicación actualizada

**Archivos a crear:**
- `lib/maplibrex/components/geolocate_control.ex`
- `assets/js/maplibrex/hooks/geolocate-control-hook.ts`
- `test/maplibrex/components/geolocate_control_test.exs`

**Tests requeridos (mínimo 10):**
- Renderizado con valores por defecto
- Validación de map_id requerido
- Validación de position válida
- Opciones de seguimiento
- Eventos emitidos correctamente
- Limpieza en destroy
- Múltiples instancias

**Complejidad:** Media (MapLibre GL JS tiene este control built-in)  
**Tiempo estimado:** 2-3 días

**Referencia svelte-maplibre:**
```svelte
<GeolocateControl 
  position="top-right" 
  on:geolocate={handleGeolocate}
/>
```

---

#### 1.2 AttributionControl ✅ COMPLETADO

**Status:** ✅ Implementado en commit `5439eaa`  
**Fecha:** 2024-12-04  
**Tests:** 12/12 pasando  

**Descripción:** Control de atribución personalizable.

**API Propuesta:**
```elixir
<.attribution_control
  id="attribution-1"
  map_id="my-map"
  position="bottom-right"
  compact={true}
  custom_attribution="© My Company 2024"
/>
```

**Atributos:**
- `id` (required) - Identificador único
- `map_id` (required) - ID del mapa
- `position` - Posición del control (default: `"bottom-right"`)
- `compact` - Modo compacto (default: `true`)
- `custom_attribution` - Atribución personalizada adicional

**Eventos:**
- Ninguno (es un control de solo visualización)

**Archivos a crear:**
- `lib/maplibrex/components/attribution_control.ex`
- `assets/js/maplibrex/hooks/attribution-control-hook.ts`
- `test/maplibrex/components/attribution_control_test.exs`

**Tests requeridos (mínimo 8):**
- Renderizado con valores por defecto
- Validación de map_id requerido
- Validación de position válida
- Modo compacto vs expandido
- Atribución personalizada
- Limpieza en destroy

**Complejidad:** Baja  
**Tiempo estimado:** 1-2 días

**Referencia svelte-maplibre:**
```svelte
<AttributionControl 
  position="bottom-right" 
  compact={true}
/>
```

---

### **FASE 2: Layer Components Especializados (v0.3.0)** 🟡 EN PROGRESO
**Duración estimada:** 3-4 semanas  
**Prioridad:** ALTA  
**Estado:** 🟡 EN PROGRESO (1/8 componentes)  
**Fecha inicio:** 2024-12-04

> **Nota:** Estos componentes complementan el `GeoJSONLayer` existente, proporcionando APIs especializadas para casos de uso comunes. El `GeoJSONLayer` genérico se mantiene para casos avanzados.

#### 2.1 CircleLayer ✅ COMPLETADO

**Status:** ✅ Implementado en commit `414ad13`  
**Fecha:** 2024-12-04  
**Tests:** 13/13 pasando  

**Descripción:** Capa especializada para renderizar puntos como círculos con radio variable.

**Casos de uso:** Visualización de POIs, eventos, densidad de puntos con tamaños variables.

**API Propuesta:**
```elixir
<.circle_layer
  id="earthquakes"
  map_id="my-map"
  source_id="earthquake-data"
  source_layer="earthquakes"
  paint={%{
    "circle-radius" => ["get", "magnitude"],
    "circle-color" => [
      "interpolate",
      ["linear"],
      ["get", "magnitude"],
      1, "#ffffb2",
      3, "#fd8d3c",
      5, "#bd0026"
    ],
    "circle-opacity" => 0.8,
    "circle-stroke-width" => 1,
    "circle-stroke-color" => "#fff"
  }}
  layout={%{
    "visibility" => "visible"
  }}
  filter={[">=", "magnitude", 2]}
  min_zoom={0}
  max_zoom={22}
  before_id={nil}
/>
```

**Atributos:**
- `id` (required) - Identificador único de la capa
- `map_id` (required) - ID del mapa
- `source_id` (required) - ID de la fuente de datos
- `source_layer` - Layer en el source (para vector tiles)
- `paint` - Propiedades de estilo (circle-radius, circle-color, etc.)
- `layout` - Propiedades de layout (visibility, etc.)
- `filter` - Expresión de filtro
- `min_zoom` - Zoom mínimo de visibilidad
- `max_zoom` - Zoom máximo de visibilidad
- `before_id` - ID de la capa antes de la cual insertar

**Eventos:**
- `layer:feature_clicked` - Feature clickeado
- `layer:feature_mouseenter` - Mouse sobre feature
- `layer:feature_mouseleave` - Mouse sale de feature
- `layer:added` - Capa agregada al mapa
- `layer:removed` - Capa removida del mapa

**Archivos a crear:**
- `lib/maplibrex/components/circle_layer.ex`
- `assets/js/maplibrex/hooks/circle-layer-hook.ts`
- `test/maplibrex/components/circle_layer_test.exs`

**Tests requeridos (mínimo 12):**
- Renderizado básico
- Validación de parámetros requeridos
- Paint properties válidas
- Filter expressions
- Min/max zoom
- Eventos de feature
- Actualización de propiedades
- Múltiples capas
- Before_id ordering
- Limpieza en destroy

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

**Referencia svelte-maplibre:**
```svelte
<CircleLayer
  sourceId="earthquakes"
  paint={{
    'circle-radius': ['get', 'magnitude'],
    'circle-color': '#ff0000'
  }}
/>
```

---

#### 2.2 LineLayer

**Descripción:** Capa especializada para renderizar líneas y rutas.

**Casos de uso:** Rutas, caminos, límites, conexiones entre puntos.

**API Propuesta:**
```elixir
<.line_layer
  id="route"
  map_id="my-map"
  source_id="route-data"
  paint={%{
    "line-width" => 3,
    "line-color" => "#007cbf",
    "line-opacity" => 0.75,
    "line-gap-width" => 0,
    "line-offset" => 0,
    "line-blur" => 0,
    "line-dasharray" => [2, 4]
  }}
  layout={%{
    "line-cap" => "round",
    "line-join" => "round"
  }}
/>
```

**Atributos:**
- Similar a CircleLayer
- Paint properties específicas de líneas (line-width, line-color, etc.)
- Layout properties de líneas (line-cap, line-join)

**Eventos:**
- Similares a CircleLayer

**Archivos a crear:**
- `lib/maplibrex/components/line_layer.ex`
- `assets/js/maplibrex/hooks/line-layer-hook.ts`
- `test/maplibrex/components/line_layer_test.exs`

**Tests requeridos:** Mínimo 12 (similar a CircleLayer)

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

---

#### 2.3 FillLayer

**Descripción:** Capa especializada para renderizar polígonos sólidos.

**Casos de uso:** Áreas, regiones, zonas, límites administrativos.

**API Propuesta:**
```elixir
<.fill_layer
  id="states"
  map_id="my-map"
  source_id="states-data"
  paint={%{
    "fill-color" => "#088",
    "fill-opacity" => 0.4,
    "fill-outline-color" => "#000"
  }}
  filter={["==", "country", "US"]}
/>
```

**Atributos:**
- Similar a CircleLayer
- Paint properties específicas de fill (fill-color, fill-opacity, fill-pattern)

**Eventos:**
- Similares a CircleLayer

**Archivos a crear:**
- `lib/maplibrex/components/fill_layer.ex`
- `assets/js/maplibrex/hooks/fill-layer-hook.ts`
- `test/maplibrex/components/fill_layer_test.exs`

**Tests requeridos:** Mínimo 12

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

---

#### 2.4 SymbolLayer

**Descripción:** Capa especializada para renderizar iconos y texto.

**Casos de uso:** Labels, marcadores con texto, iconos personalizados.

**API Propuesta:**
```elixir
<.symbol_layer
  id="poi-labels"
  map_id="my-map"
  source_id="places"
  layout={%{
    "text-field" => ["get", "name"],
    "text-font" => ["Open Sans Regular"],
    "text-size" => 12,
    "text-anchor" => "top",
    "text-offset" => [0, 0.5],
    "icon-image" => "marker-15",
    "icon-size" => 1.5,
    "icon-allow-overlap" => false,
    "text-allow-overlap" => false
  }}
  paint={%{
    "text-color" => "#000",
    "text-halo-color" => "#fff",
    "text-halo-width" => 2,
    "icon-opacity" => 1
  }}
/>
```

**Atributos:**
- Layout properties para texto e iconos
- Paint properties para estilos
- Soporte para sprites de iconos

**Eventos:**
- Similares a CircleLayer

**Archivos a crear:**
- `lib/maplibrex/components/symbol_layer.ex`
- `assets/js/maplibrex/hooks/symbol-layer-hook.ts`
- `test/maplibrex/components/symbol_layer_test.exs`

**Tests requeridos:** Mínimo 14 (más complejo por iconos y texto)

**Complejidad:** Media-Alta  
**Tiempo estimado:** 4-5 días

---

#### 2.5 HeatmapLayer

**Descripción:** Capa especializada para mapas de calor (densidad).

**Casos de uso:** Visualización de densidad de eventos, concentración de datos.

**API Propuesta:**
```elixir
<.heatmap_layer
  id="earthquake-heat"
  map_id="my-map"
  source_id="earthquakes"
  paint={%{
    "heatmap-weight" => ["interpolate", ["linear"], ["get", "mag"], 0, 0, 6, 1],
    "heatmap-intensity" => ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
    "heatmap-color" => [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(33,102,172,0)",
      0.2, "rgb(103,169,207)",
      0.4, "rgb(209,229,240)",
      0.6, "rgb(253,219,199)",
      0.8, "rgb(239,138,98)",
      1, "rgb(178,24,43)"
    ],
    "heatmap-radius" => ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
    "heatmap-opacity" => 1
  }}
/>
```

**Atributos:**
- Paint properties específicas de heatmap
- Control de peso, intensidad, color, radio

**Eventos:**
- `layer:added`, `layer:removed` (no eventos de feature individual)

**Archivos a crear:**
- `lib/maplibrex/components/heatmap_layer.ex`
- `assets/js/maplibrex/hooks/heatmap-layer-hook.ts`
- `test/maplibrex/components/heatmap_layer_test.exs`

**Tests requeridos:** Mínimo 10

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

---

#### 2.6 FillExtrusionLayer

**Descripción:** Capa especializada para edificios y polígonos 3D extruidos.

**Casos de uso:** Edificios 3D, visualización de datos con altura.

**API Propuesta:**
```elixir
<.fill_extrusion_layer
  id="buildings-3d"
  map_id="my-map"
  source_id="buildings"
  paint={%{
    "fill-extrusion-color" => "#aaa",
    "fill-extrusion-height" => ["get", "height"],
    "fill-extrusion-base" => ["get", "min_height"],
    "fill-extrusion-opacity" => 0.6,
    "fill-extrusion-vertical-gradient" => true
  }}
  filter={["==", "extrude", "true"]}
/>
```

**Atributos:**
- Paint properties para extrusión 3D
- Control de altura, base, color, opacidad

**Eventos:**
- Similares a CircleLayer

**Archivos a crear:**
- `lib/maplibrex/components/fill_extrusion_layer.ex`
- `assets/js/maplibrex/hooks/fill-extrusion-layer-hook.ts`
- `test/maplibrex/components/fill_extrusion_layer_test.exs`

**Tests requeridos:** Mínimo 12

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

---

#### 2.7 BackgroundLayer

**Descripción:** Capa de fondo del mapa.

**API Propuesta:**
```elixir
<.background_layer
  id="background"
  map_id="my-map"
  paint={%{
    "background-color" => "#f0f0f0",
    "background-opacity" => 1
  }}
/>
```

**Complejidad:** Baja  
**Tiempo estimado:** 1-2 días

---

#### 2.8 HillshadeLayer

**Descripción:** Capa de sombreado de terreno.

**API Propuesta:**
```elixir
<.hillshade_layer
  id="hillshading"
  map_id="my-map"
  source_id="dem"
  paint={%{
    "hillshade-shadow-color" => "#000",
    "hillshade-illumination-direction" => 335,
    "hillshade-exaggeration" => 0.5
  }}
/>
```

**Complejidad:** Media  
**Tiempo estimado:** 2-3 días

---

### **FASE 3: Source Components (v0.4.0)**
**Duración estimada:** 2-3 semanas  
**Prioridad:** MEDIA-ALTA

> **Nota:** Actualmente los sources se definen dentro del style o implícitamente en GeoJSONLayer. Estos componentes permiten definir sources explícitamente y reutilizarlos en múltiples capas.

#### 3.1 VectorTileSource

**Descripción:** Fuente de datos de tiles vectoriales.

**Casos de uso:** Mapas base vectoriales, datos de OpenStreetMap, tiles personalizados.

**API Propuesta:**
```elixir
<.vector_tile_source
  id="osm-tiles"
  map_id="my-map"
  url="https://example.com/tiles/{z}/{x}/{y}.pbf"
  tiles={["https://a.example.com/tiles/{z}/{x}/{y}.pbf",
          "https://b.example.com/tiles/{z}/{x}/{y}.pbf"]}
  min_zoom={0}
  max_zoom={14}
  attribution="© OpenStreetMap contributors"
  promoteId={%{"natural" => "id"}}
/>

<!-- Usar el source en múltiples capas -->
<.circle_layer source="osm-tiles" source_layer="pois" ... />
<.line_layer source="osm-tiles" source_layer="roads" ... />
```

**Atributos:**
- `id` (required) - ID del source
- `map_id` (required) - ID del mapa
- `url` - TileJSON URL
- `tiles` - Array de tile URLs
- `min_zoom` - Zoom mínimo
- `max_zoom` - Zoom máximo
- `attribution` - Texto de atribución
- `bounds` - Bounds geográficos
- `scheme` - Esquema de tiles ("xyz" o "tms")
- `promoteId` - Promover property a feature ID

**Eventos:**
- `source:data` - Datos cargados
- `source:error` - Error al cargar

**Archivos a crear:**
- `lib/maplibrex/components/vector_tile_source.ex`
- `assets/js/maplibrex/hooks/vector-tile-source-hook.ts`
- `test/maplibrex/components/vector_tile_source_test.exs`

**Tests requeridos:** Mínimo 10

**Complejidad:** Media  
**Tiempo estimado:** 3-4 días

---

#### 3.2 RasterTileSource

**Descripción:** Fuente de datos de tiles raster (imágenes).

**Casos de uso:** Satélite, terreno, overlays de imágenes.

**API Propuesta:**
```elixir
<.raster_tile_source
  id="satellite"
  map_id="my-map"
  tiles={["https://example.com/satellite/{z}/{x}/{y}.png"]}
  tile_size={256}
  min_zoom={0}
  max_zoom={18}
  attribution="© Satellite Provider"
/>
```

**Atributos:**
- Similar a VectorTileSource
- `tile_size` - Tamaño de tiles (256, 512)
- `tms` - Esquema TMS

**Eventos:**
- Similares a VectorTileSource

**Archivos a crear:**
- `lib/maplibrex/components/raster_tile_source.ex`
- `assets/js/maplibrex/hooks/raster-tile-source-hook.ts`
- `test/maplibrex/components/raster_tile_source_test.exs`

**Tests requeridos:** Mínimo 10

**Complejidad:** Media  
**Tiempo estimado:** 2-3 días

---

#### 3.3 ImageSource

**Descripción:** Fuente de imagen georreferenciada.

**Casos de uso:** Overlays de radar meteorológico, imágenes históricas, mapas escaneados.

**API Propuesta:**
```elixir
<.image_source
  id="radar-image"
  map_id="my-map"
  url="/images/weather-radar.png"
  coordinates={[
    [-80.425, 46.437],  # top-left
    [-71.516, 46.437],  # top-right
    [-71.516, 37.936],  # bottom-right
    [-80.425, 37.936]   # bottom-left
  ]}
/>

<!-- Renderizar con RasterLayer -->
<.raster_layer source="radar-image" paint={%{"raster-opacity" => 0.85}} />
```

**Atributos:**
- `id` (required) - ID del source
- `map_id` (required) - ID del mapa
- `url` (required) - URL de la imagen
- `coordinates` (required) - 4 esquinas [lng, lat]

**Eventos:**
- `source:loaded` - Imagen cargada
- `source:error` - Error al cargar

**Archivos a crear:**
- `lib/maplibrex/components/image_source.ex`
- `assets/js/maplibrex/hooks/image-source-hook.ts`
- `test/maplibrex/components/image_source_test.exs`

**Tests requeridos:** Mínimo 8

**Complejidad:** Media  
**Tiempo estimado:** 2-3 días

---

#### 3.4 RasterDEMSource

**Descripción:** Fuente de modelo digital de elevación (DEM).

**Casos de uso:** Terreno 3D, hillshading.

**API Propuesta:**
```elixir
<.raster_dem_source
  id="terrain-dem"
  map_id="my-map"
  url="https://example.com/dem/{z}/{x}/{y}.png"
  encoding="terrarium"
  max_zoom={12}
/>
```

**Atributos:**
- Similar a RasterTileSource
- `encoding` - "terrarium" o "mapbox"

**Complejidad:** Media  
**Tiempo estimado:** 2-3 días

---

#### 3.5 VideoSource

**Descripción:** Fuente de video georreferenciado.

**API Propuesta:**
```elixir
<.video_source
  id="video-overlay"
  map_id="my-map"
  urls={["/videos/drone-footage.mp4", "/videos/drone-footage.webm"]}
  coordinates={[[lng, lat], [lng, lat], [lng, lat], [lng, lat]]}
/>
```

**Complejidad:** Media-Alta  
**Tiempo estimado:** 3-4 días

---

### **FASE 4: 3D & Terrain (v0.5.0)**
**Duración estimada:** 2-3 semanas  
**Prioridad:** MEDIA

#### 4.1 Terrain

**Descripción:** Habilita terreno 3D en el mapa.

**API Propuesta:**
```elixir
<.raster_dem_source
  id="terrain-source"
  map_id="my-map"
  url="https://example.com/dem/{z}/{x}/{y}.png"
  encoding="terrarium"
/>

<.terrain
  map_id="my-map"
  source_id="terrain-source"
  exaggeration={1.5}
/>
```

**Atributos:**
- `map_id` (required)
- `source_id` (required) - RasterDEMSource
- `exaggeration` - Exageración vertical (default: 1)

**Eventos:**
- `terrain:enabled` - Terreno habilitado
- `terrain:disabled` - Terreno deshabilitado

**Archivos a crear:**
- `lib/maplibrex/components/terrain.ex`
- `assets/js/maplibrex/hooks/terrain-hook.ts`
- `test/maplibrex/components/terrain_test.exs`

**Tests requeridos:** Mínimo 8

**Complejidad:** Media-Alta  
**Tiempo estimado:** 4-5 días

---

#### 4.2 TerrainControl

**Descripción:** Toggle para habilitar/deshabilitar terreno 3D.

**API Propuesta:**
```elixir
<.terrain_control
  id="terrain-toggle"
  map_id="my-map"
  position="top-right"
  terrain_source_id="terrain-source"
  exaggeration={1.5}
/>
```

**Complejidad:** Baja-Media  
**Tiempo estimado:** 2-3 días

---

#### 4.3 Sky

**Descripción:** Capa de cielo para vistas 3D.

**API Propuesta:**
```elixir
<.sky
  map_id="my-map"
  paint={%{
    "sky-type" => "atmosphere",
    "sky-atmosphere-sun" => [0.0, 90.0],
    "sky-atmosphere-color" => "rgba(135, 206, 235, 1)"
  }}
/>
```

**Complejidad:** Baja  
**Tiempo estimado:** 2-3 días

---

### **FASE 5: Advanced Integrations (v0.6.0)** ⭐
**Duración estimada:** 3-4 semanas  
**Prioridad:** ALTA (según feedback del usuario)

#### 5.1 DeckGlLayer 🎯

**Descripción:** Integración con deck.gl para visualizaciones 3D avanzadas.

**Casos de uso:**
- Visualizaciones 3D complejas
- Animaciones de datos temporales
- Arcos, hexágonos, visualizaciones de columnas
- Renderizado de millones de puntos eficientemente

**Dependencias:**
```json
{
  "@deck.gl/core": "^9.0.0",
  "@deck.gl/layers": "^9.0.0",
  "@deck.gl/mapbox": "^9.0.0"
}
```

**API Propuesta:**
```elixir
<.deckgl_layer
  id="deck-layer"
  map_id="my-map"
  layer_type="ScatterplotLayer"
  data={@points}
  props={%{
    "getPosition" => ["get", "coordinates"],
    "getRadius" => 1000,
    "getFillColor" => [255, 140, 0],
    "pickable" => true,
    "radiusScale" => 6,
    "radiusMinPixels" => 1,
    "radiusMaxPixels" => 100
  }}
/>

<!-- Ejemplo con HexagonLayer -->
<.deckgl_layer
  id="hexagon-layer"
  map_id="my-map"
  layer_type="HexagonLayer"
  data={@data}
  props={%{
    "getPosition" => ["get", "coordinates"],
    "elevationScale" => 4,
    "radius" => 200,
    "coverage" => 1,
    "extruded" => true,
    "pickable" => true
  }}
/>

<!-- Ejemplo con ArcLayer para conexiones -->
<.deckgl_layer
  id="arc-layer"
  map_id="my-map"
  layer_type="ArcLayer"
  data={@connections}
  props={%{
    "getSourcePosition" => ["get", "from"],
    "getTargetPosition" => ["get", "to"],
    "getSourceColor" => [255, 0, 0],
    "getTargetColor" => [0, 255, 0],
    "getWidth" => 2
  }}
/>
```

**Tipos de layers soportados:**
- ScatterplotLayer
- ArcLayer
- LineLayer (deck.gl)
- HexagonLayer
- GridLayer
- ColumnLayer
- PathLayer
- PolygonLayer
- GeoJsonLayer (deck.gl)
- ScreenGridLayer
- HeatmapLayer (deck.gl)
- ContourLayer
- TextLayer
- IconLayer
- PointCloudLayer
- Trips Layer (animado)

**Atributos:**
- `id` (required) - Identificador único
- `map_id` (required) - ID del mapa
- `layer_type` (required) - Tipo de deck.gl layer
- `data` (required) - Datos a visualizar
- `props` (required) - Propiedades del layer de deck.gl
- `before_id` - ID de la capa antes de la cual insertar
- `opacity` - Opacidad (0-1)
- `visible` - Visibilidad (default: true)

**Eventos:**
- `deckgl:click` - Click en feature
- `deckgl:hover` - Hover sobre feature
- `deckgl:drag_start` - Inicio de drag
- `deckgl:drag` - Dragging
- `deckgl:drag_end` - Fin de drag
- `deckgl:layer_loaded` - Layer cargado
- `deckgl:error` - Error en el layer

**Características avanzadas:**
- Animaciones con transitions
- Interactividad (pickable, onClick, onHover)
- Tooltips personalizados
- Renderizado eficiente de millones de puntos
- WebGL custom shaders

**Ejemplo completo:**
```elixir
defmodule MyAppWeb.DeckGLMapLive do
  use MyAppWeb, :live_view
  import MaplibreX.Components

  def mount(_params, _session, socket) do
    # Datos de ejemplo: vuelos entre ciudades
    flights = [
      %{from: [-122.4, 37.8], to: [-74.0, 40.7], passengers: 1000},
      %{from: [-118.2, 34.0], to: [-87.6, 41.9], passengers: 800},
      # ... más vuelos
    ]

    {:ok, assign(socket, flights: flights)}
  end

  def render(assigns) do
    ~H"""
    <.map
      id="deckgl-map"
      center={[-95, 40]}
      zoom={4}
      pitch={45}
      style="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      class="h-screen"
    />

    <%!-- ArcLayer para visualizar conexiones --%>
    <.deckgl_layer
      id="flight-arcs"
      map_id="deckgl-map"
      layer_type="ArcLayer"
      data={@flights}
      props={%{
        "getSourcePosition" => ["get", "from"],
        "getTargetPosition" => ["get", "to"],
        "getSourceColor" => [255, 140, 0],
        "getTargetColor" => [255, 200, 0],
        "getWidth" => ["get", "passengers", "/", 100],
        "pickable" => true
      }}
    />

    <%!-- HexagonLayer para densidad --%>
    <.deckgl_layer
      id="hexagons"
      map_id="deckgl-map"
      layer_type="HexagonLayer"
      data={@flights}
      props={%{
        "getPosition" => ["get", "from"],
        "elevationScale" => 50,
        "radius" => 10000,
        "coverage" => 0.9,
        "extruded" => true,
        "pickable" => true,
        "autoHighlight" => true,
        "colorRange" => [
          [1, 152, 189],
          [73, 227, 206],
          [216, 254, 181],
          [254, 237, 177],
          [254, 173, 84],
          [209, 55, 78]
        ]
      }}
    />
    """
  end

  def handle_event("deckgl:click", %{"object" => object}, socket) do
    IO.inspect(object, label: "Clicked deck.gl object")
    {:noreply, socket}
  end
end
```

**Archivos a crear:**
- `lib/maplibrex/components/deckgl_layer.ex`
- `assets/js/maplibrex/hooks/deckgl-layer-hook.ts`
- `assets/js/maplibrex/utils/deckgl-helpers.ts`
- `test/maplibrex/components/deckgl_layer_test.exs`

**Tests requeridos:** Mínimo 15

**Complejidad:** Alta  
**Tiempo estimado:** 1.5-2 semanas

**Documentación adicional requerida:**
- Guía de uso de deck.gl layers
- Ejemplos para cada tipo de layer
- Performance best practices
- Troubleshooting común

**Referencia svelte-maplibre:**
```svelte
<DeckGlLayer
  data={flights}
  type="ArcLayer"
  props={{
    getSourcePosition: d => d.from,
    getTargetPosition: d => d.to,
    getWidth: 2
  }}
/>
```

---

#### 5.2 Custom WebGL Layers

**Descripción:** Soporte para custom WebGL layers.

**API Propuesta:**
```elixir
<.custom_layer
  id="custom-webgl"
  map_id="my-map"
  render_function="myCustomRender"
  type="custom"
/>
```

**Complejidad:** Alta  
**Tiempo estimado:** 1 semana

---

### **FASE 6: Utilities & Helpers (v0.7.0)**
**Duración estimada:** 1-2 semanas  
**Prioridad:** MEDIA-BAJA

#### 6.1 Control (Base Genérico)

**Descripción:** Componente base para crear controles personalizados.

**API Propuesta:**
```elixir
<.control
  id="custom-control"
  map_id="my-map"
  position="top-left"
  class="custom-control-class"
>
  <div class="p-2 bg-white rounded shadow">
    <button phx-click="my_action">Custom Action</button>
  </div>
</.control>
```

**Complejidad:** Media  
**Tiempo estimado:** 2-3 días

---

#### 6.2 ControlButton

**Descripción:** Botón de control reutilizable.

**API Propuesta:**
```elixir
<.control_button
  id="toggle-layers"
  map_id="my-map"
  position="top-right"
  icon="layers"
  tooltip="Toggle Layers"
  phx-click="toggle_layers"
/>
```

**Complejidad:** Baja  
**Tiempo estimado:** 1-2 días

---

#### 6.3 ControlGroup

**Descripción:** Agrupar múltiples controles.

**API Propuesta:**
```elixir
<.control_group position="top-right">
  <.control_button icon="layers" phx-click="toggle_layers" />
  <.control_button icon="settings" phx-click="open_settings" />
  <.control_button icon="info" phx-click="show_info" />
</.control_group>
```

**Complejidad:** Baja  
**Tiempo estimado:** 1-2 días

---

#### 6.4 ZoomRange

**Descripción:** Helper para mostrar contenido solo en ciertos niveles de zoom.

**API Propuesta:**
```elixir
<.zoom_range min={10} max={15}>
  <.circle_layer id="detailed-pois" ... />
</.zoom_range>
```

**Complejidad:** Baja  
**Tiempo estimado:** 1 día

---

#### 6.5 RasterLayer

**Descripción:** Capa para renderizar sources raster.

**API Propuesta:**
```elixir
<.raster_layer
  id="satellite-layer"
  map_id="my-map"
  source="satellite"
  paint={%{
    "raster-opacity" => 0.85,
    "raster-fade-duration" => 300
  }}
/>
```

**Complejidad:** Baja  
**Tiempo estimado:** 2 días

---

### **FASE 7: Polish & Optimization (v1.0.0)**
**Duración estimada:** 2-3 semanas  
**Prioridad:** ALTA (antes del release 1.0)

#### 7.1 Performance Optimizations

- [ ] Bundle size optimization
- [ ] Tree-shaking improvements
- [ ] Lazy loading de componentes
- [ ] Code splitting para deck.gl
- [ ] Memoization de configuraciones
- [ ] Debouncing de eventos frecuentes

**Tiempo estimado:** 1 semana

---

#### 7.2 Documentation

- [ ] API documentation completa (HexDocs)
- [ ] Interactive examples para cada componente
- [ ] Migration guide desde versiones anteriores
- [ ] Best practices guide
- [ ] Performance guide
- [ ] Troubleshooting guide
- [ ] deck.gl integration guide
- [ ] Storybook o similar

**Tiempo estimado:** 1 semana

---

#### 7.3 Testing & Quality

- [ ] >95% test coverage
- [ ] E2E tests con Wallaby o similar
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Browser compatibility testing
- [ ] Accessibility testing (WCAG 2.1)

**Tiempo estimado:** 1 semana

---

## 📊 Resumen de Componentes

### Componentes Actuales (v0.1.x)
1. Map
2. Marker
3. Popup
4. GeoJSONLayer
5. NavigationControl
6. ScaleControl
7. FullscreenControl

### Nuevos Componentes a Agregar

**Controles (3):**
8. GeolocateControl
9. AttributionControl
10. TerrainControl

**Layers (10):**
11. CircleLayer
12. LineLayer
13. FillLayer
14. SymbolLayer
15. HeatmapLayer
16. FillExtrusionLayer
17. BackgroundLayer
18. HillshadeLayer
19. RasterLayer
20. DeckGlLayer ⭐

**Sources (5):**
21. VectorTileSource
22. RasterTileSource
23. ImageSource
24. RasterDEMSource
25. VideoSource

**3D & Terrain (2):**
26. Terrain
27. Sky

**Utilities (5):**
28. Control (base)
29. ControlButton
30. ControlGroup
31. ZoomRange
32. CustomLayer

**Total: 32 componentes (7 actuales + 25 nuevos)**

---

## 🎯 Prioridades Clarificadas

### PRIORIDAD CRÍTICA ⭐⭐⭐
1. GeolocateControl
2. CircleLayer
3. LineLayer
4. FillLayer
5. SymbolLayer
6. **DeckGlLayer** (por feedback del usuario)
7. VectorTileSource

### PRIORIDAD ALTA ⭐⭐
8. AttributionControl
9. HeatmapLayer
10. FillExtrusionLayer
11. RasterTileSource
12. ImageSource
13. Terrain

### PRIORIDAD MEDIA ⭐
14. TerrainControl
15. RasterDEMSource
16. VideoSource
17. BackgroundLayer
18. HillshadeLayer
19. Sky
20. RasterLayer

### PRIORIDAD BAJA
21. Control (base)
22. ControlButton
23. ControlGroup
24. ZoomRange
25. CustomLayer

---

## 📅 Timeline Estimado

| Fase | Duración | Fecha Inicio | Fecha Fin |
|------|----------|--------------|-----------|
| Fase 1 - Controles Esenciales | 1-2 semanas | TBD | TBD |
| Fase 2 - Layer Components | 3-4 semanas | TBD | TBD |
| Fase 3 - Source Components | 2-3 semanas | TBD | TBD |
| Fase 4 - 3D & Terrain | 2-3 semanas | TBD | TBD |
| Fase 5 - DeckGL Integration | 3-4 semanas | TBD | TBD |
| Fase 6 - Utilities | 1-2 semanas | TBD | TBD |
| Fase 7 - Polish & v1.0 | 2-3 semanas | TBD | TBD |

**Total estimado:** 14-21 semanas (~3.5-5 meses)

---

## 🛠️ Convenciones y Prácticas

### Estructura de Archivos
```
lib/maplibrex/components/
  ├── [component_name].ex

assets/js/maplibrex/
  ├── hooks/
  │   └── [component-name]-hook.ts
  └── types/
      └── index.ts (actualizar)

test/maplibrex/components/
  └── [component_name]_test.exs
```

### Patrón de Implementación

1. **Componente Elixir**
   - @moduledoc completo con ejemplos
   - Validación de parámetros con `attr`
   - Configuración JSON clara
   - Helpers cuando sea apropiado

2. **Hook TypeScript**
   - Interfaces y tipos bien definidos
   - Lifecycle: mounted, updated, destroyed
   - Event listeners limpios
   - Logging consistente
   - Limpieza apropiada

3. **Tests**
   - Mínimo 7-15 tests por componente
   - Validaciones
   - Edge cases
   - Eventos
   - Limpieza

4. **Documentación**
   - Ejemplos en @moduledoc
   - README actualizado
   - Changelog entry
   - Migration notes si aplica

### Git Workflow

```bash
# Por cada componente:
git checkout feature/svelte-maplibre-parity
git checkout -b feature/component-name
# ... implementar componente ...
git commit -m "feat: add ComponentName

- Implement Elixir component
- Add TypeScript hook
- Add tests (X passing)
- Update documentation
"
git checkout feature/svelte-maplibre-parity
git merge feature/component-name
```

---

## 📚 Referencias

- **svelte-maplibre**: https://github.com/dimfeld/svelte-maplibre
- **MapLibre GL JS**: https://maplibre.org/maplibre-gl-js/docs/
- **deck.gl**: https://deck.gl/
- **Demo actual**: https://github.com/roger120981/maplibrex_demo

---

## ✅ Criterios de Éxito

Para cada componente:
- [ ] Implementado siguiendo el patrón establecido
- [ ] Tests pasando (>90% coverage)
- [ ] Documentación completa
- [ ] Funciona en el demo
- [ ] Revisión de código
- [ ] Sin regressions

Para v1.0:
- [ ] Todos los componentes de prioridad crítica y alta implementados
- [ ] DeckGL integration funcionando
- [ ] >95% test coverage
- [ ] Documentación completa
- [ ] Performance optimizado
- [ ] Migration guide publicado

---

## 🤝 Contribuciones

Este roadmap está abierto a discusión y ajustes. Los PRs son bienvenidos para cualquier ítem del roadmap.

**Última actualización:** 2024-12-04  
**Branch:** feature/svelte-maplibre-parity  
**Versión objetivo:** v1.0.0
