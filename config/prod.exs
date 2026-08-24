import Config

# Production build settings for the library itself. This is the configuration
# used to produce the bundle that ships inside the Hex package
# (`MIX_ENV=prod mix assets.deploy`).
#
# Note: this file is NOT loaded by applications that depend on MaplibreX —
# dependency configuration is never read by the parent app. It only affects
# building MaplibreX from this repository.
config :maplibrex,
  debug: false
