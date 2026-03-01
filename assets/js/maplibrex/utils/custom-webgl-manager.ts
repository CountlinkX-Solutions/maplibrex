/**
 * Custom WebGL Manager
 * 
 * Core manager for custom WebGL rendering in MapLibre.
 * Handles shader compilation, program linking, resource management, and render loops.
 */

import {
  ShaderProgram,
  CustomWebGLError
} from '../types/custom-webgl';

export class CustomWebGLManager {
  private programs: Map<string, ShaderProgram> = new Map();
  private buffers: Map<string, WebGLBuffer> = new Map();
  private textures: Map<string, WebGLTexture> = new Map();
  private animationFrames: Map<string, number> = new Map();
  private frameCallbacks: Map<string, () => void> = new Map();

  /**
   * Compile a WebGL shader from GLSL source
   */
  compileShader(
    gl: WebGLRenderingContext,
    source: string,
    type: number,
    layerId: string
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new CustomWebGLError(
        'Failed to create shader',
        layerId,
        'SHADER_CREATE_FAILED'
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
        'SHADER_COMPILE_ERROR'
      );
    }

    return shader;
  }

  /**
   * Create and link a WebGL program from vertex and fragment shaders
   */
  createProgram(
    gl: WebGLRenderingContext,
    vertexSource: string,
    fragmentSource: string,
    layerId: string
  ): WebGLProgram {
    const vertexShader = this.compileShader(gl, vertexSource, gl.VERTEX_SHADER, layerId);
    const fragmentShader = this.compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER, layerId);

    const program = gl.createProgram();
    if (!program) {
      throw new CustomWebGLError(
        'Failed to create program',
        layerId,
        'PROGRAM_CREATE_FAILED'
      );
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Clean up shaders after linking
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new CustomWebGLError(
        `Program link error: ${info}`,
        layerId,
        'PROGRAM_LINK_ERROR'
      );
    }

    return program;
  }

  /**
   * Get all attribute and uniform locations from a program
   */
  getLocations(gl: WebGLRenderingContext, program: WebGLProgram): ShaderProgram {
    const attributes: Record<string, number> = {};
    const uniforms: Record<string, WebGLUniformLocation> = {};

    // Get all active attributes
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        attributes[info.name] = location;
      }
    }

    // Get all active uniforms
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
  createBuffer(
    gl: WebGLRenderingContext,
    data: Float32Array | Uint16Array,
    target: number = gl.ARRAY_BUFFER,
    usage: number = gl.STATIC_DRAW
  ): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create buffer');
    }

    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, usage);
    gl.bindBuffer(target, null);

    return buffer;
  }

  /**
   * Create a data texture for large datasets
   */
  createDataTexture(
    gl: WebGLRenderingContext,
    data: Float32Array,
    width: number,
    height: number,
    format: number = gl.RGBA,
    type: number = gl.FLOAT
  ): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Check for float texture support
    const ext = gl.getExtension('OES_texture_float');
    if (!ext && type === gl.FLOAT) {
      console.warn('Float textures not supported, falling back to UNSIGNED_BYTE');
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

    // Set texture parameters for data (not images)
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
  setUniforms(
    gl: WebGLRenderingContext,
    program: ShaderProgram,
    uniforms: Record<string, any>
  ): void {
    gl.useProgram(program.program);

    for (const [name, value] of Object.entries(uniforms)) {
      const location = program.uniforms[name];
      if (!location) continue;

      if (typeof value === 'number') {
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
  setupRenderLoop(
    layerId: string,
    renderFn: () => void,
    fps: number = 60
  ): void {
    // Cancel existing loop if any
    this.stopRenderLoop(layerId);

    const interval = 1000 / fps;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const frameId = requestAnimationFrame(animate);
      this.animationFrames.set(layerId, frameId);

      const delta = currentTime - lastTime;
      if (delta >= interval) {
        renderFn();
        lastTime = currentTime - (delta % interval);
      }
    };

    animate(lastTime);
  }

  /**
   * Stop the render loop for a layer
   */
  stopRenderLoop(layerId: string): void {
    const frameId = this.animationFrames.get(layerId);
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(layerId);
    }
  }

  /**
   * Store a shader program
   */
  storeProgram(layerId: string, program: ShaderProgram): void {
    this.programs.set(layerId, program);
  }

  /**
   * Get a stored shader program
   */
  getProgram(layerId: string): ShaderProgram | undefined {
    return this.programs.get(layerId);
  }

  /**
   * Store a buffer
   */
  storeBuffer(layerId: string, buffer: WebGLBuffer): void {
    this.buffers.set(layerId, buffer);
  }

  /**
   * Get a stored buffer
   */
  getBuffer(layerId: string): WebGLBuffer | undefined {
    return this.buffers.get(layerId);
  }

  /**
   * Store a texture
   */
  storeTexture(layerId: string, texture: WebGLTexture): void {
    this.textures.set(layerId, texture);
  }

  /**
   * Get a stored texture
   */
  getTexture(layerId: string): WebGLTexture | undefined {
    return this.textures.get(layerId);
  }

  /**
   * Clean up all resources for a layer
   */
  dispose(gl: WebGLRenderingContext, layerId: string): void {
    // Stop render loop
    this.stopRenderLoop(layerId);

    // Delete program
    const program = this.programs.get(layerId);
    if (program) {
      gl.deleteProgram(program.program);
      this.programs.delete(layerId);
    }

    // Delete buffer
    const buffer = this.buffers.get(layerId);
    if (buffer) {
      gl.deleteBuffer(buffer);
      this.buffers.delete(layerId);
    }

    // Delete texture
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
  disposeAll(gl: WebGLRenderingContext): void {
    const layerIds = Array.from(this.programs.keys());
    layerIds.forEach(id => this.dispose(gl, id));
  }
}

// Singleton instance
export const customWebGLManager = new CustomWebGLManager();
