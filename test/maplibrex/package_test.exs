defmodule MaplibreX.PackageTest do
  use ExUnit.Case, async: true

  # `mix hex.build` packages what the `files` entries of `package` in mix.exs
  # match: each entry is a wildcard, and a directory brings everything under
  # it. `mix assets.deploy` writes the bundle's source map next to the bundle;
  # it is git-ignored, so whether a `priv/static` entry shipped it depended on
  # the publisher's working tree (#50).

  @files Mix.Project.config()[:package][:files]
  @bundle "priv/static/assets/js/maplibrex.js"

  # What `mix hex.build` would package from `root`, as paths relative to it.
  defp packaged(root) do
    @files
    |> Enum.flat_map(&Path.wildcard(Path.join(root, &1)))
    |> Enum.flat_map(&regular_files/1)
    |> Enum.map(&Path.relative_to(&1, root))
    |> Enum.uniq()
  end

  defp regular_files(path) do
    if File.dir?(path) do
      path |> File.ls!() |> Enum.flat_map(&regular_files(Path.join(path, &1)))
    else
      [path]
    end
  end

  @tag :tmp_dir
  test "ships the bundle and nothing else from priv, whatever else a publisher's priv/static holds",
       %{tmp_dir: root} do
    for file <- [
          @bundle,
          "#{@bundle}.map",
          "priv/static/assets/js/maplibre-gl-worker.mjs",
          "priv/static/assets/app.css"
        ] do
      path = Path.join(root, file)
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, "")
    end

    assert Enum.filter(packaged(root), &String.starts_with?(&1, "priv/")) == [@bundle]
  end

  test "every entry of files matches something in the checkout" do
    for entry <- @files do
      assert Path.wildcard(entry, match_dot: true) != [], "#{entry} matches nothing"
    end
  end

  test "the bundle loads no other file of its own: no chunk, no source map" do
    bundle = File.read!(@bundle)

    refute bundle =~ ~r/(?:\bfrom|\bimport)\s*\(?\s*["']\.{1,2}\//,
           "the bundle imports a file of its own"

    refute bundle =~ "sourceMappingURL"
  end
end
