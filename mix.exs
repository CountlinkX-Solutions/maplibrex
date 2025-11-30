defmodule MaplibreX.MixProject do
  use Mix.Project

  @version "0.1.0"
  @source_url "https://github.com/tu-usuario/maplibrex"

  def project do
    [
      app: :maplibrex,
      version: @version,
      elixir: "~> 1.14",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      description: description(),
      package: package(),
      docs: docs(),
      name: "MaplibreX",
      source_url: @source_url
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Phoenix & LiveView
      {:phoenix, "~> 1.7.0"},
      {:phoenix_html, "~> 4.0"},
      {:phoenix_live_view, "~> 1.0"},
      {:jason, "~> 1.4"},

      # Asset building
      {:esbuild, "~> 0.8", runtime: Mix.env() == :dev},

      # Testing
      {:floki, ">= 0.30.0", only: :test},
      {:wallaby, "~> 0.30", runtime: false, only: :test},
      {:phoenix_live_reload, "~> 1.2", only: :dev},

      # Documentation
      {:ex_doc, "~> 0.31", only: :dev, runtime: false}
    ]
  end

  defp description do
    """
    MapLibre GL JS components for Phoenix LiveView.
    A declarative and reactive way to build interactive maps in Elixir.
    """
  end

  defp package do
    [
      maintainers: ["Your Name"],
      licenses: ["MIT"],
      links: %{
        "GitHub" => @source_url,
        "Changelog" => "#{@source_url}/blob/main/CHANGELOG.md"
      },
      files: ~w(
        lib
        priv
        assets/js
        assets/css
        assets/package.json
        assets/tsconfig.json
        .formatter.exs
        mix.exs
        README.md
        LICENSE
        CHANGELOG.md
      )
    ]
  end

  defp docs do
    [
      main: "MaplibreX",
      source_ref: "v#{@version}",
      source_url: @source_url,
      extras: ["README.md", "CHANGELOG.md"],
      groups_for_modules: [
        Components: [
          MaplibreX.Components.Map,
          MaplibreX.Components.Marker,
          MaplibreX.Components.Popup
        ],
        Controls: [
          MaplibreX.Components.NavigationControl,
          MaplibreX.Components.ScaleControl
        ],
        Layers: [
          MaplibreX.Components.GeoJSONLayer
        ],
        Sources: [
          MaplibreX.Components.GeoJSONSource
        ]
      ]
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "cmd --cd assets npm install"],
      "assets.build": ["esbuild maplibrex --minify"],
      "assets.watch": ["esbuild maplibrex --watch"],
      test: ["assets.build", "test"]
    ]
  end
end
