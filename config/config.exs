import Config

# `maplibre-gl` and the `@deck.gl/*` packages are deliberately marked as
# external: they are peer dependencies installed by the host application, so the
# published bundle stays small and there is never a second copy of MapLibre GL
# on the page. The output is ESM so the host bundler can resolve those imports.
external_peers = ~w(
  --external:maplibre-gl
  --external:maplibre-gl/*
  --external:@deck.gl/core
  --external:@deck.gl/layers
  --external:@deck.gl/aggregation-layers
  --external:@deck.gl/mapbox
)

# esbuild builds the distributable hook bundle into priv/static.
config :esbuild,
  version: "0.25.4",
  maplibrex: [
    args: ~w(
        js/maplibrex.ts
        --bundle
        --format=esm
        --target=es2022
        --outdir=../priv/static/assets/js
        --loader:.ts=ts
        --minify
        --tree-shaking=true
        --legal-comments=none
        --drop:debugger
        --sourcemap=external
      ) ++ external_peers,
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

# MaplibreX defaults. Host applications override these in their own config.
config :maplibrex,
  default_style: "https://demotiles.maplibre.org/style.json",
  default_center: [0, 0],
  default_zoom: 10

import_config "#{config_env()}.exs"
