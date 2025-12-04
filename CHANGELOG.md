# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Map JS Commands**: Fixed all map JS commands (`fly_to`, `jump_to`, `fit_bounds`, `set_style`, `zoom_in`, `zoom_out`, `reset_north`) that were not working. Changed from `JS.push()` to `JS.dispatch()` for direct client-side communication without server round-trip.
- Added event listeners in MapHook to handle commands dispatched from Elixir components
- Commands now work instantly with reduced latency since they don't require server communication

### Changed
- Map component commands now use `JS.dispatch()` instead of `JS.push()` for better performance
- All map commands now dispatch custom DOM events (e.g., `maplibrex:fly_to`, `maplibrex:zoom_in`)
- Hook TypeScript implementation now listens for command events and executes them directly on the map instance

### Added
- Comprehensive documentation of fixes in `FIXES_APPLIED.md`
- Event listeners for all map commands in the MapHook TypeScript implementation
- Support for all MapLibre flyTo options (bearing, pitch) in commands

## [0.1.0] - 2025-11-30

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

### Features
- `<.map />` component with all standard MapLibre options
- Event handlers: map:moved, map:clicked, map:loaded, map:zoom_changed, map:error
- JS commands: fly_to, jump_to, fit_bounds, set_style, zoom_in, zoom_out, reset_north
- TypeScript types for better developer experience
- Singleton MapManager for efficient instance management
- Proper cleanup and reconnection handling
- Built-in CSS with customization support
- Marker component with dragging support
- Popup component
- GeoJSON layer support
- Navigation controls
- Scale controls
- Fullscreen controls

## [0.1.0] - 2025-11-30

### Added
- Initial public release
