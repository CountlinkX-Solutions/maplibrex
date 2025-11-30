# MaplibreX Roadmap

Este documento describe el plan de desarrollo futuro para MaplibreX, organizando funcionalidades por fases y prioridades.

## 📊 Estado Actual (v0.1.x)

### ✅ Componentes Completados (7)
1. **Map Component** - Componente principal del mapa
2. **Marker Component** - Marcadores con popups y drag
3. **Popup Component** - Popups independientes
4. **GeoJSON Layer Component** - Renderizado de datos GeoJSON
5. **Navigation Control** - Controles de navegación (zoom, brújula)
6. **Scale Control** - Barra de escala
7. **Fullscreen Control** - Toggle de pantalla completa

**Tests:** 87 tests pasando ✅

---

## 🎯 Fase 1: Controles Esenciales (v0.2.0)
*Prioridad: ALTA | Tiempo estimado: 1-2 semanas*

### 1.1 Geolocate Control
**Complejidad:** Media  
**Valor:** Muy Alto

**Características:**
- Botón de geolocalización del usuario
- Seguimiento en tiempo real opcional
- Círculo de precisión
- Configuración de opciones de posición
- Eventos de ubicación actualizada

**Archivos a crear:**
- `lib/maplibrex/components/geolocate_control.ex`
- `assets/js/maplibrex/hooks/geolocate-control-hook.ts`
- `test/maplibrex/components/geolocate_control_test.exs`

**Eventos:**
- `geolocate:location_found`
- `geolocate:location_error`
- `geolocate:tracking_started`
- `geolocate:tracking_stopped`

---

### 1.2 Attribution Control
**Complejidad:** Baja  
**Valor:** Medio

**Características:**
- Control de atribución personalizable
- Contenido y posición configurables
- Toggle compact/expanded

**Archivos a crear:**
- `lib/maplibrex/components/attribution_control.ex`
- `assets/js/maplibrex/hooks/attribution-control-hook.ts`
- `test/maplibrex/components/attribution_control_test.exs`

---

## 🚀 Fase 2: Componentes Interactivos Avanzados (v0.3.0)
*Prioridad: ALTA | Tiempo estimado: 3-4 semanas*

### 2.1 Draw Control
**Complejidad:** Alta  
**Valor:** Muy Alto

**Características:**
- Dibujar puntos, líneas, polígonos
- Editar geometrías existentes
- Borrar elementos
- Snap to grid opcional
- Exportar/importar GeoJSON
- Modos: draw_point, draw_line, draw_polygon, simple_select, direct_select

**Dependencias:**
- Integración con @mapbox/mapbox-gl-draw (o alternativa MapLibre)

**Archivos a crear:**
- `lib/maplibrex/components/draw_control.ex`
- `assets/js/maplibrex/hooks/draw-control-hook.ts`
- `assets/js/maplibrex/utils/draw-helpers.ts`
- `test/maplibrex/components/draw_control_test.exs`

**Eventos:**
- `draw:created`
- `draw:updated`
- `draw:deleted`
- `draw:mode_changed`

---

### 2.2 Geocoder Component
**Complejidad:** Media-Alta  
**Valor:** Alto

**Características:**
- Búsqueda de lugares/direcciones
- Autocompletado
- Resultados customizables
- Integración con múltiples servicios (Nominatim, MapTiler, etc.)
- Búsqueda reversa (coordinates → address)

**Archivos a crear:**
- `lib/maplibrex/components/geocoder.ex`
- `assets/js/maplibrex/hooks/geocoder-hook.ts`
- `assets/js/maplibrex/services/geocoding-service.ts`
- `test/maplibrex/components/geocoder_test.exs`

**Eventos:**
- `geocoder:result_selected`
- `geocoder:results_loaded`
- `geocoder:error`

---

### 2.3 Enhanced Marker Component
**Complejidad:** Media  
**Valor:** Alto

**Características:**
- Marcadores con HTML personalizado
- Animaciones (bounce, pulse, fade)
- Clusters mejorados con estadísticas
- Iconos SVG personalizados
- Labels dinámicos
- Z-index management

**Archivos a modificar:**
- `lib/maplibrex/components/marker.ex` (extend)
- `assets/js/maplibrex/hooks/marker-hook.ts` (extend)
- `assets/css/maplibrex.css` (add animations)

---

## 📐 Fase 3: Herramientas de Medición (v0.4.0)
*Prioridad: MEDIA | Tiempo estimado: 2-3 semanas*

### 3.1 Distance Measurement Tool
**Complejidad:** Media  
**Valor:** Alto

**Características:**
- Medir distancias punto a punto
- Múltiples segmentos
- Unidades configurables (km, mi, m, ft)
- Distancia total y por segmento
- Visualización de líneas de medición

**Archivos a crear:**
- `lib/maplibrex/components/distance_tool.ex`
- `assets/js/maplibrex/hooks/distance-tool-hook.ts`
- `assets/js/maplibrex/utils/measurement-utils.ts`
- `test/maplibrex/components/distance_tool_test.exs`

---

### 3.2 Area Measurement Tool
**Complejidad:** Media  
**Valor:** Medio-Alto

**Características:**
- Medir áreas de polígonos
- Cálculo automático de perímetro
- Unidades configurables (km², mi², ha, acres)
- Visualización de contorno

**Archivos a crear:**
- `lib/maplibrex/components/area_tool.ex`
- `assets/js/maplibrex/hooks/area-tool-hook.ts`
- (Reutilizar `measurement-utils.ts`)

---

## 🎨 Fase 4: Gestión de Capas (v0.5.0)
*Prioridad: MEDIA | Tiempo estimado: 2-3 semanas*

### 4.1 Layer Switcher/Manager
**Complejidad:** Media  
**Valor:** Alto

**Características:**
- Panel para activar/desactivar capas
- Organización por grupos
- Control de opacidad por capa
- Reordenamiento de capas (z-index)
- Expandir/colapsar grupos
- Búsqueda de capas

**Archivos a crear:**
- `lib/maplibrex/components/layer_switcher.ex`
- `assets/js/maplibrex/hooks/layer-switcher-hook.ts`
- `assets/js/maplibrex/core/layer-manager.ts`
- `assets/css/layer-switcher.css`
- `test/maplibrex/components/layer_switcher_test.exs`

---

### 4.2 Legend Component
**Complejidad:** Media  
**Valor:** Medio-Alto

**Características:**
- Leyenda automática basada en capas
- Símbolos y colores configurables
- Gradientes para datos continuos
- Categorías para datos discretos
- Interactiva (filtrar por leyenda)

**Archivos a crear:**
- `lib/maplibrex/components/legend.ex`
- `assets/js/maplibrex/hooks/legend-hook.ts`
- `assets/css/legend.css`
- `test/maplibrex/components/legend_test.exs`

---

### 4.3 Capas Adicionales

#### 4.3.1 Image Layer
**Complejidad:** Baja  
**Características:**
- Sobreponer imágenes georreferenciadas
- Opacidad configurable
- Rotación y escala

#### 4.3.2 Raster Tile Layer
**Complejidad:** Baja-Media  
**Características:**
- Capas de tiles raster (satélite, terreno)
- Múltiples fuentes
- Mezcla de capas

#### 4.3.3 Video Layer
**Complejidad:** Media  
**Características:**
- Video georreferenciado
- Control de reproducción
- Sincronización temporal

---

## 🏔️ Fase 5: Características 3D y Avanzadas (v0.6.0)
*Prioridad: MEDIA-BAJA | Tiempo estimado: 3-4 semanas*

### 5.1 3D Buildings Layer
**Complejidad:** Media-Alta  
**Valor:** Medio

**Características:**
- Edificios en 3D extruidos
- Altura basada en datos
- Sombreado configurable
- Colores por propiedad

---

### 5.2 Terrain/DEM Support
**Complejidad:** Alta  
**Valor:** Medio

**Características:**
- Modelos digitales de elevación
- Hillshading
- Contornos de elevación
- Perfil de terreno
- Exageración vertical

---

### 5.3 Heatmap Layer (dedicado)
**Complejidad:** Media  
**Valor:** Medio

**Características:**
- Heatmap optimizado
- Gradientes personalizables
- Pesos configurables
- Radio e intensidad

---

## 🎬 Fase 6: Animaciones y Rutas (v0.7.0)
*Prioridad: MEDIA | Tiempo estimado: 3-4 semanas*

### 6.1 Animation Controls
**Complejidad:** Media-Alta  
**Valor:** Medio-Alto

**Características:**
- Camera animations
- Path following (animate along route)
- Smooth transitions
- Easing functions configurables
- Play/pause/stop controls
- Velocidad ajustable

---

### 6.2 Route/Directions Component
**Complejidad:** Alta  
**Valor:** Alto

**Características:**
- Calcular rutas entre puntos
- Múltiples algoritmos (shortest, fastest)
- Instrucciones paso a paso
- Perfil de elevación
- Alternativas de ruta
- Integración con servicios de routing

---

## 🛠️ Fase 7: Utilidades y Helpers (v0.8.0)
*Prioridad: BAJA-MEDIA | Tiempo estimado: 2-3 semanas*

### 7.1 Coordinate Display Component
**Complejidad:** Baja  
**Características:**
- Mostrar coordenadas del cursor
- Múltiples formatos (DD, DMS, UTM, MGRS)
- Click para copiar
- Conversión entre formatos

---

### 7.2 Map Export Utility
**Complejidad:** Media  
**Características:**
- Exportar como imagen PNG/JPG
- Incluir/excluir atribución
- Resolución configurable
- Watermark opcional

---

### 7.3 Bounds Calculator Utility
**Complejidad:** Baja  
**Características:**
- Calcular bounds de features
- Fit múltiples elementos
- Padding inteligente
- Animación opcional

---

### 7.4 Snapshot/Bookmark System
**Complejidad:** Media  
**Características:**
- Guardar vistas del mapa
- Restaurar snapshots
- Compartir enlaces
- Thumbnails

---

## 📱 Fase 8: Responsividad y Offline (v0.9.0)
*Prioridad: MEDIA | Tiempo estimado: 2-3 semanas*

### 8.1 Responsive Utilities
**Complejidad:** Media  
**Características:**
- Detección de viewport
- Componentes adaptables
- Touch gestures optimizados
- Mobile-first helpers

---

### 8.2 Offline Support
**Complejidad:** Alta  
**Características:**
- Cache de tiles
- Modo offline
- Pre-descarga de áreas
- Service worker integration
- Sync automático

---

## 🔌 Fase 9: Integraciones (v1.0.0)
*Prioridad: BAJA | Tiempo estimado: Variable*

### 9.1 Third-party Integrations
- Turf.js helpers
- Chart.js para gráficos en popups
- Timeline controls
- Weather layers
- Traffic layers

---

### 9.2 Export/Import Formats
- KML import/export
- GPX import/export
- Shapefile support (via conversion)
- CSV with coordinates

---

## 📚 Documentación y Ejemplos

### Continuous Improvements
- [ ] Interactive documentation site
- [ ] Video tutorials
- [ ] Storybook integration
- [ ] More examples in `/examples`
- [ ] Performance benchmarks
- [ ] Migration guides
- [ ] Best practices guide

---

## 🧪 Testing y Quality

### Continuous Improvements
- [ ] E2E tests con Playwright/Cypress
- [ ] Visual regression tests
- [ ] Performance tests
- [ ] Accessibility tests (WCAG)
- [ ] Browser compatibility matrix
- [ ] Load testing

---

## 🔧 Infrastructure

### Continuous Improvements
- [ ] CI/CD pipeline mejorado
- [ ] Automated releases
- [ ] Changelog automation
- [ ] Dependabot setup
- [ ] Security scanning
- [ ] Code coverage reports

---

## 📈 Métricas de Éxito

### Por Fase
- **Tests:** Mantener >90% coverage
- **Performance:** Tiempo de carga <3s
- **Bundle size:** <1.5MB gzipped
- **Docs:** 100% componentes documentados
- **Examples:** 2+ ejemplos por componente

---

## 🎯 Notas de Implementación

### Patrón para Agregar Componentes

1. **Crear componente Elixir** (`lib/maplibrex/components/[nombre].ex`)
   - Documentación completa
   - Validación de parámetros
   - Configuración JSON

2. **Crear hook TypeScript** (`assets/js/maplibrex/hooks/[nombre]-hook.ts`)
   - Implementación mounted/destroyed
   - Manejo de eventos
   - Limpieza apropiada

3. **Actualizar tipos** (`assets/js/maplibrex/types/index.ts`)
   - Agregar interfaces necesarias

4. **Registrar hook** (`assets/js/maplibrex/hooks/index.ts`)
   - Export del nuevo hook

5. **Exportar componente** (`lib/maplibrex/components.ex`)
   - Delegar al módulo

6. **Crear tests** (`test/maplibrex/components/[nombre]_test.exs`)
   - Mínimo 7-15 tests
   - Validaciones
   - Casos edge

7. **Actualizar README**
   - Documentación del componente
   - Ejemplos de uso

8. **Crear commit**
   - Mensaje descriptivo
   - Lista de cambios

---

## 💡 Decisiones de Diseño

### Principios
1. **Simplicidad primero** - API fácil de usar
2. **Type-safe** - TypeScript en todo el JS
3. **Testing** - Todo debe tener tests
4. **Documentación** - Inline + README
5. **Performance** - Optimización constante
6. **Compatibilidad** - Mantener backwards compatibility

### Convenciones
- Nombres de componentes: PascalCase
- Nombres de hooks: kebab-case-hook
- Eventos: `componente:accion`
- IDs: siempre requeridos
- Posiciones: enum limitado

---

## 🤝 Contribuciones

Los PRs son bienvenidos para cualquier ítem del roadmap. Antes de empezar:

1. Abrir un issue para discutir
2. Seguir el patrón establecido
3. Incluir tests
4. Actualizar documentación
5. Mantener cobertura de tests

---

**Última actualización:** 2024-11-30  
**Versión actual:** v0.1.x (87 tests)  
**Próximo milestone:** v0.2.0 - Controles Esenciales
