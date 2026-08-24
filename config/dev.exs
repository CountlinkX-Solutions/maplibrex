import Config

config :maplibrex,
  debug: true

# Development build: unminified, inline source maps, watch mode.
# Keeps the same externals as the production build so what you develop against
# is what gets published.
external_peers = ~w(
  --external:maplibre-gl
  --external:maplibre-gl/*
  --external:@deck.gl/core
  --external:@deck.gl/layers
  --external:@deck.gl/aggregation-layers
  --external:@deck.gl/mapbox
)

config :esbuild,
  maplibrex: [
    args: ~w(
        js/maplibrex.ts
        --bundle
        --format=esm
        --target=es2022
        --outdir=../priv/static/assets/js
        --loader:.ts=ts
        --sourcemap=inline
      ) ++ external_peers,
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]
