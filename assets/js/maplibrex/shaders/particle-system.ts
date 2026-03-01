/**
 * Particle System Shaders
 * 
 * GLSL shaders for particle-based visualizations like ocean currents and wind flow.
 */

export const PARTICLE_VERTEX_SHADER = `
attribute vec2 a_position;
uniform mat4 u_matrix;
uniform float u_point_size;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
  gl_PointSize = u_point_size;
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
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

// Preset configurations
export const PARTICLE_SYSTEM_PRESETS = {
  ocean_currents: {
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    defaultUniforms: {
      u_color: [0.2, 0.6, 0.9], // Ocean blue
      u_opacity: 0.8,
      u_point_size: 3.0
    }
  },
  
  wind_flow: {
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    defaultUniforms: {
      u_color: [0.9, 0.9, 0.9], // White/gray
      u_opacity: 0.6,
      u_point_size: 2.0
    }
  }
};
