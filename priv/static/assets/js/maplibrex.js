// js/maplibrex/hooks/map-hook.ts
import * as maplibregl from "maplibre-gl";

// js/maplibrex/core/logger.ts
var debugEnabled = typeof window !== "undefined" && window.__MAPLIBREX_DEBUG__ === true;
function setDebug(enabled) {
  debugEnabled = enabled;
}
var logger = {
  /** Lifecycle and diagnostic output. Silent unless debugging is enabled. */
  debug(...args) {
    if (debugEnabled) {
      console.log(...args);
    }
  },
  /** Recoverable problems. Always logged. */
  warn(...args) {
    console.warn(...args);
  },
  /** Failures. Always logged. */
  error(...args) {
    console.error(...args);
  }
};

// js/maplibrex/core/map-manager.ts
var MapManagerClass = class {
  maps = {};
  /**
   * Register a new map instance
   */
  register(mapId, map) {
    if (this.maps[mapId]) {
      this.log("warn", `Map with id "${mapId}" already exists. Overwriting...`);
    }
    this.maps[mapId] = map;
    this.log("info", `Map "${mapId}" registered`, { map });
  }
  /**
   * Look up a map instance by id
   */
  get(mapId) {
    const map = this.maps[mapId];
    if (!map) {
      this.log("warn", `Map with id "${mapId}" not found`);
    }
    return map;
  }
  /**
   * Look up a map instance, raising if it does not exist
   */
  getOrThrow(mapId) {
    const map = this.get(mapId);
    if (!map) {
      throw new Error(`Map with id "${mapId}" not found. Make sure the map is mounted before accessing it.`);
    }
    return map;
  }
  /**
   * Whether a map with the given id is registered
   */
  has(mapId) {
    return mapId in this.maps;
  }
  /**
   * Remove a map from the registry
   */
  unregister(mapId) {
    if (!this.maps[mapId]) {
      this.log("warn", `Attempted to unregister non-existent map "${mapId}"`);
      return false;
    }
    delete this.maps[mapId];
    this.log("info", `Map "${mapId}" unregistered`);
    return true;
  }
  /**
   * Every registered map
   */
  getAll() {
    return { ...this.maps };
  }
  /**
   * The ids of every registered map
   */
  getAllIds() {
    return Object.keys(this.maps);
  }
  /**
   * How many maps are registered
   */
  count() {
    return Object.keys(this.maps).length;
  }
  /**
   * Remove every map. Useful in tests
   */
  clear() {
    const ids = this.getAllIds();
    ids.forEach((id) => {
      try {
        const map = this.maps[id];
        if (map && typeof map.remove === "function") {
          map.remove();
        }
      } catch (error) {
        this.log("error", `Error removing map "${id}"`, error);
      }
    });
    this.maps = {};
    this.log("info", "All maps cleared");
  }
  /**
   * Enable or disable debug mode
   */
  setDebug(enabled) {
    setDebug(enabled);
  }
  /**
   * Internal logger
   */
  log(level, message, data) {
    const prefix = "[MaplibreX MapManager]";
    switch (level) {
      case "info":
        logger.debug(prefix, message, data || "");
        break;
      case "warn":
        console.warn(prefix, message, data || "");
        break;
      case "error":
        console.error(prefix, message, data || "");
        break;
    }
  }
};
var MapManager = new MapManagerClass();
function useMap(mapId) {
  return MapManager.get(mapId);
}
function requireMap(mapId) {
  return MapManager.getOrThrow(mapId);
}

// js/maplibrex/utils/debounce.ts
function debounce(func, wait) {
  let timeout = null;
  return function(...args) {
    const context = this;
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

// js/maplibrex/core/event-dispatcher.ts
var EventDispatcher = class {
  hook;
  map;
  mapId;
  eventHandlers = /* @__PURE__ */ new Map();
  mapEventListeners = /* @__PURE__ */ new Map();
  constructor(hook, map, mapId) {
    this.hook = hook;
    this.map = map;
    this.mapId = mapId;
  }
  /**
   * Wires up the standard map events that get pushed to LiveView
   */
  setupDefaultMapEvents() {
    const debouncedMoveEnd = debounce(() => {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing();
      const pitch = this.map.getPitch();
      const payload = {
        mapId: this.mapId,
        type: "moveend",
        center: [center.lng, center.lat],
        zoom: Math.round(zoom * 100) / 100,
        bearing: Math.round(bearing * 100) / 100,
        pitch: Math.round(pitch * 100) / 100
      };
      this.pushToLiveView("map:moved", payload);
    }, 150);
    this.onMapEvent("moveend", debouncedMoveEnd);
    this.onMapEvent("click", (e) => {
      const payload = {
        mapId: this.mapId,
        type: "click",
        lngLat: [e.lngLat.lng, e.lngLat.lat],
        point: [e.point.x, e.point.y]
      };
      this.pushToLiveView("map:clicked", payload);
    });
    this.onMapEvent("load", () => {
      const payload = {
        mapId: this.mapId,
        type: "load"
      };
      this.pushToLiveView("map:loaded", payload);
    });
    this.onMapEvent("zoomend", () => {
      const payload = {
        mapId: this.mapId,
        type: "zoomend",
        zoom: this.map.getZoom()
      };
      this.pushToLiveView("map:zoom_changed", payload);
    });
    this.onMapEvent("error", (e) => {
      const payload = {
        mapId: this.mapId,
        type: "error",
        error: e.error?.message || "Unknown error"
      };
      this.pushToLiveView("map:error", payload);
    });
  }
  /**
   * Wires up the handlers for events coming from LiveView into the map
   */
  setupLiveViewHandlers() {
    this.onLiveViewEvent("map:fly_to", (payload) => {
      const { center, zoom, duration, bearing, pitch } = payload;
      this.map.flyTo({
        center,
        zoom,
        duration: duration || 1e3,
        bearing,
        pitch,
        essential: true
      });
    });
    this.onLiveViewEvent("map:jump_to", (payload) => {
      const { center, zoom, bearing, pitch } = payload;
      this.map.jumpTo({
        center,
        zoom,
        bearing,
        pitch
      });
    });
    this.onLiveViewEvent("map:fit_bounds", (payload) => {
      const { bounds, padding, maxZoom, duration } = payload;
      this.map.fitBounds(bounds, {
        padding: padding || 50,
        maxZoom,
        duration: duration || 1e3
      });
    });
    this.onLiveViewEvent("map:set_style", (payload) => {
      const { style } = payload;
      this.map.setStyle(style);
    });
    this.onLiveViewEvent("map:set_bearing", (payload) => {
      const { bearing, duration } = payload;
      this.map.rotateTo(bearing, { duration: duration || 1e3 });
    });
    this.onLiveViewEvent("map:set_pitch", (payload) => {
      const { pitch } = payload;
      this.map.setPitch(pitch);
    });
    this.onLiveViewEvent("map:reset_north", () => {
      this.map.resetNorth();
    });
    this.onLiveViewEvent("map:zoom_in", () => {
      this.map.zoomIn();
    });
    this.onLiveViewEvent("map:zoom_out", () => {
      this.map.zoomOut();
    });
  }
  /**
   * Subscribe to a map event
   */
  onMapEvent(event, handler) {
    this.map.on(event, handler);
    this.mapEventListeners.set(event, handler);
  }
  /**
   * Subscribe to an event coming from LiveView
   */
  onLiveViewEvent(event, handler) {
    this.hook.handleEvent(event, handler);
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  /**
   * Push an event to LiveView
   */
  pushToLiveView(event, payload, callback) {
    this.hook.pushEvent(event, payload, callback);
  }
  /**
   * Push an event to a specific target selector in LiveView
   */
  pushToLiveViewTarget(selector, event, payload, callback) {
    this.hook.pushEventTo(selector, event, payload, callback);
  }
  /**
   * Remove every event listener
   */
  cleanup() {
    this.mapEventListeners.forEach((handler, event) => {
      this.map.off(event, handler);
    });
    this.mapEventListeners.clear();
    this.eventHandlers.clear();
  }
  /**
   * Event statistics, useful when debugging
   */
  getStats() {
    return {
      mapEventListeners: this.mapEventListeners.size,
      liveViewHandlers: Array.from(this.eventHandlers.values()).reduce((acc, handlers) => acc + handlers.length, 0),
      events: Array.from(this.eventHandlers.keys())
    };
  }
};
function createEventDispatcher(hook, map, mapId, setupDefaults = true) {
  const dispatcher = new EventDispatcher(hook, map, mapId);
  if (setupDefaults) {
    dispatcher.setupDefaultMapEvents();
    dispatcher.setupLiveViewHandlers();
  }
  return dispatcher;
}

// js/maplibrex/hooks/map-hook.ts
var MapHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on map element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.id;
      const loaderElement = document.getElementById(config.loaderId);
      const fly = config.fly;
      const flightDuration = config.flightDuration;
      const flightSpeed = config.flightSpeed;
      const flightCurve = config.flightCurve;
      const flyToCenter = config.center;
      const flyToZoom = config.zoom;
      const flyToBearing = config.bearing || 0;
      const flyToPitch = config.pitch || 0;
      const flyFromCenter = config.flyFromCenter;
      const flyFromZoom = config.flyFromZoom;
      const flyFromBearing = config.flyFromBearing;
      const flyFromPitch = config.flyFromPitch;
      const intialCenter = fly ? flyFromCenter : flyToCenter;
      const initialZoom = fly ? flyFromZoom : flyToZoom;
      const initialBearing = fly ? flyFromBearing : flyToBearing;
      const initialPitch = fly ? flyFromPitch : flyToPitch;
      const map = new maplibregl.Map({
        container: el,
        // The initial position (the interpretation is different
        // whether we are flying or not, see above)
        center: intialCenter,
        zoom: initialZoom,
        bearing: initialBearing,
        pitch: initialPitch,
        // Other config options (which don't change based on the initial flight)
        style: config.style,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        minPitch: config.minPitch,
        maxPitch: config.maxPitch,
        bounds: config.bounds,
        maxBounds: config.maxBounds,
        interactive: config.interactive !== false,
        attributionControl: config.attributionControl !== false ? {} : false
      });
      MapManager.register(mapId, map);
      MapManager.setDebug(config.debug || false);
      const dispatcher = createEventDispatcher(this, map, mapId, true);
      this._maplibrex = {
        map,
        dispatcher,
        config
      };
      el.addEventListener("maplibrex:fly_to", (e) => {
        const { center, zoom, duration, bearing, pitch } = e.detail;
        map.flyTo({
          center,
          zoom,
          duration: duration || 1e3,
          ...bearing !== void 0 && { bearing },
          ...pitch !== void 0 && { pitch },
          essential: true
        });
      });
      el.addEventListener("maplibrex:jump_to", (e) => {
        const { center, zoom, bearing, pitch } = e.detail;
        map.jumpTo({
          center,
          zoom,
          ...bearing !== void 0 && { bearing },
          ...pitch !== void 0 && { pitch }
        });
      });
      el.addEventListener("maplibrex:fit_bounds", (e) => {
        const { bounds, padding, duration, maxZoom } = e.detail;
        map.fitBounds(bounds, {
          padding: padding || 50,
          duration: duration || 1e3,
          ...maxZoom !== void 0 && { maxZoom },
          essential: true
        });
      });
      el.addEventListener("maplibrex:set_style", (e) => {
        const { style } = e.detail;
        map.setStyle(style);
      });
      el.addEventListener("maplibrex:zoom_in", () => {
        map.zoomIn({ duration: 300 });
      });
      el.addEventListener("maplibrex:zoom_out", () => {
        map.zoomOut({ duration: 300 });
      });
      el.addEventListener("maplibrex:reset_north", () => {
        map.resetNorth({ duration: 300 });
      });
      map.once("load", () => {
        logger.debug(`[MaplibreX] Map "${mapId}" loaded and ready`);
      });
      map.once("idle", () => {
        loaderElement.style.opacity = "0";
        setTimeout(() => {
          loaderElement.style.display = "none";
        }, 500);
        if (fly) {
          map.flyTo({
            center: flyToCenter,
            zoom: flyToZoom,
            bearing: flyToBearing,
            pitch: flyToPitch,
            duration: flightDuration,
            speed: flightSpeed,
            curve: flightCurve,
            essential: true
          });
        }
      });
      map.on("error", (e) => {
        console.error(`[MaplibreX] Map error:`, e);
      });
    } catch (error) {
      console.error("[MaplibreX] Error mounting map:", error);
    }
  },
  updated() {
    const state = this._maplibrex;
    if (!state) return;
    try {
      const el = this.el;
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const oldConfig = state.config;
      if (newConfig.center[0] !== oldConfig.center[0] || newConfig.center[1] !== oldConfig.center[1]) {
        state.map.setCenter(newConfig.center);
      }
      if (newConfig.zoom !== oldConfig.zoom) {
        state.map.setZoom(newConfig.zoom);
      }
      if (newConfig.bearing !== void 0 && newConfig.bearing !== oldConfig.bearing) {
        state.map.setBearing(newConfig.bearing);
      }
      if (newConfig.pitch !== void 0 && newConfig.pitch !== oldConfig.pitch) {
        state.map.setPitch(newConfig.pitch);
      }
      if (newConfig.style !== oldConfig.style) {
        state.map.setStyle(newConfig.style);
      }
      state.config = newConfig;
    } catch (error) {
      console.error("[MaplibreX] Error updating map:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex;
    if (!state) return;
    try {
      const mapId = state.config.id;
      state.dispatcher.cleanup();
      if (state.map && typeof state.map.remove === "function") {
        state.map.remove();
      }
      MapManager.unregister(mapId);
      logger.debug(`[MaplibreX] Map "${mapId}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying map:", error);
    }
  },
  disconnected() {
    logger.debug("[MaplibreX] Map disconnected (temporary)");
  },
  reconnected() {
    const state = this._maplibrex;
    if (state && state.map) {
      state.map.resize();
      logger.debug("[MaplibreX] Map reconnected");
    }
  }
};

// js/maplibrex/hooks/marker-hook.ts
import * as maplibregl2 from "maplibre-gl";
var MarkerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on marker element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for marker "${config.id}"`);
        return;
      }
      const markerOptions = {
        color: config.color || "#3FB1CE",
        scale: config.scale || 1,
        rotation: config.rotation || 0,
        draggable: config.draggable || false,
        pitchAlignment: config.pitchAlignment || "auto",
        rotationAlignment: config.rotationAlignment || "auto"
      };
      if (config.anchor) {
        markerOptions.anchor = config.anchor;
      }
      if (config.offset) {
        markerOptions.offset = config.offset;
      }
      const marker = new maplibregl2.Marker(markerOptions).setLngLat(config.lngLat).addTo(map);
      let popup;
      if (config.popup) {
        popup = new maplibregl2.Popup({
          closeButton: config.popup.closeButton !== false,
          closeOnClick: config.popup.closeOnClick !== false,
          maxWidth: config.popup.maxWidth || "240px",
          offset: config.popup.offset
        });
        if (config.popup.text) {
          popup.setText(config.popup.text);
        } else if (config.popup.html) {
          popup.setHTML(config.popup.html);
        }
        marker.setPopup(popup);
      }
      if (config.draggable) {
        marker.on("dragstart", () => {
          this.pushEvent("marker:drag_start", {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });
        marker.on("drag", () => {
          this.pushEvent("marker:dragging", {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });
        marker.on("dragend", () => {
          this.pushEvent("marker:drag_end", {
            markerId: config.id,
            lngLat: marker.getLngLat().toArray()
          });
        });
      }
      marker.getElement().addEventListener("click", (e) => {
        e.stopPropagation();
        if (popup) {
          marker.togglePopup();
        }
        this.pushEvent("marker:clicked", {
          markerId: config.id,
          lngLat: marker.getLngLat().toArray()
        });
      });
      this._maplibrex_marker = {
        marker,
        config,
        popup
      };
      logger.debug(`[MaplibreX] Marker "${config.id}" created`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting marker:", error);
    }
  },
  updated() {
    const state = this._maplibrex_marker;
    if (!state) return;
    try {
      const el = this.el;
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const oldConfig = state.config;
      if (newConfig.lngLat[0] !== oldConfig.lngLat[0] || newConfig.lngLat[1] !== oldConfig.lngLat[1]) {
        state.marker.setLngLat(newConfig.lngLat);
      }
      if (newConfig.rotation !== void 0 && newConfig.rotation !== oldConfig.rotation) {
        state.marker.setRotation(newConfig.rotation);
      }
      if (newConfig.draggable !== oldConfig.draggable) {
        state.marker.setDraggable(newConfig.draggable || false);
      }
      if (newConfig.popup && state.popup) {
        if (newConfig.popup.text && newConfig.popup.text !== oldConfig.popup?.text) {
          state.popup.setText(newConfig.popup.text);
        } else if (newConfig.popup.html && newConfig.popup.html !== oldConfig.popup?.html) {
          state.popup.setHTML(newConfig.popup.html);
        }
      }
      state.config = newConfig;
    } catch (error) {
      console.error("[MaplibreX] Error updating marker:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_marker;
    if (!state) return;
    try {
      state.marker.remove();
      logger.debug(`[MaplibreX] Marker "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying marker:", error);
    }
  }
};

// js/maplibrex/hooks/popup-hook.ts
import * as maplibregl3 from "maplibre-gl";
var PopupHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on popup element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for popup "${config.id}"`);
        return;
      }
      const contentElement = el.querySelector("[data-popup-content]");
      if (!contentElement) {
        console.error(`[MaplibreX] No content element found for popup "${config.id}"`);
        return;
      }
      const popupOptions = {
        closeButton: config.closeButton !== false,
        closeOnClick: config.closeOnClick !== false,
        closeOnMove: config.closeOnMove || false,
        maxWidth: config.maxWidth || "240px",
        anchor: config.anchor || "auto"
      };
      if (config.offset !== void 0) {
        popupOptions.offset = config.offset;
      }
      if (config.className) {
        popupOptions.className = config.className;
      }
      const popup = new maplibregl3.Popup(popupOptions);
      const htmlContent = contentElement.innerHTML;
      popup.setHTML(htmlContent);
      if (config.lngLat && config.open !== false) {
        popup.setLngLat(config.lngLat).addTo(map);
      } else if (config.lngLat) {
        popup.setLngLat(config.lngLat);
      }
      popup.on("open", () => {
        this.pushEvent("popup:opened", {
          popupId: config.id,
          lngLat: popup.getLngLat()?.toArray()
        });
      });
      popup.on("close", () => {
        this.pushEvent("popup:closed", {
          popupId: config.id
        });
      });
      this.handleEvent("popup:open", (payload) => {
        if (payload.popup_id === config.id) {
          if (payload.lng_lat) {
            popup.setLngLat(payload.lng_lat);
          }
          if (!popup.isOpen()) {
            popup.addTo(map);
          }
        }
      });
      this.handleEvent("popup:close", (payload) => {
        if (payload.popup_id === config.id && popup.isOpen()) {
          popup.remove();
        }
      });
      this.handleEvent("popup:toggle", (payload) => {
        if (payload.popup_id === config.id) {
          if (popup.isOpen()) {
            popup.remove();
          } else {
            popup.addTo(map);
          }
        }
      });
      this.handleEvent("popup:set_location", (payload) => {
        if (payload.popup_id === config.id && payload.lng_lat) {
          popup.setLngLat(payload.lng_lat);
        }
      });
      this._maplibrex_popup = {
        popup,
        config,
        map,
        contentElement
      };
      logger.debug(`[MaplibreX] Popup "${config.id}" created`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting popup:", error);
    }
  },
  updated() {
    const state = this._maplibrex_popup;
    if (!state) return;
    try {
      const el = this.el;
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const oldConfig = state.config;
      const contentElement = el.querySelector("[data-popup-content]");
      if (contentElement) {
        const newContent = contentElement.innerHTML;
        const currentContent = state.popup.getElement()?.innerHTML;
        if (newContent !== currentContent) {
          state.popup.setHTML(newContent);
        }
      }
      if (newConfig.lngLat) {
        const oldLngLat = oldConfig.lngLat;
        if (!oldLngLat || newConfig.lngLat[0] !== oldLngLat[0] || newConfig.lngLat[1] !== oldLngLat[1]) {
          state.popup.setLngLat(newConfig.lngLat);
        }
      }
      const shouldBeOpen = newConfig.open !== false && newConfig.lngLat;
      const isCurrentlyOpen = state.popup.isOpen();
      if (shouldBeOpen && !isCurrentlyOpen) {
        state.popup.addTo(state.map);
      } else if (!shouldBeOpen && isCurrentlyOpen) {
        state.popup.remove();
      }
      if (newConfig.maxWidth !== oldConfig.maxWidth) {
        state.popup.setMaxWidth(newConfig.maxWidth || "240px");
      }
      state.config = newConfig;
    } catch (error) {
      console.error("[MaplibreX] Error updating popup:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_popup;
    if (!state) return;
    try {
      state.popup.remove();
      logger.debug(`[MaplibreX] Popup "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying popup:", error);
    }
  }
};

// js/maplibrex/hooks/geojson-layer-hook.ts
var GeoJSONLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on GeoJSON layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for layer "${config.id}"`);
        return;
      }
      const sourceId = `${config.id}-source`;
      const layerId = config.id;
      const addLayer = () => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, config.source);
        }
        if (!map.getLayer(layerId)) {
          const layerSpec = {
            ...config.layer,
            source: sourceId
          };
          if (config.beforeId) {
            map.addLayer(layerSpec, config.beforeId);
          } else {
            map.addLayer(layerSpec);
          }
        }
        map.on("click", layerId, (e) => {
          if (e.features && e.features.length > 0) {
            this.pushEvent("layer:feature_clicked", {
              layerId,
              feature: e.features[0],
              lngLat: e.lngLat.toArray(),
              point: [e.point.x, e.point.y]
            });
          }
        });
        map.on("mouseenter", layerId, (e) => {
          map.getCanvas().style.cursor = "pointer";
          if (e.features && e.features.length > 0) {
            this.pushEvent("layer:feature_mouseenter", {
              layerId,
              feature: e.features[0]
            });
          }
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          this.pushEvent("layer:feature_mouseleave", {
            layerId
          });
        });
        const source = map.getSource(sourceId);
        if (source) {
          map.once("sourcedata", (e) => {
            if (e.sourceId === sourceId && e.isSourceLoaded) {
              this.pushEvent("layer:source_loaded", {
                layerId,
                sourceId
              });
            }
          });
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
      this.handleEvent("layer:set_paint_property", (payload) => {
        if (payload.layer_id === layerId) {
          map.setPaintProperty(layerId, payload.property, payload.value);
        }
      });
      this.handleEvent("layer:set_layout_property", (payload) => {
        if (payload.layer_id === layerId) {
          map.setLayoutProperty(layerId, payload.property, payload.value);
        }
      });
      this.handleEvent("layer:set_filter", (payload) => {
        if (payload.layer_id === layerId) {
          map.setFilter(layerId, payload.filter);
        }
      });
      this.handleEvent("layer:set_data", (payload) => {
        if (payload.layer_id === layerId) {
          const source = map.getSource(sourceId);
          if (source) {
            source.setData(payload.data);
          }
        }
      });
      this._maplibrex_geojson_layer = {
        config,
        map,
        sourceId,
        layerId
      };
      logger.debug(`[MaplibreX] GeoJSON Layer "${layerId}" created`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting GeoJSON layer:", error);
    }
  },
  updated() {
    const state = this._maplibrex_geojson_layer;
    if (!state) return;
    try {
      const el = this.el;
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const source = state.map.getSource(state.sourceId);
      if (source && newConfig.source.data) {
        const oldData = JSON.stringify(state.config.source.data);
        const newData = JSON.stringify(newConfig.source.data);
        if (oldData !== newData) {
          source.setData(newConfig.source.data);
        }
      }
      if (newConfig.layer.paint) {
        Object.entries(newConfig.layer.paint).forEach(([key, value]) => {
          const oldValue = state.config.layer.paint?.[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            state.map.setPaintProperty(state.layerId, key, value);
          }
        });
      }
      if (newConfig.layer.layout) {
        Object.entries(newConfig.layer.layout).forEach(([key, value]) => {
          const oldValue = state.config.layer.layout?.[key];
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            state.map.setLayoutProperty(state.layerId, key, value);
          }
        });
      }
      if (JSON.stringify(newConfig.layer.filter) !== JSON.stringify(state.config.layer.filter)) {
        state.map.setFilter(state.layerId, newConfig.layer.filter || null);
      }
      state.config = newConfig;
    } catch (error) {
      console.error("[MaplibreX] Error updating GeoJSON layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_geojson_layer;
    if (!state) return;
    try {
      if (state.map.getLayer(state.layerId)) {
        state.map.removeLayer(state.layerId);
      }
      if (state.map.getSource(state.sourceId)) {
        state.map.removeSource(state.sourceId);
      }
      logger.debug(`[MaplibreX] GeoJSON Layer "${state.layerId}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying GeoJSON layer:", error);
    }
  }
};

// js/maplibrex/hooks/navigation-control-hook.ts
import * as maplibregl4 from "maplibre-gl";
var NavigationControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on navigation control element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for navigation control "${config.id}"`);
        return;
      }
      const controlOptions = {
        showCompass: config.showCompass !== false,
        showZoom: config.showZoom !== false,
        visualizePitch: config.visualizePitch || false
      };
      const control = new maplibregl4.NavigationControl(controlOptions);
      const position = config.position || "top-right";
      map.addControl(control, position);
      this._maplibrex_navigation_control = {
        config,
        map,
        control
      };
      logger.debug(`[MaplibreX] Navigation Control "${config.id}" added at ${position}`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting navigation control:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_navigation_control;
    if (!state) return;
    try {
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Navigation Control "${state.config.id}" removed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying navigation control:", error);
    }
  }
};

// js/maplibrex/hooks/scale-control-hook.ts
import * as maplibregl5 from "maplibre-gl";
var ScaleControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on scale control element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for scale control "${config.id}"`);
        return;
      }
      const controlOptions = {
        maxWidth: config.maxWidth || 100,
        unit: config.unit || "metric"
      };
      const control = new maplibregl5.ScaleControl(controlOptions);
      const position = config.position || "bottom-left";
      map.addControl(control, position);
      this._maplibrex_scale_control = {
        config,
        map,
        control
      };
      logger.debug(`[MaplibreX] Scale Control "${config.id}" added at ${position} (${config.unit})`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting scale control:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_scale_control;
    if (!state) return;
    try {
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Scale Control "${state.config.id}" removed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying scale control:", error);
    }
  }
};

// js/maplibrex/hooks/fullscreen-control-hook.ts
import * as maplibregl6 from "maplibre-gl";
var FullscreenControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on fullscreen control element");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId || "default");
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for fullscreen control "${config.id}"`);
        return;
      }
      let containerElement = void 0;
      if (config.containerSelector) {
        const containerEl = document.getElementById(config.containerSelector);
        if (containerEl) {
          containerElement = containerEl;
        } else {
          console.warn(`[MaplibreX] Container "${config.containerSelector}" not found, using map container`);
        }
      }
      const controlOptions = containerElement ? { container: containerElement } : {};
      const control = new maplibregl6.FullscreenControl(controlOptions);
      const position = config.position || "top-right";
      map.addControl(control, position);
      control.on("fullscreenstart", () => {
        this.pushEvent("fullscreen:entered", {
          controlId: config.id,
          mapId: config.mapId
        });
      });
      control.on("fullscreenend", () => {
        this.pushEvent("fullscreen:exited", {
          controlId: config.id,
          mapId: config.mapId
        });
      });
      this._maplibrex_fullscreen_control = {
        config,
        map,
        control
      };
      logger.debug(`[MaplibreX] Fullscreen Control "${config.id}" added at ${position}`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting fullscreen control:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_fullscreen_control;
    if (!state) return;
    try {
      state.map.removeControl(state.control);
      logger.debug(`[MaplibreX] Fullscreen Control "${state.config.id}" removed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying fullscreen control:", error);
    }
  }
};

// js/maplibrex/hooks/geolocate-control-hook.ts
import * as maplibregl7 from "maplibre-gl";
var GeolocateControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on geolocate control element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for geolocate control "${config.id}"`);
        return;
      }
      const control = new maplibregl7.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: config.trackUserLocation,
        showAccuracyCircle: config.showAccuracyCircle,
        showUserLocation: config.showUserHeading,
        // MapLibre uses showUserLocation instead
        fitBoundsOptions: config.fitBoundsOptions
      });
      map.addControl(control, config.position);
      control.on("geolocate", (e) => {
        const coords = {
          latitude: e.coords.latitude,
          longitude: e.coords.longitude,
          accuracy: e.coords.accuracy,
          altitude: e.coords.altitude,
          altitudeAccuracy: e.coords.altitudeAccuracy,
          heading: e.coords.heading,
          speed: e.coords.speed,
          timestamp: e.timestamp
        };
        this.pushEvent("geolocate:location_found", { coords });
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Location found`, coords);
      });
      control.on("trackuserlocationstart", () => {
        this.pushEvent("geolocate:tracking_started", {});
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Tracking started`);
      });
      control.on("trackuserlocationend", () => {
        this.pushEvent("geolocate:tracking_stopped", {});
        logger.debug(`[MaplibreX] Geolocate control "${config.id}": Tracking stopped`);
      });
      control.on("error", (e) => {
        const error = {
          code: e.code,
          message: e.message
        };
        this.pushEvent("geolocate:location_error", error);
        console.error(`[MaplibreX] Geolocate control "${config.id}": Error`, error);
      });
      map.on("moveend", () => {
        if (control._watchState === "ACTIVE_LOCK") {
          const center = map.getCenter();
          const coords = {
            latitude: center.lat,
            longitude: center.lng
          };
          this.pushEvent("geolocate:user_location_updated", { coords });
        }
      });
      this._maplibrex_geolocate = {
        control,
        config
      };
      logger.debug(`[MaplibreX] Geolocate control "${config.id}" mounted on map "${mapId}"`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting geolocate control:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_geolocate;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        map.removeControl(state.control);
      }
      logger.debug(`[MaplibreX] Geolocate control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying geolocate control:", error);
    }
  }
};

// js/maplibrex/hooks/attribution-control-hook.ts
import * as maplibregl8 from "maplibre-gl";
var AttributionControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on attribution control element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for attribution control "${config.id}"`);
        return;
      }
      const controlOptions = {
        compact: config.compact
      };
      if (config.customAttribution) {
        controlOptions.customAttribution = config.customAttribution;
      }
      const control = new maplibregl8.AttributionControl(controlOptions);
      map.addControl(control, config.position);
      this._maplibrex_attribution = {
        control,
        config
      };
      logger.debug(`[MaplibreX] Attribution control "${config.id}" mounted on map "${mapId}"`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting attribution control:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_attribution;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        map.removeControl(state.control);
      }
      logger.debug(`[MaplibreX] Attribution control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying attribution control:", error);
    }
  }
};

// js/maplibrex/hooks/circle-layer-hook.ts
var CircleLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on circle layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for circle layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for circle layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "circle",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          const clickHandler = (e) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent("layer:feature_clicked", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseenterHandler = (e) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = "pointer";
              this.pushEvent("layer:feature_mouseenter", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = "";
            this.pushEvent("layer:feature_mouseleave", {
              layer_id: config.id
            });
          };
          map.on("click", config.id, clickHandler);
          map.on("mouseenter", config.id, mouseenterHandler);
          map.on("mouseleave", config.id, mouseleaveHandler);
          this._maplibrex_circle_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Circle layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding circle layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting circle layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_circle_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.clickHandler) {
          map.off("click", state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off("mouseenter", state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off("mouseleave", state.config.id, state.mouseleaveHandler);
        }
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Circle layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying circle layer:", error);
    }
  }
};

// js/maplibrex/hooks/line-layer-hook.ts
var LineLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on line layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for line layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for line layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "line",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          const clickHandler = (e) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent("layer:feature_clicked", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseenterHandler = (e) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = "pointer";
              this.pushEvent("layer:feature_mouseenter", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = "";
            this.pushEvent("layer:feature_mouseleave", {
              layer_id: config.id
            });
          };
          map.on("click", config.id, clickHandler);
          map.on("mouseenter", config.id, mouseenterHandler);
          map.on("mouseleave", config.id, mouseleaveHandler);
          this._maplibrex_line_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Line layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding line layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting line layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_line_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.clickHandler) {
          map.off("click", state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off("mouseenter", state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off("mouseleave", state.config.id, state.mouseleaveHandler);
        }
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Line layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying line layer:", error);
    }
  }
};

// js/maplibrex/hooks/fill-layer-hook.ts
var FillLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on fill layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for fill layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for fill layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "fill",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          const clickHandler = (e) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent("layer:feature_clicked", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseenterHandler = (e) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = "pointer";
              this.pushEvent("layer:feature_mouseenter", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = "";
            this.pushEvent("layer:feature_mouseleave", {
              layer_id: config.id
            });
          };
          map.on("click", config.id, clickHandler);
          map.on("mouseenter", config.id, mouseenterHandler);
          map.on("mouseleave", config.id, mouseleaveHandler);
          this._maplibrex_fill_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Fill layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding fill layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting fill layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_fill_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.clickHandler) {
          map.off("click", state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off("mouseenter", state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off("mouseleave", state.config.id, state.mouseleaveHandler);
        }
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Fill layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying fill layer:", error);
    }
  }
};

// js/maplibrex/hooks/symbol-layer-hook.ts
var SymbolLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on symbol layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for symbol layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for symbol layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "symbol",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          const clickHandler = (e) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent("layer:feature_clicked", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseenterHandler = (e) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = "pointer";
              this.pushEvent("layer:feature_mouseenter", {
                layer_id: config.id,
                feature: e.features[0]
              });
            }
          };
          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = "";
            this.pushEvent("layer:feature_mouseleave", {
              layer_id: config.id
            });
          };
          map.on("click", config.id, clickHandler);
          map.on("mouseenter", config.id, mouseenterHandler);
          map.on("mouseleave", config.id, mouseleaveHandler);
          this._maplibrex_symbol_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Symbol layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding symbol layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting symbol layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_symbol_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.clickHandler) {
          map.off("click", state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off("mouseenter", state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off("mouseleave", state.config.id, state.mouseleaveHandler);
        }
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Symbol layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying symbol layer:", error);
    }
  }
};

// js/maplibrex/hooks/heatmap-layer-hook.ts
var HeatmapLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on heatmap layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for heatmap layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for heatmap layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "heatmap",
            source: config.sourceId,
            paint: config.paint || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          this._maplibrex_heatmap_layer = {
            config
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Heatmap layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding heatmap layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting heatmap layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_heatmap_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Heatmap layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying heatmap layer:", error);
    }
  }
};

// js/maplibrex/hooks/fill-extrusion-layer-hook.ts
var FillExtrusionLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on fill extrusion layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for fill extrusion layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for fill extrusion layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "fill-extrusion",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.filter) {
            layerSpec.filter = config.filter;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          const clickHandler = (e) => {
            if (e.features && e.features.length > 0) {
              this.pushEvent("layer:feature_clicked", {
                layer_id: config.id,
                features: e.features,
                lngLat: e.lngLat
              });
            }
          };
          const mouseenterHandler = (e) => {
            if (e.features && e.features.length > 0) {
              map.getCanvas().style.cursor = "pointer";
              this.pushEvent("layer:feature_mouseenter", {
                layer_id: config.id,
                features: e.features,
                lngLat: e.lngLat
              });
            }
          };
          const mouseleaveHandler = () => {
            map.getCanvas().style.cursor = "";
            this.pushEvent("layer:feature_mouseleave", {
              layer_id: config.id
            });
          };
          map.on("click", config.id, clickHandler);
          map.on("mouseenter", config.id, mouseenterHandler);
          map.on("mouseleave", config.id, mouseleaveHandler);
          this._maplibrex_fill_extrusion_layer = {
            config,
            clickHandler,
            mouseenterHandler,
            mouseleaveHandler
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Fill extrusion layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding fill extrusion layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting fill extrusion layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_fill_extrusion_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.clickHandler) {
          map.off("click", state.config.id, state.clickHandler);
        }
        if (state.mouseenterHandler) {
          map.off("mouseenter", state.config.id, state.mouseenterHandler);
        }
        if (state.mouseleaveHandler) {
          map.off("mouseleave", state.config.id, state.mouseleaveHandler);
        }
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Fill extrusion layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying fill extrusion layer:", error);
    }
  }
};

// js/maplibrex/hooks/background-layer-hook.ts
var BackgroundLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on background layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for background layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          const layerSpec = {
            id: config.id,
            type: "background",
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          this._maplibrex_background_layer = {
            config
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Background layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding background layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting background layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_background_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Background layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying background layer:", error);
    }
  }
};

// js/maplibrex/hooks/hillshade-layer-hook.ts
var HillshadeLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on hillshade layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for hillshade layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for hillshade layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "hillshade",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.sourceLayer) {
            layerSpec["source-layer"] = config.sourceLayer;
          }
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          this._maplibrex_hillshade_layer = {
            config
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Hillshade layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding hillshade layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting hillshade layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_hillshade_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Hillshade layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying hillshade layer:", error);
    }
  }
};

// js/maplibrex/hooks/raster-layer-hook.ts
var RasterLayerHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on raster layer element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster layer "${config.id}"`);
        return;
      }
      const addLayer = () => {
        try {
          if (!map.getSource(config.sourceId)) {
            console.warn(`[MaplibreX] Source "${config.sourceId}" not found for raster layer "${config.id}". Layer will be added when source is available.`);
            return;
          }
          const layerSpec = {
            id: config.id,
            type: "raster",
            source: config.sourceId,
            paint: config.paint || {},
            layout: config.layout || {}
          };
          if (config.minZoom !== void 0) {
            layerSpec.minzoom = config.minZoom;
          }
          if (config.maxZoom !== void 0) {
            layerSpec.maxzoom = config.maxZoom;
          }
          map.addLayer(layerSpec, config.beforeId);
          this._maplibrex_raster_layer = {
            config
          };
          this.pushEvent("layer:added", { layer_id: config.id });
          logger.debug(`[MaplibreX] Raster layer "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding raster layer "${config.id}":`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addLayer();
      } else {
        map.once("load", addLayer);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting raster layer:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_raster_layer;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getLayer(state.config.id)) {
          map.removeLayer(state.config.id);
        }
        this.pushEvent("layer:removed", { layer_id: state.config.id });
      }
      logger.debug(`[MaplibreX] Raster layer "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying raster layer:", error);
    }
  }
};

// js/maplibrex/hooks/vector-tile-source-hook.ts
var VectorTileSourceHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on vector tile source element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for vector tile source "${config.id}"`);
        return;
      }
      const addSource = () => {
        try {
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }
          const sourceSpec = {
            type: "vector"
          };
          if (config.url) {
            sourceSpec.url = config.url;
          }
          if (config.tiles) {
            sourceSpec.tiles = config.tiles;
          }
          if (config.minzoom !== void 0) {
            sourceSpec.minzoom = config.minzoom;
          }
          if (config.maxzoom !== void 0) {
            sourceSpec.maxzoom = config.maxzoom;
          }
          if (config.attribution) {
            sourceSpec.attribution = config.attribution;
          }
          if (config.bounds) {
            sourceSpec.bounds = config.bounds;
          }
          if (config.scheme) {
            sourceSpec.scheme = config.scheme;
          }
          if (config.promoteId) {
            sourceSpec.promoteId = config.promoteId;
          }
          if (config.volatile !== void 0) {
            sourceSpec.volatile = config.volatile;
          }
          map.addSource(config.id, sourceSpec);
          const dataHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:data", {
                source_id: config.id,
                data_type: e.dataType,
                source_data_type: e.sourceDataType,
                tile: e.tile ? {
                  coord: e.tile.tileID.canonical,
                  isSourceLoaded: e.isSourceLoaded
                } : void 0
              });
            }
          };
          const errorHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:error", {
                source_id: config.id,
                error: e.error ? e.error.message : "Unknown error",
                tile: e.tile
              });
            }
          };
          map.on("sourcedata", dataHandler);
          map.on("sourcedataloading", dataHandler);
          map.on("error", errorHandler);
          this._maplibrex_vector_tile_source = {
            config,
            dataHandler,
            errorHandler
          };
          this.pushEvent("source:added", { source_id: config.id });
          logger.debug(`[MaplibreX] Vector tile source "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding vector tile source "${config.id}":`, error);
          this.pushEvent("source:error", {
            source_id: config.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        map.once("load", addSource);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting vector tile source:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_vector_tile_source;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.dataHandler) {
          map.off("sourcedata", state.dataHandler);
          map.off("sourcedataloading", state.dataHandler);
        }
        if (state.errorHandler) {
          map.off("error", state.errorHandler);
        }
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent("source:removed", { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }
      logger.debug(`[MaplibreX] Vector tile source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying vector tile source:", error);
    }
  }
};

// js/maplibrex/hooks/raster-tile-source-hook.ts
var RasterTileSourceHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on raster tile source element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster tile source "${config.id}"`);
        return;
      }
      const addSource = () => {
        try {
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }
          const sourceSpec = {
            type: "raster"
          };
          if (config.url) {
            sourceSpec.url = config.url;
          }
          if (config.tiles) {
            sourceSpec.tiles = config.tiles;
          }
          if (config.tileSize !== void 0) {
            sourceSpec.tileSize = config.tileSize;
          }
          if (config.minzoom !== void 0) {
            sourceSpec.minzoom = config.minzoom;
          }
          if (config.maxzoom !== void 0) {
            sourceSpec.maxzoom = config.maxzoom;
          }
          if (config.attribution) {
            sourceSpec.attribution = config.attribution;
          }
          if (config.bounds) {
            sourceSpec.bounds = config.bounds;
          }
          if (config.scheme) {
            sourceSpec.scheme = config.scheme;
          }
          if (config.tms !== void 0) {
            sourceSpec.tms = config.tms;
          }
          if (config.volatile !== void 0) {
            sourceSpec.volatile = config.volatile;
          }
          map.addSource(config.id, sourceSpec);
          const dataHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:data", {
                source_id: config.id,
                data_type: e.dataType,
                source_data_type: e.sourceDataType,
                tile: e.tile ? {
                  coord: e.tile.tileID.canonical,
                  isSourceLoaded: e.isSourceLoaded
                } : void 0
              });
            }
          };
          const errorHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:error", {
                source_id: config.id,
                error: e.error ? e.error.message : "Unknown error",
                tile: e.tile
              });
            }
          };
          map.on("sourcedata", dataHandler);
          map.on("sourcedataloading", dataHandler);
          map.on("error", errorHandler);
          this._maplibrex_raster_tile_source = {
            config,
            dataHandler,
            errorHandler
          };
          this.pushEvent("source:added", { source_id: config.id });
          logger.debug(`[MaplibreX] Raster tile source "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding raster tile source "${config.id}":`, error);
          this.pushEvent("source:error", {
            source_id: config.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        map.once("load", addSource);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting raster tile source:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_raster_tile_source;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.dataHandler) {
          map.off("sourcedata", state.dataHandler);
          map.off("sourcedataloading", state.dataHandler);
        }
        if (state.errorHandler) {
          map.off("error", state.errorHandler);
        }
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent("source:removed", { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }
      logger.debug(`[MaplibreX] Raster tile source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying raster tile source:", error);
    }
  }
};

// js/maplibrex/hooks/image-source-hook.ts
var ImageSourceHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on image source element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for image source "${config.id}"`);
        return;
      }
      const addSource = () => {
        try {
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }
          const sourceSpec = {
            type: "image",
            url: config.url,
            coordinates: config.coordinates
          };
          map.addSource(config.id, sourceSpec);
          this._maplibrex_image_source = {
            config
          };
          const source = map.getSource(config.id);
          if (source && source.onAdd) {
            this.pushEvent("source:added", { source_id: config.id });
          }
          logger.debug(`[MaplibreX] Image source "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding image source "${config.id}":`, error);
          this.pushEvent("source:error", {
            source_id: config.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        map.once("load", addSource);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting image source:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_image_source;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent("source:removed", { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }
      logger.debug(`[MaplibreX] Image source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying image source:", error);
    }
  }
};

// js/maplibrex/hooks/raster-dem-source-hook.ts
var RasterDEMSourceHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on raster DEM source element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for raster DEM source "${config.id}"`);
        return;
      }
      const addSource = () => {
        try {
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }
          const sourceSpec = {
            type: "raster-dem"
          };
          if (config.url) {
            sourceSpec.url = config.url;
          }
          if (config.tiles) {
            sourceSpec.tiles = config.tiles;
          }
          if (config.tileSize !== void 0) {
            sourceSpec.tileSize = config.tileSize;
          }
          if (config.minzoom !== void 0) {
            sourceSpec.minzoom = config.minzoom;
          }
          if (config.maxzoom !== void 0) {
            sourceSpec.maxzoom = config.maxzoom;
          }
          if (config.attribution) {
            sourceSpec.attribution = config.attribution;
          }
          if (config.bounds) {
            sourceSpec.bounds = config.bounds;
          }
          if (config.encoding) {
            sourceSpec.encoding = config.encoding;
          }
          if (config.volatile !== void 0) {
            sourceSpec.volatile = config.volatile;
          }
          map.addSource(config.id, sourceSpec);
          const dataHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:data", {
                source_id: config.id,
                data_type: e.dataType,
                source_data_type: e.sourceDataType,
                tile: e.tile ? {
                  coord: e.tile.tileID.canonical,
                  isSourceLoaded: e.isSourceLoaded
                } : void 0
              });
            }
          };
          const errorHandler = (e) => {
            if (e.sourceId === config.id) {
              this.pushEvent("source:error", {
                source_id: config.id,
                error: e.error ? e.error.message : "Unknown error",
                tile: e.tile
              });
            }
          };
          map.on("sourcedata", dataHandler);
          map.on("sourcedataloading", dataHandler);
          map.on("error", errorHandler);
          this._maplibrex_raster_dem_source = {
            config,
            dataHandler,
            errorHandler
          };
          this.pushEvent("source:added", { source_id: config.id });
          logger.debug(`[MaplibreX] Raster DEM source "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding raster DEM source "${config.id}":`, error);
          this.pushEvent("source:error", {
            source_id: config.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        map.once("load", addSource);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting raster DEM source:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_raster_dem_source;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (state.dataHandler) {
          map.off("sourcedata", state.dataHandler);
          map.off("sourcedataloading", state.dataHandler);
        }
        if (state.errorHandler) {
          map.off("error", state.errorHandler);
        }
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent("source:removed", { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }
      logger.debug(`[MaplibreX] Raster DEM source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying raster DEM source:", error);
    }
  }
};

// js/maplibrex/hooks/video-source-hook.ts
var VideoSourceHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on video source element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for video source "${config.id}"`);
        return;
      }
      const addSource = () => {
        try {
          if (map.getSource(config.id)) {
            console.warn(`[MaplibreX] Source "${config.id}" already exists on map "${mapId}"`);
            return;
          }
          const sourceSpec = {
            type: "video",
            urls: config.urls,
            coordinates: config.coordinates
          };
          map.addSource(config.id, sourceSpec);
          this._maplibrex_video_source = {
            config
          };
          this.pushEvent("source:added", { source_id: config.id });
          logger.debug(`[MaplibreX] Video source "${config.id}" mounted on map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding video source "${config.id}":`, error);
          this.pushEvent("source:error", {
            source_id: config.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        addSource();
      } else {
        map.once("load", addSource);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting video source:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_video_source;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        if (map.getSource(state.config.id)) {
          try {
            map.removeSource(state.config.id);
            this.pushEvent("source:removed", { source_id: state.config.id });
          } catch (e) {
            console.warn(`[MaplibreX] Could not remove source "${state.config.id}": ${e}`);
          }
        }
      }
      logger.debug(`[MaplibreX] Video source "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying video source:", error);
    }
  }
};

// js/maplibrex/hooks/terrain-hook.ts
var TerrainHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on terrain element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for terrain`);
        return;
      }
      const enableTerrain = () => {
        try {
          const source = map.getSource(config.sourceId);
          if (!source) {
            console.error(`[MaplibreX] Source "${config.sourceId}" not found for terrain`);
            this.pushEvent("terrain:error", {
              error: `Source "${config.sourceId}" not found`
            });
            return;
          }
          map.setTerrain({
            source: config.sourceId,
            exaggeration: config.exaggeration
          });
          this._maplibrex_terrain = {
            config
          };
          this.pushEvent("terrain:enabled", {
            source_id: config.sourceId,
            exaggeration: config.exaggeration
          });
          logger.debug(`[MaplibreX] Terrain enabled with source "${config.sourceId}" and exaggeration ${config.exaggeration}`);
        } catch (error) {
          console.error(`[MaplibreX] Error enabling terrain:`, error);
          this.pushEvent("terrain:error", {
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      };
      if (map.isStyleLoaded()) {
        enableTerrain();
      } else {
        map.once("load", enableTerrain);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting terrain:", error);
    }
  },
  updated() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const state = this._maplibrex_terrain;
      if (!state) return;
      if (newConfig.sourceId !== state.config.sourceId || newConfig.exaggeration !== state.config.exaggeration) {
        const map = MapManager.get(newConfig.mapId);
        if (map && map.isStyleLoaded()) {
          try {
            map.setTerrain({
              source: newConfig.sourceId,
              exaggeration: newConfig.exaggeration
            });
            state.config = newConfig;
            logger.debug(`[MaplibreX] Terrain updated: source="${newConfig.sourceId}", exaggeration=${newConfig.exaggeration}`);
          } catch (error) {
            console.error("[MaplibreX] Error updating terrain:", error);
          }
        }
      }
    } catch (error) {
      console.error("[MaplibreX] Error in terrain updated:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_terrain;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map) {
        try {
          map.setTerrain(null);
          this.pushEvent("terrain:disabled", {});
          logger.debug(`[MaplibreX] Terrain disabled`);
        } catch (e) {
          console.warn(`[MaplibreX] Could not disable terrain: ${e}`);
        }
      }
    } catch (error) {
      console.error("[MaplibreX] Error destroying terrain:", error);
    }
  }
};

// js/maplibrex/hooks/terrain-control-hook.ts
var TerrainControlHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on terrain control element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for terrain control "${config.id}"`);
        return;
      }
      class TerrainControl {
        _map;
        _container;
        _button;
        _enabled;
        _config;
        _pushEvent;
        constructor(config2, pushEvent) {
          this._enabled = config2.enabled;
          this._config = config2;
          this._pushEvent = pushEvent;
        }
        onAdd(map2) {
          this._map = map2;
          this._container = document.createElement("div");
          this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
          this._button = document.createElement("button");
          this._button.className = "maplibregl-ctrl-terrain";
          this._button.type = "button";
          this._button.title = this._enabled ? "Disable 3D Terrain" : "Enable 3D Terrain";
          this._button.setAttribute("aria-label", this._button.title);
          this._button.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M3 20l6-8 4 4 8-12v16H3z"/>
            </svg>
          `;
          this._updateButtonStyle();
          this._button.addEventListener("click", () => {
            this._enabled = !this._enabled;
            this._toggleTerrain();
            this._updateButtonStyle();
            this._button.title = this._enabled ? "Disable 3D Terrain" : "Enable 3D Terrain";
            this._button.setAttribute("aria-label", this._button.title);
            this._pushEvent("terrain_control:toggled", {
              enabled: this._enabled,
              source_id: this._config.terrainSourceId,
              exaggeration: this._config.exaggeration
            });
          });
          this._container.appendChild(this._button);
          if (this._enabled) {
            this._toggleTerrain();
          }
          return this._container;
        }
        onRemove() {
          if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
          }
          this._map = void 0;
        }
        _toggleTerrain() {
          if (!this._map) return;
          try {
            if (this._enabled) {
              this._map.setTerrain({
                source: this._config.terrainSourceId,
                exaggeration: this._config.exaggeration
              });
            } else {
              this._map.setTerrain(null);
            }
          } catch (error) {
            console.error("[MaplibreX] Error toggling terrain:", error);
            this._pushEvent("terrain_control:error", {
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
        _updateButtonStyle() {
          if (!this._button) return;
          if (this._enabled) {
            this._button.style.backgroundColor = "#4A90E2";
            this._button.style.color = "#ffffff";
          } else {
            this._button.style.backgroundColor = "";
            this._button.style.color = "";
          }
        }
        setEnabled(enabled) {
          if (this._enabled !== enabled) {
            this._enabled = enabled;
            this._toggleTerrain();
            this._updateButtonStyle();
            if (this._button) {
              this._button.title = this._enabled ? "Disable 3D Terrain" : "Enable 3D Terrain";
              this._button.setAttribute("aria-label", this._button.title);
            }
          }
        }
      }
      const control = new TerrainControl(config, this.pushEvent.bind(this));
      map.addControl(control, config.position);
      this._maplibrex_terrain_control = {
        config,
        control,
        enabled: config.enabled
      };
      logger.debug(`[MaplibreX] Terrain control "${config.id}" mounted on map "${mapId}" at position "${config.position}"`);
    } catch (error) {
      console.error("[MaplibreX] Error mounting terrain control:", error);
    }
  },
  updated() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const state = this._maplibrex_terrain_control;
      if (!state) return;
      if (newConfig.enabled !== state.enabled) {
        state.control.setEnabled(newConfig.enabled);
        state.enabled = newConfig.enabled;
        state.config = newConfig;
      }
    } catch (error) {
      console.error("[MaplibreX] Error in terrain control updated:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_terrain_control;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map && state.control) {
        try {
          map.removeControl(state.control);
        } catch (e) {
          console.warn(`[MaplibreX] Could not remove terrain control: ${e}`);
        }
      }
      logger.debug(`[MaplibreX] Terrain control "${state.config.id}" destroyed`);
    } catch (error) {
      console.error("[MaplibreX] Error destroying terrain control:", error);
    }
  }
};

// js/maplibrex/hooks/sky-hook.ts
var SkyHook = {
  mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config found on sky element");
        return;
      }
      const config = JSON.parse(configStr);
      const mapId = config.mapId;
      const map = MapManager.get(mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${mapId}" not found for sky`);
        return;
      }
      const addSky = () => {
        try {
          map.addLayer({
            id: "sky",
            type: "sky",
            paint: config.paint
          });
          this._maplibrex_sky = {
            config
          };
          this.pushEvent("sky:added", {});
          logger.debug(`[MaplibreX] Sky layer added to map "${mapId}"`);
        } catch (error) {
          console.error(`[MaplibreX] Error adding sky:`, error);
        }
      };
      if (map.isStyleLoaded()) {
        addSky();
      } else {
        map.once("load", addSky);
      }
    } catch (error) {
      console.error("[MaplibreX] Error mounting sky:", error);
    }
  },
  updated() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      const state = this._maplibrex_sky;
      if (!state) return;
      const map = MapManager.get(newConfig.mapId);
      if (map && map.getLayer("sky")) {
        try {
          for (const [key, value] of Object.entries(newConfig.paint)) {
            map.setPaintProperty("sky", key, value);
          }
          state.config = newConfig;
          logger.debug(`[MaplibreX] Sky layer updated`);
        } catch (error) {
          console.error("[MaplibreX] Error updating sky:", error);
        }
      }
    } catch (error) {
      console.error("[MaplibreX] Error in sky updated:", error);
    }
  },
  destroyed() {
    const state = this._maplibrex_sky;
    if (!state) return;
    try {
      const map = MapManager.get(state.config.mapId);
      if (map && map.getLayer("sky")) {
        try {
          map.removeLayer("sky");
          this.pushEvent("sky:removed", {});
          logger.debug(`[MaplibreX] Sky layer removed`);
        } catch (e) {
          console.warn(`[MaplibreX] Could not remove sky layer: ${e}`);
        }
      }
    } catch (error) {
      console.error("[MaplibreX] Error destroying sky:", error);
    }
  }
};

// js/maplibrex/utils/deckgl-lazy-loader.ts
import { getVersion } from "maplibre-gl";
var deckGLModules = null;
var loadingPromise = null;
function assertDeckGLSupported() {
  const version = getVersion();
  const major = Number.parseInt(version, 10);
  if (Number.isFinite(major) && major >= 6) {
    throw new Error(
      `deck.gl layers require maplibre-gl v5 \u2014 you are running v${version}. @deck.gl/mapbox reads the internal map.transform that maplibre-gl v6 removed. Either pin maplibre-gl to ^5.0.0, or drop <.deckgl_layer> from this page. Every other MaplibreX component works on v6.`
    );
  }
}
async function loadDeckGL() {
  if (deckGLModules) {
    return deckGLModules;
  }
  assertDeckGLSupported();
  if (loadingPromise) {
    return loadingPromise;
  }
  logger.debug("[MaplibreX] Lazy loading deck.gl modules...");
  loadingPromise = Promise.all([
    import("@deck.gl/core"),
    import("@deck.gl/layers"),
    import("@deck.gl/aggregation-layers"),
    import("@deck.gl/mapbox")
  ]).then(([core, layers, aggregation, mapbox]) => {
    const modules = {
      core,
      layers,
      aggregation,
      mapbox,
      Deck: core.Deck
    };
    deckGLModules = modules;
    loadingPromise = null;
    logger.debug("[MaplibreX] deck.gl modules loaded successfully");
    return modules;
  }).catch((error) => {
    loadingPromise = null;
    console.error(
      "[MaplibreX] Failed to load deck.gl. Install the optional peer dependencies: npm install @deck.gl/core @deck.gl/layers @deck.gl/aggregation-layers @deck.gl/mapbox",
      error
    );
    throw error;
  });
  return loadingPromise;
}
function requireDeckGL() {
  if (!deckGLModules) {
    throw new Error(
      "deck.gl has not been loaded yet. Await loadDeckGL() before using deck.gl layers."
    );
  }
  return deckGLModules;
}

// js/maplibrex/utils/deckgl-layer-factory.ts
var LAYER_PACKAGES = {
  layers: [
    "ScatterplotLayer",
    "ArcLayer",
    "LineLayer",
    "ColumnLayer",
    "PathLayer",
    "PolygonLayer",
    "GeoJsonLayer",
    "TextLayer",
    "IconLayer"
  ],
  aggregation: ["HexagonLayer", "GridLayer", "ScreenGridLayer", "HeatmapLayer", "ContourLayer"]
};
var SUPPORTED_LAYER_TYPES = [
  ...LAYER_PACKAGES.layers,
  ...LAYER_PACKAGES.aggregation
];
function layerConstructor(layerType) {
  const deck = requireDeckGL();
  const modules = LAYER_PACKAGES.aggregation.includes(layerType) ? deck.aggregation : deck.layers;
  return modules[layerType];
}
function createDeckLayer(config) {
  const LayerConstructor = layerConstructor(config.layerType);
  if (!LayerConstructor) {
    throw new Error(
      `Unknown deck.gl layer type: ${config.layerType}. Available types: ${SUPPORTED_LAYER_TYPES.join(", ")}`
    );
  }
  const processedProps = processAccessors(config.props);
  return new LayerConstructor({
    ...processedProps,
    id: config.id,
    data: config.data,
    updateTriggers: config.updateTriggers || {}
  });
}
function processAccessors(props) {
  const processed = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("get")) {
      processed[key] = createAccessor(value);
    } else {
      processed[key] = value;
    }
  }
  return processed;
}
function createAccessor(value) {
  if (typeof value === "function") {
    return value;
  }
  if (typeof value === "string") {
    return (d) => d[value];
  }
  if (Array.isArray(value) && value[0] === "get" && value.length === 2) {
    const propName = value[1];
    return (d) => d[propName];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value;
}

// js/maplibrex/utils/deckgl-manager.ts
var DeckGLLayerManager = class {
  map;
  hook;
  overlay = null;
  layers = /* @__PURE__ */ new Map();
  constructor(map, hook) {
    this.map = map;
    this.hook = hook;
    this.initializeOverlay();
  }
  /**
   * Initialise the deck.gl overlay on top of MapLibre
   */
  initializeOverlay() {
    logger.debug("[MaplibreX] Initializing DeckGL overlay");
    const { MapboxOverlay } = requireDeckGL().mapbox;
    this.overlay = new MapboxOverlay({
      interleaved: true,
      onClick: this.handleClick.bind(this),
      onHover: this.handleHover.bind(this),
      onDragStart: this.handleDragStart.bind(this),
      onDrag: this.handleDrag.bind(this),
      onDragEnd: this.handleDragEnd.bind(this)
    });
    this.map.addControl(this.overlay);
  }
  /**
   * Add a layer to the overlay
   */
  addLayer(config) {
    logger.debug(`[MaplibreX] Adding DeckGL layer: ${config.id}`);
    try {
      const layer = createDeckLayer(config);
      this.layers.set(config.id, layer);
      this.updateOverlay();
    } catch (error) {
      console.error(`[MaplibreX] Error adding DeckGL layer:`, error);
      throw error;
    }
  }
  /**
   * Update an existing layer
   */
  updateLayer(config) {
    logger.debug(`[MaplibreX] Updating DeckGL layer: ${config.id}`);
    try {
      const layer = createDeckLayer(config);
      this.layers.set(config.id, layer);
      this.updateOverlay();
    } catch (error) {
      console.error(`[MaplibreX] Error updating DeckGL layer:`, error);
      throw error;
    }
  }
  /**
   * Remove a layer from the overlay
   */
  removeLayer(layerId) {
    logger.debug(`[MaplibreX] Removing DeckGL layer: ${layerId}`);
    this.layers.delete(layerId);
    this.updateOverlay();
  }
  /**
   * Refresh the overlay with the current layers
   */
  updateOverlay() {
    if (!this.overlay) return;
    const layersArray = Array.from(this.layers.values());
    this.overlay.setProps({ layers: layersArray });
  }
  /**
   * Maneja eventos de click
   */
  handleClick(info) {
    if (info.object) {
      this.hook.pushEvent("deckgl:click", {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y,
        coordinate: info.coordinate
      });
    }
  }
  /**
   * Maneja eventos de hover
   */
  handleHover(info) {
    if (info.object) {
      this.hook.pushEvent("deckgl:hover", {
        layerId: info.layer?.id,
        object: info.object,
        x: info.x,
        y: info.y
      });
    }
  }
  /**
   * Maneja inicio de drag
   */
  handleDragStart(info) {
    if (info.object) {
      this.hook.pushEvent("deckgl:drag_start", {
        layerId: info.layer?.id,
        object: info.object
      });
    }
  }
  /**
   * Maneja evento de drag
   */
  handleDrag(info) {
    if (info.object) {
      this.hook.pushEvent("deckgl:drag", {
        layerId: info.layer?.id,
        object: info.object,
        coordinate: info.coordinate
      });
    }
  }
  /**
   * Maneja fin de drag
   */
  handleDragEnd(info) {
    this.hook.pushEvent("deckgl:drag_end", {
      layerId: info.layer?.id
    });
  }
  /**
   * Limpia recursos
   */
  destroy() {
    logger.debug("[MaplibreX] Destroying DeckGL manager");
    if (this.overlay) {
      this.map.removeControl(this.overlay);
      this.overlay = null;
    }
    this.layers.clear();
  }
};

// js/maplibrex/hooks/deckgl-layer-hook.ts
var DeckGlLayerHook = {
  async mounted() {
    const el = this.el;
    try {
      const configStr = el.dataset.config;
      if (!configStr) {
        console.error("[MaplibreX] No config for DeckGL layer");
        return;
      }
      const config = JSON.parse(configStr);
      const map = MapManager.get(config.mapId);
      if (!map) {
        console.error(`[MaplibreX] Map "${config.mapId}" not found for DeckGL layer`);
        return;
      }
      logger.debug(`[MaplibreX] Mounting DeckGL layer: ${config.id}`);
      await loadDeckGL();
      const deckglManager = new DeckGLLayerManager(map, this);
      deckglManager.addLayer(config);
      this._maplibrex_deckgl = {
        config,
        deckglManager
      };
      this.pushEvent("deckgl:layer_loaded", { layerId: config.id });
    } catch (error) {
      console.error("[MaplibreX] Error mounting DeckGL layer:", error);
      this.pushEvent("deckgl:error", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  updated() {
    const el = this.el;
    const state = this._maplibrex_deckgl;
    if (!state) return;
    try {
      const configStr = el.dataset.config;
      if (!configStr) return;
      const newConfig = JSON.parse(configStr);
      logger.debug(`[MaplibreX] Updating DeckGL layer: ${newConfig.id}`);
      state.deckglManager?.updateLayer(newConfig);
      state.config = newConfig;
    } catch (error) {
      console.error("[MaplibreX] Error updating DeckGL layer:", error);
      this.pushEvent("deckgl:error", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  destroyed() {
    const state = this._maplibrex_deckgl;
    if (!state) return;
    try {
      logger.debug(`[MaplibreX] Destroying DeckGL layer: ${state.config.id}`);
      state.deckglManager?.removeLayer(state.config.id);
      state.deckglManager?.destroy();
    } catch (error) {
      console.error("[MaplibreX] Error destroying DeckGL layer:", error);
    }
  }
};

// js/maplibrex/types/custom-webgl.ts
var CustomWebGLError = class extends Error {
  constructor(message, layerId, code) {
    super(message);
    this.layerId = layerId;
    this.code = code;
    this.name = "CustomWebGLError";
  }
};

// js/maplibrex/utils/custom-webgl-manager.ts
var CustomWebGLManager = class {
  programs = /* @__PURE__ */ new Map();
  buffers = /* @__PURE__ */ new Map();
  textures = /* @__PURE__ */ new Map();
  animationFrames = /* @__PURE__ */ new Map();
  frameCallbacks = /* @__PURE__ */ new Map();
  /**
   * Compile a WebGL shader from GLSL source
   */
  compileShader(gl, source, type, layerId) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new CustomWebGLError(
        "Failed to create shader",
        layerId,
        "SHADER_CREATE_FAILED"
      );
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new CustomWebGLError(
        `Shader compilation error: ${info}`,
        layerId,
        "SHADER_COMPILE_ERROR"
      );
    }
    return shader;
  }
  /**
   * Create and link a WebGL program from vertex and fragment shaders
   */
  createProgram(gl, vertexSource, fragmentSource, layerId) {
    const vertexShader = this.compileShader(gl, vertexSource, gl.VERTEX_SHADER, layerId);
    const fragmentShader = this.compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER, layerId);
    const program = gl.createProgram();
    if (!program) {
      throw new CustomWebGLError(
        "Failed to create program",
        layerId,
        "PROGRAM_CREATE_FAILED"
      );
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new CustomWebGLError(
        `Program link error: ${info}`,
        layerId,
        "PROGRAM_LINK_ERROR"
      );
    }
    return program;
  }
  /**
   * Get all attribute and uniform locations from a program
   */
  getLocations(gl, program) {
    const attributes = {};
    const uniforms = {};
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        attributes[info.name] = location;
      }
    }
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const location = gl.getUniformLocation(program, info.name);
        if (location) {
          uniforms[info.name] = location;
        }
      }
    }
    return { program, attributes, uniforms };
  }
  /**
   * Create a WebGL buffer and upload data
   */
  createBuffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create buffer");
    }
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, usage);
    gl.bindBuffer(target, null);
    return buffer;
  }
  /**
   * Create a data texture for large datasets
   */
  createDataTexture(gl, data, width, height, format = gl.RGBA, type = gl.FLOAT) {
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create texture");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const ext = gl.getExtension("OES_texture_float");
    if (!ext && type === gl.FLOAT) {
      console.warn("Float textures not supported, falling back to UNSIGNED_BYTE");
      type = gl.UNSIGNED_BYTE;
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      format,
      width,
      height,
      0,
      format,
      type,
      data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
  /**
   * Set uniform values in a shader program
   */
  setUniforms(gl, program, uniforms) {
    gl.useProgram(program.program);
    for (const [name, value] of Object.entries(uniforms)) {
      const location = program.uniforms[name];
      if (!location) continue;
      if (typeof value === "number") {
        gl.uniform1f(location, value);
      } else if (Array.isArray(value)) {
        switch (value.length) {
          case 2:
            gl.uniform2fv(location, value);
            break;
          case 3:
            gl.uniform3fv(location, value);
            break;
          case 4:
            gl.uniform4fv(location, value);
            break;
          case 16:
            gl.uniformMatrix4fv(location, false, value);
            break;
          default:
            console.warn(`Unsupported uniform array length: ${value.length}`);
        }
      }
    }
  }
  /**
   * Setup a render loop with FPS control
   */
  setupRenderLoop(layerId, renderFn, fps = 60) {
    this.stopRenderLoop(layerId);
    const interval = 1e3 / fps;
    let lastTime = performance.now();
    const animate = (currentTime) => {
      const frameId = requestAnimationFrame(animate);
      this.animationFrames.set(layerId, frameId);
      const delta = currentTime - lastTime;
      if (delta >= interval) {
        renderFn();
        lastTime = currentTime - delta % interval;
      }
    };
    animate(lastTime);
  }
  /**
   * Stop the render loop for a layer
   */
  stopRenderLoop(layerId) {
    const frameId = this.animationFrames.get(layerId);
    if (frameId !== void 0) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(layerId);
    }
  }
  /**
   * Store a shader program
   */
  storeProgram(layerId, program) {
    this.programs.set(layerId, program);
  }
  /**
   * Get a stored shader program
   */
  getProgram(layerId) {
    return this.programs.get(layerId);
  }
  /**
   * Store a buffer
   */
  storeBuffer(layerId, buffer) {
    this.buffers.set(layerId, buffer);
  }
  /**
   * Get a stored buffer
   */
  getBuffer(layerId) {
    return this.buffers.get(layerId);
  }
  /**
   * Store a texture
   */
  storeTexture(layerId, texture) {
    this.textures.set(layerId, texture);
  }
  /**
   * Get a stored texture
   */
  getTexture(layerId) {
    return this.textures.get(layerId);
  }
  /**
   * Clean up all resources for a layer
   */
  dispose(gl, layerId) {
    this.stopRenderLoop(layerId);
    const program = this.programs.get(layerId);
    if (program) {
      gl.deleteProgram(program.program);
      this.programs.delete(layerId);
    }
    const buffer = this.buffers.get(layerId);
    if (buffer) {
      gl.deleteBuffer(buffer);
      this.buffers.delete(layerId);
    }
    const texture = this.textures.get(layerId);
    if (texture) {
      gl.deleteTexture(texture);
      this.textures.delete(layerId);
    }
    this.frameCallbacks.delete(layerId);
  }
  /**
   * Dispose all resources
   */
  disposeAll(gl) {
    const layerIds = Array.from(this.programs.keys());
    layerIds.forEach((id) => this.dispose(gl, id));
  }
};
var customWebGLManager = new CustomWebGLManager();

// js/maplibrex/shaders/particle-system.ts
var PARTICLE_VERTEX_SHADER = `
attribute vec2 a_position;
uniform mat4 u_matrix;
uniform float u_point_size;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
  gl_PointSize = u_point_size;
}
`;
var PARTICLE_FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 u_color;
uniform float u_opacity;

void main() {
  // Create circular particles with smooth edges
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // Smooth fade at edges
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  gl_FragColor = vec4(u_color, alpha * u_opacity);
}
`;
var PARTICLE_SYSTEM_PRESETS = {
  ocean_currents: {
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    defaultUniforms: {
      u_color: [0.2, 0.6, 0.9],
      // Ocean blue
      u_opacity: 0.8,
      u_point_size: 3
    }
  },
  wind_flow: {
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    defaultUniforms: {
      u_color: [0.9, 0.9, 0.9],
      // White/gray
      u_opacity: 0.6,
      u_point_size: 2
    }
  }
};

// js/maplibrex/hooks/custom-layer-hook.ts
var CustomLayerHook = {
  mounted() {
    const config = JSON.parse(this.el.dataset.config || "{}");
    logger.debug("[CustomLayer] Mounted:", config.id, "with uniforms:", config.uniforms);
    this.handleEvent(`update_uniforms_${config.id}`, (payload) => {
      logger.debug("[CustomLayer] Received uniform update:", payload);
      if (payload.uniforms) {
        this.currentConfig = {
          ...this.currentConfig,
          uniforms: payload.uniforms
        };
        if (this.map) {
          this.map.triggerRepaint();
        }
      }
    });
    const map = MapManager.get(config.mapId);
    if (!map) {
      console.error("[CustomLayer] Map not found in MapManager:", config.mapId);
      return;
    }
    const customLayer = this.createCustomLayer(config);
    this.layerId = config.id;
    this.map = map;
    this.customLayer = customLayer;
    this.currentConfig = config;
    if (config.uniforms && "u_time" in config.uniforms) {
      this.startTime = performance.now() / 1e3;
      logger.debug("[CustomLayer] Animation enabled for", config.id);
      map.repaint = true;
    }
    map.on("load", () => {
      try {
        map.addLayer(customLayer, config.beforeId);
        logger.debug("[CustomLayer] Added to map:", config.id);
      } catch (error) {
        console.error("[CustomLayer] Error adding layer:", error);
      }
    });
    if (map.loaded()) {
      try {
        map.addLayer(customLayer, config.beforeId);
        logger.debug("[CustomLayer] Added to map (already loaded):", config.id);
      } catch (error) {
        console.error("[CustomLayer] Error adding layer:", error);
      }
    }
  },
  updated() {
    const config = JSON.parse(this.el.dataset.config || "{}");
    logger.debug("[CustomLayer] Updated with uniforms:", config.uniforms);
    this.currentConfig = config;
    if (this.map) {
      this.map.triggerRepaint();
    }
  },
  destroyed() {
    logger.debug("[CustomLayer] Destroyed:", this.layerId);
    this.destroyed = true;
    if (this.map && this.startTime !== void 0) {
      this.map.repaint = false;
    }
    if (this.map && this.layerId) {
      try {
        if (this.map.getLayer(this.layerId)) {
          this.map.removeLayer(this.layerId);
        }
      } catch (error) {
        console.error("[CustomLayer] Error removing layer:", error);
      }
    }
    if (this.gl) {
      customWebGLManager.dispose(this.gl, this.layerId);
    }
  },
  createCustomLayer(config) {
    const self = this;
    let gl;
    let shaderProgram;
    let buffer;
    let initialized = false;
    let vertexShader = config.vertexShader;
    let fragmentShader = config.fragmentShader;
    if (config.preset && PARTICLE_SYSTEM_PRESETS[config.preset]) {
      const preset = PARTICLE_SYSTEM_PRESETS[config.preset];
      vertexShader = vertexShader || preset.vertexShader;
      fragmentShader = fragmentShader || preset.fragmentShader;
    }
    if (!vertexShader || !fragmentShader) {
      throw new Error("Vertex and fragment shaders are required");
    }
    return {
      id: config.id,
      type: "custom",
      renderingMode: "3d",
      onAdd(_map, glContext) {
        gl = glContext;
        self.gl = gl;
        try {
          const program = customWebGLManager.createProgram(
            gl,
            vertexShader,
            fragmentShader,
            config.id
          );
          shaderProgram = customWebGLManager.getLocations(gl, program);
          customWebGLManager.storeProgram(config.id, shaderProgram);
          self.shaderProgram = shaderProgram;
          const particleCount = 1e3;
          const positions = new Float32Array(particleCount * 2);
          for (let i = 0; i < particleCount; i++) {
            const lng = Math.random() * 360 - 180;
            const lat = Math.random() * 170 - 85;
            const x = (lng + 180) / 360;
            const latRad = lat * Math.PI / 180;
            const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
            const y = (180 - mercatorY * 180 / Math.PI) / 360;
            positions[i * 2] = x;
            positions[i * 2 + 1] = y;
          }
          buffer = customWebGLManager.createBuffer(gl, positions);
          customWebGLManager.storeBuffer(config.id, buffer);
          initialized = true;
          logger.debug("[CustomLayer] WebGL initialized:", config.id);
        } catch (error) {
          console.error("[CustomLayer] Initialization error:", error);
        }
      },
      render(_glContext, matrixOrArgs) {
        if (!initialized || !shaderProgram) {
          return;
        }
        let matrix = null;
        if (matrixOrArgs instanceof Float32Array || Array.isArray(matrixOrArgs)) {
          matrix = matrixOrArgs;
        } else {
          matrix = matrixOrArgs?.defaultProjectionData?.mainMatrix ?? null;
        }
        if (!matrix || matrix.length !== 16) {
          return;
        }
        const gl2 = gl;
        const prevVAO = gl2.getParameter(gl2.VERTEX_ARRAY_BINDING);
        const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
        const prevBlend = gl.isEnabled(gl.BLEND);
        gl2.bindVertexArray(null);
        gl.useProgram(shaderProgram.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        if (shaderProgram.uniforms.u_matrix) {
          gl.uniformMatrix4fv(shaderProgram.uniforms.u_matrix, false, matrix);
        }
        let uniforms = self.currentConfig?.uniforms || config.uniforms || {};
        if (self.startTime !== void 0 && uniforms.u_time !== void 0) {
          const currentTime = performance.now() / 1e3 - self.startTime;
          uniforms = { ...uniforms, u_time: currentTime };
        }
        customWebGLManager.setUniforms(gl, shaderProgram, uniforms);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        if (shaderProgram.attributes.a_position !== void 0) {
          gl.enableVertexAttribArray(shaderProgram.attributes.a_position);
          gl.vertexAttribPointer(shaderProgram.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(gl.POINTS, 0, 1e3);
        gl.useProgram(prevProgram);
        if (!prevBlend) gl.disable(gl.BLEND);
        if (shaderProgram.attributes.a_position !== void 0) {
          gl.disableVertexAttribArray(shaderProgram.attributes.a_position);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl2.bindVertexArray(prevVAO);
      },
      onRemove() {
        if (gl) {
          customWebGLManager.dispose(gl, config.id);
        }
      }
    };
  }
};

// js/maplibrex.ts
var MapHooks = {
  MapHook,
  MarkerHook,
  PopupHook,
  GeoJSONLayerHook,
  NavigationControlHook,
  ScaleControlHook,
  FullscreenControlHook,
  GeolocateControlHook,
  AttributionControlHook,
  CircleLayerHook,
  LineLayerHook,
  FillLayerHook,
  SymbolLayerHook,
  HeatmapLayerHook,
  FillExtrusionLayerHook,
  BackgroundLayerHook,
  HillshadeLayerHook,
  RasterLayerHook,
  VectorTileSourceHook,
  RasterTileSourceHook,
  ImageSourceHook,
  RasterDEMSourceHook,
  VideoSourceHook,
  TerrainHook,
  TerrainControlHook,
  SkyHook,
  DeckGlLayerHook,
  CustomLayerHook
};
var maplibrex_default = MapHooks;
export {
  AttributionControlHook,
  BackgroundLayerHook,
  CircleLayerHook,
  CustomLayerHook,
  DeckGlLayerHook,
  EventDispatcher,
  FillExtrusionLayerHook,
  FillLayerHook,
  FullscreenControlHook,
  GeoJSONLayerHook,
  GeolocateControlHook,
  HeatmapLayerHook,
  HillshadeLayerHook,
  ImageSourceHook,
  LineLayerHook,
  MapHook,
  MapHooks,
  MapManager,
  MarkerHook,
  NavigationControlHook,
  PopupHook,
  RasterDEMSourceHook,
  RasterLayerHook,
  RasterTileSourceHook,
  ScaleControlHook,
  SkyHook,
  SymbolLayerHook,
  TerrainControlHook,
  TerrainHook,
  VectorTileSourceHook,
  VideoSourceHook,
  createEventDispatcher,
  maplibrex_default as default,
  requireMap,
  useMap
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9tYXAtaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2NvcmUvbG9nZ2VyLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvY29yZS9tYXAtbWFuYWdlci50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L3V0aWxzL2RlYm91bmNlLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvY29yZS9ldmVudC1kaXNwYXRjaGVyLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvbWFya2VyLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9wb3B1cC1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvZ2VvanNvbi1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvbmF2aWdhdGlvbi1jb250cm9sLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9zY2FsZS1jb250cm9sLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9mdWxsc2NyZWVuLWNvbnRyb2wtaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2dlb2xvY2F0ZS1jb250cm9sLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9hdHRyaWJ1dGlvbi1jb250cm9sLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9jaXJjbGUtbGF5ZXItaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2xpbmUtbGF5ZXItaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2ZpbGwtbGF5ZXItaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL3N5bWJvbC1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvaGVhdG1hcC1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvZmlsbC1leHRydXNpb24tbGF5ZXItaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2JhY2tncm91bmQtbGF5ZXItaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2hpbGxzaGFkZS1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvcmFzdGVyLWxheWVyLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy92ZWN0b3ItdGlsZS1zb3VyY2UtaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL3Jhc3Rlci10aWxlLXNvdXJjZS1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvaW1hZ2Utc291cmNlLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy9yYXN0ZXItZGVtLXNvdXJjZS1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvaG9va3MvdmlkZW8tc291cmNlLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy90ZXJyYWluLWhvb2sudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9ob29rcy90ZXJyYWluLWNvbnRyb2wtaG9vay50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL3NreS1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvdXRpbHMvZGVja2dsLWxhenktbG9hZGVyLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvdXRpbHMvZGVja2dsLWxheWVyLWZhY3RvcnkudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC91dGlscy9kZWNrZ2wtbWFuYWdlci50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2RlY2tnbC1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvdHlwZXMvY3VzdG9tLXdlYmdsLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgvdXRpbHMvY3VzdG9tLXdlYmdsLW1hbmFnZXIudHMiLCAiLi4vLi4vLi4vLi4vYXNzZXRzL2pzL21hcGxpYnJleC9zaGFkZXJzL3BhcnRpY2xlLXN5c3RlbS50cyIsICIuLi8uLi8uLi8uLi9hc3NldHMvanMvbWFwbGlicmV4L2hvb2tzL2N1c3RvbS1sYXllci1ob29rLnRzIiwgIi4uLy4uLy4uLy4uL2Fzc2V0cy9qcy9tYXBsaWJyZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogTWFwSG9vayAtIFByaW1hcnkgaG9vayBmb3IgdGhlIE1hcCBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIGlzIHRoZSBtYWluIGVudHJ5IHBvaW50IGZvciBpbnRlZ3JhdGluZyBNYXBMaWJyZSB3aXRoIExpdmVWaWV3LlxuICogSXQgbWFuYWdlcyB0aGUgZnVsbCBtYXAgbGlmZWN5Y2xlOiBjcmVhdGlvbiwgdXBkYXRlcyBhbmQgdGVhcmRvd24uXG4gKi9cblxuLy8gbWFwbGlicmUtZ2wgdjYgaXMgRVNNLW9ubHkgYW5kIG5vIGxvbmdlciBoYXMgYSBkZWZhdWx0IGV4cG9ydC5cbmltcG9ydCAqIGFzIG1hcGxpYnJlZ2wgZnJvbSAnbWFwbGlicmUtZ2wnO1xuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2ssIE1hcENvbmZpZyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcbmltcG9ydCB7IGNyZWF0ZUV2ZW50RGlzcGF0Y2hlciB9IGZyb20gJy4uL2NvcmUvZXZlbnQtZGlzcGF0Y2hlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIE1hcEhvb2tTdGF0ZSB7XG4gIG1hcDogbWFwbGlicmVnbC5NYXA7XG4gIGRpc3BhdGNoZXI6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUV2ZW50RGlzcGF0Y2hlcj47XG4gIGNvbmZpZzogTWFwQ29uZmlnO1xuICBjbGVhbnVwPzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IE1hcEhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gb2ZmIHRoZSBlbGVtZW50XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBtYXAgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogTWFwQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwSWQgPSBjb25maWcuaWQ7XG5cbiAgICAgIC8vIFRoaXMgSFRNTCBlbGVtZW50IGFjdHMgYXMgYSBjdXJ0YWluIHRvIGhpZGUgdGhlIG1hcCB1bnRpbFxuICAgICAgLy8gYWxsIHRpbGVzIGhhdmUgYmVlbiBsb2FkZWQgYW5kIHJlbmRlcmVkLiBCeSBoaWRpbmcgdGhlXG4gICAgICAvLyBub3QgdG90YWxseSByZW5kZXJlZCBtYXAsIHdlIGF2b2lkIHRoZSBkaXN0cmFjdGluZ1xuICAgICAgLy8gZmxpY2tlcmluZyBhcyB0aWxlcyBhcmUgcmVuZGVyZWQgYW5kIHBvc3NpYmx5IHJlLXJlbmRlcmVkXG4gICAgICAvLyBhdCBkaWZmZXJlbnQgbGV2ZWxzIG9mIGRldGFpbC5cbiAgICAgIGNvbnN0IGxvYWRlckVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmxvYWRlcklkKSE7XG5cbiAgICAgIC8vIFRoZSBtYXAgc3VwcG9ydHMgYW4gaW5pdGlhbCBgZmx5VG9gIGluIHRoZSBzdHlsZSBvZlxuICAgICAgLy8gdGhlIGFuaW1hdGlvbiBmb3IgdGhlIG9sZCBHb29nbGUgRWFydGggcHJvZ3JhbW1pbmcuXG4gICAgICAvLyBUaGlzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQgYnV0IGl0IGNhbiBiZSBlbmFibGVkXG4gICAgICAvLyB3aXRoIHRoZSBib29sZWFuIGBmbHlUb2AgY29uZmlnIG9wdGlvbi4gXG5cbiAgICAgIC8vIERvIHdlIGluY2x1ZGUgdGhlIGluaXRpYWwgYGZseVRvYCBvciBkbyB3ZSByZW5kZXIgdGhlIG1hcFx1MDBCNFxuICAgICAgLy8gY2VudGVyZWQgb24gdGhlIGNvcnJlY3QgcG9zaXRpb24gd2l0aG91dCB0aGUgYGZseVRvYD9cbiAgICAgIGNvbnN0IGZseTogYm9vbGVhbiA9IGNvbmZpZy5mbHk7XG5cbiAgICAgIC8vIEluaXRpYWwgZmxpZ2h0IHBhcmFtZXRlcnNcbiAgICAgIGNvbnN0IGZsaWdodER1cmF0aW9uOiBudW1iZXIgPSBjb25maWcuZmxpZ2h0RHVyYXRpb247XG4gICAgICBjb25zdCBmbGlnaHRTcGVlZDogbnVtYmVyID0gY29uZmlnLmZsaWdodFNwZWVkO1xuICAgICAgY29uc3QgZmxpZ2h0Q3VydmUgPSBjb25maWcuZmxpZ2h0Q3VydmU7XG5cbiAgICAgIC8vIFdoZXJlIGRvIHdlIGZseSB0bz8gKG9yIHdoZXJlIGRvIHdlIHN0YXJ0IGlmIHdlJ3JlIG5vdCBmbHlpbmcpXG4gICAgICBjb25zdCBmbHlUb0NlbnRlciA9IGNvbmZpZy5jZW50ZXI7XG4gICAgICBjb25zdCBmbHlUb1pvb20gPSBjb25maWcuem9vbTtcbiAgICAgIGNvbnN0IGZseVRvQmVhcmluZyA9IGNvbmZpZy5iZWFyaW5nIHx8IDA7XG4gICAgICBjb25zdCBmbHlUb1BpdGNoID0gY29uZmlnLnBpdGNoIHx8IDA7XG5cbiAgICAgIC8vIFdoZXJlIGRvIHdlIGZseSBmcm9tPyBUaGVzZSBwYXJhbWV0ZXJzIGFyZSBpZ25vcmVkXG4gICAgICAvLyBpZiB0aGUgYGZseVRvYCBvcHRpb24gaXMgZmFsc2UuXG4gICAgICBjb25zdCBmbHlGcm9tQ2VudGVyID0gY29uZmlnLmZseUZyb21DZW50ZXI7XG4gICAgICBjb25zdCBmbHlGcm9tWm9vbSA9IGNvbmZpZy5mbHlGcm9tWm9vbTtcbiAgICAgIGNvbnN0IGZseUZyb21CZWFyaW5nID0gY29uZmlnLmZseUZyb21CZWFyaW5nO1xuICAgICAgY29uc3QgZmx5RnJvbVBpdGNoID0gY29uZmlnLmZseUZyb21QaXRjaDtcblxuICAgICAgLy8gSWYgdGhlcmUgYSBgZmx5VG9gPyBJZiBub3QsIHRoZSBpbml0aWFsIHBhcmFtZXRlcnMgYXJlIHRoZSBvbmVzXG4gICAgICAvLyB3ZSB3b3VsZCBmbHkgdG8gaWYgdGhlIGBmbHlUb2Agb3B0aW9uIGV4aXN0ZWRcbiAgICAgIGNvbnN0IGludGlhbENlbnRlciA9IGZseSA/IGZseUZyb21DZW50ZXIgOiBmbHlUb0NlbnRlcjsgXG4gICAgICBjb25zdCBpbml0aWFsWm9vbSA9IGZseSA/IGZseUZyb21ab29tIDogZmx5VG9ab29tO1xuICAgICAgY29uc3QgaW5pdGlhbEJlYXJpbmcgPSBmbHkgPyBmbHlGcm9tQmVhcmluZyA6IGZseVRvQmVhcmluZztcbiAgICAgIGNvbnN0IGluaXRpYWxQaXRjaCA9IGZseSA/IGZseUZyb21QaXRjaCA6IGZseVRvUGl0Y2g7XG5cbiAgICAgIC8vIENyZWF0ZSB0aGUgbWFwIGluc3RhbmNlXG4gICAgICBjb25zdCBtYXAgPSBuZXcgbWFwbGlicmVnbC5NYXAoe1xuICAgICAgICBjb250YWluZXI6IGVsLFxuICAgICAgICAvLyBUaGUgaW5pdGlhbCBwb3NpdGlvbiAodGhlIGludGVycHJldGF0aW9uIGlzIGRpZmZlcmVudFxuICAgICAgICAvLyB3aGV0aGVyIHdlIGFyZSBmbHlpbmcgb3Igbm90LCBzZWUgYWJvdmUpXG4gICAgICAgIGNlbnRlcjogaW50aWFsQ2VudGVyLFxuICAgICAgICB6b29tOiBpbml0aWFsWm9vbSxcbiAgICAgICAgYmVhcmluZzogaW5pdGlhbEJlYXJpbmcsXG4gICAgICAgIHBpdGNoOiBpbml0aWFsUGl0Y2gsXG4gICAgICAgIC8vIE90aGVyIGNvbmZpZyBvcHRpb25zICh3aGljaCBkb24ndCBjaGFuZ2UgYmFzZWQgb24gdGhlIGluaXRpYWwgZmxpZ2h0KVxuICAgICAgICBzdHlsZTogY29uZmlnLnN0eWxlIGFzIGFueSxcbiAgICAgICAgbWluWm9vbTogY29uZmlnLm1pblpvb20sXG4gICAgICAgIG1heFpvb206IGNvbmZpZy5tYXhab29tLFxuICAgICAgICBtaW5QaXRjaDogY29uZmlnLm1pblBpdGNoLFxuICAgICAgICBtYXhQaXRjaDogY29uZmlnLm1heFBpdGNoLFxuICAgICAgICBib3VuZHM6IGNvbmZpZy5ib3VuZHMgYXMgYW55LFxuICAgICAgICBtYXhCb3VuZHM6IGNvbmZpZy5tYXhCb3VuZHMgYXMgYW55LFxuICAgICAgICBpbnRlcmFjdGl2ZTogY29uZmlnLmludGVyYWN0aXZlICE9PSBmYWxzZSxcbiAgICAgICAgYXR0cmlidXRpb25Db250cm9sOiBjb25maWcuYXR0cmlidXRpb25Db250cm9sICE9PSBmYWxzZSA/IHt9IGFzIGFueSA6IGZhbHNlXG4gICAgICB9KTtcblxuICAgICAgLy8gUmVnaXN0ZXIgdGhlIG1hcCB3aXRoIHRoZSBtYW5hZ2VyXG4gICAgICBNYXBNYW5hZ2VyLnJlZ2lzdGVyKG1hcElkLCBtYXApO1xuICAgICAgTWFwTWFuYWdlci5zZXREZWJ1Zyhjb25maWcuZGVidWcgfHwgZmFsc2UpO1xuXG4gICAgICAvLyBDcmVhdGUgdGhlIGV2ZW50IGRpc3BhdGNoZXJcbiAgICAgIGNvbnN0IGRpc3BhdGNoZXIgPSBjcmVhdGVFdmVudERpc3BhdGNoZXIodGhpcywgbWFwLCBtYXBJZCwgdHJ1ZSk7XG5cbiAgICAgIC8vIFN0YXNoIHN0YXRlIG9uIHRoZSBob29rXG4gICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXggPSB7XG4gICAgICAgIG1hcCxcbiAgICAgICAgZGlzcGF0Y2hlcixcbiAgICAgICAgY29uZmlnXG4gICAgICB9O1xuXG4gICAgICAvLyBMaXN0ZW4gZm9yIEpTIGNvbW1hbmQgZXZlbnRzXG4gICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdtYXBsaWJyZXg6Zmx5X3RvJywgKChlOiBDdXN0b21FdmVudCkgPT4ge1xuICAgICAgICBjb25zdCB7IGNlbnRlciwgem9vbSwgZHVyYXRpb24sIGJlYXJpbmcsIHBpdGNoIH0gPSBlLmRldGFpbDtcbiAgICAgICAgbWFwLmZseVRvKHtcbiAgICAgICAgICBjZW50ZXI6IGNlbnRlciBhcyBbbnVtYmVyLCBudW1iZXJdLFxuICAgICAgICAgIHpvb206IHpvb20sXG4gICAgICAgICAgZHVyYXRpb246IGR1cmF0aW9uIHx8IDEwMDAsXG4gICAgICAgICAgLi4uKGJlYXJpbmcgIT09IHVuZGVmaW5lZCAmJiB7IGJlYXJpbmcgfSksXG4gICAgICAgICAgLi4uKHBpdGNoICE9PSB1bmRlZmluZWQgJiYgeyBwaXRjaCB9KSxcbiAgICAgICAgICBlc3NlbnRpYWw6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9KSBhcyBFdmVudExpc3RlbmVyKTtcblxuICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbWFwbGlicmV4Omp1bXBfdG8nLCAoKGU6IEN1c3RvbUV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgY2VudGVyLCB6b29tLCBiZWFyaW5nLCBwaXRjaCB9ID0gZS5kZXRhaWw7XG4gICAgICAgIG1hcC5qdW1wVG8oe1xuICAgICAgICAgIGNlbnRlcjogY2VudGVyIGFzIFtudW1iZXIsIG51bWJlcl0sXG4gICAgICAgICAgem9vbTogem9vbSxcbiAgICAgICAgICAuLi4oYmVhcmluZyAhPT0gdW5kZWZpbmVkICYmIHsgYmVhcmluZyB9KSxcbiAgICAgICAgICAuLi4ocGl0Y2ggIT09IHVuZGVmaW5lZCAmJiB7IHBpdGNoIH0pXG4gICAgICAgIH0pO1xuICAgICAgfSkgYXMgRXZlbnRMaXN0ZW5lcik7XG5cbiAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21hcGxpYnJleDpmaXRfYm91bmRzJywgKChlOiBDdXN0b21FdmVudCkgPT4ge1xuICAgICAgICBjb25zdCB7IGJvdW5kcywgcGFkZGluZywgZHVyYXRpb24sIG1heFpvb20gfSA9IGUuZGV0YWlsO1xuICAgICAgICBtYXAuZml0Qm91bmRzKGJvdW5kcyBhcyBbW251bWJlciwgbnVtYmVyXSwgW251bWJlciwgbnVtYmVyXV0sIHtcbiAgICAgICAgICBwYWRkaW5nOiBwYWRkaW5nIHx8IDUwLFxuICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbiB8fCAxMDAwLFxuICAgICAgICAgIC4uLihtYXhab29tICE9PSB1bmRlZmluZWQgJiYgeyBtYXhab29tIH0pLFxuICAgICAgICAgIGVzc2VudGlhbDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pIGFzIEV2ZW50TGlzdGVuZXIpO1xuXG4gICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdtYXBsaWJyZXg6c2V0X3N0eWxlJywgKChlOiBDdXN0b21FdmVudCkgPT4ge1xuICAgICAgICBjb25zdCB7IHN0eWxlIH0gPSBlLmRldGFpbDtcbiAgICAgICAgbWFwLnNldFN0eWxlKHN0eWxlKTtcbiAgICAgIH0pIGFzIEV2ZW50TGlzdGVuZXIpO1xuXG4gICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdtYXBsaWJyZXg6em9vbV9pbicsICgpID0+IHtcbiAgICAgICAgbWFwLnpvb21Jbih7IGR1cmF0aW9uOiAzMDAgfSk7XG4gICAgICB9KTtcblxuICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbWFwbGlicmV4Onpvb21fb3V0JywgKCkgPT4ge1xuICAgICAgICBtYXAuem9vbU91dCh7IGR1cmF0aW9uOiAzMDAgfSk7XG4gICAgICB9KTtcblxuICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbWFwbGlicmV4OnJlc2V0X25vcnRoJywgKCkgPT4ge1xuICAgICAgICBtYXAucmVzZXROb3J0aCh7IGR1cmF0aW9uOiAzMDAgfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gUmVwb3J0IHRoYXQgdGhlIG1hcCBpcyByZWFkeVxuICAgICAgbWFwLm9uY2UoJ2xvYWQnLCAoKSA9PiB7XG4gICAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBsb2FkZWQgYW5kIHJlYWR5YCk7XG4gICAgICB9KTtcblxuICAgICAgbWFwLm9uY2UoJ2lkbGUnLCAoKSA9PiB7XG4gICAgICAgIC8vIEZhZGUgb3V0IGFuZCByZW1vdmUgdGhlIGxvYWRlclxuICAgICAgICBsb2FkZXJFbGVtZW50LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIC8vIEVsaW1pbmF0ZSBpdCBmcm9tIHRoZSBET00gZGlzcGxheSB3aGVuIHRoZSBmYWRlb3V0XG4gICAgICAgICAgLy8gYW5pbWF0aW9uIGhhcyBydW47IFdlIGNhbiB0YWtlIG1vcmUgdGltZSB0aGFuIHRoZVxuICAgICAgICAgIC8vIHRpbWUgaXQgdGFrZXMgdG8gcnVuIHRoZSBhbmltYXRpb24gYmVjYXVzZSBhcyBsb25nXG4gICAgICAgICAgLy8gYXMgdGhlIG9wYWNpdHkgaXMgMCwgdGhlIGxvYWRlciBlbGVtZW50IGRvZXNuJ3RcbiAgICAgICAgICAvLyBib3RoZXIgdXMgYW55bW9yZSBcbiAgICAgICAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH0sIDUwMCk7XG5cbiAgICAgICAgaWYgKGZseSkge1xuICAgICAgICAgIG1hcC5mbHlUbyh7XG4gICAgICAgICAgICBjZW50ZXI6IGZseVRvQ2VudGVyLFxuICAgICAgICAgICAgem9vbTogZmx5VG9ab29tLFxuICAgICAgICAgICAgYmVhcmluZzogZmx5VG9CZWFyaW5nLFxuICAgICAgICAgICAgcGl0Y2g6IGZseVRvUGl0Y2gsXG4gICAgICAgICAgICBkdXJhdGlvbjogZmxpZ2h0RHVyYXRpb24sXG4gICAgICAgICAgICBzcGVlZDogZmxpZ2h0U3BlZWQsXG4gICAgICAgICAgICBjdXJ2ZTogZmxpZ2h0Q3VydmUsXG4gICAgICAgICAgICBlc3NlbnRpYWw6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgLy8gSGFuZGxlIGVycm9yc1xuICAgICAgbWFwLm9uKCdlcnJvcicsIChlKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBlcnJvcjpgLCBlKTtcbiAgICAgIH0pO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIG1hcDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IE1hcEhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleDtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikgcmV0dXJuO1xuXG4gICAgICBjb25zdCBuZXdDb25maWc6IE1hcENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG9sZENvbmZpZzogTWFwQ29uZmlnID0gc3RhdGUuY29uZmlnO1xuXG4gICAgICAvLyBVcGRhdGUgdGhlIGNlbnRyZSBpZiBpdCBjaGFuZ2VkXG4gICAgICBpZiAoXG4gICAgICAgIG5ld0NvbmZpZy5jZW50ZXJbMF0gIT09IG9sZENvbmZpZy5jZW50ZXJbMF0gfHxcbiAgICAgICAgbmV3Q29uZmlnLmNlbnRlclsxXSAhPT0gb2xkQ29uZmlnLmNlbnRlclsxXVxuICAgICAgKSB7XG4gICAgICAgIHN0YXRlLm1hcC5zZXRDZW50ZXIobmV3Q29uZmlnLmNlbnRlcik7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgem9vbSBpZiBpdCBjaGFuZ2VkXG4gICAgICBpZiAobmV3Q29uZmlnLnpvb20gIT09IG9sZENvbmZpZy56b29tKSB7XG4gICAgICAgIHN0YXRlLm1hcC5zZXRab29tKG5ld0NvbmZpZy56b29tKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRoZSBiZWFyaW5nIGlmIGl0IGNoYW5nZWRcbiAgICAgIGlmIChuZXdDb25maWcuYmVhcmluZyAhPT0gdW5kZWZpbmVkICYmIG5ld0NvbmZpZy5iZWFyaW5nICE9PSBvbGRDb25maWcuYmVhcmluZykge1xuICAgICAgICBzdGF0ZS5tYXAuc2V0QmVhcmluZyhuZXdDb25maWcuYmVhcmluZyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgcGl0Y2ggaWYgaXQgY2hhbmdlZFxuICAgICAgaWYgKG5ld0NvbmZpZy5waXRjaCAhPT0gdW5kZWZpbmVkICYmIG5ld0NvbmZpZy5waXRjaCAhPT0gb2xkQ29uZmlnLnBpdGNoKSB7XG4gICAgICAgIHN0YXRlLm1hcC5zZXRQaXRjaChuZXdDb25maWcucGl0Y2gpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHN0eWxlIGlmIGl0IGNoYW5nZWRcbiAgICAgIGlmIChuZXdDb25maWcuc3R5bGUgIT09IG9sZENvbmZpZy5zdHlsZSkge1xuICAgICAgICBzdGF0ZS5tYXAuc2V0U3R5bGUobmV3Q29uZmlnLnN0eWxlIGFzIGFueSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFN0b3JlIHRoZSBuZXcgY29uZmlndXJhdGlvblxuICAgICAgKHN0YXRlIGFzIGFueSkuY29uZmlnID0gbmV3Q29uZmlnO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIHVwZGF0aW5nIG1hcDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogTWFwSG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4O1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXBJZCA9IHN0YXRlLmNvbmZpZy5pZDtcblxuICAgICAgLy8gVGVhciBkb3duIHRoZSBldmVudCBkaXNwYXRjaGVyXG4gICAgICBzdGF0ZS5kaXNwYXRjaGVyLmNsZWFudXAoKTtcblxuICAgICAgLy8gUmVtb3ZlIHRoZSBtYXBcbiAgICAgIGlmIChzdGF0ZS5tYXAgJiYgdHlwZW9mIHN0YXRlLm1hcC5yZW1vdmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc3RhdGUubWFwLnJlbW92ZSgpO1xuICAgICAgfVxuXG4gICAgICAvLyBVbnJlZ2lzdGVyIGZyb20gdGhlIG1hbmFnZXJcbiAgICAgIE1hcE1hbmFnZXIudW5yZWdpc3RlcihtYXBJZCk7XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBkZXN0cm95ZWRgKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIG1hcDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRpc2Nvbm5lY3RlZCh0aGlzOiBhbnkpIHtcbiAgICAvLyBUZW1wb3JhcnkgZGlzY29ubmVjdCwgZS5nLiBkdXJpbmcgbGl2ZSBuYXZpZ2F0aW9uXG4gICAgbG9nZ2VyLmRlYnVnKCdbTWFwbGlicmVYXSBNYXAgZGlzY29ubmVjdGVkICh0ZW1wb3JhcnkpJyk7XG4gIH0sXG5cbiAgcmVjb25uZWN0ZWQodGhpczogYW55KSB7XG4gICAgLy8gUmVjb25uZWN0ZWQgYWZ0ZXIgYSB0ZW1wb3JhcnkgZGlzY29ubmVjdFxuICAgIGNvbnN0IHN0YXRlOiBNYXBIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXg7XG4gICAgaWYgKHN0YXRlICYmIHN0YXRlLm1hcCkge1xuICAgICAgLy8gUmVzaXplIGluIGNhc2UgdGhlIGNvbnRhaW5lciBjaGFuZ2VkIHNpemUgd2hpbGUgZGlzY29ubmVjdGVkXG4gICAgICBzdGF0ZS5tYXAucmVzaXplKCk7XG4gICAgICBsb2dnZXIuZGVidWcoJ1tNYXBsaWJyZVhdIE1hcCByZWNvbm5lY3RlZCcpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIERlYnVnLWdhdGVkIGxvZ2dpbmcuXG4gKlxuICogTWFwbGlicmVYIGlzIGNoYXR0eSBkdXJpbmcgZGV2ZWxvcG1lbnQgXHUyMDE0IGV2ZXJ5IGhvb2sgcmVwb3J0cyBpdHMgbGlmZWN5Y2xlIFx1MjAxNFxuICogYnV0IGEgbGlicmFyeSBtdXN0IG5vdCBwb2xsdXRlIGEgaG9zdCBhcHBsaWNhdGlvbidzIGNvbnNvbGUgaW4gcHJvZHVjdGlvbi5cbiAqIGBsb2dnZXIuZGVidWdgIGlzIHNpbGVudCB1bmxlc3MgZGVidWdnaW5nIGlzIGV4cGxpY2l0bHkgZW5hYmxlZDsgd2FybmluZ3MgYW5kXG4gKiBlcnJvcnMgYWx3YXlzIHJlYWNoIHRoZSBjb25zb2xlIGJlY2F1c2UgdGhleSBzaWduYWwgYSByZWFsIHByb2JsZW0uXG4gKlxuICogRGVidWdnaW5nIGlzIGVuYWJsZWQgYnkgZWl0aGVyOlxuICogICAtIGBkZWJ1ZzogdHJ1ZWAgb24gYSBgPC5tYXA+YCBjb21wb25lbnQncyBjb25maWcsIG9yXG4gKiAgIC0gYHdpbmRvdy5fX01BUExJQlJFWF9ERUJVR19fID0gdHJ1ZWAgYmVmb3JlIHRoZSBidW5kbGUgbG9hZHMuXG4gKi9cblxuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBfX01BUExJQlJFWF9ERUJVR19fPzogYm9vbGVhbjtcbiAgfVxufVxuXG5sZXQgZGVidWdFbmFibGVkOiBib29sZWFuID1cbiAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93Ll9fTUFQTElCUkVYX0RFQlVHX18gPT09IHRydWU7XG5cbi8qKlxuICogRW5hYmxlIG9yIGRpc2FibGUgZGVidWcgb3V0cHV0IGZvciB0aGUgd2hvbGUgbGlicmFyeS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldERlYnVnKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgZGVidWdFbmFibGVkID0gZW5hYmxlZDtcbn1cblxuLyoqXG4gKiBXaGV0aGVyIGRlYnVnIG91dHB1dCBpcyBjdXJyZW50bHkgZW5hYmxlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRGVidWcoKTogYm9vbGVhbiB7XG4gIHJldHVybiBkZWJ1Z0VuYWJsZWQ7XG59XG5cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIC8qKiBMaWZlY3ljbGUgYW5kIGRpYWdub3N0aWMgb3V0cHV0LiBTaWxlbnQgdW5sZXNzIGRlYnVnZ2luZyBpcyBlbmFibGVkLiAqL1xuICBkZWJ1ZyguLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgICBpZiAoZGVidWdFbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqIFJlY292ZXJhYmxlIHByb2JsZW1zLiBBbHdheXMgbG9nZ2VkLiAqL1xuICB3YXJuKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuICAgIGNvbnNvbGUud2FybiguLi5hcmdzKTtcbiAgfSxcblxuICAvKiogRmFpbHVyZXMuIEFsd2F5cyBsb2dnZWQuICovXG4gIGVycm9yKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuICAgIGNvbnNvbGUuZXJyb3IoLi4uYXJncyk7XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBNYXBNYW5hZ2VyIC0gU2luZ2xldG9uIHJlZ2lzdHJ5IG9mIGxpdmUgbWFwIGluc3RhbmNlc1xuICogXG4gKiBJbnNwaXJlZCBieSBzdmVsdGUtbWFwbGlicmUncyBDb250ZXh0IEFQSSwgdGhpcyBtYW5hZ2VyIGtlZXBzXG4gKiBhIHJlZ2lzdHJ5IG9mIGV2ZXJ5IG1hcCBpbnN0YW5jZSBhY3RpdmUgaW4gdGhlIGFwcGxpY2F0aW9uLCBzbyB0aGF0XG4gKiBtdWx0aXBsZSBjb21wb25lbnRzIChtYXJrZXJzLCBwb3B1cHMsIGxheWVycykgY2FuIHNhZmVseSByZWFjaCB0aGVcbiAqIHNhbWUgbWFwLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTWFwIH0gZnJvbSAnbWFwbGlicmUtZ2wnO1xuaW1wb3J0IHR5cGUgeyBNYXBSZWdpc3RyeSB9IGZyb20gJy4uL3R5cGVzJztcblxuaW1wb3J0IHsgbG9nZ2VyLCBzZXREZWJ1ZyBhcyBzZXRHbG9iYWxEZWJ1ZyB9IGZyb20gJy4vbG9nZ2VyJztcblxuY2xhc3MgTWFwTWFuYWdlckNsYXNzIHtcbiAgcHJpdmF0ZSBtYXBzOiBNYXBSZWdpc3RyeSA9IHt9O1xuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIG5ldyBtYXAgaW5zdGFuY2VcbiAgICovXG4gIHJlZ2lzdGVyKG1hcElkOiBzdHJpbmcsIG1hcDogTWFwKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubWFwc1ttYXBJZF0pIHtcbiAgICAgIHRoaXMubG9nKCd3YXJuJywgYE1hcCB3aXRoIGlkIFwiJHttYXBJZH1cIiBhbHJlYWR5IGV4aXN0cy4gT3ZlcndyaXRpbmcuLi5gKTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5tYXBzW21hcElkXSA9IG1hcDtcbiAgICB0aGlzLmxvZygnaW5mbycsIGBNYXAgXCIke21hcElkfVwiIHJlZ2lzdGVyZWRgLCB7IG1hcCB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb29rIHVwIGEgbWFwIGluc3RhbmNlIGJ5IGlkXG4gICAqL1xuICBnZXQobWFwSWQ6IHN0cmluZyk6IE1hcCB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbWFwID0gdGhpcy5tYXBzW21hcElkXTtcbiAgICBcbiAgICBpZiAoIW1hcCkge1xuICAgICAgdGhpcy5sb2coJ3dhcm4nLCBgTWFwIHdpdGggaWQgXCIke21hcElkfVwiIG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgdXAgYSBtYXAgaW5zdGFuY2UsIHJhaXNpbmcgaWYgaXQgZG9lcyBub3QgZXhpc3RcbiAgICovXG4gIGdldE9yVGhyb3cobWFwSWQ6IHN0cmluZyk6IE1hcCB7XG4gICAgY29uc3QgbWFwID0gdGhpcy5nZXQobWFwSWQpO1xuICAgIFxuICAgIGlmICghbWFwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE1hcCB3aXRoIGlkIFwiJHttYXBJZH1cIiBub3QgZm91bmQuIE1ha2Ugc3VyZSB0aGUgbWFwIGlzIG1vdW50ZWQgYmVmb3JlIGFjY2Vzc2luZyBpdC5gKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGEgbWFwIHdpdGggdGhlIGdpdmVuIGlkIGlzIHJlZ2lzdGVyZWRcbiAgICovXG4gIGhhcyhtYXBJZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG1hcElkIGluIHRoaXMubWFwcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBtYXAgZnJvbSB0aGUgcmVnaXN0cnlcbiAgICovXG4gIHVucmVnaXN0ZXIobWFwSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5tYXBzW21hcElkXSkge1xuICAgICAgdGhpcy5sb2coJ3dhcm4nLCBgQXR0ZW1wdGVkIHRvIHVucmVnaXN0ZXIgbm9uLWV4aXN0ZW50IG1hcCBcIiR7bWFwSWR9XCJgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgZGVsZXRlIHRoaXMubWFwc1ttYXBJZF07XG4gICAgdGhpcy5sb2coJ2luZm8nLCBgTWFwIFwiJHttYXBJZH1cIiB1bnJlZ2lzdGVyZWRgKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVyeSByZWdpc3RlcmVkIG1hcFxuICAgKi9cbiAgZ2V0QWxsKCk6IE1hcFJlZ2lzdHJ5IHtcbiAgICByZXR1cm4geyAuLi50aGlzLm1hcHMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgaWRzIG9mIGV2ZXJ5IHJlZ2lzdGVyZWQgbWFwXG4gICAqL1xuICBnZXRBbGxJZHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLm1hcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhvdyBtYW55IG1hcHMgYXJlIHJlZ2lzdGVyZWRcbiAgICovXG4gIGNvdW50KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMubWFwcykubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBldmVyeSBtYXAuIFVzZWZ1bCBpbiB0ZXN0c1xuICAgKi9cbiAgY2xlYXIoKTogdm9pZCB7XG4gICAgY29uc3QgaWRzID0gdGhpcy5nZXRBbGxJZHMoKTtcbiAgICBpZHMuZm9yRWFjaChpZCA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzLm1hcHNbaWRdO1xuICAgICAgICBpZiAobWFwICYmIHR5cGVvZiBtYXAucmVtb3ZlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbWFwLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aGlzLmxvZygnZXJyb3InLCBgRXJyb3IgcmVtb3ZpbmcgbWFwIFwiJHtpZH1cImAsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLm1hcHMgPSB7fTtcbiAgICB0aGlzLmxvZygnaW5mbycsICdBbGwgbWFwcyBjbGVhcmVkJyk7XG4gIH1cblxuICAvKipcbiAgICogRW5hYmxlIG9yIGRpc2FibGUgZGVidWcgbW9kZVxuICAgKi9cbiAgc2V0RGVidWcoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuICAgIHNldEdsb2JhbERlYnVnKGVuYWJsZWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIGxvZ2dlclxuICAgKi9cbiAgcHJpdmF0ZSBsb2cobGV2ZWw6ICdpbmZvJyB8ICd3YXJuJyB8ICdlcnJvcicsIG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBwcmVmaXggPSAnW01hcGxpYnJlWCBNYXBNYW5hZ2VyXSc7XG4gICAgXG4gICAgc3dpdGNoIChsZXZlbCkge1xuICAgICAgY2FzZSAnaW5mbyc6XG4gICAgICAgIGxvZ2dlci5kZWJ1ZyhwcmVmaXgsIG1lc3NhZ2UsIGRhdGEgfHwgJycpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3dhcm4nOlxuICAgICAgICBjb25zb2xlLndhcm4ocHJlZml4LCBtZXNzYWdlLCBkYXRhIHx8ICcnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocHJlZml4LCBtZXNzYWdlLCBkYXRhIHx8ICcnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2luZ2xldG9uIGluc3RhbmNlXG4gKi9cbmV4cG9ydCBjb25zdCBNYXBNYW5hZ2VyID0gbmV3IE1hcE1hbmFnZXJDbGFzcygpO1xuXG4vKipcbiAqIFNhZmVseSBsb29rIHVwIGEgbWFwXG4gKiBIYW5keSBpbnNpZGUgY29tcG9uZW50c1xuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlTWFwKG1hcElkOiBzdHJpbmcpOiBNYXAgfCB1bmRlZmluZWQge1xuICByZXR1cm4gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xufVxuXG4vKipcbiAqIExvb2sgdXAgYSBtYXAgb3IgcmFpc2VcbiAqIFVzZSB3aGVuIHRoZSBtYXAgaXMgcmVxdWlyZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVNYXAobWFwSWQ6IHN0cmluZyk6IE1hcCB7XG4gIHJldHVybiBNYXBNYW5hZ2VyLmdldE9yVGhyb3cobWFwSWQpO1xufVxuIiwgIi8qKlxuICogRGVib3VuY2UgdXRpbGl0eSAtIGRlbGF5cyBmdW5jdGlvbiBleGVjdXRpb24gdW50aWwgYWZ0ZXIgYSB3YWl0IHBlcmlvZFxuICogXG4gKiBVc2VmdWwgZm9yIG9wdGltaXppbmcgZnJlcXVlbnQgZXZlbnRzIGxpa2UgbWFwIG1vdmVtZW50cywgem9vbSBjaGFuZ2VzLCBldGMuXG4gKiBSZWR1Y2VzIHRoZSBudW1iZXIgb2YgY2FsbHMgdG8gZXhwZW5zaXZlIG9wZXJhdGlvbnMgb3Igc2VydmVyIHJvdW5kLXRyaXBzLlxuICogXG4gKiBAcGFyYW0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBkZWJvdW5jZVxuICogQHBhcmFtIHdhaXQgLSBUaGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzXG4gKiBAcmV0dXJucyBEZWJvdW5jZWQgdmVyc2lvbiBvZiB0aGUgZnVuY3Rpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlPFQgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IHZvaWQ+KFxuICBmdW5jOiBULFxuICB3YWl0OiBudW1iZXJcbik6ICguLi5hcmdzOiBQYXJhbWV0ZXJzPFQ+KSA9PiB2b2lkIHtcbiAgbGV0IHRpbWVvdXQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG4gIFxuICByZXR1cm4gZnVuY3Rpb24odGhpczogYW55LCAuLi5hcmdzOiBQYXJhbWV0ZXJzPFQ+KSB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXM7XG4gICAgXG4gICAgaWYgKHRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICB9XG4gICAgXG4gICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgIH0sIHdhaXQpO1xuICB9O1xufVxuXG4vKipcbiAqIFRocm90dGxlIHV0aWxpdHkgLSBlbnN1cmVzIGZ1bmN0aW9uIGlzIGNhbGxlZCBhdCBtb3N0IG9uY2UgcGVyIHdhaXQgcGVyaW9kXG4gKiBcbiAqIFVubGlrZSBkZWJvdW5jZSwgdGhyb3R0bGUgZ3VhcmFudGVlcyB0aGUgZnVuY3Rpb24gaXMgY2FsbGVkIHJlZ3VsYXJseVxuICogZHVyaW5nIGEgY29udGludW91cyBldmVudCBzdHJlYW0uXG4gKiBcbiAqIEBwYXJhbSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIHRocm90dGxlXG4gKiBAcGFyYW0gd2FpdCAtIFRoZSBtaW5pbXVtIGRlbGF5IGJldHdlZW4gY2FsbHMgaW4gbWlsbGlzZWNvbmRzXG4gKiBAcmV0dXJucyBUaHJvdHRsZWQgdmVyc2lvbiBvZiB0aGUgZnVuY3Rpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRocm90dGxlPFQgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IHZvaWQ+KFxuICBmdW5jOiBULFxuICB3YWl0OiBudW1iZXJcbik6ICguLi5hcmdzOiBQYXJhbWV0ZXJzPFQ+KSA9PiB2b2lkIHtcbiAgbGV0IHRpbWVvdXQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG4gIGxldCBsYXN0QXJnczogUGFyYW1ldGVyczxUPiB8IG51bGwgPSBudWxsO1xuICBcbiAgcmV0dXJuIGZ1bmN0aW9uKHRoaXM6IGFueSwgLi4uYXJnczogUGFyYW1ldGVyczxUPikge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzO1xuICAgIGxhc3RBcmdzID0gYXJncztcbiAgICBcbiAgICBpZiAodGltZW91dCA9PT0gbnVsbCkge1xuICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGxhc3RBcmdzID0gbnVsbDtcbiAgICAgIFxuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgaWYgKGxhc3RBcmdzICE9PSBudWxsKSB7XG4gICAgICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBsYXN0QXJncyk7XG4gICAgICAgICAgbGFzdEFyZ3MgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LCB3YWl0KTtcbiAgICB9XG4gIH07XG59XG4iLCAiLyoqXG4gKiBFdmVudERpc3BhdGNoZXIgLSBCaWRpcmVjdGlvbmFsIGV2ZW50IHBsdW1iaW5nIGJldHdlZW4gTWFwTGlicmUgYW5kIExpdmVWaWV3XG4gKiBcbiAqIFRoaXMgbW9kdWxlIGhhbmRsZXMgY29tbXVuaWNhdGlvbiBpbiBib3RoIGRpcmVjdGlvbnM6XG4gKiAxLiBNYXAgZXZlbnRzIFx1MjE5MiBMaXZlVmlldyAodmlhIHB1c2hFdmVudClcbiAqIDIuIExpdmVWaWV3IGV2ZW50cyBcdTIxOTIgbWFwICh2aWEgaGFuZGxlRXZlbnQpXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBNYXAgYXMgTWFwTGlicmVNYXAsIE1hcEV2ZW50VHlwZSB9IGZyb20gJ21hcGxpYnJlLWdsJztcbmltcG9ydCB0eXBlIHsgXG4gIEhvb2tDb250ZXh0LCBcbiAgTWFwRXZlbnRQYXlsb2FkLCBcbiAgTWFwTW92ZUV2ZW50UGF5bG9hZCwgXG4gIE1hcENsaWNrRXZlbnRQYXlsb2FkLFxuICBFdmVudEhhbmRsZXJcbn0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZGVib3VuY2UgfSBmcm9tICcuLi91dGlscy9kZWJvdW5jZSc7XG5cbi8qKiBUaGUgbWFwIGV2ZW50IG5hbWVzIE1hcExpYnJlIGFjY2VwdHMuICovXG50eXBlIE1hcEV2ZW50TmFtZSA9IGtleW9mIE1hcEV2ZW50VHlwZTtcblxuZXhwb3J0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIHByaXZhdGUgaG9vazogSG9va0NvbnRleHQ7XG4gIHByaXZhdGUgbWFwOiBNYXBMaWJyZU1hcDtcbiAgcHJpdmF0ZSBtYXBJZDogc3RyaW5nO1xuICBwcml2YXRlIGV2ZW50SGFuZGxlcnM6IE1hcDxzdHJpbmcsIEV2ZW50SGFuZGxlcltdPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBtYXBFdmVudExpc3RlbmVyczogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXAoKTtcblxuICBjb25zdHJ1Y3Rvcihob29rOiBIb29rQ29udGV4dCwgbWFwOiBNYXBMaWJyZU1hcCwgbWFwSWQ6IHN0cmluZykge1xuICAgIHRoaXMuaG9vayA9IGhvb2s7XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5tYXBJZCA9IG1hcElkO1xuICB9XG5cbiAgLyoqXG4gICAqIFdpcmVzIHVwIHRoZSBzdGFuZGFyZCBtYXAgZXZlbnRzIHRoYXQgZ2V0IHB1c2hlZCB0byBMaXZlVmlld1xuICAgKi9cbiAgc2V0dXBEZWZhdWx0TWFwRXZlbnRzKCk6IHZvaWQge1xuICAgIC8vIE1vdmVtZW50IGV2ZW50cywgZGVib3VuY2VkICgxNTBtcylcbiAgICAvLyBDdXRzIExpdmVWaWV3IHJvdW5kLXRyaXBzIGR1cmluZyBjb250aW51b3VzIHBhbi96b29tXG4gICAgY29uc3QgZGVib3VuY2VkTW92ZUVuZCA9IGRlYm91bmNlKCgpID0+IHtcbiAgICAgIGNvbnN0IGNlbnRlciA9IHRoaXMubWFwLmdldENlbnRlcigpO1xuICAgICAgY29uc3Qgem9vbSA9IHRoaXMubWFwLmdldFpvb20oKTtcbiAgICAgIGNvbnN0IGJlYXJpbmcgPSB0aGlzLm1hcC5nZXRCZWFyaW5nKCk7XG4gICAgICBjb25zdCBwaXRjaCA9IHRoaXMubWFwLmdldFBpdGNoKCk7XG5cbiAgICAgIGNvbnN0IHBheWxvYWQ6IE1hcE1vdmVFdmVudFBheWxvYWQgPSB7XG4gICAgICAgIG1hcElkOiB0aGlzLm1hcElkLFxuICAgICAgICB0eXBlOiAnbW92ZWVuZCcsXG4gICAgICAgIGNlbnRlcjogW2NlbnRlci5sbmcsIGNlbnRlci5sYXRdLFxuICAgICAgICB6b29tOiBNYXRoLnJvdW5kKHpvb20gKiAxMDApIC8gMTAwLFxuICAgICAgICBiZWFyaW5nOiBNYXRoLnJvdW5kKGJlYXJpbmcgKiAxMDApIC8gMTAwLFxuICAgICAgICBwaXRjaDogTWF0aC5yb3VuZChwaXRjaCAqIDEwMCkgLyAxMDBcbiAgICAgIH07XG5cbiAgICAgIHRoaXMucHVzaFRvTGl2ZVZpZXcoJ21hcDptb3ZlZCcsIHBheWxvYWQpO1xuICAgIH0sIDE1MCk7XG4gICAgXG4gICAgdGhpcy5vbk1hcEV2ZW50KCdtb3ZlZW5kJywgZGVib3VuY2VkTW92ZUVuZCk7XG5cbiAgICAvLyBDbGljayBldmVudHNcbiAgICB0aGlzLm9uTWFwRXZlbnQoJ2NsaWNrJywgKGU6IGFueSkgPT4ge1xuICAgICAgY29uc3QgcGF5bG9hZDogTWFwQ2xpY2tFdmVudFBheWxvYWQgPSB7XG4gICAgICAgIG1hcElkOiB0aGlzLm1hcElkLFxuICAgICAgICB0eXBlOiAnY2xpY2snLFxuICAgICAgICBsbmdMYXQ6IFtlLmxuZ0xhdC5sbmcsIGUubG5nTGF0LmxhdF0sXG4gICAgICAgIHBvaW50OiBbZS5wb2ludC54LCBlLnBvaW50LnldXG4gICAgICB9O1xuXG4gICAgICB0aGlzLnB1c2hUb0xpdmVWaWV3KCdtYXA6Y2xpY2tlZCcsIHBheWxvYWQpO1xuICAgIH0pO1xuXG4gICAgLy8gTG9hZCBldmVudFxuICAgIHRoaXMub25NYXBFdmVudCgnbG9hZCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHBheWxvYWQ6IE1hcEV2ZW50UGF5bG9hZCA9IHtcbiAgICAgICAgbWFwSWQ6IHRoaXMubWFwSWQsXG4gICAgICAgIHR5cGU6ICdsb2FkJ1xuICAgICAgfTtcblxuICAgICAgdGhpcy5wdXNoVG9MaXZlVmlldygnbWFwOmxvYWRlZCcsIHBheWxvYWQpO1xuICAgIH0pO1xuXG4gICAgLy8gWm9vbSBldmVudHNcbiAgICB0aGlzLm9uTWFwRXZlbnQoJ3pvb21lbmQnLCAoKSA9PiB7XG4gICAgICBjb25zdCBwYXlsb2FkOiBNYXBFdmVudFBheWxvYWQgPSB7XG4gICAgICAgIG1hcElkOiB0aGlzLm1hcElkLFxuICAgICAgICB0eXBlOiAnem9vbWVuZCcsXG4gICAgICAgIHpvb206IHRoaXMubWFwLmdldFpvb20oKVxuICAgICAgfTtcblxuICAgICAgdGhpcy5wdXNoVG9MaXZlVmlldygnbWFwOnpvb21fY2hhbmdlZCcsIHBheWxvYWQpO1xuICAgIH0pO1xuXG4gICAgLy8gRXJyb3IgZXZlbnRzXG4gICAgdGhpcy5vbk1hcEV2ZW50KCdlcnJvcicsIChlOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHBheWxvYWQ6IE1hcEV2ZW50UGF5bG9hZCA9IHtcbiAgICAgICAgbWFwSWQ6IHRoaXMubWFwSWQsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgIGVycm9yOiBlLmVycm9yPy5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yJ1xuICAgICAgfTtcblxuICAgICAgdGhpcy5wdXNoVG9MaXZlVmlldygnbWFwOmVycm9yJywgcGF5bG9hZCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogV2lyZXMgdXAgdGhlIGhhbmRsZXJzIGZvciBldmVudHMgY29taW5nIGZyb20gTGl2ZVZpZXcgaW50byB0aGUgbWFwXG4gICAqL1xuICBzZXR1cExpdmVWaWV3SGFuZGxlcnMoKTogdm9pZCB7XG4gICAgLy8gTW92ZSB0aGUgbWFwIHRvIGEgbG9jYXRpb25cbiAgICB0aGlzLm9uTGl2ZVZpZXdFdmVudCgnbWFwOmZseV90bycsIChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHsgY2VudGVyLCB6b29tLCBkdXJhdGlvbiwgYmVhcmluZywgcGl0Y2ggfSA9IHBheWxvYWQ7XG4gICAgICBcbiAgICAgIHRoaXMubWFwLmZseVRvKHtcbiAgICAgICAgY2VudGVyOiBjZW50ZXIgYXMgW251bWJlciwgbnVtYmVyXSxcbiAgICAgICAgem9vbTogem9vbSxcbiAgICAgICAgZHVyYXRpb246IGR1cmF0aW9uIHx8IDEwMDAsXG4gICAgICAgIGJlYXJpbmc6IGJlYXJpbmcsXG4gICAgICAgIHBpdGNoOiBwaXRjaCxcbiAgICAgICAgZXNzZW50aWFsOiB0cnVlXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIEp1bXAgc3RyYWlnaHQgdG8gYSBsb2NhdGlvbiwgbm8gYW5pbWF0aW9uXG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDpqdW1wX3RvJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgY29uc3QgeyBjZW50ZXIsIHpvb20sIGJlYXJpbmcsIHBpdGNoIH0gPSBwYXlsb2FkO1xuICAgICAgXG4gICAgICB0aGlzLm1hcC5qdW1wVG8oe1xuICAgICAgICBjZW50ZXI6IGNlbnRlciBhcyBbbnVtYmVyLCBudW1iZXJdLFxuICAgICAgICB6b29tOiB6b29tLFxuICAgICAgICBiZWFyaW5nOiBiZWFyaW5nLFxuICAgICAgICBwaXRjaDogcGl0Y2hcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRml0IHRoZSBtYXAgdG8gYm91bmRzXG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDpmaXRfYm91bmRzJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgY29uc3QgeyBib3VuZHMsIHBhZGRpbmcsIG1heFpvb20sIGR1cmF0aW9uIH0gPSBwYXlsb2FkO1xuICAgICAgXG4gICAgICB0aGlzLm1hcC5maXRCb3VuZHMoYm91bmRzLCB7XG4gICAgICAgIHBhZGRpbmc6IHBhZGRpbmcgfHwgNTAsXG4gICAgICAgIG1heFpvb206IG1heFpvb20sXG4gICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbiB8fCAxMDAwXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgbWFwIHN0eWxlXG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDpzZXRfc3R5bGUnLCAocGF5bG9hZDogYW55KSA9PiB7XG4gICAgICBjb25zdCB7IHN0eWxlIH0gPSBwYXlsb2FkO1xuICAgICAgdGhpcy5tYXAuc2V0U3R5bGUoc3R5bGUpO1xuICAgIH0pO1xuXG4gICAgLy8gQ2hhbmdlIHRoZSBiZWFyaW5nXG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDpzZXRfYmVhcmluZycsIChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHsgYmVhcmluZywgZHVyYXRpb24gfSA9IHBheWxvYWQ7XG4gICAgICB0aGlzLm1hcC5yb3RhdGVUbyhiZWFyaW5nLCB7IGR1cmF0aW9uOiBkdXJhdGlvbiB8fCAxMDAwIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gQ2hhbmdlIHRoZSBwaXRjaFxuICAgIHRoaXMub25MaXZlVmlld0V2ZW50KCdtYXA6c2V0X3BpdGNoJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgY29uc3QgeyBwaXRjaCB9ID0gcGF5bG9hZDtcbiAgICAgIHRoaXMubWFwLnNldFBpdGNoKHBpdGNoKTtcbiAgICB9KTtcblxuICAgIC8vIFJlc2V0IHRvIG5vcnRoXG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDpyZXNldF9ub3J0aCcsICgpID0+IHtcbiAgICAgIHRoaXMubWFwLnJlc2V0Tm9ydGgoKTtcbiAgICB9KTtcblxuICAgIC8vIFpvb20gaW4vb3V0XG4gICAgdGhpcy5vbkxpdmVWaWV3RXZlbnQoJ21hcDp6b29tX2luJywgKCkgPT4ge1xuICAgICAgdGhpcy5tYXAuem9vbUluKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uTGl2ZVZpZXdFdmVudCgnbWFwOnpvb21fb3V0JywgKCkgPT4ge1xuICAgICAgdGhpcy5tYXAuem9vbU91dCgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byBhIG1hcCBldmVudFxuICAgKi9cbiAgb25NYXBFdmVudChldmVudDogc3RyaW5nLCBoYW5kbGVyOiAoZTogYW55KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gRXZlbnQgbmFtZXMgYXJyaXZlIGFzIHBsYWluIHN0cmluZ3MgZnJvbSB0aGUgY29tcG9uZW50IGxheWVyLCBzbyB0aGV5XG4gICAgLy8gY2Fubm90IGJlIG5hcnJvd2VkIHRvIE1hcExpYnJlJ3MgYGtleW9mIE1hcEV2ZW50VHlwZWAgYXQgY29tcGlsZSB0aW1lLlxuICAgIHRoaXMubWFwLm9uKGV2ZW50IGFzIE1hcEV2ZW50TmFtZSwgaGFuZGxlcik7XG4gICAgdGhpcy5tYXBFdmVudExpc3RlbmVycy5zZXQoZXZlbnQsIGhhbmRsZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byBhbiBldmVudCBjb21pbmcgZnJvbSBMaXZlVmlld1xuICAgKi9cbiAgb25MaXZlVmlld0V2ZW50KGV2ZW50OiBzdHJpbmcsIGhhbmRsZXI6IEV2ZW50SGFuZGxlcik6IHZvaWQge1xuICAgIHRoaXMuaG9vay5oYW5kbGVFdmVudChldmVudCwgaGFuZGxlcik7XG4gICAgXG4gICAgLy8gS2VlcCBhIHJlZmVyZW5jZSBmb3IgY2xlYW51cFxuICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzLmhhcyhldmVudCkpIHtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycy5zZXQoZXZlbnQsIFtdKTtcbiAgICB9XG4gICAgdGhpcy5ldmVudEhhbmRsZXJzLmdldChldmVudCkhLnB1c2goaGFuZGxlcik7XG4gIH1cblxuICAvKipcbiAgICogUHVzaCBhbiBldmVudCB0byBMaXZlVmlld1xuICAgKi9cbiAgcHVzaFRvTGl2ZVZpZXcoZXZlbnQ6IHN0cmluZywgcGF5bG9hZDogYW55LCBjYWxsYmFjaz86ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmhvb2sucHVzaEV2ZW50KGV2ZW50LCBwYXlsb2FkLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUHVzaCBhbiBldmVudCB0byBhIHNwZWNpZmljIHRhcmdldCBzZWxlY3RvciBpbiBMaXZlVmlld1xuICAgKi9cbiAgcHVzaFRvTGl2ZVZpZXdUYXJnZXQoc2VsZWN0b3I6IHN0cmluZywgZXZlbnQ6IHN0cmluZywgcGF5bG9hZDogYW55LCBjYWxsYmFjaz86ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmhvb2sucHVzaEV2ZW50VG8oc2VsZWN0b3IsIGV2ZW50LCBwYXlsb2FkLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGV2ZXJ5IGV2ZW50IGxpc3RlbmVyXG4gICAqL1xuICBjbGVhbnVwKCk6IHZvaWQge1xuICAgIC8vIFJlbW92ZSB0aGUgbWFwJ3MgbGlzdGVuZXJzXG4gICAgdGhpcy5tYXBFdmVudExpc3RlbmVycy5mb3JFYWNoKChoYW5kbGVyLCBldmVudCkgPT4ge1xuICAgICAgdGhpcy5tYXAub2ZmKGV2ZW50IGFzIE1hcEV2ZW50TmFtZSwgaGFuZGxlcik7XG4gICAgfSk7XG4gICAgdGhpcy5tYXBFdmVudExpc3RlbmVycy5jbGVhcigpO1xuXG4gICAgLy8gUmVtb3ZlIHRoZSBMaXZlVmlldyBoYW5kbGVyc1xuICAgIHRoaXMuZXZlbnRIYW5kbGVycy5jbGVhcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV2ZW50IHN0YXRpc3RpY3MsIHVzZWZ1bCB3aGVuIGRlYnVnZ2luZ1xuICAgKi9cbiAgZ2V0U3RhdHMoKToge1xuICAgIG1hcEV2ZW50TGlzdGVuZXJzOiBudW1iZXI7XG4gICAgbGl2ZVZpZXdIYW5kbGVyczogbnVtYmVyO1xuICAgIGV2ZW50czogc3RyaW5nW107XG4gIH0ge1xuICAgIHJldHVybiB7XG4gICAgICBtYXBFdmVudExpc3RlbmVyczogdGhpcy5tYXBFdmVudExpc3RlbmVycy5zaXplLFxuICAgICAgbGl2ZVZpZXdIYW5kbGVyczogQXJyYXkuZnJvbSh0aGlzLmV2ZW50SGFuZGxlcnMudmFsdWVzKCkpXG4gICAgICAgIC5yZWR1Y2UoKGFjYywgaGFuZGxlcnMpID0+IGFjYyArIGhhbmRsZXJzLmxlbmd0aCwgMCksXG4gICAgICBldmVudHM6IEFycmF5LmZyb20odGhpcy5ldmVudEhhbmRsZXJzLmtleXMoKSlcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGRpc3BhdGNoZXIgd2lyZWQgd2l0aCB0aGUgZGVmYXVsdCBldmVudCBzZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUV2ZW50RGlzcGF0Y2hlcihcbiAgaG9vazogSG9va0NvbnRleHQsIFxuICBtYXA6IE1hcExpYnJlTWFwLCBcbiAgbWFwSWQ6IHN0cmluZyxcbiAgc2V0dXBEZWZhdWx0czogYm9vbGVhbiA9IHRydWVcbik6IEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0IGRpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKGhvb2ssIG1hcCwgbWFwSWQpO1xuICBcbiAgaWYgKHNldHVwRGVmYXVsdHMpIHtcbiAgICBkaXNwYXRjaGVyLnNldHVwRGVmYXVsdE1hcEV2ZW50cygpO1xuICAgIGRpc3BhdGNoZXIuc2V0dXBMaXZlVmlld0hhbmRsZXJzKCk7XG4gIH1cbiAgXG4gIHJldHVybiBkaXNwYXRjaGVyO1xufVxuIiwgIi8qKlxuICogTWFya2VySG9vayAtIEhvb2sgZm9yIHRoZSBNYXJrZXIgY29tcG9uZW50XG4gKiBcbiAqIE1hbmFnZXMgbWFwIG1hcmtlcnMgd2l0aCBzdXBwb3J0IGZvciBkcmFnICYgZHJvcCxcbiAqIHBvcHVwcywgeSBldmVudG9zIHBlcnNvbmFsaXphZG9zLlxuICovXG5cbi8vIG1hcGxpYnJlLWdsIHY2IGlzIEVTTS1vbmx5IGFuZCBubyBsb25nZXIgaGFzIGEgZGVmYXVsdCBleHBvcnQuXG5pbXBvcnQgKiBhcyBtYXBsaWJyZWdsIGZyb20gJ21hcGxpYnJlLWdsJztcbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rLCBNYXJrZXJDb25maWcgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBNYXBNYW5hZ2VyIH0gZnJvbSAnLi4vY29yZS9tYXAtbWFuYWdlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIE1hcmtlckhvb2tTdGF0ZSB7XG4gIG1hcmtlcjogbWFwbGlicmVnbC5NYXJrZXI7XG4gIGNvbmZpZzogTWFya2VyQ29uZmlnO1xuICBwb3B1cD86IG1hcGxpYnJlZ2wuUG9wdXA7XG59XG5cbmV4cG9ydCBjb25zdCBNYXJrZXJIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBtYXJrZXIgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogTWFya2VyQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoY29uZmlnLm1hcElkIHx8ICdkZWZhdWx0Jyk7XG5cbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7Y29uZmlnLm1hcElkfVwiIG5vdCBmb3VuZCBmb3IgbWFya2VyIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB0aGUgbWFya2VyIG9wdGlvbnNcbiAgICAgIGNvbnN0IG1hcmtlck9wdGlvbnM6IG1hcGxpYnJlZ2wuTWFya2VyT3B0aW9ucyA9IHtcbiAgICAgICAgY29sb3I6IGNvbmZpZy5jb2xvciB8fCAnIzNGQjFDRScsXG4gICAgICAgIHNjYWxlOiBjb25maWcuc2NhbGUgfHwgMSxcbiAgICAgICAgcm90YXRpb246IGNvbmZpZy5yb3RhdGlvbiB8fCAwLFxuICAgICAgICBkcmFnZ2FibGU6IGNvbmZpZy5kcmFnZ2FibGUgfHwgZmFsc2UsXG4gICAgICAgIHBpdGNoQWxpZ25tZW50OiBjb25maWcucGl0Y2hBbGlnbm1lbnQgfHwgJ2F1dG8nLFxuICAgICAgICByb3RhdGlvbkFsaWdubWVudDogY29uZmlnLnJvdGF0aW9uQWxpZ25tZW50IHx8ICdhdXRvJ1xuICAgICAgfTtcblxuICAgICAgaWYgKGNvbmZpZy5hbmNob3IpIHtcbiAgICAgICAgbWFya2VyT3B0aW9ucy5hbmNob3IgPSBjb25maWcuYW5jaG9yO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLm9mZnNldCkge1xuICAgICAgICBtYXJrZXJPcHRpb25zLm9mZnNldCA9IGNvbmZpZy5vZmZzZXQ7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWFyIG1hcmNhZG9yXG4gICAgICBjb25zdCBtYXJrZXIgPSBuZXcgbWFwbGlicmVnbC5NYXJrZXIobWFya2VyT3B0aW9ucylcbiAgICAgICAgLnNldExuZ0xhdChjb25maWcubG5nTGF0KVxuICAgICAgICAuYWRkVG8obWFwKTtcblxuICAgICAgLy8gQXR0YWNoIGEgcG9wdXAgaWYgb25lIHdhcyBjb25maWd1cmVkXG4gICAgICBsZXQgcG9wdXA6IG1hcGxpYnJlZ2wuUG9wdXAgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAoY29uZmlnLnBvcHVwKSB7XG4gICAgICAgIHBvcHVwID0gbmV3IG1hcGxpYnJlZ2wuUG9wdXAoe1xuICAgICAgICAgIGNsb3NlQnV0dG9uOiBjb25maWcucG9wdXAuY2xvc2VCdXR0b24gIT09IGZhbHNlLFxuICAgICAgICAgIGNsb3NlT25DbGljazogY29uZmlnLnBvcHVwLmNsb3NlT25DbGljayAhPT0gZmFsc2UsXG4gICAgICAgICAgbWF4V2lkdGg6IGNvbmZpZy5wb3B1cC5tYXhXaWR0aCB8fCAnMjQwcHgnLFxuICAgICAgICAgIG9mZnNldDogY29uZmlnLnBvcHVwLm9mZnNldFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoY29uZmlnLnBvcHVwLnRleHQpIHtcbiAgICAgICAgICBwb3B1cC5zZXRUZXh0KGNvbmZpZy5wb3B1cC50ZXh0KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25maWcucG9wdXAuaHRtbCkge1xuICAgICAgICAgIHBvcHVwLnNldEhUTUwoY29uZmlnLnBvcHVwLmh0bWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWFya2VyLnNldFBvcHVwKHBvcHVwKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWFya2VyIGV2ZW50c1xuICAgICAgaWYgKGNvbmZpZy5kcmFnZ2FibGUpIHtcbiAgICAgICAgbWFya2VyLm9uKCdkcmFnc3RhcnQnLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ21hcmtlcjpkcmFnX3N0YXJ0Jywge1xuICAgICAgICAgICAgbWFya2VySWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIGxuZ0xhdDogbWFya2VyLmdldExuZ0xhdCgpLnRvQXJyYXkoKVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBtYXJrZXIub24oJ2RyYWcnLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ21hcmtlcjpkcmFnZ2luZycsIHtcbiAgICAgICAgICAgIG1hcmtlcklkOiBjb25maWcuaWQsXG4gICAgICAgICAgICBsbmdMYXQ6IG1hcmtlci5nZXRMbmdMYXQoKS50b0FycmF5KClcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbWFya2VyLm9uKCdkcmFnZW5kJywgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdtYXJrZXI6ZHJhZ19lbmQnLCB7XG4gICAgICAgICAgICBtYXJrZXJJZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgbG5nTGF0OiBtYXJrZXIuZ2V0TG5nTGF0KCkudG9BcnJheSgpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDbGljayBldmVudFxuICAgICAgbWFya2VyLmdldEVsZW1lbnQoKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGlmIChwb3B1cCkge1xuICAgICAgICAgIG1hcmtlci50b2dnbGVQb3B1cCgpOyAgLy8gXHUyMTkwIGxcdTAwRURuZWEgYVx1MDBGMWFkaWRhXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ21hcmtlcjpjbGlja2VkJywge1xuICAgICAgICAgIG1hcmtlcklkOiBjb25maWcuaWQsXG4gICAgICAgICAgbG5nTGF0OiBtYXJrZXIuZ2V0TG5nTGF0KCkudG9BcnJheSgpXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfbWFya2VyID0ge1xuICAgICAgICBtYXJrZXIsXG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgcG9wdXBcbiAgICAgIH07XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gTWFya2VyIFwiJHtjb25maWcuaWR9XCIgY3JlYXRlZGApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIG1hcmtlcjonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IE1hcmtlckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9tYXJrZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHJldHVybjtcblxuICAgICAgY29uc3QgbmV3Q29uZmlnOiBNYXJrZXJDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBvbGRDb25maWcgPSBzdGF0ZS5jb25maWc7XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgcG9zaXRpb24gaWYgaXQgY2hhbmdlZFxuICAgICAgaWYgKFxuICAgICAgICBuZXdDb25maWcubG5nTGF0WzBdICE9PSBvbGRDb25maWcubG5nTGF0WzBdIHx8XG4gICAgICAgIG5ld0NvbmZpZy5sbmdMYXRbMV0gIT09IG9sZENvbmZpZy5sbmdMYXRbMV1cbiAgICAgICkge1xuICAgICAgICBzdGF0ZS5tYXJrZXIuc2V0TG5nTGF0KG5ld0NvbmZpZy5sbmdMYXQpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHJvdGF0aW9uIGlmIGl0IGNoYW5nZWRcbiAgICAgIGlmIChuZXdDb25maWcucm90YXRpb24gIT09IHVuZGVmaW5lZCAmJiBuZXdDb25maWcucm90YXRpb24gIT09IG9sZENvbmZpZy5yb3RhdGlvbikge1xuICAgICAgICBzdGF0ZS5tYXJrZXIuc2V0Um90YXRpb24obmV3Q29uZmlnLnJvdGF0aW9uKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGRyYWdnYWJsZSBpZiBpdCBjaGFuZ2VkXG4gICAgICBpZiAobmV3Q29uZmlnLmRyYWdnYWJsZSAhPT0gb2xkQ29uZmlnLmRyYWdnYWJsZSkge1xuICAgICAgICBzdGF0ZS5tYXJrZXIuc2V0RHJhZ2dhYmxlKG5ld0NvbmZpZy5kcmFnZ2FibGUgfHwgZmFsc2UpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHBvcHVwIGlmIGl0IGNoYW5nZWRcbiAgICAgIGlmIChuZXdDb25maWcucG9wdXAgJiYgc3RhdGUucG9wdXApIHtcbiAgICAgICAgaWYgKG5ld0NvbmZpZy5wb3B1cC50ZXh0ICYmIG5ld0NvbmZpZy5wb3B1cC50ZXh0ICE9PSBvbGRDb25maWcucG9wdXA/LnRleHQpIHtcbiAgICAgICAgICBzdGF0ZS5wb3B1cC5zZXRUZXh0KG5ld0NvbmZpZy5wb3B1cC50ZXh0KTtcbiAgICAgICAgfSBlbHNlIGlmIChuZXdDb25maWcucG9wdXAuaHRtbCAmJiBuZXdDb25maWcucG9wdXAuaHRtbCAhPT0gb2xkQ29uZmlnLnBvcHVwPy5odG1sKSB7XG4gICAgICAgICAgc3RhdGUucG9wdXAuc2V0SFRNTChuZXdDb25maWcucG9wdXAuaHRtbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gU3RvcmUgdGhlIG5ldyBjb25maWd1cmF0aW9uXG4gICAgICBzdGF0ZS5jb25maWcgPSBuZXdDb25maWc7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgdXBkYXRpbmcgbWFya2VyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBNYXJrZXJIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfbWFya2VyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZW1vdmUgdGhlIG1hcmtlclxuICAgICAgc3RhdGUubWFya2VyLnJlbW92ZSgpO1xuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBNYXJrZXIgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIG1hcmtlcjonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogUG9wdXBIb29rIC0gSG9vayBmb3IgdGhlIFBvcHVwIGNvbXBvbmVudFxuICogXG4gKiBNYW5hZ2VzIHN0YW5kYWxvbmUgbWFwIHBvcHVwcyB3aXRoIHN1cHBvcnQgZm9yXG4gKiBIVE1MIGNvbnRlbnQsIGV2ZW50cywgYW5kIHByb2dyYW1tYXRpYyBjb250cm9sIGZyb20gTGl2ZVZpZXcuXG4gKi9cblxuLy8gbWFwbGlicmUtZ2wgdjYgaXMgRVNNLW9ubHkgYW5kIG5vIGxvbmdlciBoYXMgYSBkZWZhdWx0IGV4cG9ydC5cbmltcG9ydCAqIGFzIG1hcGxpYnJlZ2wgZnJvbSAnbWFwbGlicmUtZ2wnO1xuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2ssIFBvcHVwQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBQb3B1cEhvb2tTdGF0ZSB7XG4gIHBvcHVwOiBtYXBsaWJyZWdsLlBvcHVwO1xuICBjb25maWc6IFBvcHVwQ29uZmlnO1xuICBtYXA6IG1hcGxpYnJlZ2wuTWFwO1xuICBjb250ZW50RWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsO1xufVxuXG5leHBvcnQgY29uc3QgUG9wdXBIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBwb3B1cCBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBQb3B1cENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KGNvbmZpZy5tYXBJZCB8fCAnZGVmYXVsdCcpO1xuXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIHBvcHVwIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgY29udGVudCBlbGVtZW50XG4gICAgICBjb25zdCBjb250ZW50RWxlbWVudCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXBvcHVwLWNvbnRlbnRdJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBpZiAoIWNvbnRlbnRFbGVtZW50KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE5vIGNvbnRlbnQgZWxlbWVudCBmb3VuZCBmb3IgcG9wdXAgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBwb3B1cCBvcHRpb25zXG4gICAgICBjb25zdCBwb3B1cE9wdGlvbnM6IG1hcGxpYnJlZ2wuUG9wdXBPcHRpb25zID0ge1xuICAgICAgICBjbG9zZUJ1dHRvbjogY29uZmlnLmNsb3NlQnV0dG9uICE9PSBmYWxzZSxcbiAgICAgICAgY2xvc2VPbkNsaWNrOiBjb25maWcuY2xvc2VPbkNsaWNrICE9PSBmYWxzZSxcbiAgICAgICAgY2xvc2VPbk1vdmU6IGNvbmZpZy5jbG9zZU9uTW92ZSB8fCBmYWxzZSxcbiAgICAgICAgbWF4V2lkdGg6IGNvbmZpZy5tYXhXaWR0aCB8fCAnMjQwcHgnLFxuICAgICAgICBhbmNob3I6IGNvbmZpZy5hbmNob3IgYXMgYW55IHx8ICdhdXRvJ1xuICAgICAgfTtcblxuICAgICAgaWYgKGNvbmZpZy5vZmZzZXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwb3B1cE9wdGlvbnMub2Zmc2V0ID0gY29uZmlnLm9mZnNldCBhcyBhbnk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcuY2xhc3NOYW1lKSB7XG4gICAgICAgIHBvcHVwT3B0aW9ucy5jbGFzc05hbWUgPSBjb25maWcuY2xhc3NOYW1lO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgcG9wdXBcbiAgICAgIGNvbnN0IHBvcHVwID0gbmV3IG1hcGxpYnJlZ2wuUG9wdXAocG9wdXBPcHRpb25zKTtcblxuICAgICAgLy8gU2V0IEhUTUwgY29udGVudCBmcm9tIHRoZSBzbG90XG4gICAgICBjb25zdCBodG1sQ29udGVudCA9IGNvbnRlbnRFbGVtZW50LmlubmVySFRNTDtcbiAgICAgIHBvcHVwLnNldEhUTUwoaHRtbENvbnRlbnQpO1xuXG4gICAgICAvLyBBZGQgcG9wdXAgdG8gbWFwIGlmIGxuZ0xhdCBwcm92aWRlZCBhbmQgb3BlbiBpcyB0cnVlXG4gICAgICBpZiAoY29uZmlnLmxuZ0xhdCAmJiBjb25maWcub3BlbiAhPT0gZmFsc2UpIHtcbiAgICAgICAgcG9wdXAuc2V0TG5nTGF0KGNvbmZpZy5sbmdMYXQpLmFkZFRvKG1hcCk7XG4gICAgICB9IGVsc2UgaWYgKGNvbmZpZy5sbmdMYXQpIHtcbiAgICAgICAgLy8gU2V0IGxvY2F0aW9uIGJ1dCBkb24ndCBhZGQgdG8gbWFwIHlldFxuICAgICAgICBwb3B1cC5zZXRMbmdMYXQoY29uZmlnLmxuZ0xhdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNldHVwIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgcG9wdXAub24oJ29wZW4nLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdwb3B1cDpvcGVuZWQnLCB7XG4gICAgICAgICAgcG9wdXBJZDogY29uZmlnLmlkLFxuICAgICAgICAgIGxuZ0xhdDogcG9wdXAuZ2V0TG5nTGF0KCk/LnRvQXJyYXkoKVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBwb3B1cC5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdwb3B1cDpjbG9zZWQnLCB7XG4gICAgICAgICAgcG9wdXBJZDogY29uZmlnLmlkXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEhhbmRsZSBjb21tYW5kcyBmcm9tIExpdmVWaWV3XG4gICAgICB0aGlzLmhhbmRsZUV2ZW50KCdwb3B1cDpvcGVuJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgICBpZiAocGF5bG9hZC5wb3B1cF9pZCA9PT0gY29uZmlnLmlkKSB7XG4gICAgICAgICAgaWYgKHBheWxvYWQubG5nX2xhdCkge1xuICAgICAgICAgICAgcG9wdXAuc2V0TG5nTGF0KHBheWxvYWQubG5nX2xhdCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghcG9wdXAuaXNPcGVuKCkpIHtcbiAgICAgICAgICAgIHBvcHVwLmFkZFRvKG1hcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5oYW5kbGVFdmVudCgncG9wdXA6Y2xvc2UnLCAocGF5bG9hZDogYW55KSA9PiB7XG4gICAgICAgIGlmIChwYXlsb2FkLnBvcHVwX2lkID09PSBjb25maWcuaWQgJiYgcG9wdXAuaXNPcGVuKCkpIHtcbiAgICAgICAgICBwb3B1cC5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuaGFuZGxlRXZlbnQoJ3BvcHVwOnRvZ2dsZScsIChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKHBheWxvYWQucG9wdXBfaWQgPT09IGNvbmZpZy5pZCkge1xuICAgICAgICAgIGlmIChwb3B1cC5pc09wZW4oKSkge1xuICAgICAgICAgICAgcG9wdXAucmVtb3ZlKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcHVwLmFkZFRvKG1hcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5oYW5kbGVFdmVudCgncG9wdXA6c2V0X2xvY2F0aW9uJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgICBpZiAocGF5bG9hZC5wb3B1cF9pZCA9PT0gY29uZmlnLmlkICYmIHBheWxvYWQubG5nX2xhdCkge1xuICAgICAgICAgIHBvcHVwLnNldExuZ0xhdChwYXlsb2FkLmxuZ19sYXQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gU2F2ZSBzdGF0ZVxuICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3BvcHVwID0ge1xuICAgICAgICBwb3B1cCxcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBtYXAsXG4gICAgICAgIGNvbnRlbnRFbGVtZW50XG4gICAgICB9O1xuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFBvcHVwIFwiJHtjb25maWcuaWR9XCIgY3JlYXRlZGApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIHBvcHVwOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogUG9wdXBIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfcG9wdXA7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHJldHVybjtcblxuICAgICAgY29uc3QgbmV3Q29uZmlnOiBQb3B1cENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG9sZENvbmZpZyA9IHN0YXRlLmNvbmZpZztcblxuICAgICAgLy8gVXBkYXRlIGNvbnRlbnQgaWYgaXQgY2hhbmdlZFxuICAgICAgY29uc3QgY29udGVudEVsZW1lbnQgPSBlbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1wb3B1cC1jb250ZW50XScpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgaWYgKGNvbnRlbnRFbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IG5ld0NvbnRlbnQgPSBjb250ZW50RWxlbWVudC5pbm5lckhUTUw7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRDb250ZW50ID0gc3RhdGUucG9wdXAuZ2V0RWxlbWVudCgpPy5pbm5lckhUTUw7XG4gICAgICAgIFxuICAgICAgICBpZiAobmV3Q29udGVudCAhPT0gY3VycmVudENvbnRlbnQpIHtcbiAgICAgICAgICBzdGF0ZS5wb3B1cC5zZXRIVE1MKG5ld0NvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBwb3NpdGlvbiBpZiBjaGFuZ2VkXG4gICAgICBpZiAobmV3Q29uZmlnLmxuZ0xhdCkge1xuICAgICAgICBjb25zdCBvbGRMbmdMYXQgPSBvbGRDb25maWcubG5nTGF0O1xuICAgICAgICBpZiAoXG4gICAgICAgICAgIW9sZExuZ0xhdCB8fFxuICAgICAgICAgIG5ld0NvbmZpZy5sbmdMYXRbMF0gIT09IG9sZExuZ0xhdFswXSB8fFxuICAgICAgICAgIG5ld0NvbmZpZy5sbmdMYXRbMV0gIT09IG9sZExuZ0xhdFsxXVxuICAgICAgICApIHtcbiAgICAgICAgICBzdGF0ZS5wb3B1cC5zZXRMbmdMYXQobmV3Q29uZmlnLmxuZ0xhdCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIG9wZW4vY2xvc2Ugc3RhdGUgY2hhbmdlc1xuICAgICAgY29uc3Qgc2hvdWxkQmVPcGVuID0gbmV3Q29uZmlnLm9wZW4gIT09IGZhbHNlICYmIG5ld0NvbmZpZy5sbmdMYXQ7XG4gICAgICBjb25zdCBpc0N1cnJlbnRseU9wZW4gPSBzdGF0ZS5wb3B1cC5pc09wZW4oKTtcblxuICAgICAgaWYgKHNob3VsZEJlT3BlbiAmJiAhaXNDdXJyZW50bHlPcGVuKSB7XG4gICAgICAgIHN0YXRlLnBvcHVwLmFkZFRvKHN0YXRlLm1hcCk7XG4gICAgICB9IGVsc2UgaWYgKCFzaG91bGRCZU9wZW4gJiYgaXNDdXJyZW50bHlPcGVuKSB7XG4gICAgICAgIHN0YXRlLnBvcHVwLnJlbW92ZSgpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgbWF4V2lkdGggaWYgY2hhbmdlZFxuICAgICAgaWYgKG5ld0NvbmZpZy5tYXhXaWR0aCAhPT0gb2xkQ29uZmlnLm1heFdpZHRoKSB7XG4gICAgICAgIHN0YXRlLnBvcHVwLnNldE1heFdpZHRoKG5ld0NvbmZpZy5tYXhXaWR0aCB8fCAnMjQwcHgnKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGNvbmZpZ3VyYXRpb25cbiAgICAgIHN0YXRlLmNvbmZpZyA9IG5ld0NvbmZpZztcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciB1cGRhdGluZyBwb3B1cDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogUG9wdXBIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfcG9wdXA7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlbW92ZSB0aGUgcG9wdXBcbiAgICAgIHN0YXRlLnBvcHVwLnJlbW92ZSgpO1xuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBQb3B1cCBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgcG9wdXA6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEdlb0pTT05MYXllckhvb2sgLSBIb29rIGZvciB0aGUgR2VvSlNPTkxheWVyIGNvbXBvbmVudFxuICogXG4gKiBNYW5hZ2VzIEdlb0pTT04gbGF5ZXJzIHdpdGggc3VwcG9ydCBmb3IgbXVsdGlwbGUgbGF5ZXIgdHlwZXMsXG4gKiBjbHVzdGVyaW5nLCBmZWF0dXJlIGNsaWNrIGV2ZW50cywgYW5kIGR5bmFtaWMgZGF0YSB1cGRhdGVzLlxuICovXG5cbi8vIG1hcGxpYnJlLWdsIHY2IGlzIEVTTS1vbmx5IGFuZCBubyBsb25nZXIgaGFzIGEgZGVmYXVsdCBleHBvcnQuXG5pbXBvcnQgKiBhcyBtYXBsaWJyZWdsIGZyb20gJ21hcGxpYnJlLWdsJztcbmltcG9ydCB0eXBlIHsgUGFpbnRQcm9wZXJ0eU5hbWUsIExheW91dFByb3BlcnR5TmFtZSwgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBHZW9KU09OTGF5ZXJDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBzb3VyY2U6IHtcbiAgICB0eXBlOiAnZ2VvanNvbic7XG4gICAgZGF0YTogR2VvSlNPTi5HZW9KU09OO1xuICAgIGdlbmVyYXRlSWQ/OiBib29sZWFuO1xuICAgIGNsdXN0ZXI/OiBib29sZWFuO1xuICAgIGNsdXN0ZXJNYXhab29tPzogbnVtYmVyO1xuICAgIGNsdXN0ZXJSYWRpdXM/OiBudW1iZXI7XG4gICAgY2x1c3RlclByb3BlcnRpZXM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICB9O1xuICBsYXllcjoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdHlwZTogJ2ZpbGwnIHwgJ2xpbmUnIHwgJ2NpcmNsZScgfCAnc3ltYm9sJyB8ICdoZWF0bWFwJyB8ICdmaWxsLWV4dHJ1c2lvbic7XG4gICAgc291cmNlOiBzdHJpbmc7XG4gICAgcGFpbnQ/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuICAgIGxheW91dD86IFJlY29yZDxzdHJpbmcsIGFueT47XG4gICAgZmlsdGVyPzogYW55W107XG4gICAgbWluem9vbT86IG51bWJlcjtcbiAgICBtYXh6b29tPzogbnVtYmVyO1xuICAgICdzb3VyY2UtbGF5ZXInPzogc3RyaW5nO1xuICB9O1xuICBiZWZvcmVJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEdlb0pTT05MYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogR2VvSlNPTkxheWVyQ29uZmlnO1xuICBtYXA6IG1hcGxpYnJlZ2wuTWFwO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBsYXllcklkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBHZW9KU09OTGF5ZXJIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBHZW9KU09OIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IEdlb0pTT05MYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KGNvbmZpZy5tYXBJZCB8fCAnZGVmYXVsdCcpO1xuXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIGxheWVyIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzb3VyY2VJZCA9IGAke2NvbmZpZy5pZH0tc291cmNlYDtcbiAgICAgIGNvbnN0IGxheWVySWQgPSBjb25maWcuaWQ7XG5cbiAgICAgIC8vIFdhaXQgZm9yIG1hcCB0byBiZSBsb2FkZWQgYmVmb3JlIGFkZGluZyBzb3VyY2UgYW5kIGxheWVyXG4gICAgICBjb25zdCBhZGRMYXllciA9ICgpID0+IHtcbiAgICAgICAgLy8gQWRkIHNvdXJjZVxuICAgICAgICBpZiAoIW1hcC5nZXRTb3VyY2Uoc291cmNlSWQpKSB7XG4gICAgICAgICAgbWFwLmFkZFNvdXJjZShzb3VyY2VJZCwgY29uZmlnLnNvdXJjZSBhcyBhbnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIGxheWVyXG4gICAgICAgIGlmICghbWFwLmdldExheWVyKGxheWVySWQpKSB7XG4gICAgICAgICAgY29uc3QgbGF5ZXJTcGVjOiBhbnkgPSB7XG4gICAgICAgICAgICAuLi5jb25maWcubGF5ZXIsXG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZUlkXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChjb25maWcuYmVmb3JlSWQpIHtcbiAgICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMsIGNvbmZpZy5iZWZvcmVJZCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldHVwIGNsaWNrIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgbWFwLm9uKCdjbGljaycsIGxheWVySWQsIChlOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX2NsaWNrZWQnLCB7XG4gICAgICAgICAgICAgIGxheWVySWQ6IGxheWVySWQsXG4gICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF0sXG4gICAgICAgICAgICAgIGxuZ0xhdDogZS5sbmdMYXQudG9BcnJheSgpLFxuICAgICAgICAgICAgICBwb2ludDogW2UucG9pbnQueCwgZS5wb2ludC55XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXR1cCBtb3VzZSBlbnRlci9sZWF2ZSBoYW5kbGVycyBmb3IgY3Vyc29yIGNoYW5nZVxuICAgICAgICBtYXAub24oJ21vdXNlZW50ZXInLCBsYXllcklkLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgbWFwLmdldENhbnZhcygpLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlZW50ZXInLCB7XG4gICAgICAgICAgICAgIGxheWVySWQ6IGxheWVySWQsXG4gICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbWFwLm9uKCdtb3VzZWxlYXZlJywgbGF5ZXJJZCwgKCkgPT4ge1xuICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICAgICAgICBcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6ZmVhdHVyZV9tb3VzZWxlYXZlJywge1xuICAgICAgICAgICAgbGF5ZXJJZDogbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBFbWl0IHNvdXJjZSBsb2FkZWQgZXZlbnRcbiAgICAgICAgY29uc3Qgc291cmNlID0gbWFwLmdldFNvdXJjZShzb3VyY2VJZCkgYXMgbWFwbGlicmVnbC5HZW9KU09OU291cmNlO1xuICAgICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgICAgbWFwLm9uY2UoJ3NvdXJjZWRhdGEnLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5zb3VyY2VJZCA9PT0gc291cmNlSWQgJiYgZS5pc1NvdXJjZUxvYWRlZCkge1xuICAgICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6c291cmNlX2xvYWRlZCcsIHtcbiAgICAgICAgICAgICAgICBsYXllcklkOiBsYXllcklkLFxuICAgICAgICAgICAgICAgIHNvdXJjZUlkOiBzb3VyY2VJZFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgICAvLyBIYW5kbGUgY29tbWFuZHMgZnJvbSBMaXZlVmlld1xuICAgICAgdGhpcy5oYW5kbGVFdmVudCgnbGF5ZXI6c2V0X3BhaW50X3Byb3BlcnR5JywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgICBpZiAocGF5bG9hZC5sYXllcl9pZCA9PT0gbGF5ZXJJZCkge1xuICAgICAgICAgIG1hcC5zZXRQYWludFByb3BlcnR5KGxheWVySWQsIHBheWxvYWQucHJvcGVydHksIHBheWxvYWQudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5oYW5kbGVFdmVudCgnbGF5ZXI6c2V0X2xheW91dF9wcm9wZXJ0eScsIChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKHBheWxvYWQubGF5ZXJfaWQgPT09IGxheWVySWQpIHtcbiAgICAgICAgICBtYXAuc2V0TGF5b3V0UHJvcGVydHkobGF5ZXJJZCwgcGF5bG9hZC5wcm9wZXJ0eSwgcGF5bG9hZC52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmhhbmRsZUV2ZW50KCdsYXllcjpzZXRfZmlsdGVyJywgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgICBpZiAocGF5bG9hZC5sYXllcl9pZCA9PT0gbGF5ZXJJZCkge1xuICAgICAgICAgIG1hcC5zZXRGaWx0ZXIobGF5ZXJJZCwgcGF5bG9hZC5maWx0ZXIpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5oYW5kbGVFdmVudCgnbGF5ZXI6c2V0X2RhdGEnLCAocGF5bG9hZDogYW55KSA9PiB7XG4gICAgICAgIGlmIChwYXlsb2FkLmxheWVyX2lkID09PSBsYXllcklkKSB7XG4gICAgICAgICAgY29uc3Qgc291cmNlID0gbWFwLmdldFNvdXJjZShzb3VyY2VJZCkgYXMgbWFwbGlicmVnbC5HZW9KU09OU291cmNlO1xuICAgICAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgICAgIHNvdXJjZS5zZXREYXRhKHBheWxvYWQuZGF0YSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gU2F2ZSBzdGF0ZVxuICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2dlb2pzb25fbGF5ZXIgPSB7XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgbWFwLFxuICAgICAgICBzb3VyY2VJZCxcbiAgICAgICAgbGF5ZXJJZFxuICAgICAgfTtcblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBHZW9KU09OIExheWVyIFwiJHtsYXllcklkfVwiIGNyZWF0ZWRgKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBtb3VudGluZyBHZW9KU09OIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogR2VvSlNPTkxheWVySG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2dlb2pzb25fbGF5ZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHJldHVybjtcblxuICAgICAgY29uc3QgbmV3Q29uZmlnOiBHZW9KU09OTGF5ZXJDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBzb3VyY2UgZGF0YSBpZiBpdCBjaGFuZ2VkXG4gICAgICBjb25zdCBzb3VyY2UgPSBzdGF0ZS5tYXAuZ2V0U291cmNlKHN0YXRlLnNvdXJjZUlkKSBhcyBtYXBsaWJyZWdsLkdlb0pTT05Tb3VyY2U7XG4gICAgICBpZiAoc291cmNlICYmIG5ld0NvbmZpZy5zb3VyY2UuZGF0YSkge1xuICAgICAgICAvLyBDaGVjayBpZiBkYXRhIGFjdHVhbGx5IGNoYW5nZWQgKHNpbXBsZSBjb21wYXJpc29uKVxuICAgICAgICBjb25zdCBvbGREYXRhID0gSlNPTi5zdHJpbmdpZnkoc3RhdGUuY29uZmlnLnNvdXJjZS5kYXRhKTtcbiAgICAgICAgY29uc3QgbmV3RGF0YSA9IEpTT04uc3RyaW5naWZ5KG5ld0NvbmZpZy5zb3VyY2UuZGF0YSk7XG4gICAgICAgIFxuICAgICAgICBpZiAob2xkRGF0YSAhPT0gbmV3RGF0YSkge1xuICAgICAgICAgIHNvdXJjZS5zZXREYXRhKG5ld0NvbmZpZy5zb3VyY2UuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHBhaW50IHByb3BlcnRpZXMgaWYgdGhleSBjaGFuZ2VkXG4gICAgICBpZiAobmV3Q29uZmlnLmxheWVyLnBhaW50KSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKG5ld0NvbmZpZy5sYXllci5wYWludCkuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSBzdGF0ZS5jb25maWcubGF5ZXIucGFpbnQ/LltrZXldO1xuICAgICAgICAgIGlmIChKU09OLnN0cmluZ2lmeShvbGRWYWx1ZSkgIT09IEpTT04uc3RyaW5naWZ5KHZhbHVlKSkge1xuICAgICAgICAgICAgc3RhdGUubWFwLnNldFBhaW50UHJvcGVydHkoc3RhdGUubGF5ZXJJZCwga2V5IGFzIFBhaW50UHJvcGVydHlOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGxheW91dCBwcm9wZXJ0aWVzIGlmIHRoZXkgY2hhbmdlZFxuICAgICAgaWYgKG5ld0NvbmZpZy5sYXllci5sYXlvdXQpIHtcbiAgICAgICAgT2JqZWN0LmVudHJpZXMobmV3Q29uZmlnLmxheWVyLmxheW91dCkuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSBzdGF0ZS5jb25maWcubGF5ZXIubGF5b3V0Py5ba2V5XTtcbiAgICAgICAgICBpZiAoSlNPTi5zdHJpbmdpZnkob2xkVmFsdWUpICE9PSBKU09OLnN0cmluZ2lmeSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHN0YXRlLm1hcC5zZXRMYXlvdXRQcm9wZXJ0eShzdGF0ZS5sYXllcklkLCBrZXkgYXMgTGF5b3V0UHJvcGVydHlOYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGZpbHRlciBpZiBpdCBjaGFuZ2VkXG4gICAgICBpZiAoSlNPTi5zdHJpbmdpZnkobmV3Q29uZmlnLmxheWVyLmZpbHRlcikgIT09IEpTT04uc3RyaW5naWZ5KHN0YXRlLmNvbmZpZy5sYXllci5maWx0ZXIpKSB7XG4gICAgICAgIHN0YXRlLm1hcC5zZXRGaWx0ZXIoc3RhdGUubGF5ZXJJZCwgKG5ld0NvbmZpZy5sYXllci5maWx0ZXIgfHwgbnVsbCkgYXMgYW55KTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGNvbmZpZ3VyYXRpb25cbiAgICAgIHN0YXRlLmNvbmZpZyA9IG5ld0NvbmZpZztcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciB1cGRhdGluZyBHZW9KU09OIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBHZW9KU09OTGF5ZXJIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfZ2VvanNvbl9sYXllcjtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVtb3ZlIGxheWVyXG4gICAgICBpZiAoc3RhdGUubWFwLmdldExheWVyKHN0YXRlLmxheWVySWQpKSB7XG4gICAgICAgIHN0YXRlLm1hcC5yZW1vdmVMYXllcihzdGF0ZS5sYXllcklkKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtb3ZlIHNvdXJjZVxuICAgICAgaWYgKHN0YXRlLm1hcC5nZXRTb3VyY2Uoc3RhdGUuc291cmNlSWQpKSB7XG4gICAgICAgIHN0YXRlLm1hcC5yZW1vdmVTb3VyY2Uoc3RhdGUuc291cmNlSWQpO1xuICAgICAgfVxuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEdlb0pTT04gTGF5ZXIgXCIke3N0YXRlLmxheWVySWR9XCIgZGVzdHJveWVkYCk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyBHZW9KU09OIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBOYXZpZ2F0aW9uQ29udHJvbEhvb2sgLSBIb29rIGZvciB0aGUgTmF2aWdhdGlvbkNvbnRyb2wgY29tcG9uZW50XG4gKiBcbiAqIE1hbmFnZXMgTWFwTGlicmUncyBuYXRpdmUgbmF2aWdhdGlvbiBjb250cm9scyAoem9vbSBhbmQgY29tcGFzcykuXG4gKi9cblxuLy8gbWFwbGlicmUtZ2wgdjYgaXMgRVNNLW9ubHkgYW5kIG5vIGxvbmdlciBoYXMgYSBkZWZhdWx0IGV4cG9ydC5cbmltcG9ydCAqIGFzIG1hcGxpYnJlZ2wgZnJvbSAnbWFwbGlicmUtZ2wnO1xuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2ssIE5hdmlnYXRpb25Db250cm9sQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBOYXZpZ2F0aW9uQ29udHJvbEhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogTmF2aWdhdGlvbkNvbnRyb2xDb25maWc7XG4gIG1hcDogbWFwbGlicmVnbC5NYXA7XG4gIGNvbnRyb2w6IG1hcGxpYnJlZ2wuTmF2aWdhdGlvbkNvbnRyb2w7XG59XG5cbmV4cG9ydCBjb25zdCBOYXZpZ2F0aW9uQ29udHJvbEhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIG5hdmlnYXRpb24gY29udHJvbCBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBOYXZpZ2F0aW9uQ29udHJvbENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KGNvbmZpZy5tYXBJZCB8fCAnZGVmYXVsdCcpO1xuXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIG5hdmlnYXRpb24gY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIG5hdmlnYXRpb24gY29udHJvbCB3aXRoIG9wdGlvbnNcbiAgICAgIGNvbnN0IGNvbnRyb2xPcHRpb25zOiBtYXBsaWJyZWdsLk5hdmlnYXRpb25Db250cm9sT3B0aW9ucyA9IHtcbiAgICAgICAgc2hvd0NvbXBhc3M6IGNvbmZpZy5zaG93Q29tcGFzcyAhPT0gZmFsc2UsXG4gICAgICAgIHNob3dab29tOiBjb25maWcuc2hvd1pvb20gIT09IGZhbHNlLFxuICAgICAgICB2aXN1YWxpemVQaXRjaDogY29uZmlnLnZpc3VhbGl6ZVBpdGNoIHx8IGZhbHNlXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBjb250cm9sID0gbmV3IG1hcGxpYnJlZ2wuTmF2aWdhdGlvbkNvbnRyb2woY29udHJvbE9wdGlvbnMpO1xuXG4gICAgICAvLyBBZGQgY29udHJvbCB0byBtYXAgYXQgc3BlY2lmaWVkIHBvc2l0aW9uXG4gICAgICBjb25zdCBwb3NpdGlvbiA9IChjb25maWcucG9zaXRpb24gfHwgJ3RvcC1yaWdodCcpIGFzICd0b3AtbGVmdCcgfCAndG9wLXJpZ2h0JyB8ICdib3R0b20tbGVmdCcgfCAnYm90dG9tLXJpZ2h0JztcbiAgICAgIG1hcC5hZGRDb250cm9sKGNvbnRyb2wsIHBvc2l0aW9uKTtcblxuICAgICAgLy8gU2F2ZSBzdGF0ZVxuICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X25hdmlnYXRpb25fY29udHJvbCA9IHtcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBtYXAsXG4gICAgICAgIGNvbnRyb2xcbiAgICAgIH07XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gTmF2aWdhdGlvbiBDb250cm9sIFwiJHtjb25maWcuaWR9XCIgYWRkZWQgYXQgJHtwb3NpdGlvbn1gKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBtb3VudGluZyBuYXZpZ2F0aW9uIGNvbnRyb2w6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IE5hdmlnYXRpb25Db250cm9sSG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X25hdmlnYXRpb25fY29udHJvbDtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVtb3ZlIHRoZSBjb250cm9sIGZyb20gdGhlIG1hcFxuICAgICAgc3RhdGUubWFwLnJlbW92ZUNvbnRyb2woc3RhdGUuY29udHJvbCk7XG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIE5hdmlnYXRpb24gQ29udHJvbCBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIHJlbW92ZWRgKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIG5hdmlnYXRpb24gY29udHJvbDonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogU2NhbGVDb250cm9sSG9vayAtIEhvb2sgZm9yIHRoZSBTY2FsZUNvbnRyb2wgY29tcG9uZW50XG4gKiBcbiAqIEdlc3Rpb25hIGNvbnRyb2xlcyBkZSBlc2NhbGEgbmF0aXZvcyBkZSBNYXBMaWJyZS5cbiAqL1xuXG4vLyBtYXBsaWJyZS1nbCB2NiBpcyBFU00tb25seSBhbmQgbm8gbG9uZ2VyIGhhcyBhIGRlZmF1bHQgZXhwb3J0LlxuaW1wb3J0ICogYXMgbWFwbGlicmVnbCBmcm9tICdtYXBsaWJyZS1nbCc7XG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vaywgU2NhbGVDb250cm9sQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBTY2FsZUNvbnRyb2xIb29rU3RhdGUge1xuICBjb25maWc6IFNjYWxlQ29udHJvbENvbmZpZztcbiAgbWFwOiBtYXBsaWJyZWdsLk1hcDtcbiAgY29udHJvbDogbWFwbGlicmVnbC5TY2FsZUNvbnRyb2w7XG59XG5cbmV4cG9ydCBjb25zdCBTY2FsZUNvbnRyb2xIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBzY2FsZSBjb250cm9sIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFNjYWxlQ29udHJvbENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KGNvbmZpZy5tYXBJZCB8fCAnZGVmYXVsdCcpO1xuXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIHNjYWxlIGNvbnRyb2wgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBzY2FsZSBjb250cm9sIHdpdGggb3B0aW9uc1xuICAgICAgY29uc3QgY29udHJvbE9wdGlvbnM6IG1hcGxpYnJlZ2wuU2NhbGVDb250cm9sT3B0aW9ucyA9IHtcbiAgICAgICAgbWF4V2lkdGg6IGNvbmZpZy5tYXhXaWR0aCB8fCAxMDAsXG4gICAgICAgIHVuaXQ6IChjb25maWcudW5pdCB8fCAnbWV0cmljJykgYXMgJ2ltcGVyaWFsJyB8ICdtZXRyaWMnIHwgJ25hdXRpY2FsJ1xuICAgICAgfTtcblxuICAgICAgY29uc3QgY29udHJvbCA9IG5ldyBtYXBsaWJyZWdsLlNjYWxlQ29udHJvbChjb250cm9sT3B0aW9ucyk7XG5cbiAgICAgIC8vIEFkZCBjb250cm9sIHRvIG1hcCBhdCBzcGVjaWZpZWQgcG9zaXRpb25cbiAgICAgIGNvbnN0IHBvc2l0aW9uID0gKGNvbmZpZy5wb3NpdGlvbiB8fCAnYm90dG9tLWxlZnQnKSBhcyAndG9wLWxlZnQnIHwgJ3RvcC1yaWdodCcgfCAnYm90dG9tLWxlZnQnIHwgJ2JvdHRvbS1yaWdodCc7XG4gICAgICBtYXAuYWRkQ29udHJvbChjb250cm9sLCBwb3NpdGlvbik7XG5cbiAgICAgIC8vIFNhdmUgc3RhdGVcbiAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9zY2FsZV9jb250cm9sID0ge1xuICAgICAgICBjb25maWcsXG4gICAgICAgIG1hcCxcbiAgICAgICAgY29udHJvbFxuICAgICAgfTtcblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBTY2FsZSBDb250cm9sIFwiJHtjb25maWcuaWR9XCIgYWRkZWQgYXQgJHtwb3NpdGlvbn0gKCR7Y29uZmlnLnVuaXR9KWApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIHNjYWxlIGNvbnRyb2w6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IFNjYWxlQ29udHJvbEhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9zY2FsZV9jb250cm9sO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZW1vdmUgdGhlIGNvbnRyb2wgZnJvbSB0aGUgbWFwXG4gICAgICBzdGF0ZS5tYXAucmVtb3ZlQ29udHJvbChzdGF0ZS5jb250cm9sKTtcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gU2NhbGUgQ29udHJvbCBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIHJlbW92ZWRgKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIHNjYWxlIGNvbnRyb2w6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEZ1bGxzY3JlZW5Db250cm9sSG9vayAtIEhvb2sgZm9yIHRoZSBGdWxsc2NyZWVuQ29udHJvbCBjb21wb25lbnRcbiAqIFxuICogTWFuYWdlcyBNYXBMaWJyZSdzIG5hdGl2ZSBmdWxsc2NyZWVuIGNvbnRyb2wuXG4gKi9cblxuLy8gbWFwbGlicmUtZ2wgdjYgaXMgRVNNLW9ubHkgYW5kIG5vIGxvbmdlciBoYXMgYSBkZWZhdWx0IGV4cG9ydC5cbmltcG9ydCAqIGFzIG1hcGxpYnJlZ2wgZnJvbSAnbWFwbGlicmUtZ2wnO1xuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2ssIEZ1bGxzY3JlZW5Db250cm9sQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBGdWxsc2NyZWVuQ29udHJvbEhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogRnVsbHNjcmVlbkNvbnRyb2xDb25maWc7XG4gIG1hcDogbWFwbGlicmVnbC5NYXA7XG4gIGNvbnRyb2w6IG1hcGxpYnJlZ2wuRnVsbHNjcmVlbkNvbnRyb2w7XG59XG5cbmV4cG9ydCBjb25zdCBGdWxsc2NyZWVuQ29udHJvbEhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIGZ1bGxzY3JlZW4gY29udHJvbCBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBGdWxsc2NyZWVuQ29udHJvbENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KGNvbmZpZy5tYXBJZCB8fCAnZGVmYXVsdCcpO1xuXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIGZ1bGxzY3JlZW4gY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IGNvbnRhaW5lciBlbGVtZW50IGlmIHNwZWNpZmllZFxuICAgICAgbGV0IGNvbnRhaW5lckVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKGNvbmZpZy5jb250YWluZXJTZWxlY3Rvcikge1xuICAgICAgICBjb25zdCBjb250YWluZXJFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5jb250YWluZXJTZWxlY3Rvcik7XG4gICAgICAgIGlmIChjb250YWluZXJFbCkge1xuICAgICAgICAgIGNvbnRhaW5lckVsZW1lbnQgPSBjb250YWluZXJFbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIENvbnRhaW5lciBcIiR7Y29uZmlnLmNvbnRhaW5lclNlbGVjdG9yfVwiIG5vdCBmb3VuZCwgdXNpbmcgbWFwIGNvbnRhaW5lcmApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBmdWxsc2NyZWVuIGNvbnRyb2wgd2l0aCBvcHRpb25zXG4gICAgICBjb25zdCBjb250cm9sT3B0aW9uczogbWFwbGlicmVnbC5GdWxsc2NyZWVuQ29udHJvbE9wdGlvbnMgPSBjb250YWluZXJFbGVtZW50ID8geyBjb250YWluZXI6IGNvbnRhaW5lckVsZW1lbnQgfSA6IHt9O1xuICAgICAgY29uc3QgY29udHJvbCA9IG5ldyBtYXBsaWJyZWdsLkZ1bGxzY3JlZW5Db250cm9sKGNvbnRyb2xPcHRpb25zKTtcblxuICAgICAgLy8gQWRkIGNvbnRyb2wgdG8gbWFwIGF0IHNwZWNpZmllZCBwb3NpdGlvblxuICAgICAgY29uc3QgcG9zaXRpb24gPSAoY29uZmlnLnBvc2l0aW9uIHx8ICd0b3AtcmlnaHQnKSBhcyAndG9wLWxlZnQnIHwgJ3RvcC1yaWdodCcgfCAnYm90dG9tLWxlZnQnIHwgJ2JvdHRvbS1yaWdodCc7XG4gICAgICBtYXAuYWRkQ29udHJvbChjb250cm9sLCBwb3NpdGlvbik7XG5cbiAgICAgIC8vIEZ1bGxzY3JlZW5Db250cm9sIGlzIGl0c2VsZiBhbiBFdmVudGVkIGFuZCBmaXJlcyB0aGVzZSBvbiB0aGUgY29udHJvbCxcbiAgICAgIC8vIG5ldmVyIG9uIHRoZSBtYXAgXHUyMDE0IGxpc3RlbmluZyBvbiB0aGUgbWFwIHNpbGVudGx5IHJlY2VpdmVkIG5vdGhpbmcuXG4gICAgICBjb250cm9sLm9uKCdmdWxsc2NyZWVuc3RhcnQnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdmdWxsc2NyZWVuOmVudGVyZWQnLCB7XG4gICAgICAgICAgY29udHJvbElkOiBjb25maWcuaWQsXG4gICAgICAgICAgbWFwSWQ6IGNvbmZpZy5tYXBJZFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb250cm9sLm9uKCdmdWxsc2NyZWVuZW5kJywgKCkgPT4ge1xuICAgICAgICB0aGlzLnB1c2hFdmVudCgnZnVsbHNjcmVlbjpleGl0ZWQnLCB7XG4gICAgICAgICAgY29udHJvbElkOiBjb25maWcuaWQsXG4gICAgICAgICAgbWFwSWQ6IGNvbmZpZy5tYXBJZFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTYXZlIHN0YXRlXG4gICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfZnVsbHNjcmVlbl9jb250cm9sID0ge1xuICAgICAgICBjb25maWcsXG4gICAgICAgIG1hcCxcbiAgICAgICAgY29udHJvbFxuICAgICAgfTtcblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBGdWxsc2NyZWVuIENvbnRyb2wgXCIke2NvbmZpZy5pZH1cIiBhZGRlZCBhdCAke3Bvc2l0aW9ufWApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGZ1bGxzY3JlZW4gY29udHJvbDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogRnVsbHNjcmVlbkNvbnRyb2xIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfZnVsbHNjcmVlbl9jb250cm9sO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZW1vdmUgdGhlIGNvbnRyb2wgZnJvbSB0aGUgbWFwXG4gICAgICBzdGF0ZS5tYXAucmVtb3ZlQ29udHJvbChzdGF0ZS5jb250cm9sKTtcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gRnVsbHNjcmVlbiBDb250cm9sIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgcmVtb3ZlZGApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgZnVsbHNjcmVlbiBjb250cm9sOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBHZW9sb2NhdGVDb250cm9sSG9vayAtIEhvb2sgZm9yIHRoZSBHZW9sb2NhdGVDb250cm9sIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIE1hcExpYnJlIEdMIEpTIGdlb2xvY2F0ZSBjb250cm9sLFxuICogbGV0dGluZyB1c2VycyBmaW5kIHRoZWlyIGN1cnJlbnQgbG9jYXRpb24gYW5kIG9wdGlvbmFsbHlcbiAqIHRyYWNrIHRoZWlyIG1vdmVtZW50IGluIHJlYWwgdGltZS5cbiAqL1xuXG4vLyBtYXBsaWJyZS1nbCB2NiBpcyBFU00tb25seSBhbmQgbm8gbG9uZ2VyIGhhcyBhIGRlZmF1bHQgZXhwb3J0LlxuaW1wb3J0ICogYXMgbWFwbGlicmVnbCBmcm9tICdtYXBsaWJyZS1nbCc7XG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgR2VvbG9jYXRlQ29udHJvbENvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHBvc2l0aW9uOiAndG9wLWxlZnQnIHwgJ3RvcC1yaWdodCcgfCAnYm90dG9tLWxlZnQnIHwgJ2JvdHRvbS1yaWdodCc7XG4gIHRyYWNrVXNlckxvY2F0aW9uOiBib29sZWFuO1xuICBzaG93QWNjdXJhY3lDaXJjbGU6IGJvb2xlYW47XG4gIHNob3dVc2VySGVhZGluZzogYm9vbGVhbjtcbiAgZml0Qm91bmRzT3B0aW9uczogYW55O1xufVxuXG5pbnRlcmZhY2UgR2VvbG9jYXRlQ29udHJvbEhvb2tTdGF0ZSB7XG4gIGNvbnRyb2w6IG1hcGxpYnJlZ2wuR2VvbG9jYXRlQ29udHJvbDtcbiAgY29uZmlnOiBHZW9sb2NhdGVDb250cm9sQ29uZmlnO1xufVxuXG5leHBvcnQgY29uc3QgR2VvbG9jYXRlQ29udHJvbEhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gZ2VvbG9jYXRlIGNvbnRyb2wgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogR2VvbG9jYXRlQ29udHJvbENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGdlb2xvY2F0ZSBjb250cm9sIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgdGhlIGdlb2xvY2F0ZSBjb250cm9sXG4gICAgICBjb25zdCBjb250cm9sID0gbmV3IG1hcGxpYnJlZ2wuR2VvbG9jYXRlQ29udHJvbCh7XG4gICAgICAgIHBvc2l0aW9uT3B0aW9uczoge1xuICAgICAgICAgIGVuYWJsZUhpZ2hBY2N1cmFjeTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICB0cmFja1VzZXJMb2NhdGlvbjogY29uZmlnLnRyYWNrVXNlckxvY2F0aW9uLFxuICAgICAgICBzaG93QWNjdXJhY3lDaXJjbGU6IGNvbmZpZy5zaG93QWNjdXJhY3lDaXJjbGUsXG4gICAgICAgIHNob3dVc2VyTG9jYXRpb246IGNvbmZpZy5zaG93VXNlckhlYWRpbmcsIC8vIE1hcExpYnJlIHVzZXMgc2hvd1VzZXJMb2NhdGlvbiBpbnN0ZWFkXG4gICAgICAgIGZpdEJvdW5kc09wdGlvbnM6IGNvbmZpZy5maXRCb3VuZHNPcHRpb25zXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIHRoZSBjb250cm9sIHRvIHRoZSBtYXAgYXQgdGhlIGdpdmVuIHBvc2l0aW9uXG4gICAgICBtYXAuYWRkQ29udHJvbChjb250cm9sLCBjb25maWcucG9zaXRpb24pO1xuXG4gICAgICAvLyBFdmVudDogZ2VvbG9jYXRlIChsb2NhdGlvbiBmb3VuZClcbiAgICAgIGNvbnRyb2wub24oJ2dlb2xvY2F0ZScsIChlOiBhbnkpID0+IHtcbiAgICAgICAgY29uc3QgY29vcmRzID0ge1xuICAgICAgICAgIGxhdGl0dWRlOiBlLmNvb3Jkcy5sYXRpdHVkZSxcbiAgICAgICAgICBsb25naXR1ZGU6IGUuY29vcmRzLmxvbmdpdHVkZSxcbiAgICAgICAgICBhY2N1cmFjeTogZS5jb29yZHMuYWNjdXJhY3ksXG4gICAgICAgICAgYWx0aXR1ZGU6IGUuY29vcmRzLmFsdGl0dWRlLFxuICAgICAgICAgIGFsdGl0dWRlQWNjdXJhY3k6IGUuY29vcmRzLmFsdGl0dWRlQWNjdXJhY3ksXG4gICAgICAgICAgaGVhZGluZzogZS5jb29yZHMuaGVhZGluZyxcbiAgICAgICAgICBzcGVlZDogZS5jb29yZHMuc3BlZWQsXG4gICAgICAgICAgdGltZXN0YW1wOiBlLnRpbWVzdGFtcFxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdnZW9sb2NhdGU6bG9jYXRpb25fZm91bmQnLCB7IGNvb3JkcyB9KTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBHZW9sb2NhdGUgY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiOiBMb2NhdGlvbiBmb3VuZGAsIGNvb3Jkcyk7XG4gICAgICB9KTtcblxuICAgICAgLy8gRXZlbnQ6IHRyYWNrdXNlcmxvY2F0aW9uc3RhcnRcbiAgICAgIGNvbnRyb2wub24oJ3RyYWNrdXNlcmxvY2F0aW9uc3RhcnQnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdnZW9sb2NhdGU6dHJhY2tpbmdfc3RhcnRlZCcsIHt9KTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBHZW9sb2NhdGUgY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiOiBUcmFja2luZyBzdGFydGVkYCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gRXZlbnQ6IHRyYWNrdXNlcmxvY2F0aW9uZW5kXG4gICAgICBjb250cm9sLm9uKCd0cmFja3VzZXJsb2NhdGlvbmVuZCcsICgpID0+IHtcbiAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2dlb2xvY2F0ZTp0cmFja2luZ19zdG9wcGVkJywge30pO1xuICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEdlb2xvY2F0ZSBjb250cm9sIFwiJHtjb25maWcuaWR9XCI6IFRyYWNraW5nIHN0b3BwZWRgKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBFdmVudDogZXJyb3JcbiAgICAgIGNvbnRyb2wub24oJ2Vycm9yJywgKGU6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBlcnJvciA9IHtcbiAgICAgICAgICBjb2RlOiBlLmNvZGUsXG4gICAgICAgICAgbWVzc2FnZTogZS5tZXNzYWdlXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2dlb2xvY2F0ZTpsb2NhdGlvbl9lcnJvcicsIGVycm9yKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gR2VvbG9jYXRlIGNvbnRyb2wgXCIke2NvbmZpZy5pZH1cIjogRXJyb3JgLCBlcnJvcik7XG4gICAgICB9KTtcblxuICAgICAgLy8gRXZlbnQ6IHVzZXIgbG9jYXRpb24gdXBkYXRlZCAoZHVyYW50ZSB0cmFja2luZylcbiAgICAgIC8vIFRoaXMgZmlyZXMgY29udGludW91c2x5IHdoaWxlIHRyYWNrVXNlckxvY2F0aW9uIGlzIG9uXG4gICAgICBtYXAub24oJ21vdmVlbmQnLCAoKSA9PiB7XG4gICAgICAgIGlmIChjb250cm9sLl93YXRjaFN0YXRlID09PSAnQUNUSVZFX0xPQ0snKSB7XG4gICAgICAgICAgY29uc3QgY2VudGVyID0gbWFwLmdldENlbnRlcigpO1xuICAgICAgICAgIGNvbnN0IGNvb3JkcyA9IHtcbiAgICAgICAgICAgIGxhdGl0dWRlOiBjZW50ZXIubGF0LFxuICAgICAgICAgICAgbG9uZ2l0dWRlOiBjZW50ZXIubG5nXG4gICAgICAgICAgfTtcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnZ2VvbG9jYXRlOnVzZXJfbG9jYXRpb25fdXBkYXRlZCcsIHsgY29vcmRzIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gR3VhcmRhciBlc3RhZG9cbiAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9nZW9sb2NhdGUgPSB7XG4gICAgICAgIGNvbnRyb2wsXG4gICAgICAgIGNvbmZpZ1xuICAgICAgfTtcblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBHZW9sb2NhdGUgY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiIG1vdW50ZWQgb24gbWFwIFwiJHttYXBJZH1cImApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGdlb2xvY2F0ZSBjb250cm9sOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBHZW9sb2NhdGVDb250cm9sSG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2dlb2xvY2F0ZTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoc3RhdGUuY29uZmlnLm1hcElkKTtcbiAgICAgIGlmIChtYXAgJiYgc3RhdGUuY29udHJvbCkge1xuICAgICAgICAvLyBSZW1vdmUgdGhlIGNvbnRyb2wgZnJvbSB0aGUgbWFwXG4gICAgICAgIG1hcC5yZW1vdmVDb250cm9sKHN0YXRlLmNvbnRyb2wpO1xuICAgICAgfVxuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEdlb2xvY2F0ZSBjb250cm9sIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgZ2VvbG9jYXRlIGNvbnRyb2w6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEF0dHJpYnV0aW9uQ29udHJvbEhvb2sgLSBIb29rIGZvciB0aGUgQXR0cmlidXRpb25Db250cm9sIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIE1hcExpYnJlIEdMIEpTIGF0dHJpYnV0aW9uIGNvbnRyb2wsXG4gKiBzaG93aW5nIGF0dHJpYnV0aW9uIGZvciB0aGUgbWFwIGFuZCBpdHMgZGF0YSBzb3VyY2VzLlxuICovXG5cbi8vIG1hcGxpYnJlLWdsIHY2IGlzIEVTTS1vbmx5IGFuZCBubyBsb25nZXIgaGFzIGEgZGVmYXVsdCBleHBvcnQuXG5pbXBvcnQgKiBhcyBtYXBsaWJyZWdsIGZyb20gJ21hcGxpYnJlLWdsJztcbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBBdHRyaWJ1dGlvbkNvbnRyb2xDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBwb3NpdGlvbjogJ3RvcC1sZWZ0JyB8ICd0b3AtcmlnaHQnIHwgJ2JvdHRvbS1sZWZ0JyB8ICdib3R0b20tcmlnaHQnO1xuICBjb21wYWN0OiBib29sZWFuO1xuICBjdXN0b21BdHRyaWJ1dGlvbjogc3RyaW5nIHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIEF0dHJpYnV0aW9uQ29udHJvbEhvb2tTdGF0ZSB7XG4gIGNvbnRyb2w6IG1hcGxpYnJlZ2wuQXR0cmlidXRpb25Db250cm9sO1xuICBjb25maWc6IEF0dHJpYnV0aW9uQ29udHJvbENvbmZpZztcbn1cblxuZXhwb3J0IGNvbnN0IEF0dHJpYnV0aW9uQ29udHJvbEhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gYXR0cmlidXRpb24gY29udHJvbCBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBBdHRyaWJ1dGlvbkNvbnRyb2xDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciBhdHRyaWJ1dGlvbiBjb250cm9sIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB0aGUgY29udHJvbCBvcHRpb25zXG4gICAgICBjb25zdCBjb250cm9sT3B0aW9uczogbWFwbGlicmVnbC5BdHRyaWJ1dGlvbkNvbnRyb2xPcHRpb25zID0ge1xuICAgICAgICBjb21wYWN0OiBjb25maWcuY29tcGFjdFxuICAgICAgfTtcblxuICAgICAgLy8gQWRkIGN1c3RvbSBhdHRyaWJ1dGlvbiB3aGVuIHByb3ZpZGVkXG4gICAgICBpZiAoY29uZmlnLmN1c3RvbUF0dHJpYnV0aW9uKSB7XG4gICAgICAgIGNvbnRyb2xPcHRpb25zLmN1c3RvbUF0dHJpYnV0aW9uID0gY29uZmlnLmN1c3RvbUF0dHJpYnV0aW9uO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgdGhlIGF0dHJpYnV0aW9uIGNvbnRyb2xcbiAgICAgIGNvbnN0IGNvbnRyb2wgPSBuZXcgbWFwbGlicmVnbC5BdHRyaWJ1dGlvbkNvbnRyb2woY29udHJvbE9wdGlvbnMpO1xuXG4gICAgICAvLyBBZGQgdGhlIGNvbnRyb2wgdG8gdGhlIG1hcCBhdCB0aGUgZ2l2ZW4gcG9zaXRpb25cbiAgICAgIG1hcC5hZGRDb250cm9sKGNvbnRyb2wsIGNvbmZpZy5wb3NpdGlvbik7XG5cbiAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfYXR0cmlidXRpb24gPSB7XG4gICAgICAgIGNvbnRyb2wsXG4gICAgICAgIGNvbmZpZ1xuICAgICAgfTtcblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBBdHRyaWJ1dGlvbiBjb250cm9sIFwiJHtjb25maWcuaWR9XCIgbW91bnRlZCBvbiBtYXAgXCIke21hcElkfVwiYCk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgYXR0cmlidXRpb24gY29udHJvbDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogQXR0cmlidXRpb25Db250cm9sSG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2F0dHJpYnV0aW9uO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCAmJiBzdGF0ZS5jb250cm9sKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgY29udHJvbCBmcm9tIHRoZSBtYXBcbiAgICAgICAgbWFwLnJlbW92ZUNvbnRyb2woc3RhdGUuY29udHJvbCk7XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gQXR0cmlidXRpb24gY29udHJvbCBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIGF0dHJpYnV0aW9uIGNvbnRyb2w6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIENpcmNsZUxheWVySG9vayAtIEhvb2sgZm9yIHRoZSBDaXJjbGVMYXllciBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIG1hbmFnZXMgYSBjaXJjbGUgbGF5ZXIgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiByZW5kZXJpbmcgcG9pbnRzIGFzIGNpcmNsZXMgd2l0aCBjb25maWd1cmFibGUgc3R5bGluZy5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgQ2lyY2xlTGF5ZXJDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBzb3VyY2VMYXllcj86IHN0cmluZztcbiAgcGFpbnQ6IGFueTtcbiAgbGF5b3V0OiBhbnk7XG4gIGZpbHRlcj86IGFueTtcbiAgbWluWm9vbT86IG51bWJlcjtcbiAgbWF4Wm9vbT86IG51bWJlcjtcbiAgYmVmb3JlSWQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBDaXJjbGVMYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogQ2lyY2xlTGF5ZXJDb25maWc7XG4gIGNsaWNrSGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG4gIG1vdXNlZW50ZXJIYW5kbGVyPzogKGU6IGFueSkgPT4gdm9pZDtcbiAgbW91c2VsZWF2ZUhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgQ2lyY2xlTGF5ZXJIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIGNpcmNsZSBsYXllciBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBDaXJjbGVMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGNpcmNsZSBsYXllciBcIiR7Y29uZmlnLmlkfVwiYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgbWFwIGlzIGZ1bGx5IGxvYWRlZFxuICAgICAgY29uc3QgYWRkTGF5ZXIgPSAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBzb3VyY2UgZXhpc3RzXG4gICAgICAgICAgaWYgKCFtYXAuZ2V0U291cmNlKGNvbmZpZy5zb3VyY2VJZCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gU291cmNlIFwiJHtjb25maWcuc291cmNlSWR9XCIgbm90IGZvdW5kIGZvciBjaXJjbGUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIi4gTGF5ZXIgd2lsbCBiZSBhZGRlZCB3aGVuIHNvdXJjZSBpcyBhdmFpbGFibGUuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIGxheWVyIHNwZWNpZmljYXRpb25cbiAgICAgICAgICBjb25zdCBsYXllclNwZWM6IGFueSA9IHtcbiAgICAgICAgICAgIGlkOiBjb25maWcuaWQsXG4gICAgICAgICAgICB0eXBlOiAnY2lyY2xlJyxcbiAgICAgICAgICAgIHNvdXJjZTogY29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fSxcbiAgICAgICAgICAgIGxheW91dDogY29uZmlnLmxheW91dCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnNvdXJjZUxheWVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWNbJ3NvdXJjZS1sYXllciddID0gY29uZmlnLnNvdXJjZUxheWVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuZmlsdGVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWMuZmlsdGVyID0gY29uZmlnLmZpbHRlcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1pblpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1pbnpvb20gPSBjb25maWcubWluWm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heFpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1heHpvb20gPSBjb25maWcubWF4Wm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdGhlIGxheWVyIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXJTcGVjLCBjb25maWcuYmVmb3JlSWQpO1xuXG4gICAgICAgICAgLy8gRXZlbnQgaGFuZGxlcnMgZm9yIGludGVyYWN0aXZpdHlcbiAgICAgICAgICBjb25zdCBjbGlja0hhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmZlYXR1cmVfY2xpY2tlZCcsIHtcbiAgICAgICAgICAgICAgICBsYXllcl9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG1vdXNlZW50ZXJIYW5kbGVyID0gKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZmVhdHVyZXMgJiYgZS5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlZW50ZXInLCB7XG4gICAgICAgICAgICAgICAgbGF5ZXJfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBmZWF0dXJlOiBlLmZlYXR1cmVzWzBdXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBtb3VzZWxlYXZlSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlbGVhdmUnLCB7XG4gICAgICAgICAgICAgIGxheWVyX2lkOiBjb25maWcuaWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICAgIG1hcC5vbignY2xpY2snLCBjb25maWcuaWQsIGNsaWNrSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWVudGVyJywgY29uZmlnLmlkLCBtb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWxlYXZlJywgY29uZmlnLmlkLCBtb3VzZWxlYXZlSGFuZGxlcik7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9jaXJjbGVfbGF5ZXIgPSB7XG4gICAgICAgICAgICBjb25maWcsXG4gICAgICAgICAgICBjbGlja0hhbmRsZXIsXG4gICAgICAgICAgICBtb3VzZWVudGVySGFuZGxlcixcbiAgICAgICAgICAgIG1vdXNlbGVhdmVIYW5kbGVyXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSBhZ3JlZ2FkYVxuICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjphZGRlZCcsIHsgbGF5ZXJfaWQ6IGNvbmZpZy5pZCB9KTtcblxuICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gQ2lyY2xlIGxheWVyIFwiJHtjb25maWcuaWR9XCIgbW91bnRlZCBvbiBtYXAgXCIke21hcElkfVwiYCk7XG5cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBFcnJvciBhZGRpbmcgY2lyY2xlIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGNpcmNsZSBsYXllcjonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogQ2lyY2xlTGF5ZXJIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfY2lyY2xlX2xheWVyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmVyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBpZiAoc3RhdGUuY2xpY2tIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignY2xpY2snLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLmNsaWNrSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLm1vdXNlZW50ZXJIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignbW91c2VlbnRlcicsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUubW91c2VlbnRlckhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5tb3VzZWxlYXZlSGFuZGxlcikge1xuICAgICAgICAgIG1hcC5vZmYoJ21vdXNlbGVhdmUnLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLm1vdXNlbGVhdmVIYW5kbGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGF5ZXIgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldExheWVyKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICBtYXAucmVtb3ZlTGF5ZXIoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSByZW1vdmlkYVxuICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6cmVtb3ZlZCcsIHsgbGF5ZXJfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBDaXJjbGUgbGF5ZXIgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyBjaXJjbGUgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIExpbmVMYXllckhvb2sgLSBIb29rIGZvciB0aGUgTGluZUxheWVyIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIGxpbmUgbGF5ZXIgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiByZW5kZXJpbmcgY29uZmlndXJhYmxlIGxpbmVzIGZvciByb3V0ZXMsIHBhdGhzIGFuZCBjb25uZWN0aW9ucy5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgTGluZUxheWVyQ29uZmlnIHtcbiAgaWQ6IHN0cmluZztcbiAgbWFwSWQ6IHN0cmluZztcbiAgc291cmNlSWQ6IHN0cmluZztcbiAgc291cmNlTGF5ZXI/OiBzdHJpbmc7XG4gIHBhaW50OiBhbnk7XG4gIGxheW91dDogYW55O1xuICBmaWx0ZXI/OiBhbnk7XG4gIG1pblpvb20/OiBudW1iZXI7XG4gIG1heFpvb20/OiBudW1iZXI7XG4gIGJlZm9yZUlkPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgTGluZUxheWVySG9va1N0YXRlIHtcbiAgY29uZmlnOiBMaW5lTGF5ZXJDb25maWc7XG4gIGNsaWNrSGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG4gIG1vdXNlZW50ZXJIYW5kbGVyPzogKGU6IGFueSkgPT4gdm9pZDtcbiAgbW91c2VsZWF2ZUhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgTGluZUxheWVySG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBsaW5lIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IExpbmVMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGxpbmUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZExheWVyID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgc291cmNlIGV4aXN0c1xuICAgICAgICAgIGlmICghbWFwLmdldFNvdXJjZShjb25maWcuc291cmNlSWQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIFNvdXJjZSBcIiR7Y29uZmlnLnNvdXJjZUlkfVwiIG5vdCBmb3VuZCBmb3IgbGluZSBsYXllciBcIiR7Y29uZmlnLmlkfVwiLiBMYXllciB3aWxsIGJlIGFkZGVkIHdoZW4gc291cmNlIGlzIGF2YWlsYWJsZS5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBCdWlsZCB0aGUgbGF5ZXIgc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IGxheWVyU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIHR5cGU6ICdsaW5lJyxcbiAgICAgICAgICAgIHNvdXJjZTogY29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fSxcbiAgICAgICAgICAgIGxheW91dDogY29uZmlnLmxheW91dCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnNvdXJjZUxheWVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWNbJ3NvdXJjZS1sYXllciddID0gY29uZmlnLnNvdXJjZUxheWVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuZmlsdGVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWMuZmlsdGVyID0gY29uZmlnLmZpbHRlcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1pblpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1pbnpvb20gPSBjb25maWcubWluWm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heFpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1heHpvb20gPSBjb25maWcubWF4Wm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdGhlIGxheWVyIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXJTcGVjLCBjb25maWcuYmVmb3JlSWQpO1xuXG4gICAgICAgICAgLy8gRXZlbnQgaGFuZGxlcnMgZm9yIGludGVyYWN0aXZpdHlcbiAgICAgICAgICBjb25zdCBjbGlja0hhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmZlYXR1cmVfY2xpY2tlZCcsIHtcbiAgICAgICAgICAgICAgICBsYXllcl9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG1vdXNlZW50ZXJIYW5kbGVyID0gKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZmVhdHVyZXMgJiYgZS5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlZW50ZXInLCB7XG4gICAgICAgICAgICAgICAgbGF5ZXJfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBmZWF0dXJlOiBlLmZlYXR1cmVzWzBdXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBtb3VzZWxlYXZlSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlbGVhdmUnLCB7XG4gICAgICAgICAgICAgIGxheWVyX2lkOiBjb25maWcuaWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICAgIG1hcC5vbignY2xpY2snLCBjb25maWcuaWQsIGNsaWNrSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWVudGVyJywgY29uZmlnLmlkLCBtb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWxlYXZlJywgY29uZmlnLmlkLCBtb3VzZWxlYXZlSGFuZGxlcik7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9saW5lX2xheWVyID0ge1xuICAgICAgICAgICAgY29uZmlnLFxuICAgICAgICAgICAgY2xpY2tIYW5kbGVyLFxuICAgICAgICAgICAgbW91c2VlbnRlckhhbmRsZXIsXG4gICAgICAgICAgICBtb3VzZWxlYXZlSGFuZGxlclxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgYWdyZWdhZGFcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6YWRkZWQnLCB7IGxheWVyX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIExpbmUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBsaW5lIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGxpbmUgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IExpbmVMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9saW5lX2xheWVyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmVyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBpZiAoc3RhdGUuY2xpY2tIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignY2xpY2snLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLmNsaWNrSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLm1vdXNlZW50ZXJIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignbW91c2VlbnRlcicsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUubW91c2VlbnRlckhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5tb3VzZWxlYXZlSGFuZGxlcikge1xuICAgICAgICAgIG1hcC5vZmYoJ21vdXNlbGVhdmUnLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLm1vdXNlbGVhdmVIYW5kbGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGF5ZXIgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldExheWVyKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICBtYXAucmVtb3ZlTGF5ZXIoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSByZW1vdmlkYVxuICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6cmVtb3ZlZCcsIHsgbGF5ZXJfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBMaW5lIGxheWVyIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgbGluZSBsYXllcjonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogRmlsbExheWVySG9vayAtIEhvb2sgZm9yIHRoZSBGaWxsTGF5ZXIgY29tcG9uZW50XG4gKiBcbiAqIFRoaXMgaG9vayBtYW5hZ2VzIGEgZmlsbGVkIHBvbHlnb24gbGF5ZXIgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiByZW5kZXJpbmcgY29uZmlndXJhYmxlIGFyZWFzIGZvciByZWdpb25zIGFuZCB6b25lcy5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgRmlsbExheWVyQ29uZmlnIHtcbiAgaWQ6IHN0cmluZztcbiAgbWFwSWQ6IHN0cmluZztcbiAgc291cmNlSWQ6IHN0cmluZztcbiAgc291cmNlTGF5ZXI/OiBzdHJpbmc7XG4gIHBhaW50OiBhbnk7XG4gIGxheW91dDogYW55O1xuICBmaWx0ZXI/OiBhbnk7XG4gIG1pblpvb20/OiBudW1iZXI7XG4gIG1heFpvb20/OiBudW1iZXI7XG4gIGJlZm9yZUlkPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRmlsbExheWVySG9va1N0YXRlIHtcbiAgY29uZmlnOiBGaWxsTGF5ZXJDb25maWc7XG4gIGNsaWNrSGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG4gIG1vdXNlZW50ZXJIYW5kbGVyPzogKGU6IGFueSkgPT4gdm9pZDtcbiAgbW91c2VsZWF2ZUhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgRmlsbExheWVySG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBmaWxsIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IEZpbGxMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGZpbGwgbGF5ZXIgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZExheWVyID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgc291cmNlIGV4aXN0c1xuICAgICAgICAgIGlmICghbWFwLmdldFNvdXJjZShjb25maWcuc291cmNlSWQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIFNvdXJjZSBcIiR7Y29uZmlnLnNvdXJjZUlkfVwiIG5vdCBmb3VuZCBmb3IgZmlsbCBsYXllciBcIiR7Y29uZmlnLmlkfVwiLiBMYXllciB3aWxsIGJlIGFkZGVkIHdoZW4gc291cmNlIGlzIGF2YWlsYWJsZS5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBCdWlsZCB0aGUgbGF5ZXIgc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IGxheWVyU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIHR5cGU6ICdmaWxsJyxcbiAgICAgICAgICAgIHNvdXJjZTogY29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fSxcbiAgICAgICAgICAgIGxheW91dDogY29uZmlnLmxheW91dCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnNvdXJjZUxheWVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWNbJ3NvdXJjZS1sYXllciddID0gY29uZmlnLnNvdXJjZUxheWVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuZmlsdGVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWMuZmlsdGVyID0gY29uZmlnLmZpbHRlcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1pblpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1pbnpvb20gPSBjb25maWcubWluWm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heFpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1heHpvb20gPSBjb25maWcubWF4Wm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdGhlIGxheWVyIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXJTcGVjLCBjb25maWcuYmVmb3JlSWQpO1xuXG4gICAgICAgICAgLy8gRXZlbnQgaGFuZGxlcnMgZm9yIGludGVyYWN0aXZpdHlcbiAgICAgICAgICBjb25zdCBjbGlja0hhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmZlYXR1cmVfY2xpY2tlZCcsIHtcbiAgICAgICAgICAgICAgICBsYXllcl9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG1vdXNlZW50ZXJIYW5kbGVyID0gKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZmVhdHVyZXMgJiYgZS5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlZW50ZXInLCB7XG4gICAgICAgICAgICAgICAgbGF5ZXJfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBmZWF0dXJlOiBlLmZlYXR1cmVzWzBdXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBtb3VzZWxlYXZlSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIG1hcC5nZXRDYW52YXMoKS5zdHlsZS5jdXJzb3IgPSAnJztcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX21vdXNlbGVhdmUnLCB7XG4gICAgICAgICAgICAgIGxheWVyX2lkOiBjb25maWcuaWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICAgIG1hcC5vbignY2xpY2snLCBjb25maWcuaWQsIGNsaWNrSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWVudGVyJywgY29uZmlnLmlkLCBtb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWxlYXZlJywgY29uZmlnLmlkLCBtb3VzZWxlYXZlSGFuZGxlcik7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9maWxsX2xheWVyID0ge1xuICAgICAgICAgICAgY29uZmlnLFxuICAgICAgICAgICAgY2xpY2tIYW5kbGVyLFxuICAgICAgICAgICAgbW91c2VlbnRlckhhbmRsZXIsXG4gICAgICAgICAgICBtb3VzZWxlYXZlSGFuZGxlclxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgYWdyZWdhZGFcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6YWRkZWQnLCB7IGxheWVyX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEZpbGwgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBmaWxsIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGZpbGwgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IEZpbGxMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9maWxsX2xheWVyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmVyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBpZiAoc3RhdGUuY2xpY2tIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignY2xpY2snLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLmNsaWNrSGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLm1vdXNlZW50ZXJIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignbW91c2VlbnRlcicsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUubW91c2VlbnRlckhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5tb3VzZWxlYXZlSGFuZGxlcikge1xuICAgICAgICAgIG1hcC5vZmYoJ21vdXNlbGVhdmUnLCBzdGF0ZS5jb25maWcuaWQsIHN0YXRlLm1vdXNlbGVhdmVIYW5kbGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGF5ZXIgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldExheWVyKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICBtYXAucmVtb3ZlTGF5ZXIoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSByZW1vdmlkYVxuICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6cmVtb3ZlZCcsIHsgbGF5ZXJfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBGaWxsIGxheWVyIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgZmlsbCBsYXllcjonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogU3ltYm9sTGF5ZXJIb29rIC0gSG9vayBmb3IgdGhlIFN5bWJvbExheWVyIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIHN5bWJvbCBsYXllciBpbiBNYXBMaWJyZSBHTCBKUyxcbiAqIHJlbmRlcmluZyBpY29ucyBhbmQvb3IgdGV4dCB3aXRoIGNvbmZpZ3VyYWJsZSBzdHlsaW5nLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBTeW1ib2xMYXllckNvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHNvdXJjZUlkOiBzdHJpbmc7XG4gIHNvdXJjZUxheWVyPzogc3RyaW5nO1xuICBwYWludDogYW55O1xuICBsYXlvdXQ6IGFueTtcbiAgZmlsdGVyPzogYW55O1xuICBtaW5ab29tPzogbnVtYmVyO1xuICBtYXhab29tPzogbnVtYmVyO1xuICBiZWZvcmVJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFN5bWJvbExheWVySG9va1N0YXRlIHtcbiAgY29uZmlnOiBTeW1ib2xMYXllckNvbmZpZztcbiAgY2xpY2tIYW5kbGVyPzogKGU6IGFueSkgPT4gdm9pZDtcbiAgbW91c2VlbnRlckhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xuICBtb3VzZWxlYXZlSGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBTeW1ib2xMYXllckhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gc3ltYm9sIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFN5bWJvbExheWVyQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwSWQgPSBjb25maWcubWFwSWQ7XG5cbiAgICAgIC8vIEdldCB0aGUgbWFwIGluc3RhbmNlXG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChtYXBJZCk7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke21hcElkfVwiIG5vdCBmb3VuZCBmb3Igc3ltYm9sIGxheWVyIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBhZGRMYXllciA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIHNvdXJjZSBleGlzdHNcbiAgICAgICAgICBpZiAoIW1hcC5nZXRTb3VyY2UoY29uZmlnLnNvdXJjZUlkKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBTb3VyY2UgXCIke2NvbmZpZy5zb3VyY2VJZH1cIiBub3QgZm91bmQgZm9yIHN5bWJvbCBsYXllciBcIiR7Y29uZmlnLmlkfVwiLiBMYXllciB3aWxsIGJlIGFkZGVkIHdoZW4gc291cmNlIGlzIGF2YWlsYWJsZS5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBCdWlsZCB0aGUgbGF5ZXIgc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IGxheWVyU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIHR5cGU6ICdzeW1ib2wnLFxuICAgICAgICAgICAgc291cmNlOiBjb25maWcuc291cmNlSWQsXG4gICAgICAgICAgICBwYWludDogY29uZmlnLnBhaW50IHx8IHt9LFxuICAgICAgICAgICAgbGF5b3V0OiBjb25maWcubGF5b3V0IHx8IHt9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEFncmVnYXIgcHJvcGllZGFkZXMgb3BjaW9uYWxlc1xuICAgICAgICAgIGlmIChjb25maWcuc291cmNlTGF5ZXIpIHtcbiAgICAgICAgICAgIGxheWVyU3BlY1snc291cmNlLWxheWVyJ10gPSBjb25maWcuc291cmNlTGF5ZXI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5maWx0ZXIpIHtcbiAgICAgICAgICAgIGxheWVyU3BlYy5maWx0ZXIgPSBjb25maWcuZmlsdGVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWluWm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWluem9vbSA9IGNvbmZpZy5taW5ab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWF4Wm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWF4em9vbSA9IGNvbmZpZy5tYXhab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCB0aGUgbGF5ZXIgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMsIGNvbmZpZy5iZWZvcmVJZCk7XG5cbiAgICAgICAgICAvLyBFdmVudCBoYW5kbGVycyBmb3IgaW50ZXJhY3Rpdml0eVxuICAgICAgICAgIGNvbnN0IGNsaWNrSGFuZGxlciA9IChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmZlYXR1cmVzICYmIGUuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6ZmVhdHVyZV9jbGlja2VkJywge1xuICAgICAgICAgICAgICAgIGxheWVyX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICAgICAgZmVhdHVyZTogZS5mZWF0dXJlc1swXVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgbW91c2VlbnRlckhhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5mZWF0dXJlcyAmJiBlLmZlYXR1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgbWFwLmdldENhbnZhcygpLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmZlYXR1cmVfbW91c2VlbnRlcicsIHtcbiAgICAgICAgICAgICAgICBsYXllcl9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgICAgIGZlYXR1cmU6IGUuZmVhdHVyZXNbMF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IG1vdXNlbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgbWFwLmdldENhbnZhcygpLnN0eWxlLmN1cnNvciA9ICcnO1xuICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmZlYXR1cmVfbW91c2VsZWF2ZScsIHtcbiAgICAgICAgICAgICAgbGF5ZXJfaWQ6IGNvbmZpZy5pZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEFncmVnYXIgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgICAgbWFwLm9uKCdjbGljaycsIGNvbmZpZy5pZCwgY2xpY2tIYW5kbGVyKTtcbiAgICAgICAgICBtYXAub24oJ21vdXNlZW50ZXInLCBjb25maWcuaWQsIG1vdXNlZW50ZXJIYW5kbGVyKTtcbiAgICAgICAgICBtYXAub24oJ21vdXNlbGVhdmUnLCBjb25maWcuaWQsIG1vdXNlbGVhdmVIYW5kbGVyKTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3N5bWJvbF9sYXllciA9IHtcbiAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgIGNsaWNrSGFuZGxlcixcbiAgICAgICAgICAgIG1vdXNlZW50ZXJIYW5kbGVyLFxuICAgICAgICAgICAgbW91c2VsZWF2ZUhhbmRsZXJcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIGFncmVnYWRhXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmFkZGVkJywgeyBsYXllcl9pZDogY29uZmlnLmlkIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBTeW1ib2wgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBzeW1ib2wgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIGxheWVyIGltbWVkaWF0ZWx5XG4gICAgICBpZiAobWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICBhZGRMYXllcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHN0eWxlIHRvIGxvYWRcbiAgICAgICAgbWFwLm9uY2UoJ2xvYWQnLCBhZGRMYXllcik7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgc3ltYm9sIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBTeW1ib2xMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9zeW1ib2xfbGF5ZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZXIgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgIGlmIChzdGF0ZS5jbGlja0hhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdjbGljaycsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUuY2xpY2tIYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUubW91c2VlbnRlckhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdtb3VzZWVudGVyJywgc3RhdGUuY29uZmlnLmlkLCBzdGF0ZS5tb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLm1vdXNlbGVhdmVIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignbW91c2VsZWF2ZScsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUubW91c2VsZWF2ZUhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBsYXllciBpZiBwcmVzZW50XG4gICAgICAgIGlmIChtYXAuZ2V0TGF5ZXIoc3RhdGUuY29uZmlnLmlkKSkge1xuICAgICAgICAgIG1hcC5yZW1vdmVMYXllcihzdGF0ZS5jb25maWcuaWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIHJlbW92aWRhXG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpyZW1vdmVkJywgeyBsYXllcl9pZDogc3RhdGUuY29uZmlnLmlkIH0pO1xuICAgICAgfVxuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFN5bWJvbCBsYXllciBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIHN5bWJvbCBsYXllcjonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogSGVhdG1hcExheWVySG9vayAtIEhvb2sgZm9yIHRoZSBIZWF0bWFwTGF5ZXIgY29tcG9uZW50XG4gKiBcbiAqIFRoaXMgaG9vayBtYW5hZ2VzIGEgaGVhdG1hcCBsYXllciBpbiBNYXBMaWJyZSBHTCBKUyxcbiAqIHZpc3VhbGlzaW5nIHRoZSBkZW5zaXR5IGFuZCBjb25jZW50cmF0aW9uIG9mIGRhdGEgcG9pbnRzLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBIZWF0bWFwTGF5ZXJDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBzb3VyY2VMYXllcj86IHN0cmluZztcbiAgcGFpbnQ6IGFueTtcbiAgZmlsdGVyPzogYW55O1xuICBtaW5ab29tPzogbnVtYmVyO1xuICBtYXhab29tPzogbnVtYmVyO1xuICBiZWZvcmVJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEhlYXRtYXBMYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogSGVhdG1hcExheWVyQ29uZmlnO1xufVxuXG5leHBvcnQgY29uc3QgSGVhdG1hcExheWVySG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBoZWF0bWFwIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IEhlYXRtYXBMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGhlYXRtYXAgbGF5ZXIgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZExheWVyID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgc291cmNlIGV4aXN0c1xuICAgICAgICAgIGlmICghbWFwLmdldFNvdXJjZShjb25maWcuc291cmNlSWQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIFNvdXJjZSBcIiR7Y29uZmlnLnNvdXJjZUlkfVwiIG5vdCBmb3VuZCBmb3IgaGVhdG1hcCBsYXllciBcIiR7Y29uZmlnLmlkfVwiLiBMYXllciB3aWxsIGJlIGFkZGVkIHdoZW4gc291cmNlIGlzIGF2YWlsYWJsZS5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBCdWlsZCB0aGUgbGF5ZXIgc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IGxheWVyU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIHR5cGU6ICdoZWF0bWFwJyxcbiAgICAgICAgICAgIHNvdXJjZTogY29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnNvdXJjZUxheWVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWNbJ3NvdXJjZS1sYXllciddID0gY29uZmlnLnNvdXJjZUxheWVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuZmlsdGVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWMuZmlsdGVyID0gY29uZmlnLmZpbHRlcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1pblpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1pbnpvb20gPSBjb25maWcubWluWm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heFpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1heHpvb20gPSBjb25maWcubWF4Wm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdGhlIGxheWVyIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXJTcGVjLCBjb25maWcuYmVmb3JlSWQpO1xuXG4gICAgICAgICAgLy8gR3VhcmRhciBlc3RhZG9cbiAgICAgICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfaGVhdG1hcF9sYXllciA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgYWdyZWdhZGFcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6YWRkZWQnLCB7IGxheWVyX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEhlYXRtYXAgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBoZWF0bWFwIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGhlYXRtYXAgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IEhlYXRtYXBMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9oZWF0bWFwX2xheWVyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmUgdGhlIGxheWVyIGlmIHByZXNlbnRcbiAgICAgICAgaWYgKG1hcC5nZXRMYXllcihzdGF0ZS5jb25maWcuaWQpKSB7XG4gICAgICAgICAgbWFwLnJlbW92ZUxheWVyKHN0YXRlLmNvbmZpZy5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgcmVtb3ZpZGFcbiAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOnJlbW92ZWQnLCB7IGxheWVyX2lkOiBzdGF0ZS5jb25maWcuaWQgfSk7XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gSGVhdG1hcCBsYXllciBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIGhlYXRtYXAgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEZpbGxFeHRydXNpb25MYXllckhvb2sgLSBIb29rIGZvciB0aGUgRmlsbEV4dHJ1c2lvbkxheWVyIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhbiBleHRydWRlZCAzRCBwb2x5Z29uIGxheWVyIGluIE1hcExpYnJlIEdMIEpTLFxuICogY29tbW9ubHkgdXNlZCBmb3IgYnVpbGRpbmdzIGFuZCBoZWlnaHQtYmFzZWQgZGF0YSB2aXN1YWxpc2F0aW9ucy5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgRmlsbEV4dHJ1c2lvbkxheWVyQ29uZmlnIHtcbiAgaWQ6IHN0cmluZztcbiAgbWFwSWQ6IHN0cmluZztcbiAgc291cmNlSWQ6IHN0cmluZztcbiAgc291cmNlTGF5ZXI/OiBzdHJpbmc7XG4gIHBhaW50OiBhbnk7XG4gIGxheW91dD86IGFueTtcbiAgZmlsdGVyPzogYW55O1xuICBtaW5ab29tPzogbnVtYmVyO1xuICBtYXhab29tPzogbnVtYmVyO1xuICBiZWZvcmVJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEZpbGxFeHRydXNpb25MYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogRmlsbEV4dHJ1c2lvbkxheWVyQ29uZmlnO1xuICBjbGlja0hhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xuICBtb3VzZWVudGVySGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG4gIG1vdXNlbGVhdmVIYW5kbGVyPzogKGU6IGFueSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IEZpbGxFeHRydXNpb25MYXllckhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gZmlsbCBleHRydXNpb24gbGF5ZXIgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogRmlsbEV4dHJ1c2lvbkxheWVyQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwSWQgPSBjb25maWcubWFwSWQ7XG5cbiAgICAgIC8vIEdldCB0aGUgbWFwIGluc3RhbmNlXG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChtYXBJZCk7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke21hcElkfVwiIG5vdCBmb3VuZCBmb3IgZmlsbCBleHRydXNpb24gbGF5ZXIgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZExheWVyID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgc291cmNlIGV4aXN0c1xuICAgICAgICAgIGlmICghbWFwLmdldFNvdXJjZShjb25maWcuc291cmNlSWQpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIFNvdXJjZSBcIiR7Y29uZmlnLnNvdXJjZUlkfVwiIG5vdCBmb3VuZCBmb3IgZmlsbCBleHRydXNpb24gbGF5ZXIgXCIke2NvbmZpZy5pZH1cIi4gTGF5ZXIgd2lsbCBiZSBhZGRlZCB3aGVuIHNvdXJjZSBpcyBhdmFpbGFibGUuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIGxheWVyIHNwZWNpZmljYXRpb25cbiAgICAgICAgICBjb25zdCBsYXllclNwZWM6IGFueSA9IHtcbiAgICAgICAgICAgIGlkOiBjb25maWcuaWQsXG4gICAgICAgICAgICB0eXBlOiAnZmlsbC1leHRydXNpb24nLFxuICAgICAgICAgICAgc291cmNlOiBjb25maWcuc291cmNlSWQsXG4gICAgICAgICAgICBwYWludDogY29uZmlnLnBhaW50IHx8IHt9LFxuICAgICAgICAgICAgbGF5b3V0OiBjb25maWcubGF5b3V0IHx8IHt9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEFncmVnYXIgcHJvcGllZGFkZXMgb3BjaW9uYWxlc1xuICAgICAgICAgIGlmIChjb25maWcuc291cmNlTGF5ZXIpIHtcbiAgICAgICAgICAgIGxheWVyU3BlY1snc291cmNlLWxheWVyJ10gPSBjb25maWcuc291cmNlTGF5ZXI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5maWx0ZXIpIHtcbiAgICAgICAgICAgIGxheWVyU3BlYy5maWx0ZXIgPSBjb25maWcuZmlsdGVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWluWm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWluem9vbSA9IGNvbmZpZy5taW5ab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWF4Wm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWF4em9vbSA9IGNvbmZpZy5tYXhab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCB0aGUgbGF5ZXIgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMsIGNvbmZpZy5iZWZvcmVJZCk7XG5cbiAgICAgICAgICAvLyBDb25maWd1cmFyIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgICAgY29uc3QgY2xpY2tIYW5kbGVyID0gKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZmVhdHVyZXMgJiYgZS5mZWF0dXJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpmZWF0dXJlX2NsaWNrZWQnLCB7XG4gICAgICAgICAgICAgICAgbGF5ZXJfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBmZWF0dXJlczogZS5mZWF0dXJlcyxcbiAgICAgICAgICAgICAgICBsbmdMYXQ6IGUubG5nTGF0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBtb3VzZWVudGVySGFuZGxlciA9IChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmZlYXR1cmVzICYmIGUuZmVhdHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBtYXAuZ2V0Q2FudmFzKCkuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6ZmVhdHVyZV9tb3VzZWVudGVyJywge1xuICAgICAgICAgICAgICAgIGxheWVyX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICAgICAgZmVhdHVyZXM6IGUuZmVhdHVyZXMsXG4gICAgICAgICAgICAgICAgbG5nTGF0OiBlLmxuZ0xhdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgbW91c2VsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBtYXAuZ2V0Q2FudmFzKCkuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6ZmVhdHVyZV9tb3VzZWxlYXZlJywge1xuICAgICAgICAgICAgICBsYXllcl9pZDogY29uZmlnLmlkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gUmVnaXN0cmFyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICAgIG1hcC5vbignY2xpY2snLCBjb25maWcuaWQsIGNsaWNrSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWVudGVyJywgY29uZmlnLmlkLCBtb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdtb3VzZWxlYXZlJywgY29uZmlnLmlkLCBtb3VzZWxlYXZlSGFuZGxlcik7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9maWxsX2V4dHJ1c2lvbl9sYXllciA9IHtcbiAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgIGNsaWNrSGFuZGxlcixcbiAgICAgICAgICAgIG1vdXNlZW50ZXJIYW5kbGVyLFxuICAgICAgICAgICAgbW91c2VsZWF2ZUhhbmRsZXJcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIGFncmVnYWRhXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmFkZGVkJywgeyBsYXllcl9pZDogY29uZmlnLmlkIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBGaWxsIGV4dHJ1c2lvbiBsYXllciBcIiR7Y29uZmlnLmlkfVwiIG1vdW50ZWQgb24gbWFwIFwiJHttYXBJZH1cImApO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gRXJyb3IgYWRkaW5nIGZpbGwgZXh0cnVzaW9uIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGZpbGwgZXh0cnVzaW9uIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBGaWxsRXh0cnVzaW9uTGF5ZXJIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfZmlsbF9leHRydXNpb25fbGF5ZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZXIgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgIGlmIChzdGF0ZS5jbGlja0hhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdjbGljaycsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUuY2xpY2tIYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUubW91c2VlbnRlckhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdtb3VzZWVudGVyJywgc3RhdGUuY29uZmlnLmlkLCBzdGF0ZS5tb3VzZWVudGVySGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLm1vdXNlbGVhdmVIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignbW91c2VsZWF2ZScsIHN0YXRlLmNvbmZpZy5pZCwgc3RhdGUubW91c2VsZWF2ZUhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBsYXllciBpZiBwcmVzZW50XG4gICAgICAgIGlmIChtYXAuZ2V0TGF5ZXIoc3RhdGUuY29uZmlnLmlkKSkge1xuICAgICAgICAgIG1hcC5yZW1vdmVMYXllcihzdGF0ZS5jb25maWcuaWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIHJlbW92aWRhXG4gICAgICAgIHRoaXMucHVzaEV2ZW50KCdsYXllcjpyZW1vdmVkJywgeyBsYXllcl9pZDogc3RhdGUuY29uZmlnLmlkIH0pO1xuICAgICAgfVxuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEZpbGwgZXh0cnVzaW9uIGxheWVyIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgZmlsbCBleHRydXNpb24gbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEJhY2tncm91bmRMYXllckhvb2sgLSBIb29rIGZvciB0aGUgQmFja2dyb3VuZExheWVyIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIGJhY2tncm91bmQgbGF5ZXIgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiByZW5kZXJpbmcgYSBzb2xpZCBjb2xvdXIgb3IgcGF0dGVybiBhcyB0aGUgbWFwJ3MgYmFzZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgQmFja2dyb3VuZExheWVyQ29uZmlnIHtcbiAgaWQ6IHN0cmluZztcbiAgbWFwSWQ6IHN0cmluZztcbiAgcGFpbnQ6IGFueTtcbiAgbGF5b3V0PzogYW55O1xuICBtaW5ab29tPzogbnVtYmVyO1xuICBtYXhab29tPzogbnVtYmVyO1xuICBiZWZvcmVJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEJhY2tncm91bmRMYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogQmFja2dyb3VuZExheWVyQ29uZmlnO1xufVxuXG5leHBvcnQgY29uc3QgQmFja2dyb3VuZExheWVySG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBiYWNrZ3JvdW5kIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IEJhY2tncm91bmRMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGJhY2tncm91bmQgbGF5ZXIgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZExheWVyID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIEJ1aWxkIHRoZSBsYXllciBzcGVjaWZpY2F0aW9uXG4gICAgICAgICAgY29uc3QgbGF5ZXJTcGVjOiBhbnkgPSB7XG4gICAgICAgICAgICBpZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgdHlwZTogJ2JhY2tncm91bmQnLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fSxcbiAgICAgICAgICAgIGxheW91dDogY29uZmlnLmxheW91dCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLm1pblpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1pbnpvb20gPSBjb25maWcubWluWm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heFpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGF5ZXJTcGVjLm1heHpvb20gPSBjb25maWcubWF4Wm9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdGhlIGxheWVyIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkTGF5ZXIobGF5ZXJTcGVjLCBjb25maWcuYmVmb3JlSWQpO1xuXG4gICAgICAgICAgLy8gR3VhcmRhciBlc3RhZG9cbiAgICAgICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfYmFja2dyb3VuZF9sYXllciA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgYWdyZWdhZGFcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6YWRkZWQnLCB7IGxheWVyX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIEJhY2tncm91bmQgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBiYWNrZ3JvdW5kIGxheWVyIFwiJHtjb25maWcuaWR9XCI6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBsYXllciBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkTGF5ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkTGF5ZXIpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIGJhY2tncm91bmQgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IEJhY2tncm91bmRMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9iYWNrZ3JvdW5kX2xheWVyO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmUgdGhlIGxheWVyIGlmIHByZXNlbnRcbiAgICAgICAgaWYgKG1hcC5nZXRMYXllcihzdGF0ZS5jb25maWcuaWQpKSB7XG4gICAgICAgICAgbWFwLnJlbW92ZUxheWVyKHN0YXRlLmNvbmZpZy5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIGNhcGEgcmVtb3ZpZGFcbiAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOnJlbW92ZWQnLCB7IGxheWVyX2lkOiBzdGF0ZS5jb25maWcuaWQgfSk7XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gQmFja2dyb3VuZCBsYXllciBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIGJhY2tncm91bmQgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIEhpbGxzaGFkZUxheWVySG9vayAtIEhvb2sgZm9yIHRoZSBIaWxsc2hhZGVMYXllciBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIG1hbmFnZXMgYSB0ZXJyYWluIGhpbGxzaGFkZSBsYXllciBpbiBNYXBMaWJyZSBHTCBKUyxcbiAqIHJlbmRlcmluZyAzRCByZWxpZWYgZnJvbSBhIHJhc3Rlci1kZW0gc291cmNlLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBIaWxsc2hhZGVMYXllckNvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHNvdXJjZUlkOiBzdHJpbmc7XG4gIHNvdXJjZUxheWVyPzogc3RyaW5nO1xuICBwYWludDogYW55O1xuICBsYXlvdXQ/OiBhbnk7XG4gIG1pblpvb20/OiBudW1iZXI7XG4gIG1heFpvb20/OiBudW1iZXI7XG4gIGJlZm9yZUlkPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSGlsbHNoYWRlTGF5ZXJIb29rU3RhdGUge1xuICBjb25maWc6IEhpbGxzaGFkZUxheWVyQ29uZmlnO1xufVxuXG5leHBvcnQgY29uc3QgSGlsbHNoYWRlTGF5ZXJIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIGhpbGxzaGFkZSBsYXllciBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBIaWxsc2hhZGVMYXllckNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIGhpbGxzaGFkZSBsYXllciBcIiR7Y29uZmlnLmlkfVwiYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gV2FpdCB1bnRpbCB0aGUgbWFwIGlzIGZ1bGx5IGxvYWRlZFxuICAgICAgY29uc3QgYWRkTGF5ZXIgPSAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBzb3VyY2UgZXhpc3RzXG4gICAgICAgICAgaWYgKCFtYXAuZ2V0U291cmNlKGNvbmZpZy5zb3VyY2VJZCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gU291cmNlIFwiJHtjb25maWcuc291cmNlSWR9XCIgbm90IGZvdW5kIGZvciBoaWxsc2hhZGUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIi4gTGF5ZXIgd2lsbCBiZSBhZGRlZCB3aGVuIHNvdXJjZSBpcyBhdmFpbGFibGUuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIGxheWVyIHNwZWNpZmljYXRpb25cbiAgICAgICAgICBjb25zdCBsYXllclNwZWM6IGFueSA9IHtcbiAgICAgICAgICAgIGlkOiBjb25maWcuaWQsXG4gICAgICAgICAgICB0eXBlOiAnaGlsbHNoYWRlJyxcbiAgICAgICAgICAgIHNvdXJjZTogY29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgcGFpbnQ6IGNvbmZpZy5wYWludCB8fCB7fSxcbiAgICAgICAgICAgIGxheW91dDogY29uZmlnLmxheW91dCB8fCB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnNvdXJjZUxheWVyKSB7XG4gICAgICAgICAgICBsYXllclNwZWNbJ3NvdXJjZS1sYXllciddID0gY29uZmlnLnNvdXJjZUxheWVyO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWluWm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWluem9vbSA9IGNvbmZpZy5taW5ab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWF4Wm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWF4em9vbSA9IGNvbmZpZy5tYXhab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCB0aGUgbGF5ZXIgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMsIGNvbmZpZy5iZWZvcmVJZCk7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9oaWxsc2hhZGVfbGF5ZXIgPSB7XG4gICAgICAgICAgICBjb25maWdcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIGFncmVnYWRhXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmFkZGVkJywgeyBsYXllcl9pZDogY29uZmlnLmlkIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBIaWxsc2hhZGUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBoaWxsc2hhZGUgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIGxheWVyIGltbWVkaWF0ZWx5XG4gICAgICBpZiAobWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICBhZGRMYXllcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHN0eWxlIHRvIGxvYWRcbiAgICAgICAgbWFwLm9uY2UoJ2xvYWQnLCBhZGRMYXllcik7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgaGlsbHNoYWRlIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBIaWxsc2hhZGVMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9oaWxsc2hhZGVfbGF5ZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGF5ZXIgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldExheWVyKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICBtYXAucmVtb3ZlTGF5ZXIoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSByZW1vdmlkYVxuICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6cmVtb3ZlZCcsIHsgbGF5ZXJfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBIaWxsc2hhZGUgbGF5ZXIgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyBoaWxsc2hhZGUgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIFJhc3RlckxheWVySG9vayAtIEhvb2sgZm9yIHRoZSBSYXN0ZXJMYXllciBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIG1hbmFnZXMgYSByYXN0ZXIgbGF5ZXIgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiByZW5kZXJpbmcgaW1hZ2UgdGlsZXMgZnJvbSByYXN0ZXIgc291cmNlcy5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgUmFzdGVyTGF5ZXJDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBwYWludDogYW55O1xuICBsYXlvdXQ6IGFueTtcbiAgbWluWm9vbT86IG51bWJlcjtcbiAgbWF4Wm9vbT86IG51bWJlcjtcbiAgYmVmb3JlSWQ/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBSYXN0ZXJMYXllckhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogUmFzdGVyTGF5ZXJDb25maWc7XG59XG5cbmV4cG9ydCBjb25zdCBSYXN0ZXJMYXllckhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gcmFzdGVyIGxheWVyIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFJhc3RlckxheWVyQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwSWQgPSBjb25maWcubWFwSWQ7XG5cbiAgICAgIC8vIEdldCB0aGUgbWFwIGluc3RhbmNlXG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChtYXBJZCk7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke21hcElkfVwiIG5vdCBmb3VuZCBmb3IgcmFzdGVyIGxheWVyIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBhZGRMYXllciA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIHNvdXJjZSBleGlzdHNcbiAgICAgICAgICBpZiAoIW1hcC5nZXRTb3VyY2UoY29uZmlnLnNvdXJjZUlkKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBTb3VyY2UgXCIke2NvbmZpZy5zb3VyY2VJZH1cIiBub3QgZm91bmQgZm9yIHJhc3RlciBsYXllciBcIiR7Y29uZmlnLmlkfVwiLiBMYXllciB3aWxsIGJlIGFkZGVkIHdoZW4gc291cmNlIGlzIGF2YWlsYWJsZS5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBCdWlsZCB0aGUgbGF5ZXIgc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IGxheWVyU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgIHR5cGU6ICdyYXN0ZXInLFxuICAgICAgICAgICAgc291cmNlOiBjb25maWcuc291cmNlSWQsXG4gICAgICAgICAgICBwYWludDogY29uZmlnLnBhaW50IHx8IHt9LFxuICAgICAgICAgICAgbGF5b3V0OiBjb25maWcubGF5b3V0IHx8IHt9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEFncmVnYXIgcHJvcGllZGFkZXMgb3BjaW9uYWxlc1xuICAgICAgICAgIGlmIChjb25maWcubWluWm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWluem9vbSA9IGNvbmZpZy5taW5ab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWF4Wm9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsYXllclNwZWMubWF4em9vbSA9IGNvbmZpZy5tYXhab29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCB0aGUgbGF5ZXIgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRMYXllcihsYXllclNwZWMsIGNvbmZpZy5iZWZvcmVJZCk7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9yYXN0ZXJfbGF5ZXIgPSB7XG4gICAgICAgICAgICBjb25maWdcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gRW1pdGlyIGV2ZW50byBkZSBjYXBhIGFncmVnYWRhXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ2xheWVyOmFkZGVkJywgeyBsYXllcl9pZDogY29uZmlnLmlkIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBSYXN0ZXIgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyByYXN0ZXIgbGF5ZXIgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIGxheWVyIGltbWVkaWF0ZWx5XG4gICAgICBpZiAobWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICBhZGRMYXllcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHN0eWxlIHRvIGxvYWRcbiAgICAgICAgbWFwLm9uY2UoJ2xvYWQnLCBhZGRMYXllcik7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgcmFzdGVyIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBSYXN0ZXJMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9yYXN0ZXJfbGF5ZXI7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGF5ZXIgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldExheWVyKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICBtYXAucmVtb3ZlTGF5ZXIoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgY2FwYSByZW1vdmlkYVxuICAgICAgICB0aGlzLnB1c2hFdmVudCgnbGF5ZXI6cmVtb3ZlZCcsIHsgbGF5ZXJfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBSYXN0ZXIgbGF5ZXIgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyByYXN0ZXIgbGF5ZXI6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIFZlY3RvclRpbGVTb3VyY2VIb29rIC0gSG9vayBmb3IgdGhlIFZlY3RvclRpbGVTb3VyY2UgY29tcG9uZW50XG4gKiBcbiAqIFRoaXMgaG9vayBtYW5hZ2VzIGEgdmVjdG9yIHRpbGUgc291cmNlIGluIE1hcExpYnJlIEdMIEpTLFxuICogd2hpY2ggY2FuIGJlIGNvbnN1bWVkIGJ5IG11bHRpcGxlIGxheWVycyB0byByZW5kZXIgZGF0YS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgVmVjdG9yVGlsZVNvdXJjZUNvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHVybD86IHN0cmluZztcbiAgdGlsZXM/OiBzdHJpbmdbXTtcbiAgbWluem9vbT86IG51bWJlcjtcbiAgbWF4em9vbT86IG51bWJlcjtcbiAgYXR0cmlidXRpb24/OiBzdHJpbmc7XG4gIGJvdW5kcz86IG51bWJlcltdO1xuICBzY2hlbWU/OiBzdHJpbmc7XG4gIHByb21vdGVJZD86IGFueTtcbiAgdm9sYXRpbGU/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgVmVjdG9yVGlsZVNvdXJjZUhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogVmVjdG9yVGlsZVNvdXJjZUNvbmZpZztcbiAgZGF0YUhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xuICBlcnJvckhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgVmVjdG9yVGlsZVNvdXJjZUhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gdmVjdG9yIHRpbGUgc291cmNlIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFZlY3RvclRpbGVTb3VyY2VDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciB2ZWN0b3IgdGlsZSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZFNvdXJjZSA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIHNvdXJjZSBpcyBub3QgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICAgICAgaWYgKG1hcC5nZXRTb3VyY2UoY29uZmlnLmlkKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBTb3VyY2UgXCIke2NvbmZpZy5pZH1cIiBhbHJlYWR5IGV4aXN0cyBvbiBtYXAgXCIke21hcElkfVwiYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uXG4gICAgICAgICAgY29uc3Qgc291cmNlU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgdHlwZTogJ3ZlY3RvcidcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQWdyZWdhciBwcm9waWVkYWRlcyBvcGNpb25hbGVzXG4gICAgICAgICAgaWYgKGNvbmZpZy51cmwpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudXJsID0gY29uZmlnLnVybDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLnRpbGVzKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLnRpbGVzID0gY29uZmlnLnRpbGVzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWluem9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLm1pbnpvb20gPSBjb25maWcubWluem9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heHpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc291cmNlU3BlYy5tYXh6b29tID0gY29uZmlnLm1heHpvb207XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5hdHRyaWJ1dGlvbikge1xuICAgICAgICAgICAgc291cmNlU3BlYy5hdHRyaWJ1dGlvbiA9IGNvbmZpZy5hdHRyaWJ1dGlvbjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLmJvdW5kcykge1xuICAgICAgICAgICAgc291cmNlU3BlYy5ib3VuZHMgPSBjb25maWcuYm91bmRzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuc2NoZW1lKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLnNjaGVtZSA9IGNvbmZpZy5zY2hlbWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5wcm9tb3RlSWQpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMucHJvbW90ZUlkID0gY29uZmlnLnByb21vdGVJZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLnZvbGF0aWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudm9sYXRpbGUgPSBjb25maWcudm9sYXRpbGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQWRkIHRoZSBzb3VyY2UgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRTb3VyY2UoY29uZmlnLmlkLCBzb3VyY2VTcGVjKTtcblxuICAgICAgICAgIC8vIFdpcmUgdXAgdGhlIHNvdXJjZSdzIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgICAgY29uc3QgZGF0YUhhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5zb3VyY2VJZCA9PT0gY29uZmlnLmlkKSB7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6ZGF0YScsIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBkYXRhX3R5cGU6IGUuZGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgc291cmNlX2RhdGFfdHlwZTogZS5zb3VyY2VEYXRhVHlwZSxcbiAgICAgICAgICAgICAgICB0aWxlOiBlLnRpbGUgPyB7XG4gICAgICAgICAgICAgICAgICBjb29yZDogZS50aWxlLnRpbGVJRC5jYW5vbmljYWwsXG4gICAgICAgICAgICAgICAgICBpc1NvdXJjZUxvYWRlZDogZS5pc1NvdXJjZUxvYWRlZFxuICAgICAgICAgICAgICAgIH0gOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IGVycm9ySGFuZGxlciA9IChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChlLnNvdXJjZUlkID09PSBjb25maWcuaWQpIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTplcnJvcicsIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBlcnJvcjogZS5lcnJvciA/IGUuZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgICAgICAgICAgICB0aWxlOiBlLnRpbGVcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIFJlZ2lzdHJhciBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgICBtYXAub24oJ3NvdXJjZWRhdGEnLCBkYXRhSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdzb3VyY2VkYXRhbG9hZGluZycsIGRhdGFIYW5kbGVyKTtcbiAgICAgICAgICBtYXAub24oJ2Vycm9yJywgZXJyb3JIYW5kbGVyKTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3ZlY3Rvcl90aWxlX3NvdXJjZSA9IHtcbiAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgIGRhdGFIYW5kbGVyLFxuICAgICAgICAgICAgZXJyb3JIYW5kbGVyXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgc291cmNlIGFncmVnYWRvXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTphZGRlZCcsIHsgc291cmNlX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFZlY3RvciB0aWxlIHNvdXJjZSBcIiR7Y29uZmlnLmlkfVwiIG1vdW50ZWQgb24gbWFwIFwiJHttYXBJZH1cImApO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gRXJyb3IgYWRkaW5nIHZlY3RvciB0aWxlIHNvdXJjZSBcIiR7Y29uZmlnLmlkfVwiOmAsIGVycm9yKTtcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnc291cmNlOmVycm9yJywge1xuICAgICAgICAgICAgc291cmNlX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcidcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gSWYgdGhlIG1hcCBoYXMgYWxyZWFkeSBsb2FkZWQsIGFkZCB0aGUgc291cmNlIGltbWVkaWF0ZWx5XG4gICAgICBpZiAobWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICBhZGRTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkU291cmNlKTtcbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBtb3VudGluZyB2ZWN0b3IgdGlsZSBzb3VyY2U6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IFZlY3RvclRpbGVTb3VyY2VIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfdmVjdG9yX3RpbGVfc291cmNlO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmVyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBpZiAoc3RhdGUuZGF0YUhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdzb3VyY2VkYXRhJywgc3RhdGUuZGF0YUhhbmRsZXIpO1xuICAgICAgICAgIG1hcC5vZmYoJ3NvdXJjZWRhdGFsb2FkaW5nJywgc3RhdGUuZGF0YUhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5lcnJvckhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdlcnJvcicsIHN0YXRlLmVycm9ySGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNvdXJjZSBpZiBwcmVzZW50XG4gICAgICAgIGlmIChtYXAuZ2V0U291cmNlKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICAvLyBOb3RlOiBhIHNvdXJjZSBjYW4gb25seSBiZSByZW1vdmVkIG9uY2Ugbm8gbGF5ZXIgcmVmZXJlbmNlcyBpdFxuICAgICAgICAgIC8vIE1hcExpYnJlIHJhaXNlcyBpZiB3ZSB0cnkgdG8gcmVtb3ZlIGEgc291cmNlIHRoYXQgaXMgc3RpbGwgaW4gdXNlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG1hcC5yZW1vdmVTb3VyY2Uoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6cmVtb3ZlZCcsIHsgc291cmNlX2lkOiBzdGF0ZS5jb25maWcuaWQgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBDb3VsZCBub3QgcmVtb3ZlIHNvdXJjZSBcIiR7c3RhdGUuY29uZmlnLmlkfVwiOiAke2V9YCk7XG4gICAgICAgICAgICAvLyBUaGUgc291cmNlIGlzIHByb2JhYmx5IHN0aWxsIGluIHVzZSBieSBhIGxheWVyXG4gICAgICAgICAgICAvLyBMYXllcnMgbXVzdCBiZSByZW1vdmVkIGZpcnN0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gVmVjdG9yIHRpbGUgc291cmNlIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgdmVjdG9yIHRpbGUgc291cmNlOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBSYXN0ZXJUaWxlU291cmNlSG9vayAtIEhvb2sgZm9yIHRoZSBSYXN0ZXJUaWxlU291cmNlIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIHJhc3RlciB0aWxlIHNvdXJjZSBpbiBNYXBMaWJyZSBHTCBKUyxcbiAqIHVzZWQgZm9yIHNhdGVsbGl0ZSBpbWFnZXJ5LCB0ZXJyYWluIGFuZCBvdGhlciByYXN0ZXIgb3ZlcmxheXMuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2sgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBNYXBNYW5hZ2VyIH0gZnJvbSAnLi4vY29yZS9tYXAtbWFuYWdlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIFJhc3RlclRpbGVTb3VyY2VDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICB1cmw/OiBzdHJpbmc7XG4gIHRpbGVzPzogc3RyaW5nW107XG4gIHRpbGVTaXplPzogbnVtYmVyO1xuICBtaW56b29tPzogbnVtYmVyO1xuICBtYXh6b29tPzogbnVtYmVyO1xuICBhdHRyaWJ1dGlvbj86IHN0cmluZztcbiAgYm91bmRzPzogbnVtYmVyW107XG4gIHNjaGVtZT86IHN0cmluZztcbiAgdG1zPzogYm9vbGVhbjtcbiAgdm9sYXRpbGU/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgUmFzdGVyVGlsZVNvdXJjZUhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogUmFzdGVyVGlsZVNvdXJjZUNvbmZpZztcbiAgZGF0YUhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xuICBlcnJvckhhbmRsZXI/OiAoZTogYW55KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUmFzdGVyVGlsZVNvdXJjZUhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gcmFzdGVyIHRpbGUgc291cmNlIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFJhc3RlclRpbGVTb3VyY2VDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciByYXN0ZXIgdGlsZSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZFNvdXJjZSA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIHNvdXJjZSBpcyBub3QgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICAgICAgaWYgKG1hcC5nZXRTb3VyY2UoY29uZmlnLmlkKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBTb3VyY2UgXCIke2NvbmZpZy5pZH1cIiBhbHJlYWR5IGV4aXN0cyBvbiBtYXAgXCIke21hcElkfVwiYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uXG4gICAgICAgICAgY29uc3Qgc291cmNlU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgdHlwZTogJ3Jhc3RlcidcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQWdyZWdhciBwcm9waWVkYWRlcyBvcGNpb25hbGVzXG4gICAgICAgICAgaWYgKGNvbmZpZy51cmwpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudXJsID0gY29uZmlnLnVybDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLnRpbGVzKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLnRpbGVzID0gY29uZmlnLnRpbGVzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcudGlsZVNpemUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc291cmNlU3BlYy50aWxlU2l6ZSA9IGNvbmZpZy50aWxlU2l6ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1pbnpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc291cmNlU3BlYy5taW56b29tID0gY29uZmlnLm1pbnpvb207XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5tYXh6b29tICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMubWF4em9vbSA9IGNvbmZpZy5tYXh6b29tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuYXR0cmlidXRpb24pIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMuYXR0cmlidXRpb24gPSBjb25maWcuYXR0cmlidXRpb247XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5ib3VuZHMpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMuYm91bmRzID0gY29uZmlnLmJvdW5kcztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLnNjaGVtZSkge1xuICAgICAgICAgICAgc291cmNlU3BlYy5zY2hlbWUgPSBjb25maWcuc2NoZW1lO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcudG1zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudG1zID0gY29uZmlnLnRtcztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLnZvbGF0aWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudm9sYXRpbGUgPSBjb25maWcudm9sYXRpbGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQWRkIHRoZSBzb3VyY2UgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRTb3VyY2UoY29uZmlnLmlkLCBzb3VyY2VTcGVjKTtcblxuICAgICAgICAgIC8vIFdpcmUgdXAgdGhlIHNvdXJjZSdzIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgICAgY29uc3QgZGF0YUhhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5zb3VyY2VJZCA9PT0gY29uZmlnLmlkKSB7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6ZGF0YScsIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBkYXRhX3R5cGU6IGUuZGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgc291cmNlX2RhdGFfdHlwZTogZS5zb3VyY2VEYXRhVHlwZSxcbiAgICAgICAgICAgICAgICB0aWxlOiBlLnRpbGUgPyB7XG4gICAgICAgICAgICAgICAgICBjb29yZDogZS50aWxlLnRpbGVJRC5jYW5vbmljYWwsXG4gICAgICAgICAgICAgICAgICBpc1NvdXJjZUxvYWRlZDogZS5pc1NvdXJjZUxvYWRlZFxuICAgICAgICAgICAgICAgIH0gOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IGVycm9ySGFuZGxlciA9IChlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChlLnNvdXJjZUlkID09PSBjb25maWcuaWQpIHtcbiAgICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTplcnJvcicsIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VfaWQ6IGNvbmZpZy5pZCxcbiAgICAgICAgICAgICAgICBlcnJvcjogZS5lcnJvciA/IGUuZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgICAgICAgICAgICB0aWxlOiBlLnRpbGVcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIFJlZ2lzdHJhciBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgICBtYXAub24oJ3NvdXJjZWRhdGEnLCBkYXRhSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdzb3VyY2VkYXRhbG9hZGluZycsIGRhdGFIYW5kbGVyKTtcbiAgICAgICAgICBtYXAub24oJ2Vycm9yJywgZXJyb3JIYW5kbGVyKTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3Jhc3Rlcl90aWxlX3NvdXJjZSA9IHtcbiAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgIGRhdGFIYW5kbGVyLFxuICAgICAgICAgICAgZXJyb3JIYW5kbGVyXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgc291cmNlIGFncmVnYWRvXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTphZGRlZCcsIHsgc291cmNlX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFJhc3RlciB0aWxlIHNvdXJjZSBcIiR7Y29uZmlnLmlkfVwiIG1vdW50ZWQgb24gbWFwIFwiJHttYXBJZH1cImApO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gRXJyb3IgYWRkaW5nIHJhc3RlciB0aWxlIHNvdXJjZSBcIiR7Y29uZmlnLmlkfVwiOmAsIGVycm9yKTtcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnc291cmNlOmVycm9yJywge1xuICAgICAgICAgICAgc291cmNlX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcidcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gSWYgdGhlIG1hcCBoYXMgYWxyZWFkeSBsb2FkZWQsIGFkZCB0aGUgc291cmNlIGltbWVkaWF0ZWx5XG4gICAgICBpZiAobWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICBhZGRTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdhaXQgZm9yIHRoZSBzdHlsZSB0byBsb2FkXG4gICAgICAgIG1hcC5vbmNlKCdsb2FkJywgYWRkU291cmNlKTtcbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBtb3VudGluZyByYXN0ZXIgdGlsZSBzb3VyY2U6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IFJhc3RlclRpbGVTb3VyY2VIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfcmFzdGVyX3RpbGVfc291cmNlO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChzdGF0ZS5jb25maWcubWFwSWQpO1xuICAgICAgaWYgKG1hcCkge1xuICAgICAgICAvLyBSZW1vdmVyIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBpZiAoc3RhdGUuZGF0YUhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdzb3VyY2VkYXRhJywgc3RhdGUuZGF0YUhhbmRsZXIpO1xuICAgICAgICAgIG1hcC5vZmYoJ3NvdXJjZWRhdGFsb2FkaW5nJywgc3RhdGUuZGF0YUhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5lcnJvckhhbmRsZXIpIHtcbiAgICAgICAgICBtYXAub2ZmKCdlcnJvcicsIHN0YXRlLmVycm9ySGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNvdXJjZSBpZiBwcmVzZW50XG4gICAgICAgIGlmIChtYXAuZ2V0U291cmNlKHN0YXRlLmNvbmZpZy5pZCkpIHtcbiAgICAgICAgICAvLyBOb3RlOiBhIHNvdXJjZSBjYW4gb25seSBiZSByZW1vdmVkIG9uY2Ugbm8gbGF5ZXIgcmVmZXJlbmNlcyBpdFxuICAgICAgICAgIC8vIE1hcExpYnJlIHJhaXNlcyBpZiB3ZSB0cnkgdG8gcmVtb3ZlIGEgc291cmNlIHRoYXQgaXMgc3RpbGwgaW4gdXNlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG1hcC5yZW1vdmVTb3VyY2Uoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6cmVtb3ZlZCcsIHsgc291cmNlX2lkOiBzdGF0ZS5jb25maWcuaWQgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBDb3VsZCBub3QgcmVtb3ZlIHNvdXJjZSBcIiR7c3RhdGUuY29uZmlnLmlkfVwiOiAke2V9YCk7XG4gICAgICAgICAgICAvLyBUaGUgc291cmNlIGlzIHByb2JhYmx5IHN0aWxsIGluIHVzZSBieSBhIGxheWVyXG4gICAgICAgICAgICAvLyBMYXllcnMgbXVzdCBiZSByZW1vdmVkIGZpcnN0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gUmFzdGVyIHRpbGUgc291cmNlIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgcmFzdGVyIHRpbGUgc291cmNlOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBJbWFnZVNvdXJjZUhvb2sgLSBIb29rIGZvciB0aGUgSW1hZ2VTb3VyY2UgY29tcG9uZW50XG4gKiBcbiAqIFRoaXMgaG9vayBtYW5hZ2VzIGEgZ2VvcmVmZXJlbmNlZCBpbWFnZSBzb3VyY2UgaW4gTWFwTGlicmUgR0wgSlMsXG4gKiB1c2VkIGZvciByYWRhciBvdmVybGF5cywgaGlzdG9yaWNhbCBtYXBzLCBzY2FubmVkIGltYWdlcnksIGFuZCBzaW1pbGFyLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTGl2ZVZpZXdIb29rIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgTWFwTWFuYWdlciB9IGZyb20gJy4uL2NvcmUvbWFwLW1hbmFnZXInO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbmludGVyZmFjZSBJbWFnZVNvdXJjZUNvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBjb29yZGluYXRlczogbnVtYmVyW11bXTtcbn1cblxuaW50ZXJmYWNlIEltYWdlU291cmNlSG9va1N0YXRlIHtcbiAgY29uZmlnOiBJbWFnZVNvdXJjZUNvbmZpZztcbn1cblxuZXhwb3J0IGNvbnN0IEltYWdlU291cmNlSG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiBpbWFnZSBzb3VyY2UgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogSW1hZ2VTb3VyY2VDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciBpbWFnZSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFdhaXQgdW50aWwgdGhlIG1hcCBpcyBmdWxseSBsb2FkZWRcbiAgICAgIGNvbnN0IGFkZFNvdXJjZSA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhlIHNvdXJjZSBpcyBub3QgYWxyZWFkeSByZWdpc3RlcmVkXG4gICAgICAgICAgaWYgKG1hcC5nZXRTb3VyY2UoY29uZmlnLmlkKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBTb3VyY2UgXCIke2NvbmZpZy5pZH1cIiBhbHJlYWR5IGV4aXN0cyBvbiBtYXAgXCIke21hcElkfVwiYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQnVpbGQgdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uXG4gICAgICAgICAgY29uc3Qgc291cmNlU3BlYzogYW55ID0ge1xuICAgICAgICAgICAgdHlwZTogJ2ltYWdlJyxcbiAgICAgICAgICAgIHVybDogY29uZmlnLnVybCxcbiAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBjb25maWcuY29vcmRpbmF0ZXNcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQWRkIHRoZSBzb3VyY2UgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRTb3VyY2UoY29uZmlnLmlkLCBzb3VyY2VTcGVjKTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2ltYWdlX3NvdXJjZSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0IHRoZSBzb3VyY2UtYWRkZWQgZXZlbnQgb25jZSB0aGUgaW1hZ2UgaGFzIGxvYWRlZFxuICAgICAgICAgIC8vIE5vdGU6IE1hcExpYnJlIGxvYWRzIHRoZSBpbWFnZSBhc3luY2hyb25vdXNseVxuICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IG1hcC5nZXRTb3VyY2UoY29uZmlnLmlkKSBhcyBhbnk7XG4gICAgICAgICAgaWYgKHNvdXJjZSAmJiBzb3VyY2Uub25BZGQpIHtcbiAgICAgICAgICAgIC8vIFRoZSBpbWFnZSBsb2FkcyBpbiB0aGUgYmFja2dyb3VuZFxuICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTphZGRlZCcsIHsgc291cmNlX2lkOiBjb25maWcuaWQgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBJbWFnZSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBpbWFnZSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTplcnJvcicsIHtcbiAgICAgICAgICAgIHNvdXJjZV9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIHNvdXJjZSBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkU291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXYWl0IGZvciB0aGUgc3R5bGUgdG8gbG9hZFxuICAgICAgICBtYXAub25jZSgnbG9hZCcsIGFkZFNvdXJjZSk7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgaW1hZ2Ugc291cmNlOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBJbWFnZVNvdXJjZUhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9pbWFnZV9zb3VyY2U7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgc291cmNlIGlmIHByZXNlbnRcbiAgICAgICAgaWYgKG1hcC5nZXRTb3VyY2Uoc3RhdGUuY29uZmlnLmlkKSkge1xuICAgICAgICAgIC8vIE5vdGU6IGEgc291cmNlIGNhbiBvbmx5IGJlIHJlbW92ZWQgb25jZSBubyBsYXllciByZWZlcmVuY2VzIGl0XG4gICAgICAgICAgLy8gTWFwTGlicmUgcmFpc2VzIGlmIHdlIHRyeSB0byByZW1vdmUgYSBzb3VyY2UgdGhhdCBpcyBzdGlsbCBpbiB1c2VcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWFwLnJlbW92ZVNvdXJjZShzdGF0ZS5jb25maWcuaWQpO1xuICAgICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTpyZW1vdmVkJywgeyBzb3VyY2VfaWQ6IHN0YXRlLmNvbmZpZy5pZCB9KTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNYXBsaWJyZVhdIENvdWxkIG5vdCByZW1vdmUgc291cmNlIFwiJHtzdGF0ZS5jb25maWcuaWR9XCI6ICR7ZX1gKTtcbiAgICAgICAgICAgIC8vIFRoZSBzb3VyY2UgaXMgcHJvYmFibHkgc3RpbGwgaW4gdXNlIGJ5IGEgbGF5ZXJcbiAgICAgICAgICAgIC8vIExheWVycyBtdXN0IGJlIHJlbW92ZWQgZmlyc3RcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBJbWFnZSBzb3VyY2UgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyBpbWFnZSBzb3VyY2U6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxufTtcbiIsICIvKipcbiAqIFJhc3RlckRFTVNvdXJjZUhvb2sgLSBIb29rIGZvciB0aGUgUmFzdGVyREVNU291cmNlIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIERFTSAoRGlnaXRhbCBFbGV2YXRpb24gTW9kZWwpIHNvdXJjZSBpbiBNYXBMaWJyZSBHTCBKUyxcbiAqIHVzZWQgZm9yIHRlcnJhaW4gZWxldmF0aW9uIGRhdGEsIGhpbGxzaGFkaW5nIGFuZCAzRCByZW5kZXJpbmcuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBMaXZlVmlld0hvb2sgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBNYXBNYW5hZ2VyIH0gZnJvbSAnLi4vY29yZS9tYXAtbWFuYWdlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIFJhc3RlckRFTVNvdXJjZUNvbmZpZyB7XG4gIGlkOiBzdHJpbmc7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHVybD86IHN0cmluZztcbiAgdGlsZXM/OiBzdHJpbmdbXTtcbiAgdGlsZVNpemU/OiBudW1iZXI7XG4gIG1pbnpvb20/OiBudW1iZXI7XG4gIG1heHpvb20/OiBudW1iZXI7XG4gIGF0dHJpYnV0aW9uPzogc3RyaW5nO1xuICBib3VuZHM/OiBudW1iZXJbXTtcbiAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gIHZvbGF0aWxlPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIFJhc3RlckRFTVNvdXJjZUhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogUmFzdGVyREVNU291cmNlQ29uZmlnO1xuICBkYXRhSGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG4gIGVycm9ySGFuZGxlcj86IChlOiBhbnkpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBSYXN0ZXJERU1Tb3VyY2VIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIHJhc3RlciBERU0gc291cmNlIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFJhc3RlckRFTVNvdXJjZUNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIHJhc3RlciBERU0gc291cmNlIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBhZGRTb3VyY2UgPSAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBzb3VyY2UgaXMgbm90IGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAgICAgIGlmIChtYXAuZ2V0U291cmNlKGNvbmZpZy5pZCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gU291cmNlIFwiJHtjb25maWcuaWR9XCIgYWxyZWFkeSBleGlzdHMgb24gbWFwIFwiJHttYXBJZH1cImApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEJ1aWxkIHRoZSBzb3VyY2Ugc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IHNvdXJjZVNwZWM6IGFueSA9IHtcbiAgICAgICAgICAgIHR5cGU6ICdyYXN0ZXItZGVtJ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBBZ3JlZ2FyIHByb3BpZWRhZGVzIG9wY2lvbmFsZXNcbiAgICAgICAgICBpZiAoY29uZmlnLnVybCkge1xuICAgICAgICAgICAgc291cmNlU3BlYy51cmwgPSBjb25maWcudXJsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcudGlsZXMpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMudGlsZXMgPSBjb25maWcudGlsZXM7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy50aWxlU2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLnRpbGVTaXplID0gY29uZmlnLnRpbGVTaXplO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcubWluem9vbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLm1pbnpvb20gPSBjb25maWcubWluem9vbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLm1heHpvb20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc291cmNlU3BlYy5tYXh6b29tID0gY29uZmlnLm1heHpvb207XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy5hdHRyaWJ1dGlvbikge1xuICAgICAgICAgICAgc291cmNlU3BlYy5hdHRyaWJ1dGlvbiA9IGNvbmZpZy5hdHRyaWJ1dGlvbjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29uZmlnLmJvdW5kcykge1xuICAgICAgICAgICAgc291cmNlU3BlYy5ib3VuZHMgPSBjb25maWcuYm91bmRzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb25maWcuZW5jb2RpbmcpIHtcbiAgICAgICAgICAgIHNvdXJjZVNwZWMuZW5jb2RpbmcgPSBjb25maWcuZW5jb2Rpbmc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbmZpZy52b2xhdGlsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzb3VyY2VTcGVjLnZvbGF0aWxlID0gY29uZmlnLnZvbGF0aWxlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFkZCB0aGUgc291cmNlIHRvIHRoZSBtYXBcbiAgICAgICAgICBtYXAuYWRkU291cmNlKGNvbmZpZy5pZCwgc291cmNlU3BlYyk7XG5cbiAgICAgICAgICAvLyBXaXJlIHVwIHRoZSBzb3VyY2UncyBldmVudCBoYW5kbGVyc1xuICAgICAgICAgIGNvbnN0IGRhdGFIYW5kbGVyID0gKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuc291cmNlSWQgPT09IGNvbmZpZy5pZCkge1xuICAgICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnc291cmNlOmRhdGEnLCB7XG4gICAgICAgICAgICAgICAgc291cmNlX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICAgICAgZGF0YV90eXBlOiBlLmRhdGFUeXBlLFxuICAgICAgICAgICAgICAgIHNvdXJjZV9kYXRhX3R5cGU6IGUuc291cmNlRGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgdGlsZTogZS50aWxlID8ge1xuICAgICAgICAgICAgICAgICAgY29vcmQ6IGUudGlsZS50aWxlSUQuY2Fub25pY2FsLFxuICAgICAgICAgICAgICAgICAgaXNTb3VyY2VMb2FkZWQ6IGUuaXNTb3VyY2VMb2FkZWRcbiAgICAgICAgICAgICAgICB9IDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBlcnJvckhhbmRsZXIgPSAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5zb3VyY2VJZCA9PT0gY29uZmlnLmlkKSB7XG4gICAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6ZXJyb3InLCB7XG4gICAgICAgICAgICAgICAgc291cmNlX2lkOiBjb25maWcuaWQsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGUuZXJyb3IgPyBlLmVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICAgICAgICAgICAgdGlsZTogZS50aWxlXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBSZWdpc3RyYXIgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgICAgbWFwLm9uKCdzb3VyY2VkYXRhJywgZGF0YUhhbmRsZXIpO1xuICAgICAgICAgIG1hcC5vbignc291cmNlZGF0YWxvYWRpbmcnLCBkYXRhSGFuZGxlcik7XG4gICAgICAgICAgbWFwLm9uKCdlcnJvcicsIGVycm9ySGFuZGxlcik7XG5cbiAgICAgICAgICAvLyBHdWFyZGFyIGVzdGFkb1xuICAgICAgICAgICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9yYXN0ZXJfZGVtX3NvdXJjZSA9IHtcbiAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgIGRhdGFIYW5kbGVyLFxuICAgICAgICAgICAgZXJyb3JIYW5kbGVyXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEVtaXRpciBldmVudG8gZGUgc291cmNlIGFncmVnYWRvXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTphZGRlZCcsIHsgc291cmNlX2lkOiBjb25maWcuaWQgfSk7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFJhc3RlciBERU0gc291cmNlIFwiJHtjb25maWcuaWR9XCIgbW91bnRlZCBvbiBtYXAgXCIke21hcElkfVwiYCk7XG5cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBFcnJvciBhZGRpbmcgcmFzdGVyIERFTSBzb3VyY2UgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTplcnJvcicsIHtcbiAgICAgICAgICAgIHNvdXJjZV9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIHNvdXJjZSBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkU291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXYWl0IGZvciB0aGUgc3R5bGUgdG8gbG9hZFxuICAgICAgICBtYXAub25jZSgnbG9hZCcsIGFkZFNvdXJjZSk7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgcmFzdGVyIERFTSBzb3VyY2U6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IFJhc3RlckRFTVNvdXJjZUhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9yYXN0ZXJfZGVtX3NvdXJjZTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoc3RhdGUuY29uZmlnLm1hcElkKTtcbiAgICAgIGlmIChtYXApIHtcbiAgICAgICAgLy8gUmVtb3ZlciBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgaWYgKHN0YXRlLmRhdGFIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignc291cmNlZGF0YScsIHN0YXRlLmRhdGFIYW5kbGVyKTtcbiAgICAgICAgICBtYXAub2ZmKCdzb3VyY2VkYXRhbG9hZGluZycsIHN0YXRlLmRhdGFIYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuZXJyb3JIYW5kbGVyKSB7XG4gICAgICAgICAgbWFwLm9mZignZXJyb3InLCBzdGF0ZS5lcnJvckhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBzb3VyY2UgaWYgcHJlc2VudFxuICAgICAgICBpZiAobWFwLmdldFNvdXJjZShzdGF0ZS5jb25maWcuaWQpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG1hcC5yZW1vdmVTb3VyY2Uoc3RhdGUuY29uZmlnLmlkKTtcbiAgICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6cmVtb3ZlZCcsIHsgc291cmNlX2lkOiBzdGF0ZS5jb25maWcuaWQgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBDb3VsZCBub3QgcmVtb3ZlIHNvdXJjZSBcIiR7c3RhdGUuY29uZmlnLmlkfVwiOiAke2V9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gUmFzdGVyIERFTSBzb3VyY2UgXCIke3N0YXRlLmNvbmZpZy5pZH1cIiBkZXN0cm95ZWRgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgZGVzdHJveWluZyByYXN0ZXIgREVNIHNvdXJjZTonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogVmlkZW9Tb3VyY2VIb29rIC0gSG9vayBmb3IgdGhlIFZpZGVvU291cmNlIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgbWFuYWdlcyBhIGdlb3JlZmVyZW5jZWQgdmlkZW8gc291cmNlIGluIE1hcExpYnJlIEdMIEpTLFxuICogdXNlZCBmb3IgZHJvbmUgb3ZlcmxheXMsIHN1cnZlaWxsYW5jZSBjYW1lcmFzLCB0aW1lLWxhcHNlLCBhbmQgc2ltaWxhci5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgVmlkZW9Tb3VyY2VDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICB1cmxzOiBzdHJpbmdbXTtcbiAgY29vcmRpbmF0ZXM6IG51bWJlcltdW107XG59XG5cbmludGVyZmFjZSBWaWRlb1NvdXJjZUhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogVmlkZW9Tb3VyY2VDb25maWc7XG59XG5cbmV4cG9ydCBjb25zdCBWaWRlb1NvdXJjZUhvb2s6IExpdmVWaWV3SG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgLy8gUmVhZCB0aGUgY29uZmlndXJhdGlvblxuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm91bmQgb24gdmlkZW8gc291cmNlIGVsZW1lbnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IFZpZGVvU291cmNlQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3QgbWFwSWQgPSBjb25maWcubWFwSWQ7XG5cbiAgICAgIC8vIEdldCB0aGUgbWFwIGluc3RhbmNlXG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChtYXBJZCk7XG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke21hcElkfVwiIG5vdCBmb3VuZCBmb3IgdmlkZW8gc291cmNlIFwiJHtjb25maWcuaWR9XCJgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBhZGRTb3VyY2UgPSAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoZSBzb3VyY2UgaXMgbm90IGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAgICAgIGlmIChtYXAuZ2V0U291cmNlKGNvbmZpZy5pZCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gU291cmNlIFwiJHtjb25maWcuaWR9XCIgYWxyZWFkeSBleGlzdHMgb24gbWFwIFwiJHttYXBJZH1cImApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEJ1aWxkIHRoZSBzb3VyY2Ugc3BlY2lmaWNhdGlvblxuICAgICAgICAgIGNvbnN0IHNvdXJjZVNwZWM6IGFueSA9IHtcbiAgICAgICAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICAgICAgICB1cmxzOiBjb25maWcudXJscyxcbiAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBjb25maWcuY29vcmRpbmF0ZXNcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQWRkIHRoZSBzb3VyY2UgdG8gdGhlIG1hcFxuICAgICAgICAgIG1hcC5hZGRTb3VyY2UoY29uZmlnLmlkLCBzb3VyY2VTcGVjKTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3ZpZGVvX3NvdXJjZSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIHNvdXJjZSBhZ3JlZ2Fkb1xuICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCdzb3VyY2U6YWRkZWQnLCB7IHNvdXJjZV9pZDogY29uZmlnLmlkIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBWaWRlbyBzb3VyY2UgXCIke2NvbmZpZy5pZH1cIiBtb3VudGVkIG9uIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyB2aWRlbyBzb3VyY2UgXCIke2NvbmZpZy5pZH1cIjpgLCBlcnJvcik7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NvdXJjZTplcnJvcicsIHtcbiAgICAgICAgICAgIHNvdXJjZV9pZDogY29uZmlnLmlkLFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBhZGQgdGhlIHNvdXJjZSBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgYWRkU291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXYWl0IGZvciB0aGUgc3R5bGUgdG8gbG9hZFxuICAgICAgICBtYXAub25jZSgnbG9hZCcsIGFkZFNvdXJjZSk7XG4gICAgICB9XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgdmlkZW8gc291cmNlOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBWaWRlb1NvdXJjZUhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF92aWRlb19zb3VyY2U7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0aGUgc291cmNlIGlmIHByZXNlbnRcbiAgICAgICAgaWYgKG1hcC5nZXRTb3VyY2Uoc3RhdGUuY29uZmlnLmlkKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBtYXAucmVtb3ZlU291cmNlKHN0YXRlLmNvbmZpZy5pZCk7XG4gICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgnc291cmNlOnJlbW92ZWQnLCB7IHNvdXJjZV9pZDogc3RhdGUuY29uZmlnLmlkIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gQ291bGQgbm90IHJlbW92ZSBzb3VyY2UgXCIke3N0YXRlLmNvbmZpZy5pZH1cIjogJHtlfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFZpZGVvIHNvdXJjZSBcIiR7c3RhdGUuY29uZmlnLmlkfVwiIGRlc3Ryb3llZGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIHZpZGVvIHNvdXJjZTonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogVGVycmFpbkhvb2sgLSBIb29rIGZvciB0aGUgVGVycmFpbiBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIGVuYWJsZXMgM0QgdGVycmFpbiByZW5kZXJpbmcgaW4gTWFwTGlicmUgR0wgSlNcbiAqIHVzaW5nIGEgUmFzdGVyREVNU291cmNlIGZvciBlbGV2YXRpb24gZGF0YS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgVGVycmFpbkNvbmZpZyB7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHNvdXJjZUlkOiBzdHJpbmc7XG4gIGV4YWdnZXJhdGlvbjogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgVGVycmFpbkhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogVGVycmFpbkNvbmZpZztcbn1cblxuZXhwb3J0IGNvbnN0IFRlcnJhaW5Ib29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIHRlcnJhaW4gZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogVGVycmFpbkNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnU3RyKTtcbiAgICAgIGNvbnN0IG1hcElkID0gY29uZmlnLm1hcElkO1xuXG4gICAgICAvLyBHZXQgdGhlIG1hcCBpbnN0YW5jZVxuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQobWFwSWQpO1xuICAgICAgaWYgKCFtYXApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gTWFwIFwiJHttYXBJZH1cIiBub3QgZm91bmQgZm9yIHRlcnJhaW5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBlbmFibGVUZXJyYWluID0gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgc291cmNlIGV4aXN0c1xuICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IG1hcC5nZXRTb3VyY2UoY29uZmlnLnNvdXJjZUlkKTtcbiAgICAgICAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gU291cmNlIFwiJHtjb25maWcuc291cmNlSWR9XCIgbm90IGZvdW5kIGZvciB0ZXJyYWluYCk7XG4gICAgICAgICAgICB0aGlzLnB1c2hFdmVudCgndGVycmFpbjplcnJvcicsIHtcbiAgICAgICAgICAgICAgZXJyb3I6IGBTb3VyY2UgXCIke2NvbmZpZy5zb3VyY2VJZH1cIiBub3QgZm91bmRgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbmFibGUgdGVycmFpbiB3aXRoIHRoZSBnaXZlbiBzb3VyY2VcbiAgICAgICAgICBtYXAuc2V0VGVycmFpbih7XG4gICAgICAgICAgICBzb3VyY2U6IGNvbmZpZy5zb3VyY2VJZCxcbiAgICAgICAgICAgIGV4YWdnZXJhdGlvbjogY29uZmlnLmV4YWdnZXJhdGlvblxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gR3VhcmRhciBlc3RhZG9cbiAgICAgICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfdGVycmFpbiA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvIGRlIHRlcnJlbm8gaGFiaWxpdGFkb1xuICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCd0ZXJyYWluOmVuYWJsZWQnLCB7XG4gICAgICAgICAgICBzb3VyY2VfaWQ6IGNvbmZpZy5zb3VyY2VJZCxcbiAgICAgICAgICAgIGV4YWdnZXJhdGlvbjogY29uZmlnLmV4YWdnZXJhdGlvblxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBUZXJyYWluIGVuYWJsZWQgd2l0aCBzb3VyY2UgXCIke2NvbmZpZy5zb3VyY2VJZH1cIiBhbmQgZXhhZ2dlcmF0aW9uICR7Y29uZmlnLmV4YWdnZXJhdGlvbn1gKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGVuYWJsaW5nIHRlcnJhaW46YCwgZXJyb3IpO1xuICAgICAgICAgIHRoaXMucHVzaEV2ZW50KCd0ZXJyYWluOmVycm9yJywge1xuICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIElmIHRoZSBtYXAgaGFzIGFscmVhZHkgbG9hZGVkLCBlbmFibGUgdGVycmFpbiBpbW1lZGlhdGVseVxuICAgICAgaWYgKG1hcC5pc1N0eWxlTG9hZGVkKCkpIHtcbiAgICAgICAgZW5hYmxlVGVycmFpbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHN0eWxlIHRvIGxvYWRcbiAgICAgICAgbWFwLm9uY2UoJ2xvYWQnLCBlbmFibGVUZXJyYWluKTtcbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBtb3VudGluZyB0ZXJyYWluOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikgcmV0dXJuO1xuXG4gICAgICBjb25zdCBuZXdDb25maWc6IFRlcnJhaW5Db25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBzdGF0ZTogVGVycmFpbkhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF90ZXJyYWluO1xuICAgICAgXG4gICAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgdGVycmFpbiB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGNoYW5nZWRcbiAgICAgIGlmIChcbiAgICAgICAgbmV3Q29uZmlnLnNvdXJjZUlkICE9PSBzdGF0ZS5jb25maWcuc291cmNlSWQgfHxcbiAgICAgICAgbmV3Q29uZmlnLmV4YWdnZXJhdGlvbiAhPT0gc3RhdGUuY29uZmlnLmV4YWdnZXJhdGlvblxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG5ld0NvbmZpZy5tYXBJZCk7XG4gICAgICAgIGlmIChtYXAgJiYgbWFwLmlzU3R5bGVMb2FkZWQoKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBtYXAuc2V0VGVycmFpbih7XG4gICAgICAgICAgICAgIHNvdXJjZTogbmV3Q29uZmlnLnNvdXJjZUlkLFxuICAgICAgICAgICAgICBleGFnZ2VyYXRpb246IG5ld0NvbmZpZy5leGFnZ2VyYXRpb25cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBBY3R1YWxpemFyIGVzdGFkb1xuICAgICAgICAgICAgc3RhdGUuY29uZmlnID0gbmV3Q29uZmlnO1xuXG4gICAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFRlcnJhaW4gdXBkYXRlZDogc291cmNlPVwiJHtuZXdDb25maWcuc291cmNlSWR9XCIsIGV4YWdnZXJhdGlvbj0ke25ld0NvbmZpZy5leGFnZ2VyYXRpb259YCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIHVwZGF0aW5nIHRlcnJhaW46JywgZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBpbiB0ZXJyYWluIHVwZGF0ZWQ6JywgZXJyb3IpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgY29uc3Qgc3RhdGU6IFRlcnJhaW5Ib29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfdGVycmFpbjtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoc3RhdGUuY29uZmlnLm1hcElkKTtcbiAgICAgIGlmIChtYXApIHtcbiAgICAgICAgLy8gRGVzaGFiaWxpdGFyIHRlcnJlbm9cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtYXAuc2V0VGVycmFpbihudWxsKTtcbiAgICAgICAgICB0aGlzLnB1c2hFdmVudCgndGVycmFpbjpkaXNhYmxlZCcsIHt9KTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFRlcnJhaW4gZGlzYWJsZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gQ291bGQgbm90IGRpc2FibGUgdGVycmFpbjogJHtlfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgdGVycmFpbjonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogVGVycmFpbkNvbnRyb2xIb29rIC0gSG9vayBmb3IgdGhlIFRlcnJhaW5Db250cm9sIGNvbXBvbmVudFxuICogXG4gKiBUaGlzIGhvb2sgY3JlYXRlcyBhIFVJIGNvbnRyb2wgdGhhdCB0b2dnbGVzIDNEIHRlcnJhaW4gb24gYW5kIG9mZi5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5pbnRlcmZhY2UgVGVycmFpbkNvbnRyb2xDb25maWcge1xuICBpZDogc3RyaW5nO1xuICBtYXBJZDogc3RyaW5nO1xuICBwb3NpdGlvbjogc3RyaW5nO1xuICB0ZXJyYWluU291cmNlSWQ6IHN0cmluZztcbiAgZXhhZ2dlcmF0aW9uOiBudW1iZXI7XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBUZXJyYWluQ29udHJvbEhvb2tTdGF0ZSB7XG4gIGNvbmZpZzogVGVycmFpbkNvbnRyb2xDb25maWc7XG4gIGNvbnRyb2w6IGFueTtcbiAgZW5hYmxlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNvbnN0IFRlcnJhaW5Db250cm9sSG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZWFkIHRoZSBjb25maWd1cmF0aW9uXG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIE5vIGNvbmZpZyBmb3VuZCBvbiB0ZXJyYWluIGNvbnRyb2wgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbmZpZzogVGVycmFpbkNvbnRyb2xDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciB0ZXJyYWluIGNvbnRyb2wgXCIke2NvbmZpZy5pZH1cImApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWFyIGNsYXNlIGRlIGNvbnRyb2wgcGVyc29uYWxpemFkb1xuICAgICAgY2xhc3MgVGVycmFpbkNvbnRyb2wge1xuICAgICAgICBwcml2YXRlIF9tYXA6IGFueTtcbiAgICAgICAgcHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICAgICAgcHJpdmF0ZSBfYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICAgICAgcHJpdmF0ZSBfZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgcHJpdmF0ZSBfY29uZmlnOiBUZXJyYWluQ29udHJvbENvbmZpZztcbiAgICAgICAgcHJpdmF0ZSBfcHVzaEV2ZW50OiBhbnk7XG5cbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiBUZXJyYWluQ29udHJvbENvbmZpZywgcHVzaEV2ZW50OiBhbnkpIHtcbiAgICAgICAgICB0aGlzLl9lbmFibGVkID0gY29uZmlnLmVuYWJsZWQ7XG4gICAgICAgICAgdGhpcy5fY29uZmlnID0gY29uZmlnO1xuICAgICAgICAgIHRoaXMuX3B1c2hFdmVudCA9IHB1c2hFdmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uQWRkKG1hcDogYW55KSB7XG4gICAgICAgICAgdGhpcy5fbWFwID0gbWFwO1xuICAgICAgICAgIHRoaXMuX2NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIHRoaXMuX2NvbnRhaW5lci5jbGFzc05hbWUgPSAnbWFwbGlicmVnbC1jdHJsIG1hcGxpYnJlZ2wtY3RybC1ncm91cCc7XG5cbiAgICAgICAgICB0aGlzLl9idXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgICB0aGlzLl9idXR0b24uY2xhc3NOYW1lID0gJ21hcGxpYnJlZ2wtY3RybC10ZXJyYWluJztcbiAgICAgICAgICB0aGlzLl9idXR0b24udHlwZSA9ICdidXR0b24nO1xuICAgICAgICAgIHRoaXMuX2J1dHRvbi50aXRsZSA9IHRoaXMuX2VuYWJsZWQgPyAnRGlzYWJsZSAzRCBUZXJyYWluJyA6ICdFbmFibGUgM0QgVGVycmFpbic7XG4gICAgICAgICAgdGhpcy5fYnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuX2J1dHRvbi50aXRsZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gVGVycmFpbiBpY29uIChtb3VudGFpbiAvIDNEKVxuICAgICAgICAgIHRoaXMuX2J1dHRvbi5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgZmlsbD1cIm5vbmVcIj5cbiAgICAgICAgICAgICAgPHBhdGggZD1cIk0zIDIwbDYtOCA0IDQgOC0xMnYxNkgzelwiLz5cbiAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgIGA7XG5cbiAgICAgICAgICAvLyBBcGxpY2FyIGVzdGlsbyBpbmljaWFsXG4gICAgICAgICAgdGhpcy5fdXBkYXRlQnV0dG9uU3R5bGUoKTtcblxuICAgICAgICAgIC8vIFRvZ2dsZSBldmVudCBsaXN0ZW5lclxuICAgICAgICAgIHRoaXMuX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSAhdGhpcy5fZW5hYmxlZDtcbiAgICAgICAgICAgIHRoaXMuX3RvZ2dsZVRlcnJhaW4oKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUJ1dHRvblN0eWxlKCk7XG4gICAgICAgICAgICB0aGlzLl9idXR0b24hLnRpdGxlID0gdGhpcy5fZW5hYmxlZCA/ICdEaXNhYmxlIDNEIFRlcnJhaW4nIDogJ0VuYWJsZSAzRCBUZXJyYWluJztcbiAgICAgICAgICAgIHRoaXMuX2J1dHRvbiEuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5fYnV0dG9uIS50aXRsZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVtaXRpciBldmVudG8gYSBMaXZlVmlld1xuICAgICAgICAgICAgdGhpcy5fcHVzaEV2ZW50KCd0ZXJyYWluX2NvbnRyb2w6dG9nZ2xlZCcsIHtcbiAgICAgICAgICAgICAgZW5hYmxlZDogdGhpcy5fZW5hYmxlZCxcbiAgICAgICAgICAgICAgc291cmNlX2lkOiB0aGlzLl9jb25maWcudGVycmFpblNvdXJjZUlkLFxuICAgICAgICAgICAgICBleGFnZ2VyYXRpb246IHRoaXMuX2NvbmZpZy5leGFnZ2VyYXRpb25cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2J1dHRvbik7XG5cbiAgICAgICAgICAvLyBFbmFibGUgdGVycmFpbiBzdHJhaWdodCBhd2F5IHdoZW4gaXQgc3RhcnRzIGVuYWJsZWRcbiAgICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlVGVycmFpbigpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB0aGlzLl9jb250YWluZXI7XG4gICAgICAgIH1cblxuICAgICAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgICBpZiAodGhpcy5fY29udGFpbmVyICYmIHRoaXMuX2NvbnRhaW5lci5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250YWluZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9jb250YWluZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9tYXAgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIF90b2dnbGVUZXJyYWluKCkge1xuICAgICAgICAgIGlmICghdGhpcy5fbWFwKSByZXR1cm47XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgLy8gSGFiaWxpdGFyIHRlcnJlbm9cbiAgICAgICAgICAgICAgdGhpcy5fbWFwLnNldFRlcnJhaW4oe1xuICAgICAgICAgICAgICAgIHNvdXJjZTogdGhpcy5fY29uZmlnLnRlcnJhaW5Tb3VyY2VJZCxcbiAgICAgICAgICAgICAgICBleGFnZ2VyYXRpb246IHRoaXMuX2NvbmZpZy5leGFnZ2VyYXRpb25cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBEZXNoYWJpbGl0YXIgdGVycmVub1xuICAgICAgICAgICAgICB0aGlzLl9tYXAuc2V0VGVycmFpbihudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgdG9nZ2xpbmcgdGVycmFpbjonLCBlcnJvcik7XG4gICAgICAgICAgICB0aGlzLl9wdXNoRXZlbnQoJ3RlcnJhaW5fY29udHJvbDplcnJvcicsIHtcbiAgICAgICAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIF91cGRhdGVCdXR0b25TdHlsZSgpIHtcbiAgICAgICAgICBpZiAoIXRoaXMuX2J1dHRvbikgcmV0dXJuO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICh0aGlzLl9lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9idXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyM0QTkwRTInO1xuICAgICAgICAgICAgdGhpcy5fYnV0dG9uLnN0eWxlLmNvbG9yID0gJyNmZmZmZmYnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9idXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyc7XG4gICAgICAgICAgICB0aGlzLl9idXR0b24uc3R5bGUuY29sb3IgPSAnJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCAhPT0gZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVUZXJyYWluKCk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVCdXR0b25TdHlsZSgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2J1dHRvbikge1xuICAgICAgICAgICAgICB0aGlzLl9idXR0b24udGl0bGUgPSB0aGlzLl9lbmFibGVkID8gJ0Rpc2FibGUgM0QgVGVycmFpbicgOiAnRW5hYmxlIDNEIFRlcnJhaW4nO1xuICAgICAgICAgICAgICB0aGlzLl9idXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5fYnV0dG9uLnRpdGxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIHRoZSBjb250cm9sIGluc3RhbmNlXG4gICAgICBjb25zdCBjb250cm9sID0gbmV3IFRlcnJhaW5Db250cm9sKGNvbmZpZywgdGhpcy5wdXNoRXZlbnQuYmluZCh0aGlzKSk7XG5cbiAgICAgIC8vIEFncmVnYXIgY29udHJvbCBhbCBtYXBhXG4gICAgICBtYXAuYWRkQ29udHJvbChjb250cm9sIGFzIGFueSwgY29uZmlnLnBvc2l0aW9uIGFzIGFueSk7XG5cbiAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfdGVycmFpbl9jb250cm9sID0ge1xuICAgICAgICBjb25maWcsXG4gICAgICAgIGNvbnRyb2wsXG4gICAgICAgIGVuYWJsZWQ6IGNvbmZpZy5lbmFibGVkXG4gICAgICB9O1xuXG4gICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFRlcnJhaW4gY29udHJvbCBcIiR7Y29uZmlnLmlkfVwiIG1vdW50ZWQgb24gbWFwIFwiJHttYXBJZH1cIiBhdCBwb3NpdGlvbiBcIiR7Y29uZmlnLnBvc2l0aW9ufVwiYCk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgbW91bnRpbmcgdGVycmFpbiBjb250cm9sOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBlbCA9IHRoaXMuZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikgcmV0dXJuO1xuXG4gICAgICBjb25zdCBuZXdDb25maWc6IFRlcnJhaW5Db250cm9sQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdTdHIpO1xuICAgICAgY29uc3Qgc3RhdGU6IFRlcnJhaW5Db250cm9sSG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3RlcnJhaW5fY29udHJvbDtcbiAgICAgIFxuICAgICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgICAvLyBVcGRhdGUgdGhlIGNvbnRyb2wgd2hlbiB0aGUgZW5hYmxlZCBzdGF0ZSBjaGFuZ2VkXG4gICAgICBpZiAobmV3Q29uZmlnLmVuYWJsZWQgIT09IHN0YXRlLmVuYWJsZWQpIHtcbiAgICAgICAgc3RhdGUuY29udHJvbC5zZXRFbmFibGVkKG5ld0NvbmZpZy5lbmFibGVkKTtcbiAgICAgICAgc3RhdGUuZW5hYmxlZCA9IG5ld0NvbmZpZy5lbmFibGVkO1xuICAgICAgICBzdGF0ZS5jb25maWcgPSBuZXdDb25maWc7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGluIHRlcnJhaW4gY29udHJvbCB1cGRhdGVkOicsIGVycm9yKTtcbiAgICB9XG4gIH0sXG5cbiAgZGVzdHJveWVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IHN0YXRlOiBUZXJyYWluQ29udHJvbEhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF90ZXJyYWluX2NvbnRyb2w7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KHN0YXRlLmNvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwICYmIHN0YXRlLmNvbnRyb2wpIHtcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBjb250cm9sIGZyb20gdGhlIG1hcFxuICAgICAgICB0cnkge1xuICAgICAgICAgIG1hcC5yZW1vdmVDb250cm9sKHN0YXRlLmNvbnRyb2wpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbTWFwbGlicmVYXSBDb3VsZCBub3QgcmVtb3ZlIHRlcnJhaW4gY29udHJvbDogJHtlfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gVGVycmFpbiBjb250cm9sIFwiJHtzdGF0ZS5jb25maWcuaWR9XCIgZGVzdHJveWVkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgdGVycmFpbiBjb250cm9sOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBTa3lIb29rIC0gSG9vayBmb3IgdGhlIFNreSBjb21wb25lbnRcbiAqIFxuICogVGhpcyBob29rIGFkZHMgYW4gYXRtb3NwaGVyaWMgc2t5IGxheWVyIHRvIHRoZSBtYXAgZm9yXG4gKiBtZWpvcmFyIHZpc3VhbGl6YWNpb25lcyAzRC5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vaywgUGFpbnRQcm9wZXJ0eU5hbWUgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBNYXBNYW5hZ2VyIH0gZnJvbSAnLi4vY29yZS9tYXAtbWFuYWdlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIFNreUNvbmZpZyB7XG4gIG1hcElkOiBzdHJpbmc7XG4gIHBhaW50OiB7XG4gICAgW2tleTogc3RyaW5nXTogYW55O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgU2t5SG9va1N0YXRlIHtcbiAgY29uZmlnOiBTa3lDb25maWc7XG59XG5cbmV4cG9ydCBjb25zdCBTa3lIb29rOiBMaXZlVmlld0hvb2sgPSB7XG4gIG1vdW50ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gTm8gY29uZmlnIGZvdW5kIG9uIHNreSBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29uZmlnOiBTa3lDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXBJZCA9IGNvbmZpZy5tYXBJZDtcblxuICAgICAgLy8gR2V0IHRoZSBtYXAgaW5zdGFuY2VcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG1hcElkKTtcbiAgICAgIGlmICghbWFwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIE1hcCBcIiR7bWFwSWR9XCIgbm90IGZvdW5kIGZvciBza3lgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWl0IHVudGlsIHRoZSBtYXAgaXMgZnVsbHkgbG9hZGVkXG4gICAgICBjb25zdCBhZGRTa3kgPSAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQWdyZWdhciBjYXBhIGRlIGNpZWxvXG4gICAgICAgICAgLy8gQHRzLWlnbm9yZSAtIHNreSB0eXBlIGlzIHZhbGlkIGluIE1hcExpYnJlIGJ1dCBub3QgaW4gY3VycmVudCB0eXBlIGRlZmluaXRpb25zXG4gICAgICAgICAgbWFwLmFkZExheWVyKHtcbiAgICAgICAgICAgIGlkOiAnc2t5JyxcbiAgICAgICAgICAgIHR5cGU6ICdza3knIGFzIGFueSxcbiAgICAgICAgICAgIHBhaW50OiBjb25maWcucGFpbnRcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIEd1YXJkYXIgZXN0YWRvXG4gICAgICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3NreSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBFbWl0aXIgZXZlbnRvXG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NreTphZGRlZCcsIHt9KTtcblxuICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gU2t5IGxheWVyIGFkZGVkIHRvIG1hcCBcIiR7bWFwSWR9XCJgKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYXBsaWJyZVhdIEVycm9yIGFkZGluZyBza3k6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJZiB0aGUgbWFwIGhhcyBhbHJlYWR5IGxvYWRlZCwgYWRkIHRoZSBza3kgaW1tZWRpYXRlbHlcbiAgICAgIGlmIChtYXAuaXNTdHlsZUxvYWRlZCgpKSB7XG4gICAgICAgIGFkZFNreSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIHN0eWxlIHRvIGxvYWRcbiAgICAgICAgbWFwLm9uY2UoJ2xvYWQnLCBhZGRTa3kpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIHNreTonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbmZpZ1N0ciA9IGVsLmRhdGFzZXQuY29uZmlnO1xuICAgICAgaWYgKCFjb25maWdTdHIpIHJldHVybjtcblxuICAgICAgY29uc3QgbmV3Q29uZmlnOiBTa3lDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBzdGF0ZTogU2t5SG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3NreTtcbiAgICAgIFxuICAgICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuXG4gICAgICAvLyBVcGRhdGUgdGhlIHNreSB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGNoYW5nZWRcbiAgICAgIGNvbnN0IG1hcCA9IE1hcE1hbmFnZXIuZ2V0KG5ld0NvbmZpZy5tYXBJZCk7XG4gICAgICBpZiAobWFwICYmIG1hcC5nZXRMYXllcignc2t5JykpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBVcGRhdGUgcGFpbnQgcHJvcGVydGllc1xuICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG5ld0NvbmZpZy5wYWludCkpIHtcbiAgICAgICAgICAgIG1hcC5zZXRQYWludFByb3BlcnR5KCdza3knLCBrZXkgYXMgUGFpbnRQcm9wZXJ0eU5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTdG9yZSB0aGUgbmV3IGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICBzdGF0ZS5jb25maWcgPSBuZXdDb25maWc7XG5cbiAgICAgICAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFNreSBsYXllciB1cGRhdGVkYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW01hcGxpYnJlWF0gRXJyb3IgdXBkYXRpbmcgc2t5OicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBpbiBza3kgdXBkYXRlZDonLCBlcnJvcik7XG4gICAgfVxuICB9LFxuXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogU2t5SG9va1N0YXRlIHwgdW5kZWZpbmVkID0gKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X3NreTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoc3RhdGUuY29uZmlnLm1hcElkKTtcbiAgICAgIGlmIChtYXAgJiYgbWFwLmdldExheWVyKCdza3knKSkge1xuICAgICAgICAvLyBSZW1vdmUgdGhlIHNreSBsYXllclxuICAgICAgICB0cnkge1xuICAgICAgICAgIG1hcC5yZW1vdmVMYXllcignc2t5Jyk7XG4gICAgICAgICAgdGhpcy5wdXNoRXZlbnQoJ3NreTpyZW1vdmVkJywge30pO1xuICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gU2t5IGxheWVyIHJlbW92ZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW01hcGxpYnJlWF0gQ291bGQgbm90IHJlbW92ZSBza3kgbGF5ZXI6ICR7ZX1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBFcnJvciBkZXN0cm95aW5nIHNreTonLCBlcnJvcik7XG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogTGF6eSBsb2FkZXIgZm9yIHRoZSBkZWNrLmdsIHBhY2thZ2VzLlxuICpcbiAqIGRlY2suZ2wgaXMgcm91Z2hseSA2MDAgS0IgXHUyMDE0IGxhcmdlciB0aGFuIHRoZSByZXN0IG9mIE1hcGxpYnJlWCBwdXQgdG9nZXRoZXIgXHUyMDE0XG4gKiBhbmQgb25seSBtYXR0ZXJzIHRvIGFwcGxpY2F0aW9ucyB0aGF0IHVzZSBgPC5kZWNrZ2xfbGF5ZXI+YC4gTm90aGluZyBpbiB0aGlzXG4gKiBtb2R1bGUgbWF5IGJlIGltcG9ydGVkIHN0YXRpY2FsbHkgYW55d2hlcmUgaW4gdGhlIGxpYnJhcnksIG9yIHRoZSBidW5kbGVyXG4gKiBob2lzdHMgZGVjay5nbCBpbnRvIHRoZSBtYWluIGNodW5rIGFuZCB0aGUgc3BsaXQgaXMgbG9zdC4gVGhhdCBpcyB3aHkgdGhlXG4gKiBsYXllciBmYWN0b3J5IGFuZCB0aGUgb3ZlcmxheSBtYW5hZ2VyIHJlYWNoIGZvciB0aGVpciBjb25zdHJ1Y3RvcnMgdGhyb3VnaFxuICogYHJlcXVpcmVEZWNrR0woKWAgaW5zdGVhZCBvZiBpbXBvcnRpbmcgdGhlbSBkaXJlY3RseS5cbiAqXG4gKiBgaW1wb3J0IHR5cGVgIGRlY2xhcmF0aW9ucyBhcmUgZXJhc2VkIGF0IGNvbXBpbGUgdGltZSBhbmQgYXJlIHNhZmUuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBEZWNrIH0gZnJvbSAnQGRlY2suZ2wvY29yZSc7XG5pbXBvcnQgeyBnZXRWZXJzaW9uIH0gZnJvbSAnbWFwbGlicmUtZ2wnO1xuXG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuLi9jb3JlL2xvZ2dlcic7XG5cbi8vIFR5cGUtb25seSBpbXBvcnRzIChubyBydW50aW1lIGNvc3QpXG50eXBlIERlY2tHTENvcmUgPSB0eXBlb2YgaW1wb3J0KCdAZGVjay5nbC9jb3JlJyk7XG50eXBlIERlY2tHTExheWVycyA9IHR5cGVvZiBpbXBvcnQoJ0BkZWNrLmdsL2xheWVycycpO1xudHlwZSBEZWNrR0xBZ2dyZWdhdGlvbiA9IHR5cGVvZiBpbXBvcnQoJ0BkZWNrLmdsL2FnZ3JlZ2F0aW9uLWxheWVycycpO1xudHlwZSBEZWNrR0xNYXBib3ggPSB0eXBlb2YgaW1wb3J0KCdAZGVjay5nbC9tYXBib3gnKTtcblxuZXhwb3J0IGludGVyZmFjZSBEZWNrR0xNb2R1bGVzIHtcbiAgY29yZTogRGVja0dMQ29yZTtcbiAgbGF5ZXJzOiBEZWNrR0xMYXllcnM7XG4gIGFnZ3JlZ2F0aW9uOiBEZWNrR0xBZ2dyZWdhdGlvbjtcbiAgbWFwYm94OiBEZWNrR0xNYXBib3g7XG4gIERlY2s6IHR5cGVvZiBEZWNrO1xufVxuXG4vLyBDYWNoZSBmb3IgbG9hZGVkIG1vZHVsZXNcbmxldCBkZWNrR0xNb2R1bGVzOiBEZWNrR0xNb2R1bGVzIHwgbnVsbCA9IG51bGw7XG5sZXQgbG9hZGluZ1Byb21pc2U6IFByb21pc2U8RGVja0dMTW9kdWxlcz4gfCBudWxsID0gbnVsbDtcblxuLyoqXG4gKiBkZWNrLmdsJ3MgTWFwYm94T3ZlcmxheSByZWFkcyBNYXBMaWJyZSdzIGludGVybmFsIGBtYXAudHJhbnNmb3JtYCwgd2hpY2hcbiAqIG1hcGxpYnJlLWdsIHY2IHJlbW92ZWQuIEV2ZXJ5IHB1Ymxpc2hlZCBAZGVjay5nbC9tYXBib3ggXHUyMDE0IDkuMy4xMCBhbmQgdGhlXG4gKiA5LjQgYWxwaGFzIGluY2x1ZGVkIFx1MjAxNCBzdGlsbCBkZXBlbmRzIG9uIGl0LCBzbyBhIGRlY2suZ2wgbGF5ZXIgdW5kZXIgdjZcbiAqIGRpZXMgd2l0aCBhbiBvcGFxdWUgYENhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nICdfbmVhclonKWAuXG4gKlxuICogRmFpbCBlYXJseSB3aXRoIGFuIGV4cGxhbmF0aW9uIGluc3RlYWQuIFJlbW92ZSB0aGlzIGNoZWNrIG9uY2UgZGVjay5nbFxuICogc3VwcG9ydHMgbWFwbGlicmUtZ2wgdjYuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydERlY2tHTFN1cHBvcnRlZCgpOiB2b2lkIHtcbiAgY29uc3QgdmVyc2lvbiA9IGdldFZlcnNpb24oKTtcbiAgY29uc3QgbWFqb3IgPSBOdW1iZXIucGFyc2VJbnQodmVyc2lvbiwgMTApO1xuXG4gIGlmIChOdW1iZXIuaXNGaW5pdGUobWFqb3IpICYmIG1ham9yID49IDYpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgZGVjay5nbCBsYXllcnMgcmVxdWlyZSBtYXBsaWJyZS1nbCB2NSBcdTIwMTQgeW91IGFyZSBydW5uaW5nIHYke3ZlcnNpb259LiBgICtcbiAgICAgICAgJ0BkZWNrLmdsL21hcGJveCByZWFkcyB0aGUgaW50ZXJuYWwgbWFwLnRyYW5zZm9ybSB0aGF0IG1hcGxpYnJlLWdsIHY2IHJlbW92ZWQuICcgK1xuICAgICAgICAnRWl0aGVyIHBpbiBtYXBsaWJyZS1nbCB0byBeNS4wLjAsIG9yIGRyb3AgPC5kZWNrZ2xfbGF5ZXI+IGZyb20gdGhpcyBwYWdlLiAnICtcbiAgICAgICAgJ0V2ZXJ5IG90aGVyIE1hcGxpYnJlWCBjb21wb25lbnQgd29ya3Mgb24gdjYuJ1xuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBMb2FkIHRoZSBkZWNrLmdsIG1vZHVsZXMsIGltcG9ydGluZyB0aGVtIG9uIGZpcnN0IGNhbGwgYW5kIHJldHVybmluZyB0aGVcbiAqIGNhY2hlZCBzZXQgYWZ0ZXJ3YXJkcy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWREZWNrR0woKTogUHJvbWlzZTxEZWNrR0xNb2R1bGVzPiB7XG4gIGlmIChkZWNrR0xNb2R1bGVzKSB7XG4gICAgcmV0dXJuIGRlY2tHTE1vZHVsZXM7XG4gIH1cblxuICBhc3NlcnREZWNrR0xTdXBwb3J0ZWQoKTtcblxuICBpZiAobG9hZGluZ1Byb21pc2UpIHtcbiAgICByZXR1cm4gbG9hZGluZ1Byb21pc2U7XG4gIH1cblxuICBsb2dnZXIuZGVidWcoJ1tNYXBsaWJyZVhdIExhenkgbG9hZGluZyBkZWNrLmdsIG1vZHVsZXMuLi4nKTtcblxuICBsb2FkaW5nUHJvbWlzZSA9IFByb21pc2UuYWxsKFtcbiAgICBpbXBvcnQoJ0BkZWNrLmdsL2NvcmUnKSxcbiAgICBpbXBvcnQoJ0BkZWNrLmdsL2xheWVycycpLFxuICAgIGltcG9ydCgnQGRlY2suZ2wvYWdncmVnYXRpb24tbGF5ZXJzJyksXG4gICAgaW1wb3J0KCdAZGVjay5nbC9tYXBib3gnKVxuICBdKVxuICAgIC50aGVuKChbY29yZSwgbGF5ZXJzLCBhZ2dyZWdhdGlvbiwgbWFwYm94XSkgPT4ge1xuICAgICAgY29uc3QgbW9kdWxlczogRGVja0dMTW9kdWxlcyA9IHtcbiAgICAgICAgY29yZSxcbiAgICAgICAgbGF5ZXJzLFxuICAgICAgICBhZ2dyZWdhdGlvbixcbiAgICAgICAgbWFwYm94LFxuICAgICAgICBEZWNrOiBjb3JlLkRlY2tcbiAgICAgIH07XG5cbiAgICAgIGRlY2tHTE1vZHVsZXMgPSBtb2R1bGVzO1xuICAgICAgbG9hZGluZ1Byb21pc2UgPSBudWxsO1xuXG4gICAgICBsb2dnZXIuZGVidWcoJ1tNYXBsaWJyZVhdIGRlY2suZ2wgbW9kdWxlcyBsb2FkZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICByZXR1cm4gbW9kdWxlcztcbiAgICB9KVxuICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgIGxvYWRpbmdQcm9taXNlID0gbnVsbDtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICdbTWFwbGlicmVYXSBGYWlsZWQgdG8gbG9hZCBkZWNrLmdsLiBJbnN0YWxsIHRoZSBvcHRpb25hbCBwZWVyIGRlcGVuZGVuY2llczogJyArXG4gICAgICAgICAgJ25wbSBpbnN0YWxsIEBkZWNrLmdsL2NvcmUgQGRlY2suZ2wvbGF5ZXJzIEBkZWNrLmdsL2FnZ3JlZ2F0aW9uLWxheWVycyBAZGVjay5nbC9tYXBib3gnLFxuICAgICAgICBlcnJvclxuICAgICAgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH0pO1xuXG4gIHJldHVybiBsb2FkaW5nUHJvbWlzZTtcbn1cblxuLyoqXG4gKiBUaGUgYWxyZWFkeS1sb2FkZWQgZGVjay5nbCBtb2R1bGVzLlxuICpcbiAqIFRocm93cyBpZiBgbG9hZERlY2tHTCgpYCBoYXMgbm90IHJlc29sdmVkIHlldC4gQ2FsbCB0aGlzIG9ubHkgZnJvbSBjb2RlIHRoYXRcbiAqIHJ1bnMgYWZ0ZXIgdGhlIERlY2tHbExheWVySG9vayBoYXMgYXdhaXRlZCB0aGUgbG9hZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVEZWNrR0woKTogRGVja0dMTW9kdWxlcyB7XG4gIGlmICghZGVja0dMTW9kdWxlcykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdkZWNrLmdsIGhhcyBub3QgYmVlbiBsb2FkZWQgeWV0LiBBd2FpdCBsb2FkRGVja0dMKCkgYmVmb3JlIHVzaW5nIGRlY2suZ2wgbGF5ZXJzLidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGRlY2tHTE1vZHVsZXM7XG59XG5cbi8qKlxuICogV2hldGhlciB0aGUgZGVjay5nbCBtb2R1bGVzIGFyZSBjYWNoZWQgaW4gbWVtb3J5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNEZWNrR0xMb2FkZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBkZWNrR0xNb2R1bGVzICE9PSBudWxsO1xufVxuXG4vKipcbiAqIFN0YXJ0IGxvYWRpbmcgZGVjay5nbCBpbiB0aGUgYmFja2dyb3VuZCBzbyB0aGUgZmlyc3QgYDwuZGVja2dsX2xheWVyPmAgbW91bnRcbiAqIGRvZXMgbm90IGhhdmUgdG8gd2FpdCBmb3IgdGhlIG5ldHdvcmsuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVsb2FkRGVja0dMKCk6IHZvaWQge1xuICBpZiAoIWRlY2tHTE1vZHVsZXMgJiYgIWxvYWRpbmdQcm9taXNlKSB7XG4gICAgbG9hZERlY2tHTCgpLmNhdGNoKCgpID0+IHtcbiAgICAgIC8vIFByZWxvYWRpbmcgaXMgYmVzdC1lZmZvcnQ7IGxvYWREZWNrR0wgYWxyZWFkeSByZXBvcnRlZCB0aGUgZmFpbHVyZS5cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIENsZWFyIHRoZSBtb2R1bGUgY2FjaGUuIFVzZWZ1bCBpbiB0ZXN0cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyRGVja0dMQ2FjaGUoKTogdm9pZCB7XG4gIGRlY2tHTE1vZHVsZXMgPSBudWxsO1xuICBsb2FkaW5nUHJvbWlzZSA9IG51bGw7XG59XG4iLCAiLyoqXG4gKiBGYWN0b3J5IGZvciBidWlsZGluZyBkZWNrLmdsIGxheWVyc1xuICogXG4gKiBUaGlzIGZhY3RvcnkgdGFrZXMgYSBjb25maWd1cmF0aW9uIG9iamVjdCBhbmQgY3JlYXRlcyB0aGUgbWF0Y2hpbmdcbiAqIGRlY2suZ2wgbGF5ZXIgaW5zdGFuY2UuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBMYXllciB9IGZyb20gJ0BkZWNrLmdsL2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBEZWNrR0xMYXllckNvbmZpZyB9IGZyb20gJy4uL3R5cGVzL2RlY2tnbCc7XG5pbXBvcnQgeyByZXF1aXJlRGVja0dMIH0gZnJvbSAnLi9kZWNrZ2wtbGF6eS1sb2FkZXInO1xuXG4vLyBUaGUgbGF5ZXIgdHlwZXMgdGhpcyBjb21wb25lbnQgc3VwcG9ydHMsIHNwbGl0IGJ5IHRoZSBwYWNrYWdlIHRoYXQgcHJvdmlkZXNcbi8vIHRoZW0uIFRoZSBjb25zdHJ1Y3RvcnMgdGhlbXNlbHZlcyBhcmUgcmVzb2x2ZWQgYXQgY2FsbCB0aW1lIGZyb20gdGhlXG4vLyBsYXppbHktbG9hZGVkIG1vZHVsZXMgXHUyMDE0IGltcG9ydGluZyB0aGVtIGhlcmUgd291bGQgZGVmZWF0IHRoZSBjb2RlIHNwbGl0LlxuY29uc3QgTEFZRVJfUEFDS0FHRVMgPSB7XG4gIGxheWVyczogW1xuICAgICdTY2F0dGVycGxvdExheWVyJyxcbiAgICAnQXJjTGF5ZXInLFxuICAgICdMaW5lTGF5ZXInLFxuICAgICdDb2x1bW5MYXllcicsXG4gICAgJ1BhdGhMYXllcicsXG4gICAgJ1BvbHlnb25MYXllcicsXG4gICAgJ0dlb0pzb25MYXllcicsXG4gICAgJ1RleHRMYXllcicsXG4gICAgJ0ljb25MYXllcidcbiAgXSxcbiAgYWdncmVnYXRpb246IFsnSGV4YWdvbkxheWVyJywgJ0dyaWRMYXllcicsICdTY3JlZW5HcmlkTGF5ZXInLCAnSGVhdG1hcExheWVyJywgJ0NvbnRvdXJMYXllciddXG59IGFzIGNvbnN0O1xuXG5jb25zdCBTVVBQT1JURURfTEFZRVJfVFlQRVM6IHN0cmluZ1tdID0gW1xuICAuLi5MQVlFUl9QQUNLQUdFUy5sYXllcnMsXG4gIC4uLkxBWUVSX1BBQ0tBR0VTLmFnZ3JlZ2F0aW9uXG5dO1xuXG4vKipcbiAqIExvb2sgdXAgYSBsYXllciBjb25zdHJ1Y3RvciBpbiB0aGUgbG9hZGVkIGRlY2suZ2wgbW9kdWxlcy5cbiAqXG4gKiBSZXF1aXJlcyBgbG9hZERlY2tHTCgpYCB0byBoYXZlIHJlc29sdmVkIFx1MjAxNCB0aGUgRGVja0dsTGF5ZXJIb29rIGF3YWl0cyBpdFxuICogYmVmb3JlIGFueSBsYXllciBpcyBjcmVhdGVkLlxuICovXG5mdW5jdGlvbiBsYXllckNvbnN0cnVjdG9yKGxheWVyVHlwZTogc3RyaW5nKTogYW55IHtcbiAgY29uc3QgZGVjayA9IHJlcXVpcmVEZWNrR0woKTtcblxuICBjb25zdCBtb2R1bGVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID1cbiAgICAoTEFZRVJfUEFDS0FHRVMuYWdncmVnYXRpb24gYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKGxheWVyVHlwZSlcbiAgICAgID8gZGVjay5hZ2dyZWdhdGlvblxuICAgICAgOiBkZWNrLmxheWVycztcblxuICByZXR1cm4gbW9kdWxlc1tsYXllclR5cGVdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlY2suZ2wgbGF5ZXIgaW5zdGFuY2UgZnJvbSBhIGNvbmZpZ3VyYXRpb24gb2JqZWN0XG4gKiBcbiAqIEBwYXJhbSBjb25maWcgLSBMYXllciBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyBUaGUgZGVjay5nbCBsYXllciBpbnN0YW5jZVxuICogQHRocm93cyBFcnJvciBpZiB0aGUgbGF5ZXIgdHlwZSBpcyBub3Qgc3VwcG9ydGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEZWNrTGF5ZXIoY29uZmlnOiBEZWNrR0xMYXllckNvbmZpZyk6IExheWVyIHtcbiAgY29uc3QgTGF5ZXJDb25zdHJ1Y3RvciA9IGxheWVyQ29uc3RydWN0b3IoY29uZmlnLmxheWVyVHlwZSk7XG5cbiAgaWYgKCFMYXllckNvbnN0cnVjdG9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFVua25vd24gZGVjay5nbCBsYXllciB0eXBlOiAke2NvbmZpZy5sYXllclR5cGV9LiBgICtcbiAgICAgIGBBdmFpbGFibGUgdHlwZXM6ICR7U1VQUE9SVEVEX0xBWUVSX1RZUEVTLmpvaW4oJywgJyl9YFxuICAgICk7XG4gIH1cblxuICAvLyBUdXJuIEVsaXhpciBhdG9tcy9zdHJpbmdzIGludG8gSlMgYWNjZXNzb3IgZnVuY3Rpb25zXG4gIGNvbnN0IHByb2Nlc3NlZFByb3BzID0gcHJvY2Vzc0FjY2Vzc29ycyhjb25maWcucHJvcHMpO1xuICBcbiAgcmV0dXJuIG5ldyBMYXllckNvbnN0cnVjdG9yKHtcbiAgICAuLi5wcm9jZXNzZWRQcm9wcyxcbiAgICBpZDogY29uZmlnLmlkLFxuICAgIGRhdGE6IGNvbmZpZy5kYXRhLFxuICAgIHVwZGF0ZVRyaWdnZXJzOiBjb25maWcudXBkYXRlVHJpZ2dlcnMgfHwge31cbiAgfSk7XG59XG5cbi8qKlxuICogVHVybiBFbGl4aXIgYXRvbXMvc3RyaW5ncyBpbnRvIEpTIGFjY2Vzc29yIGZ1bmN0aW9uc1xuICogXG4gKiBFeGFtcGxlczpcbiAqIC0gOnBvc2l0aW9uICAgICAgICAgIC0+IGQgPT4gZC5wb3NpdGlvblxuICogLSBcImNvb3JkaW5hdGVzXCIgICAgICAtPiBkID0+IGQuY29vcmRpbmF0ZXNcbiAqIC0gW1wiZ2V0XCIsIFwiY29vcmRzXCJdICAtPiBkID0+IGQuY29vcmRzXG4gKi9cbmZ1bmN0aW9uIHByb2Nlc3NBY2Nlc3NvcnMocHJvcHM6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgY29uc3QgcHJvY2Vzc2VkOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gIFxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwcm9wcykpIHtcbiAgICAvLyBBbiBhY2Nlc3Nvcjogc3RhcnRzIHdpdGggXCJnZXRcIlxuICAgIGlmIChrZXkuc3RhcnRzV2l0aCgnZ2V0JykpIHtcbiAgICAgIHByb2Nlc3NlZFtrZXldID0gY3JlYXRlQWNjZXNzb3IodmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcm9jZXNzZWRba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHByb2Nlc3NlZDtcbn1cblxuLyoqXG4gKiBCdWlsZCBhbiBhY2Nlc3NvciBmdW5jdGlvbiBmcm9tIGFueSBvZiB0aGUgc3VwcG9ydGVkIGZvcm1hdHNcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQWNjZXNzb3IodmFsdWU6IGFueSk6IGFueSB7XG4gIC8vIEFscmVhZHkgYSBmdW5jdGlvbjogcGFzcyBpdCB0aHJvdWdoXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgXG4gIC8vIEEgc3RyaW5nL2F0b206IGEgcHJvcGVydHkgbmFtZVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiAoZDogYW55KSA9PiBkW3ZhbHVlXTtcbiAgfVxuICBcbiAgLy8gQW4gYXJyYXkgb2YgdGhlIGZvcm0gW1wiZ2V0XCIsIFwicHJvcE5hbWVcIl1cbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpICYmIHZhbHVlWzBdID09PSAnZ2V0JyAmJiB2YWx1ZS5sZW5ndGggPT09IDIpIHtcbiAgICBjb25zdCBwcm9wTmFtZSA9IHZhbHVlWzFdO1xuICAgIHJldHVybiAoZDogYW55KSA9PiBkW3Byb3BOYW1lXTtcbiAgfVxuICBcbiAgLy8gQW4gYXJyYXk6IGEgY29uc3RhbnQgdmFsdWVcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIFxuICAvLyBBIGNvbnN0YW50IHZhbHVlXG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqXG4gKiBXaGV0aGVyIGEgbGF5ZXIgdHlwZSBpcyBzdXBwb3J0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRMYXllclR5cGUobGF5ZXJUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIFNVUFBPUlRFRF9MQVlFUl9UWVBFUy5pbmNsdWRlcyhsYXllclR5cGUpO1xufVxuXG4vKipcbiAqIFRoZSBsaXN0IG9mIHN1cHBvcnRlZCBsYXllciB0eXBlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwcG9ydGVkTGF5ZXJUeXBlcygpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBbLi4uU1VQUE9SVEVEX0xBWUVSX1RZUEVTXTtcbn1cbiIsICIvKipcbiAqIE1hbmFnZXIgZm9yIGRlY2suZ2wgbGF5ZXJzXG4gKiBcbiAqIE1hbmFnZXMgdGhlIGludGVncmF0aW9uIGJldHdlZW4gZGVjay5nbCBhbmQgTWFwTGlicmUgR0wgSlMsXG4gKiBoYW5kbGluZyB0aGUgb3ZlcmxheSwgaXRzIGxheWVycyBhbmQgdGhlaXIgZXZlbnRzLlxuICovXG5cbmltcG9ydCB0eXBlIHsgTWFwYm94T3ZlcmxheSB9IGZyb20gJ0BkZWNrLmdsL21hcGJveCc7XG5pbXBvcnQgdHlwZSB7IExheWVyLCBQaWNraW5nSW5mbyB9IGZyb20gJ0BkZWNrLmdsL2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBNYXAgYXMgTWFwTGlicmVNYXAgfSBmcm9tICdtYXBsaWJyZS1nbCc7XG5pbXBvcnQgeyBjcmVhdGVEZWNrTGF5ZXIgfSBmcm9tICcuL2RlY2tnbC1sYXllci1mYWN0b3J5JztcbmltcG9ydCB7IHJlcXVpcmVEZWNrR0wgfSBmcm9tICcuL2RlY2tnbC1sYXp5LWxvYWRlcic7XG5pbXBvcnQgdHlwZSB7IERlY2tHTExheWVyQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMvZGVja2dsJztcblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vY29yZS9sb2dnZXInO1xuXG5leHBvcnQgY2xhc3MgRGVja0dMTGF5ZXJNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBtYXA6IE1hcExpYnJlTWFwO1xuICBwcml2YXRlIGhvb2s6IGFueTtcbiAgcHJpdmF0ZSBvdmVybGF5OiBNYXBib3hPdmVybGF5IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbGF5ZXJzOiBNYXA8c3RyaW5nLCBMYXllcj4gPSBuZXcgTWFwPHN0cmluZywgTGF5ZXI+KCk7XG4gIFxuICBjb25zdHJ1Y3RvcihtYXA6IE1hcExpYnJlTWFwLCBob29rOiBhbnkpIHtcbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhvb2sgPSBob29rO1xuICAgIHRoaXMuaW5pdGlhbGl6ZU92ZXJsYXkoKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIEluaXRpYWxpc2UgdGhlIGRlY2suZ2wgb3ZlcmxheSBvbiB0b3Agb2YgTWFwTGlicmVcbiAgICovXG4gIHByaXZhdGUgaW5pdGlhbGl6ZU92ZXJsYXkoKTogdm9pZCB7XG4gICAgbG9nZ2VyLmRlYnVnKCdbTWFwbGlicmVYXSBJbml0aWFsaXppbmcgRGVja0dMIG92ZXJsYXknKTtcbiAgICBcbiAgICAvLyBSZXNvbHZlZCBhdCBydW50aW1lIHNvIEBkZWNrLmdsL21hcGJveCBzdGF5cyBvdXQgb2YgdGhlIG1haW4gYnVuZGxlLlxuICAgIGNvbnN0IHsgTWFwYm94T3ZlcmxheSB9ID0gcmVxdWlyZURlY2tHTCgpLm1hcGJveDtcblxuICAgIHRoaXMub3ZlcmxheSA9IG5ldyBNYXBib3hPdmVybGF5KHtcbiAgICAgIGludGVybGVhdmVkOiB0cnVlLFxuICAgICAgb25DbGljazogdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpLFxuICAgICAgb25Ib3ZlcjogdGhpcy5oYW5kbGVIb3Zlci5iaW5kKHRoaXMpLFxuICAgICAgb25EcmFnU3RhcnQ6IHRoaXMuaGFuZGxlRHJhZ1N0YXJ0LmJpbmQodGhpcyksXG4gICAgICBvbkRyYWc6IHRoaXMuaGFuZGxlRHJhZy5iaW5kKHRoaXMpLFxuICAgICAgb25EcmFnRW5kOiB0aGlzLmhhbmRsZURyYWdFbmQuYmluZCh0aGlzKVxuICAgIH0pO1xuICAgIFxuICAgIHRoaXMubWFwLmFkZENvbnRyb2wodGhpcy5vdmVybGF5IGFzIGFueSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBBZGQgYSBsYXllciB0byB0aGUgb3ZlcmxheVxuICAgKi9cbiAgYWRkTGF5ZXIoY29uZmlnOiBEZWNrR0xMYXllckNvbmZpZyk6IHZvaWQge1xuICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gQWRkaW5nIERlY2tHTCBsYXllcjogJHtjb25maWcuaWR9YCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxheWVyID0gY3JlYXRlRGVja0xheWVyKGNvbmZpZyk7XG4gICAgICB0aGlzLmxheWVycy5zZXQoY29uZmlnLmlkLCBsYXllcik7XG4gICAgICB0aGlzLnVwZGF0ZU92ZXJsYXkoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gRXJyb3IgYWRkaW5nIERlY2tHTCBsYXllcjpgLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbGF5ZXJcbiAgICovXG4gIHVwZGF0ZUxheWVyKGNvbmZpZzogRGVja0dMTGF5ZXJDb25maWcpOiB2b2lkIHtcbiAgICBsb2dnZXIuZGVidWcoYFtNYXBsaWJyZVhdIFVwZGF0aW5nIERlY2tHTCBsYXllcjogJHtjb25maWcuaWR9YCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxheWVyID0gY3JlYXRlRGVja0xheWVyKGNvbmZpZyk7XG4gICAgICB0aGlzLmxheWVycy5zZXQoY29uZmlnLmlkLCBsYXllcik7XG4gICAgICB0aGlzLnVwZGF0ZU92ZXJsYXkoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgW01hcGxpYnJlWF0gRXJyb3IgdXBkYXRpbmcgRGVja0dMIGxheWVyOmAsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIFJlbW92ZSBhIGxheWVyIGZyb20gdGhlIG92ZXJsYXlcbiAgICovXG4gIHJlbW92ZUxheWVyKGxheWVySWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gUmVtb3ZpbmcgRGVja0dMIGxheWVyOiAke2xheWVySWR9YCk7XG4gICAgXG4gICAgdGhpcy5sYXllcnMuZGVsZXRlKGxheWVySWQpO1xuICAgIHRoaXMudXBkYXRlT3ZlcmxheSgpO1xuICB9XG4gIFxuICAvKipcbiAgICogUmVmcmVzaCB0aGUgb3ZlcmxheSB3aXRoIHRoZSBjdXJyZW50IGxheWVyc1xuICAgKi9cbiAgcHJpdmF0ZSB1cGRhdGVPdmVybGF5KCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5vdmVybGF5KSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgbGF5ZXJzQXJyYXkgPSBBcnJheS5mcm9tKHRoaXMubGF5ZXJzLnZhbHVlcygpKTtcbiAgICB0aGlzLm92ZXJsYXkuc2V0UHJvcHMoeyBsYXllcnM6IGxheWVyc0FycmF5IH0pO1xuICB9XG4gIFxuICAvKipcbiAgICogTWFuZWphIGV2ZW50b3MgZGUgY2xpY2tcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlQ2xpY2soaW5mbzogUGlja2luZ0luZm8pOiB2b2lkIHtcbiAgICBpZiAoaW5mby5vYmplY3QpIHtcbiAgICAgIHRoaXMuaG9vay5wdXNoRXZlbnQoJ2RlY2tnbDpjbGljaycsIHtcbiAgICAgICAgbGF5ZXJJZDogaW5mby5sYXllcj8uaWQsXG4gICAgICAgIG9iamVjdDogaW5mby5vYmplY3QsXG4gICAgICAgIHg6IGluZm8ueCxcbiAgICAgICAgeTogaW5mby55LFxuICAgICAgICBjb29yZGluYXRlOiBpbmZvLmNvb3JkaW5hdGVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIE1hbmVqYSBldmVudG9zIGRlIGhvdmVyXG4gICAqL1xuICBwcml2YXRlIGhhbmRsZUhvdmVyKGluZm86IFBpY2tpbmdJbmZvKTogdm9pZCB7XG4gICAgaWYgKGluZm8ub2JqZWN0KSB7XG4gICAgICB0aGlzLmhvb2sucHVzaEV2ZW50KCdkZWNrZ2w6aG92ZXInLCB7XG4gICAgICAgIGxheWVySWQ6IGluZm8ubGF5ZXI/LmlkLFxuICAgICAgICBvYmplY3Q6IGluZm8ub2JqZWN0LFxuICAgICAgICB4OiBpbmZvLngsXG4gICAgICAgIHk6IGluZm8ueVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICogTWFuZWphIGluaWNpbyBkZSBkcmFnXG4gICAqL1xuICBwcml2YXRlIGhhbmRsZURyYWdTdGFydChpbmZvOiBQaWNraW5nSW5mbyk6IHZvaWQge1xuICAgIGlmIChpbmZvLm9iamVjdCkge1xuICAgICAgdGhpcy5ob29rLnB1c2hFdmVudCgnZGVja2dsOmRyYWdfc3RhcnQnLCB7XG4gICAgICAgIGxheWVySWQ6IGluZm8ubGF5ZXI/LmlkLFxuICAgICAgICBvYmplY3Q6IGluZm8ub2JqZWN0XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBNYW5lamEgZXZlbnRvIGRlIGRyYWdcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlRHJhZyhpbmZvOiBQaWNraW5nSW5mbyk6IHZvaWQge1xuICAgIGlmIChpbmZvLm9iamVjdCkge1xuICAgICAgdGhpcy5ob29rLnB1c2hFdmVudCgnZGVja2dsOmRyYWcnLCB7XG4gICAgICAgIGxheWVySWQ6IGluZm8ubGF5ZXI/LmlkLFxuICAgICAgICBvYmplY3Q6IGluZm8ub2JqZWN0LFxuICAgICAgICBjb29yZGluYXRlOiBpbmZvLmNvb3JkaW5hdGVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgLyoqXG4gICAqIE1hbmVqYSBmaW4gZGUgZHJhZ1xuICAgKi9cbiAgcHJpdmF0ZSBoYW5kbGVEcmFnRW5kKGluZm86IFBpY2tpbmdJbmZvKTogdm9pZCB7XG4gICAgdGhpcy5ob29rLnB1c2hFdmVudCgnZGVja2dsOmRyYWdfZW5kJywge1xuICAgICAgbGF5ZXJJZDogaW5mby5sYXllcj8uaWRcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIExpbXBpYSByZWN1cnNvc1xuICAgKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICBsb2dnZXIuZGVidWcoJ1tNYXBsaWJyZVhdIERlc3Ryb3lpbmcgRGVja0dMIG1hbmFnZXInKTtcbiAgICBcbiAgICBpZiAodGhpcy5vdmVybGF5KSB7XG4gICAgICB0aGlzLm1hcC5yZW1vdmVDb250cm9sKHRoaXMub3ZlcmxheSBhcyBhbnkpO1xuICAgICAgdGhpcy5vdmVybGF5ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5sYXllcnMuY2xlYXIoKTtcbiAgfVxufVxuIiwgIi8qKlxuICogTGl2ZVZpZXcgaG9vayBmb3IgZGVjay5nbCBsYXllcnNcbiAqIFxuICogTWFuYWdlcyB0aGUgbGlmZWN5Y2xlIG9mIGRlY2suZ2wgbGF5ZXJzIGluc2lkZSBMaXZlVmlldyxcbiAqIGtlZXBpbmcgc2VydmVyIGFuZCBjbGllbnQgdXBkYXRlcyBpbiBzeW5jLlxuICogXG4gKiBVc2VzIGxhenkgbG9hZGluZyB0byBvbmx5IGxvYWQgZGVjay5nbCB3aGVuIG5lZWRlZCwgcmVkdWNpbmcgaW5pdGlhbCBidW5kbGUgc2l6ZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IExpdmVWaWV3SG9vayB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcbmltcG9ydCB7IERlY2tHTExheWVyTWFuYWdlciB9IGZyb20gJy4uL3V0aWxzL2RlY2tnbC1tYW5hZ2VyJztcbmltcG9ydCB0eXBlIHsgRGVja0dMTGF5ZXJDb25maWcgfSBmcm9tICcuLi90eXBlcy9kZWNrZ2wnO1xuaW1wb3J0IHsgbG9hZERlY2tHTCB9IGZyb20gJy4uL3V0aWxzL2RlY2tnbC1sYXp5LWxvYWRlcic7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuaW50ZXJmYWNlIERlY2tHbExheWVySG9va1N0YXRlIHtcbiAgY29uZmlnOiBEZWNrR0xMYXllckNvbmZpZztcbiAgZGVja2dsTWFuYWdlcjogRGVja0dMTGF5ZXJNYW5hZ2VyIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNvbnN0IERlY2tHbExheWVySG9vazogTGl2ZVZpZXdIb29rID0ge1xuICBhc3luYyBtb3VudGVkKHRoaXM6IGFueSkge1xuICAgIGNvbnN0IGVsID0gdGhpcy5lbCBhcyBIVE1MRWxlbWVudDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29uZmlnU3RyID0gZWwuZGF0YXNldC5jb25maWc7XG4gICAgICBpZiAoIWNvbmZpZ1N0cikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFwbGlicmVYXSBObyBjb25maWcgZm9yIERlY2tHTCBsYXllcicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbmZpZzogRGVja0dMTGF5ZXJDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBjb25zdCBtYXAgPSBNYXBNYW5hZ2VyLmdldChjb25maWcubWFwSWQpO1xuICAgICAgXG4gICAgICBpZiAoIW1hcCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFwbGlicmVYXSBNYXAgXCIke2NvbmZpZy5tYXBJZH1cIiBub3QgZm91bmQgZm9yIERlY2tHTCBsYXllcmApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gTW91bnRpbmcgRGVja0dMIGxheWVyOiAke2NvbmZpZy5pZH1gKTtcbiAgICAgIFxuICAgICAgLy8gTGF6eSBsb2FkIGRlY2suZ2wgbW9kdWxlcyAob25seSBvbiBmaXJzdCB1c2UpXG4gICAgICBhd2FpdCBsb2FkRGVja0dMKCk7XG4gICAgICBcbiAgICAgIC8vIEluaXRpYWxpemUgRGVja0dMIG1hbmFnZXJcbiAgICAgIGNvbnN0IGRlY2tnbE1hbmFnZXIgPSBuZXcgRGVja0dMTGF5ZXJNYW5hZ2VyKG1hcCwgdGhpcyk7XG4gICAgICBcbiAgICAgIC8vIEFkZCBsYXllclxuICAgICAgZGVja2dsTWFuYWdlci5hZGRMYXllcihjb25maWcpO1xuICAgICAgXG4gICAgICAvLyBTdG9yZSBzdGF0ZVxuICAgICAgKHRoaXMgYXMgYW55KS5fbWFwbGlicmV4X2RlY2tnbCA9IHtcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBkZWNrZ2xNYW5hZ2VyXG4gICAgICB9O1xuICAgICAgXG4gICAgICB0aGlzLnB1c2hFdmVudCgnZGVja2dsOmxheWVyX2xvYWRlZCcsIHsgbGF5ZXJJZDogY29uZmlnLmlkIH0pO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIG1vdW50aW5nIERlY2tHTCBsYXllcjonLCBlcnJvcik7XG4gICAgICB0aGlzLnB1c2hFdmVudCgnZGVja2dsOmVycm9yJywgeyBcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSBcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgXG4gIHVwZGF0ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgZWwgPSB0aGlzLmVsIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IHN0YXRlOiBEZWNrR2xMYXllckhvb2tTdGF0ZSB8IHVuZGVmaW5lZCA9ICh0aGlzIGFzIGFueSkuX21hcGxpYnJleF9kZWNrZ2w7XG4gICAgXG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdTdHIgPSBlbC5kYXRhc2V0LmNvbmZpZztcbiAgICAgIGlmICghY29uZmlnU3RyKSByZXR1cm47XG4gICAgICBcbiAgICAgIGNvbnN0IG5ld0NvbmZpZzogRGVja0dMTGF5ZXJDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ1N0cik7XG4gICAgICBcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgW01hcGxpYnJlWF0gVXBkYXRpbmcgRGVja0dMIGxheWVyOiAke25ld0NvbmZpZy5pZH1gKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGxheWVyXG4gICAgICBzdGF0ZS5kZWNrZ2xNYW5hZ2VyPy51cGRhdGVMYXllcihuZXdDb25maWcpO1xuICAgICAgc3RhdGUuY29uZmlnID0gbmV3Q29uZmlnO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIHVwZGF0aW5nIERlY2tHTCBsYXllcjonLCBlcnJvcik7XG4gICAgICB0aGlzLnB1c2hFdmVudCgnZGVja2dsOmVycm9yJywgeyBcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSBcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgXG4gIGRlc3Ryb3llZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBzdGF0ZTogRGVja0dsTGF5ZXJIb29rU3RhdGUgfCB1bmRlZmluZWQgPSAodGhpcyBhcyBhbnkpLl9tYXBsaWJyZXhfZGVja2dsO1xuICAgIGlmICghc3RhdGUpIHJldHVybjtcbiAgICBcbiAgICB0cnkge1xuICAgICAgbG9nZ2VyLmRlYnVnKGBbTWFwbGlicmVYXSBEZXN0cm95aW5nIERlY2tHTCBsYXllcjogJHtzdGF0ZS5jb25maWcuaWR9YCk7XG4gICAgICBcbiAgICAgIHN0YXRlLmRlY2tnbE1hbmFnZXI/LnJlbW92ZUxheWVyKHN0YXRlLmNvbmZpZy5pZCk7XG4gICAgICBzdGF0ZS5kZWNrZ2xNYW5hZ2VyPy5kZXN0cm95KCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYXBsaWJyZVhdIEVycm9yIGRlc3Ryb3lpbmcgRGVja0dMIGxheWVyOicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn07XG4iLCAiLyoqXG4gKiBDdXN0b20gV2ViR0wgTGF5ZXIgVHlwZXNcbiAqIFxuICogRGVmaW5lcyB0eXBlcyBmb3IgY3VzdG9tIFdlYkdMIHJlbmRlcmluZyBsYXllcnMgaW4gTWFwTGlicmUuXG4gKiBTdXBwb3J0cyBwYXJ0aWNsZSBzeXN0ZW1zLCB2ZWN0b3IgZmllbGRzLCBzaGFkZXIgZWZmZWN0cywgYW5kIG1vcmUuXG4gKi9cblxuZXhwb3J0IHR5cGUgQ3VzdG9tTGF5ZXJUeXBlID1cbiAgfCAncGFydGljbGVfc3lzdGVtJyAgICAgLy8gRm9yIHdpbmQsIG9jZWFuIGN1cnJlbnRzLCBwYXJ0aWNsZSBlZmZlY3RzXG4gIHwgJ3ZlY3Rvcl9maWVsZCcgICAgICAgIC8vIEZvciBkaXJlY3Rpb25hbCBmbG93IHZpc3VhbGl6YXRpb25cbiAgfCAnc2hhZGVyX2VmZmVjdCcgICAgICAgLy8gRm9yIGN1c3RvbSB2aXN1YWwgZWZmZWN0c1xuICB8ICdwcm9jZWR1cmFsX2dlb21ldHJ5JyAvLyBGb3IgR1BVLWdlbmVyYXRlZCBnZW9tZXRyeVxuICB8ICdkYXRhX3RleHR1cmUnOyAgICAgICAvLyBGb3IgbGFyZ2UgZGF0YXNldHMgYXMgdGV4dHVyZXNcblxuZXhwb3J0IHR5cGUgUmVuZGVyaW5nTW9kZSA9ICdzdGF0aWMnIHwgJ2R5bmFtaWMnIHwgJ3N0cmVhbWluZyc7XG5cbmV4cG9ydCB0eXBlIERhdGFGb3JtYXQgPSAndmVydGljZXMnIHwgJ3RleHR1cmUnIHwgJ3N0cnVjdHVyZWQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEN1c3RvbUxheWVyQ29uZmlnIHtcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogQ3VzdG9tTGF5ZXJUeXBlO1xuICBtYXBJZDogc3RyaW5nO1xuXG4gIC8vIFNoYWRlcnMgKEdMU0wgc291cmNlIGNvZGUpXG4gIHZlcnRleFNoYWRlcj86IHN0cmluZztcbiAgZnJhZ21lbnRTaGFkZXI/OiBzdHJpbmc7XG5cbiAgLy8gT3B0aW9uYWwgcHJlc2V0IG5hbWUgKGUuZy4sICdvY2Vhbl9jdXJyZW50cycsICd3aW5kX2Zsb3cnKVxuICBwcmVzZXQ/OiBzdHJpbmc7XG5cbiAgLy8gRGF0YSBjb25maWd1cmF0aW9uXG4gIGRhdGE/OiBhbnk7XG4gIGRhdGFGb3JtYXQ/OiBEYXRhRm9ybWF0O1xuICBkYXRhVGV4dHVyZVNpemU/OiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH07XG5cbiAgLy8gRHluYW1pYyB1bmlmb3JtcyAocGFyYW1ldGVycyB0aGF0IGNoYW5nZSBvdmVyIHRpbWUpXG4gIHVuaWZvcm1zPzogUmVjb3JkPHN0cmluZywgYW55PjtcblxuICAvLyBQZXJmb3JtYW5jZSBzZXR0aW5nc1xuICB1cGRhdGVJbnRlcnZhbD86IG51bWJlcjsgLy8gbXMgYmV0d2VlbiB1cGRhdGVzXG4gIHJlbmRlcmluZ01vZGU/OiBSZW5kZXJpbmdNb2RlO1xuICBmcHM/OiBudW1iZXI7IC8vIFRhcmdldCBmcmFtZXMgcGVyIHNlY29uZFxuXG4gIC8vIExheWVyIHBvc2l0aW9uaW5nXG4gIGJlZm9yZUlkPzogc3RyaW5nO1xuICBtaW5ab29tPzogbnVtYmVyO1xuICBtYXhab29tPzogbnVtYmVyO1xuXG4gIC8vIENhbGxiYWNrc1xuICBvblJlbmRlcj86IHN0cmluZzsgLy8gRXZlbnQgbmFtZSBmb3IgY3VzdG9tIHJlbmRlciBjYWxsYmFja1xuICBvblVwZGF0ZT86IHN0cmluZzsgLy8gRXZlbnQgbmFtZSBmb3IgZGF0YSB1cGRhdGUgY2FsbGJhY2tcbiAgb25FcnJvcj86IHN0cmluZzsgIC8vIEV2ZW50IG5hbWUgZm9yIGVycm9yc1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYkdMTGF5ZXJJbXBsZW1lbnRhdGlvbiB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6ICdjdXN0b20nO1xuICByZW5kZXJpbmdNb2RlOiAnM2QnO1xuICBcbiAgb25BZGQobWFwOiBhbnksIGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkO1xuICAvLyBBY2NvcmRpbmcgdG8gTWFwTGlicmUgR0wgSlMgZG9jcywgcmVuZGVyIHJlY2VpdmVzIGFyZ3Mgb2JqZWN0IHdpdGggcHJvamVjdGlvbiBkYXRhXG4gIHJlbmRlcihnbDogV2ViR0xSZW5kZXJpbmdDb250ZXh0LCBhcmdzOiBhbnkpOiB2b2lkO1xuICBvblJlbW92ZT8obWFwOiBhbnksIGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkO1xuICBwcmVyZW5kZXI/KGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQsIGFyZ3M6IGFueSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2hhZGVyUHJvZ3JhbSB7XG4gIHByb2dyYW06IFdlYkdMUHJvZ3JhbTtcbiAgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgdW5pZm9ybXM6IFJlY29yZDxzdHJpbmcsIFdlYkdMVW5pZm9ybUxvY2F0aW9uPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWNsZVN5c3RlbUNvbmZpZyB7XG4gIHBhcnRpY2xlQ291bnQ6IG51bWJlcjtcbiAgcGFydGljbGVTaXplOiBudW1iZXI7XG4gIHNwZWVkTXVsdGlwbGllcjogbnVtYmVyO1xuICBmYWRlT3BhY2l0eTogbnVtYmVyO1xuICBjb2xvclJhbXA6IHN0cmluZ1tdOyAvLyBBcnJheSBvZiBjb2xvciBzdG9wc1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZlY3RvckZpZWxkRGF0YSB7XG4gIHU6IG51bWJlcltdW107IC8vIFUgY29tcG9uZW50IChlYXN0LXdlc3QpXG4gIHY6IG51bWJlcltdW107IC8vIFYgY29tcG9uZW50IChub3J0aC1zb3V0aClcbiAgd2lkdGg6IG51bWJlcjtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIGJvdW5kczogW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl07IC8vIFt3ZXN0LCBzb3V0aCwgZWFzdCwgbm9ydGhdXG59XG5cbi8vIFByZXNldCBjb25maWd1cmF0aW9uc1xuZXhwb3J0IGludGVyZmFjZSBQcmVzZXRDb25maWcge1xuICBuYW1lOiBzdHJpbmc7XG4gIHZlcnRleFNoYWRlcjogc3RyaW5nO1xuICBmcmFnbWVudFNoYWRlcjogc3RyaW5nO1xuICBkZWZhdWx0VW5pZm9ybXM6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIGRlZmF1bHRTZXR0aW5nczogUGFydGlhbDxDdXN0b21MYXllckNvbmZpZz47XG59XG5cbi8vIEVycm9yIHR5cGVzXG5leHBvcnQgY2xhc3MgQ3VzdG9tV2ViR0xFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIHB1YmxpYyByZWFkb25seSBsYXllcklkOiBzdHJpbmcsXG4gICAgcHVibGljIHJlYWRvbmx5IGNvZGU6IHN0cmluZ1xuICApIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnQ3VzdG9tV2ViR0xFcnJvcic7XG4gIH1cbn1cbiIsICIvKipcbiAqIEN1c3RvbSBXZWJHTCBNYW5hZ2VyXG4gKiBcbiAqIENvcmUgbWFuYWdlciBmb3IgY3VzdG9tIFdlYkdMIHJlbmRlcmluZyBpbiBNYXBMaWJyZS5cbiAqIEhhbmRsZXMgc2hhZGVyIGNvbXBpbGF0aW9uLCBwcm9ncmFtIGxpbmtpbmcsIHJlc291cmNlIG1hbmFnZW1lbnQsIGFuZCByZW5kZXIgbG9vcHMuXG4gKi9cblxuaW1wb3J0IHtcbiAgU2hhZGVyUHJvZ3JhbSxcbiAgQ3VzdG9tV2ViR0xFcnJvclxufSBmcm9tICcuLi90eXBlcy9jdXN0b20td2ViZ2wnO1xuXG5leHBvcnQgY2xhc3MgQ3VzdG9tV2ViR0xNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBwcm9ncmFtczogTWFwPHN0cmluZywgU2hhZGVyUHJvZ3JhbT4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgYnVmZmVyczogTWFwPHN0cmluZywgV2ViR0xCdWZmZXI+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHRleHR1cmVzOiBNYXA8c3RyaW5nLCBXZWJHTFRleHR1cmU+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIGFuaW1hdGlvbkZyYW1lczogTWFwPHN0cmluZywgbnVtYmVyPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBmcmFtZUNhbGxiYWNrczogTWFwPHN0cmluZywgKCkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XG5cbiAgLyoqXG4gICAqIENvbXBpbGUgYSBXZWJHTCBzaGFkZXIgZnJvbSBHTFNMIHNvdXJjZVxuICAgKi9cbiAgY29tcGlsZVNoYWRlcihcbiAgICBnbDogV2ViR0xSZW5kZXJpbmdDb250ZXh0LFxuICAgIHNvdXJjZTogc3RyaW5nLFxuICAgIHR5cGU6IG51bWJlcixcbiAgICBsYXllcklkOiBzdHJpbmdcbiAgKTogV2ViR0xTaGFkZXIge1xuICAgIGNvbnN0IHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcih0eXBlKTtcbiAgICBpZiAoIXNoYWRlcikge1xuICAgICAgdGhyb3cgbmV3IEN1c3RvbVdlYkdMRXJyb3IoXG4gICAgICAgICdGYWlsZWQgdG8gY3JlYXRlIHNoYWRlcicsXG4gICAgICAgIGxheWVySWQsXG4gICAgICAgICdTSEFERVJfQ1JFQVRFX0ZBSUxFRCdcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcbiAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgY29uc3QgaW5mbyA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKTtcbiAgICAgIGdsLmRlbGV0ZVNoYWRlcihzaGFkZXIpO1xuICAgICAgdGhyb3cgbmV3IEN1c3RvbVdlYkdMRXJyb3IoXG4gICAgICAgIGBTaGFkZXIgY29tcGlsYXRpb24gZXJyb3I6ICR7aW5mb31gLFxuICAgICAgICBsYXllcklkLFxuICAgICAgICAnU0hBREVSX0NPTVBJTEVfRVJST1InXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBzaGFkZXI7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGFuZCBsaW5rIGEgV2ViR0wgcHJvZ3JhbSBmcm9tIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVyc1xuICAgKi9cbiAgY3JlYXRlUHJvZ3JhbShcbiAgICBnbDogV2ViR0xSZW5kZXJpbmdDb250ZXh0LFxuICAgIHZlcnRleFNvdXJjZTogc3RyaW5nLFxuICAgIGZyYWdtZW50U291cmNlOiBzdHJpbmcsXG4gICAgbGF5ZXJJZDogc3RyaW5nXG4gICk6IFdlYkdMUHJvZ3JhbSB7XG4gICAgY29uc3QgdmVydGV4U2hhZGVyID0gdGhpcy5jb21waWxlU2hhZGVyKGdsLCB2ZXJ0ZXhTb3VyY2UsIGdsLlZFUlRFWF9TSEFERVIsIGxheWVySWQpO1xuICAgIGNvbnN0IGZyYWdtZW50U2hhZGVyID0gdGhpcy5jb21waWxlU2hhZGVyKGdsLCBmcmFnbWVudFNvdXJjZSwgZ2wuRlJBR01FTlRfU0hBREVSLCBsYXllcklkKTtcblxuICAgIGNvbnN0IHByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKCk7XG4gICAgaWYgKCFwcm9ncmFtKSB7XG4gICAgICB0aHJvdyBuZXcgQ3VzdG9tV2ViR0xFcnJvcihcbiAgICAgICAgJ0ZhaWxlZCB0byBjcmVhdGUgcHJvZ3JhbScsXG4gICAgICAgIGxheWVySWQsXG4gICAgICAgICdQUk9HUkFNX0NSRUFURV9GQUlMRUQnXG4gICAgICApO1xuICAgIH1cblxuICAgIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSk7XG5cbiAgICAvLyBDbGVhbiB1cCBzaGFkZXJzIGFmdGVyIGxpbmtpbmdcbiAgICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKTtcbiAgICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpO1xuXG4gICAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkge1xuICAgICAgY29uc3QgaW5mbyA9IGdsLmdldFByb2dyYW1JbmZvTG9nKHByb2dyYW0pO1xuICAgICAgZ2wuZGVsZXRlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICAgIHRocm93IG5ldyBDdXN0b21XZWJHTEVycm9yKFxuICAgICAgICBgUHJvZ3JhbSBsaW5rIGVycm9yOiAke2luZm99YCxcbiAgICAgICAgbGF5ZXJJZCxcbiAgICAgICAgJ1BST0dSQU1fTElOS19FUlJPUidcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2dyYW07XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBhdHRyaWJ1dGUgYW5kIHVuaWZvcm0gbG9jYXRpb25zIGZyb20gYSBwcm9ncmFtXG4gICAqL1xuICBnZXRMb2NhdGlvbnMoZ2w6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCwgcHJvZ3JhbTogV2ViR0xQcm9ncmFtKTogU2hhZGVyUHJvZ3JhbSB7XG4gICAgY29uc3QgYXR0cmlidXRlczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuICAgIGNvbnN0IHVuaWZvcm1zOiBSZWNvcmQ8c3RyaW5nLCBXZWJHTFVuaWZvcm1Mb2NhdGlvbj4gPSB7fTtcblxuICAgIC8vIEdldCBhbGwgYWN0aXZlIGF0dHJpYnV0ZXNcbiAgICBjb25zdCBudW1BdHRyaWJ1dGVzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1BdHRyaWJ1dGVzOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZm8gPSBnbC5nZXRBY3RpdmVBdHRyaWIocHJvZ3JhbSwgaSk7XG4gICAgICBpZiAoaW5mbykge1xuICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sIGluZm8ubmFtZSk7XG4gICAgICAgIGF0dHJpYnV0ZXNbaW5mby5uYW1lXSA9IGxvY2F0aW9uO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEdldCBhbGwgYWN0aXZlIHVuaWZvcm1zXG4gICAgY29uc3QgbnVtVW5pZm9ybXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkFDVElWRV9VTklGT1JNUyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Vbmlmb3JtczsgaSsrKSB7XG4gICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlVW5pZm9ybShwcm9ncmFtLCBpKTtcbiAgICAgIGlmIChpbmZvKSB7XG4gICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIGluZm8ubmFtZSk7XG4gICAgICAgIGlmIChsb2NhdGlvbikge1xuICAgICAgICAgIHVuaWZvcm1zW2luZm8ubmFtZV0gPSBsb2NhdGlvbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IHByb2dyYW0sIGF0dHJpYnV0ZXMsIHVuaWZvcm1zIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgV2ViR0wgYnVmZmVyIGFuZCB1cGxvYWQgZGF0YVxuICAgKi9cbiAgY3JlYXRlQnVmZmVyKFxuICAgIGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQsXG4gICAgZGF0YTogRmxvYXQzMkFycmF5IHwgVWludDE2QXJyYXksXG4gICAgdGFyZ2V0OiBudW1iZXIgPSBnbC5BUlJBWV9CVUZGRVIsXG4gICAgdXNhZ2U6IG51bWJlciA9IGdsLlNUQVRJQ19EUkFXXG4gICk6IFdlYkdMQnVmZmVyIHtcbiAgICBjb25zdCBidWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBpZiAoIWJ1ZmZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIGJ1ZmZlcicpO1xuICAgIH1cblxuICAgIGdsLmJpbmRCdWZmZXIodGFyZ2V0LCBidWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEodGFyZ2V0LCBkYXRhLCB1c2FnZSk7XG4gICAgZ2wuYmluZEJ1ZmZlcih0YXJnZXQsIG51bGwpO1xuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBkYXRhIHRleHR1cmUgZm9yIGxhcmdlIGRhdGFzZXRzXG4gICAqL1xuICBjcmVhdGVEYXRhVGV4dHVyZShcbiAgICBnbDogV2ViR0xSZW5kZXJpbmdDb250ZXh0LFxuICAgIGRhdGE6IEZsb2F0MzJBcnJheSxcbiAgICB3aWR0aDogbnVtYmVyLFxuICAgIGhlaWdodDogbnVtYmVyLFxuICAgIGZvcm1hdDogbnVtYmVyID0gZ2wuUkdCQSxcbiAgICB0eXBlOiBudW1iZXIgPSBnbC5GTE9BVFxuICApOiBXZWJHTFRleHR1cmUge1xuICAgIGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgaWYgKCF0ZXh0dXJlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBjcmVhdGUgdGV4dHVyZScpO1xuICAgIH1cblxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuXG4gICAgLy8gQ2hlY2sgZm9yIGZsb2F0IHRleHR1cmUgc3VwcG9ydFxuICAgIGNvbnN0IGV4dCA9IGdsLmdldEV4dGVuc2lvbignT0VTX3RleHR1cmVfZmxvYXQnKTtcbiAgICBpZiAoIWV4dCAmJiB0eXBlID09PSBnbC5GTE9BVCkge1xuICAgICAgY29uc29sZS53YXJuKCdGbG9hdCB0ZXh0dXJlcyBub3Qgc3VwcG9ydGVkLCBmYWxsaW5nIGJhY2sgdG8gVU5TSUdORURfQllURScpO1xuICAgICAgdHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgfVxuXG4gICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAwLFxuICAgICAgZm9ybWF0LFxuICAgICAgd2lkdGgsXG4gICAgICBoZWlnaHQsXG4gICAgICAwLFxuICAgICAgZm9ybWF0LFxuICAgICAgdHlwZSxcbiAgICAgIGRhdGFcbiAgICApO1xuXG4gICAgLy8gU2V0IHRleHR1cmUgcGFyYW1ldGVycyBmb3IgZGF0YSAobm90IGltYWdlcylcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG5cbiAgICByZXR1cm4gdGV4dHVyZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgdW5pZm9ybSB2YWx1ZXMgaW4gYSBzaGFkZXIgcHJvZ3JhbVxuICAgKi9cbiAgc2V0VW5pZm9ybXMoXG4gICAgZ2w6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCxcbiAgICBwcm9ncmFtOiBTaGFkZXJQcm9ncmFtLFxuICAgIHVuaWZvcm1zOiBSZWNvcmQ8c3RyaW5nLCBhbnk+XG4gICk6IHZvaWQge1xuICAgIGdsLnVzZVByb2dyYW0ocHJvZ3JhbS5wcm9ncmFtKTtcblxuICAgIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh1bmlmb3JtcykpIHtcbiAgICAgIGNvbnN0IGxvY2F0aW9uID0gcHJvZ3JhbS51bmlmb3Jtc1tuYW1lXTtcbiAgICAgIGlmICghbG9jYXRpb24pIGNvbnRpbnVlO1xuXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICBnbC51bmlmb3JtMWYobG9jYXRpb24sIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgc3dpdGNoICh2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBnbC51bmlmb3JtMmZ2KGxvY2F0aW9uLCB2YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBnbC51bmlmb3JtM2Z2KGxvY2F0aW9uLCB2YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICBnbC51bmlmb3JtNGZ2KGxvY2F0aW9uLCB2YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDE2OlxuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdihsb2NhdGlvbiwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFVuc3VwcG9ydGVkIHVuaWZvcm0gYXJyYXkgbGVuZ3RoOiAke3ZhbHVlLmxlbmd0aH1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR1cCBhIHJlbmRlciBsb29wIHdpdGggRlBTIGNvbnRyb2xcbiAgICovXG4gIHNldHVwUmVuZGVyTG9vcChcbiAgICBsYXllcklkOiBzdHJpbmcsXG4gICAgcmVuZGVyRm46ICgpID0+IHZvaWQsXG4gICAgZnBzOiBudW1iZXIgPSA2MFxuICApOiB2b2lkIHtcbiAgICAvLyBDYW5jZWwgZXhpc3RpbmcgbG9vcCBpZiBhbnlcbiAgICB0aGlzLnN0b3BSZW5kZXJMb29wKGxheWVySWQpO1xuXG4gICAgY29uc3QgaW50ZXJ2YWwgPSAxMDAwIC8gZnBzO1xuICAgIGxldCBsYXN0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXG4gICAgY29uc3QgYW5pbWF0ZSA9IChjdXJyZW50VGltZTogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCBmcmFtZUlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xuICAgICAgdGhpcy5hbmltYXRpb25GcmFtZXMuc2V0KGxheWVySWQsIGZyYW1lSWQpO1xuXG4gICAgICBjb25zdCBkZWx0YSA9IGN1cnJlbnRUaW1lIC0gbGFzdFRpbWU7XG4gICAgICBpZiAoZGVsdGEgPj0gaW50ZXJ2YWwpIHtcbiAgICAgICAgcmVuZGVyRm4oKTtcbiAgICAgICAgbGFzdFRpbWUgPSBjdXJyZW50VGltZSAtIChkZWx0YSAlIGludGVydmFsKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgYW5pbWF0ZShsYXN0VGltZSk7XG4gIH1cblxuICAvKipcbiAgICogU3RvcCB0aGUgcmVuZGVyIGxvb3AgZm9yIGEgbGF5ZXJcbiAgICovXG4gIHN0b3BSZW5kZXJMb29wKGxheWVySWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGZyYW1lSWQgPSB0aGlzLmFuaW1hdGlvbkZyYW1lcy5nZXQobGF5ZXJJZCk7XG4gICAgaWYgKGZyYW1lSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVJZCk7XG4gICAgICB0aGlzLmFuaW1hdGlvbkZyYW1lcy5kZWxldGUobGF5ZXJJZCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0b3JlIGEgc2hhZGVyIHByb2dyYW1cbiAgICovXG4gIHN0b3JlUHJvZ3JhbShsYXllcklkOiBzdHJpbmcsIHByb2dyYW06IFNoYWRlclByb2dyYW0pOiB2b2lkIHtcbiAgICB0aGlzLnByb2dyYW1zLnNldChsYXllcklkLCBwcm9ncmFtKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBzdG9yZWQgc2hhZGVyIHByb2dyYW1cbiAgICovXG4gIGdldFByb2dyYW0obGF5ZXJJZDogc3RyaW5nKTogU2hhZGVyUHJvZ3JhbSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMucHJvZ3JhbXMuZ2V0KGxheWVySWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3JlIGEgYnVmZmVyXG4gICAqL1xuICBzdG9yZUJ1ZmZlcihsYXllcklkOiBzdHJpbmcsIGJ1ZmZlcjogV2ViR0xCdWZmZXIpOiB2b2lkIHtcbiAgICB0aGlzLmJ1ZmZlcnMuc2V0KGxheWVySWQsIGJ1ZmZlcik7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgc3RvcmVkIGJ1ZmZlclxuICAgKi9cbiAgZ2V0QnVmZmVyKGxheWVySWQ6IHN0cmluZyk6IFdlYkdMQnVmZmVyIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXJzLmdldChsYXllcklkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9yZSBhIHRleHR1cmVcbiAgICovXG4gIHN0b3JlVGV4dHVyZShsYXllcklkOiBzdHJpbmcsIHRleHR1cmU6IFdlYkdMVGV4dHVyZSk6IHZvaWQge1xuICAgIHRoaXMudGV4dHVyZXMuc2V0KGxheWVySWQsIHRleHR1cmUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHN0b3JlZCB0ZXh0dXJlXG4gICAqL1xuICBnZXRUZXh0dXJlKGxheWVySWQ6IHN0cmluZyk6IFdlYkdMVGV4dHVyZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudGV4dHVyZXMuZ2V0KGxheWVySWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFuIHVwIGFsbCByZXNvdXJjZXMgZm9yIGEgbGF5ZXJcbiAgICovXG4gIGRpc3Bvc2UoZ2w6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCwgbGF5ZXJJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gU3RvcCByZW5kZXIgbG9vcFxuICAgIHRoaXMuc3RvcFJlbmRlckxvb3AobGF5ZXJJZCk7XG5cbiAgICAvLyBEZWxldGUgcHJvZ3JhbVxuICAgIGNvbnN0IHByb2dyYW0gPSB0aGlzLnByb2dyYW1zLmdldChsYXllcklkKTtcbiAgICBpZiAocHJvZ3JhbSkge1xuICAgICAgZ2wuZGVsZXRlUHJvZ3JhbShwcm9ncmFtLnByb2dyYW0pO1xuICAgICAgdGhpcy5wcm9ncmFtcy5kZWxldGUobGF5ZXJJZCk7XG4gICAgfVxuXG4gICAgLy8gRGVsZXRlIGJ1ZmZlclxuICAgIGNvbnN0IGJ1ZmZlciA9IHRoaXMuYnVmZmVycy5nZXQobGF5ZXJJZCk7XG4gICAgaWYgKGJ1ZmZlcikge1xuICAgICAgZ2wuZGVsZXRlQnVmZmVyKGJ1ZmZlcik7XG4gICAgICB0aGlzLmJ1ZmZlcnMuZGVsZXRlKGxheWVySWQpO1xuICAgIH1cblxuICAgIC8vIERlbGV0ZSB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZXMuZ2V0KGxheWVySWQpO1xuICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICBnbC5kZWxldGVUZXh0dXJlKHRleHR1cmUpO1xuICAgICAgdGhpcy50ZXh0dXJlcy5kZWxldGUobGF5ZXJJZCk7XG4gICAgfVxuXG4gICAgdGhpcy5mcmFtZUNhbGxiYWNrcy5kZWxldGUobGF5ZXJJZCk7XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZSBhbGwgcmVzb3VyY2VzXG4gICAqL1xuICBkaXNwb3NlQWxsKGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBsYXllcklkcyA9IEFycmF5LmZyb20odGhpcy5wcm9ncmFtcy5rZXlzKCkpO1xuICAgIGxheWVySWRzLmZvckVhY2goaWQgPT4gdGhpcy5kaXNwb3NlKGdsLCBpZCkpO1xuICB9XG59XG5cbi8vIFNpbmdsZXRvbiBpbnN0YW5jZVxuZXhwb3J0IGNvbnN0IGN1c3RvbVdlYkdMTWFuYWdlciA9IG5ldyBDdXN0b21XZWJHTE1hbmFnZXIoKTtcbiIsICIvKipcbiAqIFBhcnRpY2xlIFN5c3RlbSBTaGFkZXJzXG4gKiBcbiAqIEdMU0wgc2hhZGVycyBmb3IgcGFydGljbGUtYmFzZWQgdmlzdWFsaXphdGlvbnMgbGlrZSBvY2VhbiBjdXJyZW50cyBhbmQgd2luZCBmbG93LlxuICovXG5cbmV4cG9ydCBjb25zdCBQQVJUSUNMRV9WRVJURVhfU0hBREVSID0gYFxuYXR0cmlidXRlIHZlYzIgYV9wb3NpdGlvbjtcbnVuaWZvcm0gbWF0NCB1X21hdHJpeDtcbnVuaWZvcm0gZmxvYXQgdV9wb2ludF9zaXplO1xuXG52b2lkIG1haW4oKSB7XG4gIGdsX1Bvc2l0aW9uID0gdV9tYXRyaXggKiB2ZWM0KGFfcG9zaXRpb24sIDAuMCwgMS4wKTtcbiAgZ2xfUG9pbnRTaXplID0gdV9wb2ludF9zaXplO1xufVxuYDtcblxuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFX0ZSQUdNRU5UX1NIQURFUiA9IGBcbnByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xuXG51bmlmb3JtIHZlYzMgdV9jb2xvcjtcbnVuaWZvcm0gZmxvYXQgdV9vcGFjaXR5O1xuXG52b2lkIG1haW4oKSB7XG4gIC8vIENyZWF0ZSBjaXJjdWxhciBwYXJ0aWNsZXMgd2l0aCBzbW9vdGggZWRnZXNcbiAgdmVjMiBjZW50ZXIgPSBnbF9Qb2ludENvb3JkIC0gdmVjMigwLjUpO1xuICBmbG9hdCBkaXN0ID0gbGVuZ3RoKGNlbnRlcik7XG4gIFxuICAvLyBTbW9vdGggZmFkZSBhdCBlZGdlc1xuICBmbG9hdCBhbHBoYSA9IDEuMCAtIHNtb290aHN0ZXAoMC4zLCAwLjUsIGRpc3QpO1xuICBcbiAgZ2xfRnJhZ0NvbG9yID0gdmVjNCh1X2NvbG9yLCBhbHBoYSAqIHVfb3BhY2l0eSk7XG59XG5gO1xuXG4vLyBQcmVzZXQgY29uZmlndXJhdGlvbnNcbmV4cG9ydCBjb25zdCBQQVJUSUNMRV9TWVNURU1fUFJFU0VUUyA9IHtcbiAgb2NlYW5fY3VycmVudHM6IHtcbiAgICB2ZXJ0ZXhTaGFkZXI6IFBBUlRJQ0xFX1ZFUlRFWF9TSEFERVIsXG4gICAgZnJhZ21lbnRTaGFkZXI6IFBBUlRJQ0xFX0ZSQUdNRU5UX1NIQURFUixcbiAgICBkZWZhdWx0VW5pZm9ybXM6IHtcbiAgICAgIHVfY29sb3I6IFswLjIsIDAuNiwgMC45XSwgLy8gT2NlYW4gYmx1ZVxuICAgICAgdV9vcGFjaXR5OiAwLjgsXG4gICAgICB1X3BvaW50X3NpemU6IDMuMFxuICAgIH1cbiAgfSxcbiAgXG4gIHdpbmRfZmxvdzoge1xuICAgIHZlcnRleFNoYWRlcjogUEFSVElDTEVfVkVSVEVYX1NIQURFUixcbiAgICBmcmFnbWVudFNoYWRlcjogUEFSVElDTEVfRlJBR01FTlRfU0hBREVSLFxuICAgIGRlZmF1bHRVbmlmb3Jtczoge1xuICAgICAgdV9jb2xvcjogWzAuOSwgMC45LCAwLjldLCAvLyBXaGl0ZS9ncmF5XG4gICAgICB1X29wYWNpdHk6IDAuNixcbiAgICAgIHVfcG9pbnRfc2l6ZTogMi4wXG4gICAgfVxuICB9XG59O1xuIiwgIi8qKlxuICogQ3VzdG9tIFdlYkdMIExheWVyIEhvb2tcbiAqIFxuICogUGhvZW5peCBMaXZlVmlldyBob29rIGZvciBjdXN0b20gV2ViR0wgcmVuZGVyaW5nIGxheWVycy5cbiAqL1xuXG5pbXBvcnQgeyBjdXN0b21XZWJHTE1hbmFnZXIgfSBmcm9tICcuLi91dGlscy9jdXN0b20td2ViZ2wtbWFuYWdlcic7XG5pbXBvcnQgeyBQQVJUSUNMRV9TWVNURU1fUFJFU0VUUyB9IGZyb20gJy4uL3NoYWRlcnMvcGFydGljbGUtc3lzdGVtJztcbmltcG9ydCB7IE1hcE1hbmFnZXIgfSBmcm9tICcuLi9jb3JlL21hcC1tYW5hZ2VyJztcbmltcG9ydCB0eXBlIHsgQ3VzdG9tTGF5ZXJDb25maWcsIFdlYkdMTGF5ZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uL3R5cGVzL2N1c3RvbS13ZWJnbCc7XG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL2NvcmUvbG9nZ2VyJztcblxuZXhwb3J0IGNvbnN0IEN1c3RvbUxheWVySG9vayA9IHtcbiAgbW91bnRlZCh0aGlzOiBhbnkpIHtcbiAgICBjb25zdCBjb25maWc6IEN1c3RvbUxheWVyQ29uZmlnID0gSlNPTi5wYXJzZSh0aGlzLmVsLmRhdGFzZXQuY29uZmlnIHx8ICd7fScpO1xuICAgIGxvZ2dlci5kZWJ1ZygnW0N1c3RvbUxheWVyXSBNb3VudGVkOicsIGNvbmZpZy5pZCwgJ3dpdGggdW5pZm9ybXM6JywgY29uZmlnLnVuaWZvcm1zKTtcbiAgICBcbiAgICAvLyBMaXN0ZW4gZm9yIHVuaWZvcm0gdXBkYXRlcyB2aWEgUGhvZW5peCBldmVudHNcbiAgICB0aGlzLmhhbmRsZUV2ZW50KGB1cGRhdGVfdW5pZm9ybXNfJHtjb25maWcuaWR9YCwgKHBheWxvYWQ6IGFueSkgPT4ge1xuICAgICAgbG9nZ2VyLmRlYnVnKCdbQ3VzdG9tTGF5ZXJdIFJlY2VpdmVkIHVuaWZvcm0gdXBkYXRlOicsIHBheWxvYWQpO1xuICAgICAgaWYgKHBheWxvYWQudW5pZm9ybXMpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlnID0ge1xuICAgICAgICAgIC4uLnRoaXMuY3VycmVudENvbmZpZyxcbiAgICAgICAgICB1bmlmb3JtczogcGF5bG9hZC51bmlmb3Jtc1xuICAgICAgICB9O1xuICAgICAgICAvLyBUcmlnZ2VyIHJlcGFpbnQgdG8gYXBwbHkgY2hhbmdlc1xuICAgICAgICBpZiAodGhpcy5tYXApIHtcbiAgICAgICAgICB0aGlzLm1hcC50cmlnZ2VyUmVwYWludCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBVc2UgTWFwTWFuYWdlciBpbnN0ZWFkIG9mIERPTSB0byBnZXQgbWFwIGluc3RhbmNlXG4gICAgY29uc3QgbWFwID0gTWFwTWFuYWdlci5nZXQoY29uZmlnLm1hcElkKTtcbiAgICBpZiAoIW1hcCkge1xuICAgICAgY29uc29sZS5lcnJvcignW0N1c3RvbUxheWVyXSBNYXAgbm90IGZvdW5kIGluIE1hcE1hbmFnZXI6JywgY29uZmlnLm1hcElkKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSBjdXN0b20gbGF5ZXIgaW1wbGVtZW50YXRpb25cbiAgICBjb25zdCBjdXN0b21MYXllciA9IHRoaXMuY3JlYXRlQ3VzdG9tTGF5ZXIoY29uZmlnKTtcbiAgICBcbiAgICAvLyBTdG9yZSByZWZlcmVuY2VcbiAgICB0aGlzLmxheWVySWQgPSBjb25maWcuaWQ7XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5jdXN0b21MYXllciA9IGN1c3RvbUxheWVyO1xuICAgIHRoaXMuY3VycmVudENvbmZpZyA9IGNvbmZpZztcbiAgICBcbiAgICAvLyBTdG9yZSBzdGFydCB0aW1lIGZvciB1X3RpbWUgY2FsY3VsYXRpb24gKGlmIG5lZWRlZCBmb3IgYW5pbWF0aW9uKVxuICAgIGlmIChjb25maWcudW5pZm9ybXMgJiYgJ3VfdGltZScgaW4gY29uZmlnLnVuaWZvcm1zKSB7XG4gICAgICB0aGlzLnN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpIC8gMTAwMDtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnW0N1c3RvbUxheWVyXSBBbmltYXRpb24gZW5hYmxlZCBmb3InLCBjb25maWcuaWQpO1xuICAgICAgLy8gbWFwLnJlcGFpbnQgPSB0cnVlIHRlbGxzIE1hcExpYnJlIHRvIGNvbnRpbnVvdXNseSByZS1yZW5kZXIgZXZlcnkgZnJhbWUuXG4gICAgICAvLyBBdCB0aGUgZW5kIG9mIGVhY2ggX3JlbmRlcigpIGN5Y2xlIE1hcExpYnJlIGNoZWNrcyB0aGlzIGZsYWcgYW5kIGNhbGxzXG4gICAgICAvLyB0cmlnZ2VyUmVwYWludCgpIGF1dG9tYXRpY2FsbHkgXHUyMDE0IG5vIGV4dGVybmFsIHJBRiBsb29wIG5lZWRlZC5cbiAgICAgIG1hcC5yZXBhaW50ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbGF5ZXIgdG8gbWFwXG4gICAgbWFwLm9uKCdsb2FkJywgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbWFwLmFkZExheWVyKGN1c3RvbUxheWVyLCBjb25maWcuYmVmb3JlSWQpO1xuICAgICAgICBsb2dnZXIuZGVidWcoJ1tDdXN0b21MYXllcl0gQWRkZWQgdG8gbWFwOicsIGNvbmZpZy5pZCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQ3VzdG9tTGF5ZXJdIEVycm9yIGFkZGluZyBsYXllcjonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBJZiBtYXAgaXMgYWxyZWFkeSBsb2FkZWQsIGFkZCBpbW1lZGlhdGVseVxuICAgIGlmIChtYXAubG9hZGVkKCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG1hcC5hZGRMYXllcihjdXN0b21MYXllciwgY29uZmlnLmJlZm9yZUlkKTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKCdbQ3VzdG9tTGF5ZXJdIEFkZGVkIHRvIG1hcCAoYWxyZWFkeSBsb2FkZWQpOicsIGNvbmZpZy5pZCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQ3VzdG9tTGF5ZXJdIEVycm9yIGFkZGluZyBsYXllcjonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZWQodGhpczogYW55KSB7XG4gICAgY29uc3QgY29uZmlnOiBDdXN0b21MYXllckNvbmZpZyA9IEpTT04ucGFyc2UodGhpcy5lbC5kYXRhc2V0LmNvbmZpZyB8fCAne30nKTtcbiAgICBsb2dnZXIuZGVidWcoJ1tDdXN0b21MYXllcl0gVXBkYXRlZCB3aXRoIHVuaWZvcm1zOicsIGNvbmZpZy51bmlmb3Jtcyk7XG4gICAgXG4gICAgLy8gU3RvcmUgdXBkYXRlZCBjb25maWcgc28gcmVuZGVyKCkgY2FuIGFjY2VzcyBpdFxuICAgIHRoaXMuY3VycmVudENvbmZpZyA9IGNvbmZpZztcbiAgICBcbiAgICAvLyBUcmlnZ2VyIG1hcCByZXBhaW50IHRvIGFwcGx5IHVuaWZvcm0gdXBkYXRlcyBhbmQgY29udGludWUgYW5pbWF0aW9uXG4gICAgaWYgKHRoaXMubWFwKSB7XG4gICAgICB0aGlzLm1hcC50cmlnZ2VyUmVwYWludCgpO1xuICAgIH1cbiAgfSxcblxuICBkZXN0cm95ZWQodGhpczogYW55KSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdbQ3VzdG9tTGF5ZXJdIERlc3Ryb3llZDonLCB0aGlzLmxheWVySWQpO1xuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuICAgIC8vIFR1cm4gb2ZmIGNvbnRpbnVvdXMgcmVwYWludCB3aGVuIHRoZSBhbmltYXRlZCBsYXllciBpcyByZW1vdmVkXG4gICAgaWYgKHRoaXMubWFwICYmIHRoaXMuc3RhcnRUaW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubWFwLnJlcGFpbnQgPSBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHRoaXMubWFwICYmIHRoaXMubGF5ZXJJZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHRoaXMubWFwLmdldExheWVyKHRoaXMubGF5ZXJJZCkpIHtcbiAgICAgICAgICB0aGlzLm1hcC5yZW1vdmVMYXllcih0aGlzLmxheWVySWQpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbQ3VzdG9tTGF5ZXJdIEVycm9yIHJlbW92aW5nIGxheWVyOicsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5nbCkge1xuICAgICAgY3VzdG9tV2ViR0xNYW5hZ2VyLmRpc3Bvc2UodGhpcy5nbCwgdGhpcy5sYXllcklkKTtcbiAgICB9XG4gIH0sXG5cbiAgY3JlYXRlQ3VzdG9tTGF5ZXIodGhpczogYW55LCBjb25maWc6IEN1c3RvbUxheWVyQ29uZmlnKTogV2ViR0xMYXllckltcGxlbWVudGF0aW9uIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBsZXQgZ2w6IFdlYkdMUmVuZGVyaW5nQ29udGV4dDtcbiAgICBsZXQgc2hhZGVyUHJvZ3JhbTogYW55O1xuICAgIGxldCBidWZmZXI6IFdlYkdMQnVmZmVyO1xuICAgIGxldCBpbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgLy8gR2V0IHNoYWRlcnMgKGZyb20gcHJlc2V0IG9yIGN1c3RvbSlcbiAgICBsZXQgdmVydGV4U2hhZGVyID0gY29uZmlnLnZlcnRleFNoYWRlcjtcbiAgICBsZXQgZnJhZ21lbnRTaGFkZXIgPSBjb25maWcuZnJhZ21lbnRTaGFkZXI7XG5cbiAgICBpZiAoY29uZmlnLnByZXNldCAmJiBQQVJUSUNMRV9TWVNURU1fUFJFU0VUU1tjb25maWcucHJlc2V0IGFzIGtleW9mIHR5cGVvZiBQQVJUSUNMRV9TWVNURU1fUFJFU0VUU10pIHtcbiAgICAgIGNvbnN0IHByZXNldCA9IFBBUlRJQ0xFX1NZU1RFTV9QUkVTRVRTW2NvbmZpZy5wcmVzZXQgYXMga2V5b2YgdHlwZW9mIFBBUlRJQ0xFX1NZU1RFTV9QUkVTRVRTXTtcbiAgICAgIHZlcnRleFNoYWRlciA9IHZlcnRleFNoYWRlciB8fCBwcmVzZXQudmVydGV4U2hhZGVyO1xuICAgICAgZnJhZ21lbnRTaGFkZXIgPSBmcmFnbWVudFNoYWRlciB8fCBwcmVzZXQuZnJhZ21lbnRTaGFkZXI7XG4gICAgfVxuXG4gICAgaWYgKCF2ZXJ0ZXhTaGFkZXIgfHwgIWZyYWdtZW50U2hhZGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBhcmUgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IGNvbmZpZy5pZCxcbiAgICAgIHR5cGU6ICdjdXN0b20nLFxuICAgICAgcmVuZGVyaW5nTW9kZTogJzNkJyxcblxuICAgICAgb25BZGQoX21hcDogYW55LCBnbENvbnRleHQ6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCkge1xuICAgICAgICBnbCA9IGdsQ29udGV4dDtcbiAgICAgICAgc2VsZi5nbCA9IGdsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIHNoYWRlciBwcm9ncmFtXG4gICAgICAgICAgY29uc3QgcHJvZ3JhbSA9IGN1c3RvbVdlYkdMTWFuYWdlci5jcmVhdGVQcm9ncmFtKFxuICAgICAgICAgICAgZ2wsXG4gICAgICAgICAgICB2ZXJ0ZXhTaGFkZXIhLFxuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXIhLFxuICAgICAgICAgICAgY29uZmlnLmlkXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHNoYWRlclByb2dyYW0gPSBjdXN0b21XZWJHTE1hbmFnZXIuZ2V0TG9jYXRpb25zKGdsLCBwcm9ncmFtKTtcbiAgICAgICAgICBjdXN0b21XZWJHTE1hbmFnZXIuc3RvcmVQcm9ncmFtKGNvbmZpZy5pZCwgc2hhZGVyUHJvZ3JhbSk7XG4gICAgICAgICAgc2VsZi5zaGFkZXJQcm9ncmFtID0gc2hhZGVyUHJvZ3JhbTtcblxuICAgICAgICAgIC8vIENyZWF0ZSBwYXJ0aWNsZSBkYXRhIGluIE1FUkNBVE9SIENPT1JESU5BVEVTIFswLCAxXVxuICAgICAgICAgIC8vIEFjY29yZGluZyB0byBNYXBMaWJyZSBHTCBkb2NzLCBjdXN0b20gbGF5ZXJzIHdvcmsgd2l0aCBNZXJjYXRvckNvb3JkaW5hdGVcbiAgICAgICAgICAvLyB3aGljaCBjb252ZXJ0cyBsbmcvbGF0IHRvIG5vcm1hbGl6ZWQgWzAsIDFdIHJhbmdlXG4gICAgICAgICAgY29uc3QgcGFydGljbGVDb3VudCA9IDEwMDA7XG4gICAgICAgICAgY29uc3QgcG9zaXRpb25zID0gbmV3IEZsb2F0MzJBcnJheShwYXJ0aWNsZUNvdW50ICogMik7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0aWNsZUNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIHJhbmRvbSBsbmcvbGF0XG4gICAgICAgICAgICBjb25zdCBsbmcgPSBNYXRoLnJhbmRvbSgpICogMzYwIC0gMTgwO1xuICAgICAgICAgICAgY29uc3QgbGF0ID0gTWF0aC5yYW5kb20oKSAqIDE3MCAtIDg1O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHRvIE1lcmNhdG9yIGNvb3JkaW5hdGVzIFswLCAxXVxuICAgICAgICAgICAgLy8gRm9ybXVsYSBmcm9tIE1hcExpYnJlOiB4ID0gKGxuZyArIDE4MCkgLyAzNjBcbiAgICAgICAgICAgIC8vIHkgPSAoMTgwIC0gKDE4MCAvIFx1MDNDMCAqIGxuKHRhbihcdTAzQzAvNCArIGxhdCAqIFx1MDNDMCAvIDM2MCkpKSkgLyAzNjBcbiAgICAgICAgICAgIGNvbnN0IHggPSAobG5nICsgMTgwKSAvIDM2MDtcbiAgICAgICAgICAgIGNvbnN0IGxhdFJhZCA9IGxhdCAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgICAgICBjb25zdCBtZXJjYXRvclkgPSBNYXRoLmxvZyhNYXRoLnRhbihNYXRoLlBJIC8gNCArIGxhdFJhZCAvIDIpKTtcbiAgICAgICAgICAgIGNvbnN0IHkgPSAoMTgwIC0gbWVyY2F0b3JZICogMTgwIC8gTWF0aC5QSSkgLyAzNjA7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMl0gPSB4O1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAyICsgMV0gPSB5O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJ1ZmZlciA9IGN1c3RvbVdlYkdMTWFuYWdlci5jcmVhdGVCdWZmZXIoZ2wsIHBvc2l0aW9ucyk7XG4gICAgICAgICAgY3VzdG9tV2ViR0xNYW5hZ2VyLnN0b3JlQnVmZmVyKGNvbmZpZy5pZCwgYnVmZmVyKTtcblxuICAgICAgICAgIGluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcoJ1tDdXN0b21MYXllcl0gV2ViR0wgaW5pdGlhbGl6ZWQ6JywgY29uZmlnLmlkKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQ3VzdG9tTGF5ZXJdIEluaXRpYWxpemF0aW9uIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgcmVuZGVyKF9nbENvbnRleHQ6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCwgbWF0cml4T3JBcmdzOiBhbnkpIHtcbiAgICAgICAgaWYgKCFpbml0aWFsaXplZCB8fCAhc2hhZGVyUHJvZ3JhbSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN1cHBvcnQgYm90aCBNYXBMaWJyZSBBUElzOlxuICAgICAgICAvLyAtIE9sZCAoPCAzLngpOiByZW5kZXIoZ2wsIG1hdHJpeCkgd2hlcmUgbWF0cml4IGlzIEZsb2F0MzJBcnJheSBkaXJlY3RseVxuICAgICAgICAvLyAtIE5ldyAoPj0gMy54KTogcmVuZGVyKGdsLCBhcmdzKSB3aGVyZSBhcmdzLmRlZmF1bHRQcm9qZWN0aW9uRGF0YS5tYWluTWF0cml4IGhvbGRzIGl0XG4gICAgICAgIGxldCBtYXRyaXg6IEZsb2F0MzJBcnJheSB8IG51bWJlcltdIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChtYXRyaXhPckFyZ3MgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgQXJyYXkuaXNBcnJheShtYXRyaXhPckFyZ3MpKSB7XG4gICAgICAgICAgbWF0cml4ID0gbWF0cml4T3JBcmdzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hdHJpeCA9IG1hdHJpeE9yQXJncz8uZGVmYXVsdFByb2plY3Rpb25EYXRhPy5tYWluTWF0cml4ID8/IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW1hdHJpeCB8fCBtYXRyaXgubGVuZ3RoICE9PSAxNikge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFx1MjUwMFx1MjUwMCBTYXZlIEdMIHN0YXRlIChNYXBMaWJyZSB2NSB1c2VzIFdlYkdMMiArIFZBT3MgXHUyMDE0IG11c3Qgc2F2ZS9yZXN0b3JlIFZBTyBiaW5kaW5nKSBcdTI1MDBcdTI1MDBcbiAgICAgICAgY29uc3QgZ2wyID0gZ2wgYXMgV2ViR0wyUmVuZGVyaW5nQ29udGV4dDtcbiAgICAgICAgY29uc3QgcHJldlZBTyA9IGdsMi5nZXRQYXJhbWV0ZXIoZ2wyLlZFUlRFWF9BUlJBWV9CSU5ESU5HKSBhcyBXZWJHTFZlcnRleEFycmF5T2JqZWN0IHwgbnVsbDtcbiAgICAgICAgY29uc3QgcHJldlByb2dyYW0gPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuQ1VSUkVOVF9QUk9HUkFNKSBhcyBXZWJHTFByb2dyYW0gfCBudWxsO1xuICAgICAgICBjb25zdCBwcmV2QmxlbmQgPSBnbC5pc0VuYWJsZWQoZ2wuQkxFTkQpO1xuXG4gICAgICAgIC8vIFVuYmluZCBWQU8gc28gb3VyIHZlcnRleCBhdHRyaWJ1dGUgY2FsbHMgZG9uJ3QgY29ycnVwdCBNYXBMaWJyZSdzIFZBTyBzdGF0ZVxuICAgICAgICBnbDIuYmluZFZlcnRleEFycmF5KG51bGwpO1xuXG4gICAgICAgIC8vIFx1MjUwMFx1MjUwMCBSZW5kZXIgXHUyNTAwXHUyNTAwXG4gICAgICAgIGdsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbS5wcm9ncmFtKTtcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkJMRU5EKTtcbiAgICAgICAgZ2wuYmxlbmRGdW5jKGdsLlNSQ19BTFBIQSwgZ2wuT05FX01JTlVTX1NSQ19BTFBIQSk7XG5cbiAgICAgICAgaWYgKHNoYWRlclByb2dyYW0udW5pZm9ybXMudV9tYXRyaXgpIHtcbiAgICAgICAgICBnbC51bmlmb3JtTWF0cml4NGZ2KHNoYWRlclByb2dyYW0udW5pZm9ybXMudV9tYXRyaXgsIGZhbHNlLCBtYXRyaXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdV90aW1lIGlzIGRyaXZlbiBjbGllbnQtc2lkZSBmcm9tIHBlcmZvcm1hbmNlLm5vdygpIGZvciBzbW9vdGgsIGppdHRlci1mcmVlIGFuaW1hdGlvblxuICAgICAgICBsZXQgdW5pZm9ybXMgPSBzZWxmLmN1cnJlbnRDb25maWc/LnVuaWZvcm1zIHx8IGNvbmZpZy51bmlmb3JtcyB8fCB7fTtcbiAgICAgICAgaWYgKHNlbGYuc3RhcnRUaW1lICE9PSB1bmRlZmluZWQgJiYgdW5pZm9ybXMudV90aW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpIC8gMTAwMCAtIHNlbGYuc3RhcnRUaW1lO1xuICAgICAgICAgIHVuaWZvcm1zID0geyAuLi51bmlmb3JtcywgdV90aW1lOiBjdXJyZW50VGltZSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY3VzdG9tV2ViR0xNYW5hZ2VyLnNldFVuaWZvcm1zKGdsLCBzaGFkZXJQcm9ncmFtLCB1bmlmb3Jtcyk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIGJ1ZmZlcik7XG4gICAgICAgIGlmIChzaGFkZXJQcm9ncmFtLmF0dHJpYnV0ZXMuYV9wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoc2hhZGVyUHJvZ3JhbS5hdHRyaWJ1dGVzLmFfcG9zaXRpb24pO1xuICAgICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5hdHRyaWJ1dGVzLmFfcG9zaXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICBnbC5kcmF3QXJyYXlzKGdsLlBPSU5UUywgMCwgMTAwMCk7XG5cbiAgICAgICAgLy8gXHUyNTAwXHUyNTAwIFJlc3RvcmUgR0wgc3RhdGUgXHUyNTAwXHUyNTAwXG4gICAgICAgIGdsLnVzZVByb2dyYW0ocHJldlByb2dyYW0pO1xuICAgICAgICBpZiAoIXByZXZCbGVuZCkgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG4gICAgICAgIGlmIChzaGFkZXJQcm9ncmFtLmF0dHJpYnV0ZXMuYV9wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KHNoYWRlclByb2dyYW0uYXR0cmlidXRlcy5hX3Bvc2l0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG4gICAgICAgIC8vIFJlc3RvcmUgTWFwTGlicmUncyBWQU9cbiAgICAgICAgZ2wyLmJpbmRWZXJ0ZXhBcnJheShwcmV2VkFPKTtcblxuICAgICAgICAvLyBBbmltYXRpb24gbG9vcCBpcyBkcml2ZW4gYnkgdGhlIGluZGVwZW5kZW50IHJBRiBpbiBtb3VudGVkKCksIG5vdCBoZXJlLlxuICAgICAgfSxcblxuICAgICAgb25SZW1vdmUoKSB7XG4gICAgICAgIGlmIChnbCkge1xuICAgICAgICAgIGN1c3RvbVdlYkdMTWFuYWdlci5kaXNwb3NlKGdsLCBjb25maWcuaWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxufTtcbiIsICIvKipcbiAqIE1hcGxpYnJlWCAtIE1hcExpYnJlIEdMIEpTIENvbXBvbmVudHMgZm9yIFBob2VuaXggTGl2ZVZpZXdcbiAqIFxuICogQG1vZHVsZSBtYXBsaWJyZXhcbiAqIEB2ZXJzaW9uIDAuMS4wXG4gKiBcbiAqIEVudHJ5IHBvaW50IGZvciBNYXBsaWJyZVguIFRoaXMgbW9kdWxlIHByb3ZpZGVzIFBob2VuaXggTGl2ZVZpZXcgaG9va3NcbiAqIGZvciBpbnRlZ3JhdGluZyBNYXBMaWJyZSBHTCBKUyBtYXBzIGludG8geW91ciBMaXZlVmlldyBhcHBsaWNhdGlvbnMuXG4gKiBcbiAqIEBleGFtcGxlXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBJbiB5b3VyIGFwcC5qc1xuICogaW1wb3J0IHsgTWFwSG9va3MgfSBmcm9tIFwibWFwbGlicmV4XCJcbiAqIFxuICogbGV0IGxpdmVTb2NrZXQgPSBuZXcgTGl2ZVNvY2tldChcIi9saXZlXCIsIFNvY2tldCwge1xuICogICBob29rczogTWFwSG9va3MsXG4gKiAgIHBhcmFtczoge19jc3JmX3Rva2VuOiBjc3JmVG9rZW59XG4gKiB9KVxuICogYGBgXG4gKi9cblxuLy8gRXhwb3J0IGFsbCBob29rc1xuaW1wb3J0IHsgXG4gIE1hcEhvb2ssIFxuICBNYXJrZXJIb29rLFxuICBQb3B1cEhvb2ssXG4gIEdlb0pTT05MYXllckhvb2ssXG4gIE5hdmlnYXRpb25Db250cm9sSG9vayxcbiAgU2NhbGVDb250cm9sSG9vayxcbiAgRnVsbHNjcmVlbkNvbnRyb2xIb29rLFxuICBHZW9sb2NhdGVDb250cm9sSG9vayxcbiAgQXR0cmlidXRpb25Db250cm9sSG9vayxcbiAgQ2lyY2xlTGF5ZXJIb29rLFxuICBMaW5lTGF5ZXJIb29rLFxuICBGaWxsTGF5ZXJIb29rLFxuICBTeW1ib2xMYXllckhvb2ssXG4gIEhlYXRtYXBMYXllckhvb2ssXG4gIEZpbGxFeHRydXNpb25MYXllckhvb2ssXG4gIEJhY2tncm91bmRMYXllckhvb2ssXG4gIEhpbGxzaGFkZUxheWVySG9vayxcbiAgUmFzdGVyTGF5ZXJIb29rLFxuICBWZWN0b3JUaWxlU291cmNlSG9vayxcbiAgUmFzdGVyVGlsZVNvdXJjZUhvb2ssXG4gIEltYWdlU291cmNlSG9vayxcbiAgUmFzdGVyREVNU291cmNlSG9vayxcbiAgVmlkZW9Tb3VyY2VIb29rLFxuICBUZXJyYWluSG9vayxcbiAgVGVycmFpbkNvbnRyb2xIb29rLFxuICBTa3lIb29rLFxuICBEZWNrR2xMYXllckhvb2ssXG4gIEN1c3RvbUxheWVySG9va1xufSBmcm9tICcuL21hcGxpYnJleC9ob29rcyc7XG5cbi8qKlxuICogSG9va3Mgb2JqZWN0IHRvIGJlIHBhc3NlZCB0byBMaXZlU29ja2V0XG4gKiBDb250YWlucyBhbGwgTWFwbGlicmVYIGhvb2tzXG4gKi9cbmV4cG9ydCBjb25zdCBNYXBIb29rcyA9IHtcbiAgTWFwSG9vayxcbiAgTWFya2VySG9vayxcbiAgUG9wdXBIb29rLFxuICBHZW9KU09OTGF5ZXJIb29rLFxuICBOYXZpZ2F0aW9uQ29udHJvbEhvb2ssXG4gIFNjYWxlQ29udHJvbEhvb2ssXG4gIEZ1bGxzY3JlZW5Db250cm9sSG9vayxcbiAgR2VvbG9jYXRlQ29udHJvbEhvb2ssXG4gIEF0dHJpYnV0aW9uQ29udHJvbEhvb2ssXG4gIENpcmNsZUxheWVySG9vayxcbiAgTGluZUxheWVySG9vayxcbiAgRmlsbExheWVySG9vayxcbiAgU3ltYm9sTGF5ZXJIb29rLFxuICBIZWF0bWFwTGF5ZXJIb29rLFxuICBGaWxsRXh0cnVzaW9uTGF5ZXJIb29rLFxuICBCYWNrZ3JvdW5kTGF5ZXJIb29rLFxuICBIaWxsc2hhZGVMYXllckhvb2ssXG4gIFJhc3RlckxheWVySG9vayxcbiAgVmVjdG9yVGlsZVNvdXJjZUhvb2ssXG4gIFJhc3RlclRpbGVTb3VyY2VIb29rLFxuICBJbWFnZVNvdXJjZUhvb2ssXG4gIFJhc3RlckRFTVNvdXJjZUhvb2ssXG4gIFZpZGVvU291cmNlSG9vayxcbiAgVGVycmFpbkhvb2ssXG4gIFRlcnJhaW5Db250cm9sSG9vayxcbiAgU2t5SG9vayxcbiAgRGVja0dsTGF5ZXJIb29rLFxuICBDdXN0b21MYXllckhvb2tcbn07XG5cbi8vIEV4cG9ydCBpbmRpdmlkdWFsIGhvb2tzIGZvciBhZHZhbmNlZCB1c2FnZVxuZXhwb3J0IHsgXG4gIE1hcEhvb2ssIFxuICBNYXJrZXJIb29rLFxuICBQb3B1cEhvb2ssXG4gIEdlb0pTT05MYXllckhvb2ssXG4gIE5hdmlnYXRpb25Db250cm9sSG9vayxcbiAgU2NhbGVDb250cm9sSG9vayxcbiAgRnVsbHNjcmVlbkNvbnRyb2xIb29rLFxuICBHZW9sb2NhdGVDb250cm9sSG9vayxcbiAgQXR0cmlidXRpb25Db250cm9sSG9vayxcbiAgQ2lyY2xlTGF5ZXJIb29rLFxuICBMaW5lTGF5ZXJIb29rLFxuICBGaWxsTGF5ZXJIb29rLFxuICBTeW1ib2xMYXllckhvb2ssXG4gIEhlYXRtYXBMYXllckhvb2ssXG4gIEZpbGxFeHRydXNpb25MYXllckhvb2ssXG4gIEJhY2tncm91bmRMYXllckhvb2ssXG4gIEhpbGxzaGFkZUxheWVySG9vayxcbiAgUmFzdGVyTGF5ZXJIb29rLFxuICBWZWN0b3JUaWxlU291cmNlSG9vayxcbiAgUmFzdGVyVGlsZVNvdXJjZUhvb2ssXG4gIEltYWdlU291cmNlSG9vayxcbiAgUmFzdGVyREVNU291cmNlSG9vayxcbiAgVmlkZW9Tb3VyY2VIb29rLFxuICBUZXJyYWluSG9vayxcbiAgVGVycmFpbkNvbnRyb2xIb29rLFxuICBTa3lIb29rLFxuICBEZWNrR2xMYXllckhvb2ssXG4gIEN1c3RvbUxheWVySG9va1xufSBmcm9tICcuL21hcGxpYnJleC9ob29rcyc7XG5cbi8vIEV4cG9ydCBjb3JlIHV0aWxpdGllc1xuZXhwb3J0IHsgTWFwTWFuYWdlciwgdXNlTWFwLCByZXF1aXJlTWFwIH0gZnJvbSAnLi9tYXBsaWJyZXgvY29yZS9tYXAtbWFuYWdlcic7XG5leHBvcnQgeyBFdmVudERpc3BhdGNoZXIsIGNyZWF0ZUV2ZW50RGlzcGF0Y2hlciB9IGZyb20gJy4vbWFwbGlicmV4L2NvcmUvZXZlbnQtZGlzcGF0Y2hlcic7XG5cbi8vIEV4cG9ydCB0eXBlc1xuZXhwb3J0IHR5cGUge1xuICBMaXZlVmlld0hvb2ssXG4gIEhvb2tDb250ZXh0LFxuICBNYXBDb25maWcsXG4gIE1hcmtlckNvbmZpZyxcbiAgUG9wdXBDb25maWcsXG4gIExheWVyQ29uZmlnLFxuICBHZW9KU09OU291cmNlQ29uZmlnLFxuICBDb250cm9sQ29uZmlnLFxuICBOYXZpZ2F0aW9uQ29udHJvbENvbmZpZyxcbiAgU2NhbGVDb250cm9sQ29uZmlnLFxuICBGdWxsc2NyZWVuQ29udHJvbENvbmZpZyxcbiAgR2VvbG9jYXRlQ29udHJvbENvbmZpZyxcbiAgTWFwRXZlbnRQYXlsb2FkLFxuICBNYXBNb3ZlRXZlbnRQYXlsb2FkLFxuICBNYXBDbGlja0V2ZW50UGF5bG9hZCxcbiAgTWFya2VyRHJhZ0V2ZW50UGF5bG9hZCxcbiAgUG9zaXRpb24sXG4gIEJvdW5kc1xufSBmcm9tICcuL21hcGxpYnJleC90eXBlcyc7XG5cbi8vIERlZmF1bHQgZXhwb3J0XG5leHBvcnQgZGVmYXVsdCBNYXBIb29rcztcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFRQSxZQUFZLGdCQUFnQjs7O0FDVzVCLElBQUksZUFDRixPQUFPLFdBQVcsZUFBZSxPQUFPLHdCQUF3QjtBQUszRCxTQUFTLFNBQVMsU0FBd0I7QUFDL0MsaUJBQWU7QUFDakI7QUFTTyxJQUFNLFNBQVM7QUFBQTtBQUFBLEVBRXBCLFNBQVMsTUFBdUI7QUFDOUIsUUFBSSxjQUFjO0FBQ2hCLGNBQVEsSUFBSSxHQUFHLElBQUk7QUFBQSxJQUNyQjtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0EsUUFBUSxNQUF1QjtBQUM3QixZQUFRLEtBQUssR0FBRyxJQUFJO0FBQUEsRUFDdEI7QUFBQTtBQUFBLEVBR0EsU0FBUyxNQUF1QjtBQUM5QixZQUFRLE1BQU0sR0FBRyxJQUFJO0FBQUEsRUFDdkI7QUFDRjs7O0FDdkNBLElBQU0sa0JBQU4sTUFBc0I7QUFBQSxFQUNaLE9BQW9CLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUs3QixTQUFTLE9BQWUsS0FBZ0I7QUFDdEMsUUFBSSxLQUFLLEtBQUssS0FBSyxHQUFHO0FBQ3BCLFdBQUssSUFBSSxRQUFRLGdCQUFnQixLQUFLLGtDQUFrQztBQUFBLElBQzFFO0FBRUEsU0FBSyxLQUFLLEtBQUssSUFBSTtBQUNuQixTQUFLLElBQUksUUFBUSxRQUFRLEtBQUssZ0JBQWdCLEVBQUUsSUFBSSxDQUFDO0FBQUEsRUFDdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLElBQUksT0FBZ0M7QUFDbEMsVUFBTSxNQUFNLEtBQUssS0FBSyxLQUFLO0FBRTNCLFFBQUksQ0FBQyxLQUFLO0FBQ1IsV0FBSyxJQUFJLFFBQVEsZ0JBQWdCLEtBQUssYUFBYTtBQUFBLElBQ3JEO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLFdBQVcsT0FBb0I7QUFDN0IsVUFBTSxNQUFNLEtBQUssSUFBSSxL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STtBQUdoQyxXQUFHLFdBQVcsV0FBVztBQUN6QixZQUFJLENBQUMsVUFBVyxJQUFHLFFBQVEsR0FBRyxLQUFLO0FBQ25DLFlBQUksY0FBYyxXQUFXLGVBQWUsUUFBVztBQUNyRCxhQUFHLHlCQUF5QixjQUFjLFdBQVcsVUFBVTtBQUFBLFFBQ2pFO0FBQ0EsV0FBRyxXQUFXLEdBQUcsY0FBYyxJQUFJO0FBRW5DLFlBQUksZ0JBQWdCLE9BQU87QUFBQSxNQUc3QjtBQUFBLE1BRUEsV0FBVztBQUNULFlBQUksSUFBSTtBQUNOLDZCQUFtQixRQUFRLElBQUksT0FBTyxFQUFFO0FBQUEsUUFDMUM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FDak5PLElBQU0sV0FBVztBQUFBLEVBQ3RCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7QUE2REEsSUFBTyxvQkFBUTsiLAogICJuYW1lcyI6IFsibWFwbGlicmVnbCIsICJtYXBsaWJyZWdsIiwgIm1hcGxpYnJlZ2wiLCAibWFwbGlicmVnbCIsICJtYXBsaWJyZWdsIiwgIm1hcGxpYnJlZ2wiLCAibWFwbGlicmVnbCIsICJjb25maWciLCAibWFwIl0KfQo=
