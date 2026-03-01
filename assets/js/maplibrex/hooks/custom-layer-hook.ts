/**
 * Custom WebGL Layer Hook
 * 
 * Phoenix LiveView hook for custom WebGL rendering layers.
 */

import { customWebGLManager } from '../utils/custom-webgl-manager';
import { PARTICLE_SYSTEM_PRESETS } from '../shaders/particle-system';
import type { CustomLayerConfig, WebGLLayerImplementation } from '../types/custom-webgl';

export const CustomLayerHook = {
  mounted(this: any) {
    const config: CustomLayerConfig = JSON.parse(this.el.dataset.config || '{}');
    console.log('[CustomLayer] Mounted:', config.id);

    const mapEl = document.getElementById(config.mapId);
    if (!mapEl || !(mapEl as any).mapInstance) {
      console.error('[CustomLayer] Map not found:', config.mapId);
      return;
    }

    const map = (mapEl as any).mapInstance;
    
    // Create the custom layer implementation
    const customLayer = this.createCustomLayer(config);
    
    // Store reference
    this.layerId = config.id;
    this.map = map;
    this.customLayer = customLayer;

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
    console.log('[CustomLayer] Updated:', config.id);
    
    // Handle uniform updates
    if (config.uniforms && this.gl && this.shaderProgram) {
      customWebGLManager.setUniforms(this.gl, this.shaderProgram, config.uniforms);
    }
  },

  destroyed(this: any) {
    console.log('[CustomLayer] Destroyed:', this.layerId);
    
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

          // Create simple particle data (random positions)
          const particleCount = 1000;
          const positions = new Float32Array(particleCount * 2);
          for (let i = 0; i < particleCount; i++) {
            positions[i * 2] = Math.random() * 2 - 1;
            positions[i * 2 + 1] = Math.random() * 2 - 1;
          }

          buffer = customWebGLManager.createBuffer(gl, positions);
          customWebGLManager.storeBuffer(config.id, buffer);

          initialized = true;
          console.log('[CustomLayer] WebGL initialized:', config.id);
        } catch (error) {
          console.error('[CustomLayer] Initialization error:', error);
        }
      },

      render(_glContext: WebGLRenderingContext, matrix: number[]) {
        if (!initialized || !shaderProgram) return;

        gl.useProgram(shaderProgram.program);

        // Enable blending for particles
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Set matrix uniform
        if (shaderProgram.uniforms.u_matrix) {
          gl.uniformMatrix4fv(shaderProgram.uniforms.u_matrix, false, matrix);
        }

        // Set other uniforms
        const uniforms = config.uniforms || {};
        customWebGLManager.setUniforms(gl, shaderProgram, uniforms);

        // Bind buffer and set attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        if (shaderProgram.attributes.a_position !== undefined) {
          gl.enableVertexAttribArray(shaderProgram.attributes.a_position);
          gl.vertexAttribPointer(
            shaderProgram.attributes.a_position,
            2, // 2 components per vertex (x, y)
            gl.FLOAT,
            false,
            0,
            0
          );
        }

        // Draw particles
        gl.drawArrays(gl.POINTS, 0, 1000);

        gl.disable(gl.BLEND);
      },

      onRemove() {
        if (gl) {
          customWebGLManager.dispose(gl, config.id);
        }
      }
    };
  }
};
