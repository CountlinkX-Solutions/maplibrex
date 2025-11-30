# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of MaplibreX
- Core Map component with full MapLibre GL JS integration
- TypeScript-based hook system with MapManager and EventDispatcher
- Bidirectional event handling between LiveView and MapLibre
- Reactive map updates when assigns change
- JavaScript commands for map control (fly_to, jump_to, fit_bounds, etc.)
- Comprehensive documentation and examples
- MapLibre GL JS v5.0.0-pre.2 integration
- CSS styling with dark mode support

### Features in v0.1.0
- `<.map />` component with all standard MapLibre options
- Event handlers: map:moved, map:clicked, map:loaded, map:zoom_changed, map:error
- JS commands: fly_to, jump_to, fit_bounds, set_style, zoom_in, zoom_out, reset_north
- TypeScript types for better developer experience
- Singleton MapManager for efficient instance management
- Proper cleanup and reconnection handling
- Built-in CSS with customization support

### Coming Soon
- Marker component
- Popup component
- GeoJSON layer support
- Navigation controls
- Scale controls
- Fullscreen controls
- Geolocate controls
- Cluster support
- 3D buildings
- Terrain support

## [0.1.0] - 2025-11-30

### Added
- Initial public release
