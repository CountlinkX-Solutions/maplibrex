defmodule MaplibreX.MixProject do
  use Mix.Project

  @version "0.1.0"
  @source_url "https://github.com/CountlinkX-Solutions/maplibrex"

  def project do
    [
      app: :maplibrex,
      version: @version,
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      description: description(),
      package: package(),
      docs: docs(),
      name: "MaplibreX",
      source_url: @source_url,
      dialyzer: [plt_add_apps: [:mix]]
    ]
  end

  def cli do
    [preferred_envs: [ci: :test]]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Phoenix & LiveView
      {:phoenix, "~> 1.7"},
      {:phoenix_html, "~> 4.0"},
      {:phoenix_live_view, "~> 1.0"},
      {:jason, "~> 1.4"},

      # Asset building (used to produce priv/static, never at runtime)
      {:esbuild, "~> 0.8", runtime: false},

      # Testing & static analysis
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},

      # Documentation
      {:ex_doc, "~> 0.31", only: :dev, runtime: false}
    ]
  end

  defp description do
    "MapLibre GL JS components for Phoenix LiveView. " <>
      "A declarative and reactive way to build interactive maps in Elixir."
  end

  defp package do
    [
      maintainers: ["Yendris Rogelio Cruz Mendoza"],
      licenses: ["MIT"],
      links: %{
        "GitHub" => @source_url,
        "Changelog" => "#{@source_url}/blob/main/CHANGELOG.md",
        "Demo" => "https://github.com/CountlinkX-Solutions/maplibrex_demo"
      },
      # `priv/static` carries the prebuilt hook bundle and must exist before
      # publishing — use `mix publish`, which builds it first.
      files: ~w(
        lib
        priv/static
        assets/js
        assets/css
        assets/package.json
        assets/tsconfig.json
        .formatter.exs
        mix.exs
        package.json
        README.md
        LICENSE
        CHANGELOG.md
        CONTRIBUTING.md
        CODE_OF_CONDUCT.md
        SECURITY.md
      )
    ]
  end

  defp docs do
    [
      main: "readme",
      source_ref: "v#{@version}",
      source_url: @source_url,
      extras: [
        "README.md",
        "CHANGELOG.md",
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
        "SECURITY.md",
        "LICENSE"
      ],
      groups_for_modules: [
        Core: [
          MaplibreX,
          MaplibreX.Components,
          MaplibreX.Components.Map
        ],
        Overlays: [
          MaplibreX.Components.Marker,
          MaplibreX.Components.Popup
        ],
        Controls: [
          MaplibreX.Components.NavigationControl,
          MaplibreX.Components.ScaleControl,
          MaplibreX.Components.FullscreenControl,
          MaplibreX.Components.GeolocateControl,
          MaplibreX.Components.AttributionControl,
          MaplibreX.Components.TerrainControl,
          MaplibreX.Components.Control,
          MaplibreX.Components.ControlButton,
          MaplibreX.Components.ControlGroup,
          MaplibreX.Components.ZoomRange
        ],
        Layers: [
          MaplibreX.Components.GeoJSONLayer,
          MaplibreX.Components.CircleLayer,
          MaplibreX.Components.LineLayer,
          MaplibreX.Components.FillLayer,
          MaplibreX.Components.SymbolLayer,
          MaplibreX.Components.HeatmapLayer,
          MaplibreX.Components.FillExtrusionLayer,
          MaplibreX.Components.BackgroundLayer,
          MaplibreX.Components.HillshadeLayer,
          MaplibreX.Components.RasterLayer
        ],
        Sources: [
          MaplibreX.Components.VectorTileSource,
          MaplibreX.Components.RasterTileSource,
          MaplibreX.Components.RasterDEMSource,
          MaplibreX.Components.ImageSource,
          MaplibreX.Components.VideoSource
        ],
        "3D & Terrain": [
          MaplibreX.Components.Terrain,
          MaplibreX.Components.Sky
        ],
        "Advanced Integrations": [
          MaplibreX.Components.DeckGlLayer,
          MaplibreX.Components.CustomLayer
        ]
      ]
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "cmd --cd assets npm install"],
      "assets.build": ["esbuild maplibrex"],
      "assets.watch": ["esbuild maplibrex --watch"],
      # Produces the bundle that ships in the Hex package. Uses its own esbuild
      # profile so the output does not depend on MIX_ENV.
      "assets.deploy": ["esbuild maplibrex_release"],
      typecheck: ["cmd --cd assets npx tsc --noEmit"],
      # Hex has no prepublish hook, so the asset build is wired in here. Never
      # run `mix hex.publish` directly or the package ships an empty
      # priv/static. Run this in :dev — hex.publish needs ex_doc to build the
      # documentation, and ex_doc is a dev-only dependency.
      publish: ["assets.deploy", "hex.publish"],
      ci: ["format --check-formatted", "compile --warnings-as-errors", "credo --strict", "test"]
    ]
  end
end
