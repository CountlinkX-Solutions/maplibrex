defmodule Mix.Tasks.Maplibrex.CopyWorker do
  @shortdoc "Copies the maplibre-gl 6 worker files next to app.js"

  @moduledoc """
  Copies the worker files of maplibre-gl 6 into the application's static
  assets, where `setWorkerUrl` points MapLibre at them.

      $ mix maplibrex.copy_worker [--from DIR] [--to DIR]

  maplibre-gl 6 starts its worker from a separate file,
  `maplibre-gl-worker.mjs`, which esbuild does not copy into the build. This
  task copies it, and `maplibre-gl-shared.mjs` (which the worker of releases
  before 6.13 imports) when the installed maplibre-gl has it, from `--from` to
  `--to`, creating `--to` if needed. Running it again copies the files again
  and changes nothing else.

  With maplibre-gl 5, which carries its worker inside its own bundle, or when
  maplibre-gl is not installed, it copies nothing, says why in one line and
  succeeds. So it is safe in the asset aliases of any application, in
  `mix.exs`:

      "assets.build": ["compile", "tailwind my_app", "esbuild my_app", "maplibrex.copy_worker"],
      "assets.deploy": [
        "tailwind my_app --minify",
        "esbuild my_app --minify",
        "maplibrex.copy_worker",
        "phx.digest"
      ]

  ## Options

    * `--from` - the `dist` directory of the installed maplibre-gl.
      Defaults to `assets/node_modules/maplibre-gl/dist`
    * `--to` - where the application serves `app.js` from. Defaults to
      `priv/static/assets/js`
  """

  use Mix.Task

  @default_from "assets/node_modules/maplibre-gl/dist"
  @default_to "priv/static/assets/js"
  @worker "maplibre-gl-worker.mjs"
  @shared "maplibre-gl-shared.mjs"

  @impl Mix.Task
  def run(args) do
    {opts, _args, invalid} = OptionParser.parse(args, strict: [from: :string, to: :string])

    if invalid != [] do
      options = Enum.map_join(invalid, ", ", fn {option, _value} -> option end)
      Mix.raise("maplibrex.copy_worker: unknown option #{options}; it takes --from and --to")
    end

    from = Keyword.get(opts, :from, @default_from)
    to = Keyword.get(opts, :to, @default_to)

    if File.regular?(Path.join(from, @worker)) do
      copy(from, to)
    else
      Mix.shell().info("maplibrex.copy_worker: #{why_no_worker(from)}, nothing to copy")
    end
  end

  defp copy(from, to) do
    files = Enum.filter([@worker, @shared], &File.regular?(Path.join(from, &1)))
    File.mkdir_p!(to)
    Enum.each(files, &File.cp!(Path.join(from, &1), Path.join(to, &1)))

    Mix.shell().info(
      "maplibrex.copy_worker: copied #{Enum.join(files, " and ")} from #{from} to #{to}"
    )
  end

  # Why `from` has no worker file: the version of the maplibre-gl it belongs
  # to, read from the package.json next to it, when there is one.
  defp why_no_worker(from) do
    case version(Path.join(Path.dirname(from), "package.json")) do
      nil -> "maplibre-gl is not installed in #{from}"
      "5." <> _ = version -> "maplibre-gl #{version} carries its worker in its own bundle"
      version -> "maplibre-gl #{version} has no #{@worker} in #{from}"
    end
  end

  defp version(package_json) do
    with {:ok, json} <- File.read(package_json),
         [_, version] <- Regex.run(~r/"version"\s*:\s*"([^"]+)"/, json) do
      version
    else
      _ -> nil
    end
  end
end
