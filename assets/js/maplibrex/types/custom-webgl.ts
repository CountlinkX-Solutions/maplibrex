/**
 * Custom WebGL Layer Types
 * 
 * Defines types for custom WebGL rendering layers in MapLibre.
 * Supports particle systems, vector fields, shader effects, and more.
 */

export type CustomLayerType =
  | 'particle_system'     // For wind, ocean currents, particle effects
  | 'vector_field'        // For directional flow visualization
  | 'shader_effect'       // For custom visual effects
  | 'procedural_geometry' // For GPU-generated geometry
  | 'data_texture';       // For large datasets as textures

export type RenderingMode = 'static' | 'dynamic' | 'streaming';

export type DataFormat = 'vertices' | 'texture' | 'structured';

export interface CustomLayerConfig {
  id: string;
  type: CustomLayerType;
  mapId: string;

  // Shaders (GLSL source code)
  vertexShader?: string;
  fragmentShader?: string;

  // Optional preset name (e.g., 'ocean_currents', 'wind_flow')
  preset?: string;

  // Data configuration
  data?: any;
  dataFormat?: DataFormat;
  dataTextureSize?: { width: number; height: number };

  // Dynamic uniforms (parameters that change over time)
  uniforms?: Record<string, any>;

  // Performance settings
  updateInterval?: number; // ms between updates
  renderingMode?: RenderingMode;
  fps?: number; // Target frames per second

  // Layer positioning
  beforeId?: string;
  minZoom?: number;
  maxZoom?: number;

  // Callbacks
  onRender?: string; // Event name for custom render callback
  onUpdate?: string; // Event name for data update callback
  onError?: string;  // Event name for errors
}

export interface WebGLLayerImplementation {
  id: string;
  type: 'custom';
  renderingMode: '3d';
  
  onAdd(map: any, gl: WebGLRenderingContext): void;
  // According to MapLibre GL JS docs, render receives args object with projection data
  render(gl: WebGLRenderingContext, args: any): void;
  onRemove?(map: any, gl: WebGLRenderingContext): void;
  prerender?(gl: WebGLRenderingContext, args: any): void;
}

export interface ShaderProgram {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation>;
}

export interface ParticleSystemConfig {
  particleCount: number;
  particleSize: number;
  speedMultiplier: number;
  fadeOpacity: number;
  colorRamp: string[]; // Array of color stops
}

export interface VectorFieldData {
  u: number[][]; // U component (east-west)
  v: number[][]; // V component (north-south)
  width: number;
  height: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
}

// Preset configurations
export interface PresetConfig {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  defaultUniforms: Record<string, any>;
  defaultSettings: Partial<CustomLayerConfig>;
}

// Error types
export class CustomWebGLError extends Error {
  constructor(
    message: string,
    public readonly layerId: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CustomWebGLError';
  }
}
