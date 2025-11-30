import Config

# Configuración de esbuild
config :esbuild,
  version: "0.17.11",
  maplibrex: [
    args: ~w(
      js/maplibrex.ts
      --bundle
      --target=es2022
      --outdir=../priv/static/assets/js
      --external:/fonts/*
      --external:/images/*
      --loader:.ts=ts
      --loader:.tsx=tsx
      --sourcemap
    ),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

# Configuración por defecto de MaplibreX
config :maplibrex,
  default_style: "https://demotiles.maplibre.org/style.json",
  default_center: [0, 0],
  default_zoom: 10

# Import environment specific config
import_config "#{config_env()}.exs"
