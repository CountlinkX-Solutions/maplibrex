import Config

# Configuración para desarrollo
config :maplibrex,
  debug: true

# Configuración de esbuild para desarrollo con watch
config :esbuild,
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
      --sourcemap=inline
      --watch
    ),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]
