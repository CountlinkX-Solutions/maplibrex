/**
 * Custom WebGL Layer Hook
 * 
 * Phoenix LiveView hook for custom WebGL rendering layers.
 */

import { customWebGLManager } from '../utils/custom-webgl-manager';
import { PARTICLE_SYSTEM_PRESETS } from '../shaders/particle-system';
import { MapManager } from '../core/map-manager';
import type { CustomLayerConfig, WebGLLayerImplementation } from '../types/custom-webgl';

export const CustomLayerHook = {
  mounted(this: any) {
    const config: CustomLayerConfig = JSON.parse(this.el.dataset.config || '{}');
    console.log('[CustomLayer] Mounted:', config.id, 'with uniforms:', config.uniforms);
    
    // Listen for uniform updates via Phoenix events
    this.handleEvent(`update_uniforms_${config.id}`, (payload: any) => {
      console.log('[CustomLayer] Received uniform update:', payload);
      if (payload.uniforms) {
        this.currentConfig = {
          ...this.currentConfig,
          uniforms: payload.uniforms
        };
        // Trigger repaint to apply changes
        if (this.map) {
          this.map.triggerRepaint();
        }
      }
    });

    // Use MapManager instead of DOM to get map instance
    const map = MapManager.get(config.mapId);
    if (!map) {
      console.error('[CustomLayer] Map not found in MapManager:', config.mapId);
      return;
    }
    
    // Create the custom layer implementation
    const customLayer = this.createCustomLayer(config);
    
    // Store reference
    this.layerId = config.id;
    this.map = map;
    this.customLayer = customLayer;
    this.currentConfig = config;
    
    // Store start time for u_time calculation (if needed for animation)
    if (config.uniforms && 'u_time' in config.uniforms) {
      this.startTime = performance.now() / 1000;
      console.log('[CustomLayer] Animation enabled for', config.id);
      // map.repaint = true tells MapLibre to continuously re-render every frame.
      // At the end of each _render() cycle MapLibre checks this flag and calls
      // triggerRepaint() automatically — no external rAF loop needed.
      map.repaint = true;
    }

    // Add layer to map
    map.on('load', () => {
      try {
        map.addLayer(customLayer, config.beforeId);
        console.log('[CustomLayer] Added to map:', config.id);
      } catch (error) {
        console.error('[CustomLayer] Error adding layer:', error);
      }
    });

    // If map is already loaded, add immediately
    if (map.loaded()) {
      try {
        map.addLayer(customLayer, config.beforeId);
        console.log('[CustomLayer] Added to map (already loaded):', config.id);
      } catch (error) {
        console.error('[CustomLayer] Error adding layer:', error);
      }
    }
  },

  updated(this: any) {
    const config: CustomLayerConfig = JSON.parse(this.el.dataset.config || '{}');
    console.log('[CustomLayer] Updated with uniforms:', config.uniforms);
    
    // Store updated config so render() can access it
    this.currentConfig = config;
    
    // Trigger map repaint to apply uniform updates and continue animation
    if (this.map) {
      this.map.triggerRepaint();
    }
  },

  destroyed(this: any) {
    console.log('[CustomLayer] Destroyed:', this.layerId);

    this.destroyed = true;
    // Turn off continuous repaint when the animated layer is removed
    if (this.map && this.startTime !== undefined) {
      this.map.repaint = false;
    }
    
    if (this.map && this.layerId) {
      try {
        if (this.map.getLayer(this.layerId)) {
          this.map.removeLayer(this.layerId);
        }
      } catch (error) {
        console.error('[CustomLayer] Error removing layer:', error);
      }
    }

    if (this.gl) {
      customWebGLManager.dispose(this.gl, this.layerId);
    }
  },

  createCustomLayer(this: any, config: CustomLayerConfig): WebGLLayerImplementation {
    const self = this;
    let gl: WebGLRenderingContext;
    let shaderProgram: any;
    let buffer: WebGLBuffer;
    let initialized = false;

    // Get shaders (from preset or custom)
    let vertexShader = config.vertexShader;
    let fragmentShader = config.fragmentShader;

    if (config.preset && PARTICLE_SYSTEM_PRESETS[config.preset as keyof typeof PARTICLE_SYSTEM_PRESETS]) {
      const preset = PARTICLE_SYSTEM_PRESETS[config.preset as keyof typeof PARTICLE_SYSTEM_PRESETS];
      vertexShader = vertexShader || preset.vertexShader;
      fragmentShader = fragmentShader || preset.fragmentShader;
    }

    if (!vertexShader || !fragmentShader) {
      throw new Error('Vertex and fragment shaders are required');
    }

    return {
      id: config.id,
      type: 'custom',
      renderingMode: '3d',

      onAdd(_map: any, glContext: WebGLRenderingContext) {
        gl = glContext;
        self.gl = gl;

        try {
          // Create shader program
          const program = customWebGLManager.createProgram(
            gl,
            vertexShader!,
            fragmentShader!,
            config.id
          );

          shaderProgram = customWebGLManager.getLocations(gl, program);
          customWebGLManager.storeProgram(config.id, shaderProgram);
          self.shaderProgram = shaderProgram;

          // Create particle data in MERCATOR COORDINATES [0, 1]
          // According to MapLibre GL docs, custom layers work with MercatorCoordinate
          // which converts lng/lat to normalized [0, 1] range
          const particleCount = 1000;
          const positions = new Float32Array(particleCount * 2);
          for (let i = 0; i < particleCount; i++) {
            // Generate random lng/lat
            const lng = Math.random() * 360 - 180;
            const lat = Math.random() * 170 - 85;
            
            // Convert to Mercator coordinates [0, 1]
            // Formula from MapLibre: x = (lng + 180) / 360
            // y = (180 - (180 / π * ln(tan(π/4 + lat * π / 360)))) / 360
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
          console.log('[CustomLayer] WebGL initialized:', config.id);
        } catch (error) {
          console.error('[CustomLayer] Initialization error:', error);
        }
      },

      render(_glContext: WebGLRenderingContext, matrixOrArgs: any) {
        if (!initialized || !shaderProgram) {
          return;
        }

        // Support both MapLibre APIs:
        // - Old (< 3.x): render(gl, matrix) where matrix is Float32Array directly
        // - New (>= 3.x): render(gl, args) where args.defaultProjectionData.mainMatrix holds it
        let matrix: Float32Array | number[] | null = null;
        if (matrixOrArgs instanceof Float32Array || Array.isArray(matrixOrArgs)) {
          matrix = matrixOrArgs;
        } else {
          matrix = matrixOrArgs?.defaultProjectionData?.mainMatrix ?? null;
        }

        if (!matrix || matrix.length !== 16) {
          return;
        }

        // ── Save GL state (MapLibre v5 uses WebGL2 + VAOs — must save/restore VAO binding) ──
        const gl2 = gl as WebGL2RenderingContext;
        const prevVAO = gl2.getParameter(gl2.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
        const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
        const prevBlend = gl.isEnabled(gl.BLEND);

        // Unbind VAO so our vertex attribute calls don't corrupt MapLibre's VAO state
        gl2.bindVertexArray(null);

        // ── Render ──
        gl.useProgram(shaderProgram.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        if (shaderProgram.uniforms.u_matrix) {
          gl.uniformMatrix4fv(shaderProgram.uniforms.u_matrix, false, matrix);
        }

        // u_time is driven client-side from performance.now() for smooth, jitter-free animation
        let uniforms = self.currentConfig?.uniforms || config.uniforms || {};
        if (self.startTime !== undefined && uniforms.u_time !== undefined) {
          const currentTime = performance.now() / 1000 - self.startTime;
          uniforms = { ...uniforms, u_time: currentTime };
        }

        customWebGLManager.setUniforms(gl, shaderProgram, uniforms);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        if (shaderProgram.attributes.a_position !== undefined) {
          gl.enableVertexAttribArray(shaderProgram.attributes.a_position);
          gl.vertexAttribPointer(shaderProgram.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
        }

        gl.drawArrays(gl.POINTS, 0, 1000);

        // ── Restore GL state ──
        gl.useProgram(prevProgram);
        if (!prevBlend) gl.disable(gl.BLEND);
        if (shaderProgram.attributes.a_position !== undefined) {
          gl.disableVertexAttribArray(shaderProgram.attributes.a_position);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        // Restore MapLibre's VAO
        gl2.bindVertexArray(prevVAO);

        // Animation loop is driven by the independent rAF in mounted(), not here.
      },

      onRemove() {
        if (gl) {
          customWebGLManager.dispose(gl, config.id);
        }
      }
    };
  }
};
