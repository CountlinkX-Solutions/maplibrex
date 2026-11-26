defmodule Mix.Tasks.Maplibrex.CopyWorkerTest do
  # Not async: the tests that use the default paths change the working directory.
  use ExUnit.Case, async: false

  alias Mix.Tasks.Maplibrex.CopyWorker

  @moduletag :tmp_dir

  setup do
    Mix.shell(Mix.Shell.Process)
    on_exit(fn -> Mix.shell(Mix.Shell.IO) end)
  end

  # A maplibre-gl package as npm installs it under `root`, with `files` in its dist/.
  defp install_maplibre(root, version, files) do
    package = Path.join(root, "assets/node_modules/maplibre-gl")
    dist = Path.join(package, "dist")
    File.mkdir_p!(dist)

    File.write!(
      Path.join(package, "package.json"),
      ~s({"name": "maplibre-gl", "version": "#{version}"})
    )

    for file <- files, do: File.write!(Path.join(dist, file), "// #{file} #{version}\n")
    dist
  end

  defp info do
    assert_received {:mix_shell, :info, [message]}
    refute_received {:mix_shell, :info, _}
    message
  end

  test "copies the worker and the shared chunk of maplibre-gl 6 before 6.13", %{tmp_dir: tmp} do
    from =
      install_maplibre(
        tmp,
        "6.5.0",
        ~w(maplibre-gl.mjs maplibre-gl-worker.mjs maplibre-gl-shared.mjs)
      )

    to = Path.join(tmp, "out/js")

    CopyWorker.run(["--from", from, "--to", to])

    assert File.ls!(to) |> Enum.sort() == ~w(maplibre-gl-shared.mjs maplibre-gl-worker.mjs)

    assert File.read!(Path.join(to, "maplibre-gl-worker.mjs")) ==
             File.read!(Path.join(from, "maplibre-gl-worker.mjs"))

    assert File.read!(Path.join(to, "maplibre-gl-shared.mjs")) ==
             File.read!(Path.join(from, "maplibre-gl-shared.mjs"))

    assert info() =~ "maplibre-gl-worker.mjs and maplibre-gl-shared.mjs"
  end

  test "copies only the worker when maplibre-gl has no shared chunk", %{tmp_dir: tmp} do
    from = install_maplibre(tmp, "6.19.0", ~w(maplibre-gl.mjs maplibre-gl-worker.mjs))
    to = Path.join(tmp, "out/js")

    CopyWorker.run(["--from", from, "--to", to])

    assert File.ls!(to) == ["maplibre-gl-worker.mjs"]
    assert info() =~ "maplibre-gl-worker.mjs"
  end

  test "copies nothing for maplibre-gl 5 and says why in one line", %{tmp_dir: tmp} do
    from = install_maplibre(tmp, "5.24.0", ~w(maplibre-gl.js maplibre-gl-csp-worker.js))
    to = Path.join(tmp, "out/js")

    CopyWorker.run(["--from", from, "--to", to])

    refute File.exists?(to)
    message = info()
    assert message =~ "5.24.0"
    assert message =~ "nothing to copy"
    refute message =~ "\n"
  end

  test "copies nothing when maplibre-gl is not installed and says why in one line", %{
    tmp_dir: tmp
  } do
    from = Path.join(tmp, "assets/node_modules/maplibre-gl/dist")
    to = Path.join(tmp, "out/js")

    CopyWorker.run(["--from", from, "--to", to])

    refute File.exists?(to)
    message = info()
    assert message =~ "not installed"
    assert message =~ "nothing to copy"
    refute message =~ "\n"
  end

  test "can run again: the copies are replaced, nothing else changes", %{tmp_dir: tmp} do
    from = install_maplibre(tmp, "6.5.0", ~w(maplibre-gl-worker.mjs maplibre-gl-shared.mjs))
    to = Path.join(tmp, "out/js")
    File.mkdir_p!(to)
    File.write!(Path.join(to, "app.js"), "// app\n")

    CopyWorker.run(["--from", from, "--to", to])
    File.write!(Path.join(from, "maplibre-gl-worker.mjs"), "// upgraded\n")
    CopyWorker.run(["--from", from, "--to", to])

    assert File.ls!(to) |> Enum.sort() == ~w(app.js maplibre-gl-shared.mjs maplibre-gl-worker.mjs)
    assert File.read!(Path.join(to, "maplibre-gl-worker.mjs")) == "// upgraded\n"
    assert File.read!(Path.join(to, "app.js")) == "// app\n"
  end

  test "reads from assets/node_modules and writes to priv/static/assets/js by default", %{
    tmp_dir: tmp
  } do
    install_maplibre(tmp, "6.5.0", ~w(maplibre-gl-worker.mjs maplibre-gl-shared.mjs))

    File.cd!(tmp, fn -> CopyWorker.run([]) end)

    assert File.ls!(Path.join(tmp, "priv/static/assets/js")) |> Enum.sort() ==
             ~w(maplibre-gl-shared.mjs maplibre-gl-worker.mjs)
  end

  test "by default, in an application without maplibre-gl, copies nothing and succeeds", %{
    tmp_dir: tmp
  } do
    File.cd!(tmp, fn -> CopyWorker.run([]) end)

    refute File.exists?(Path.join(tmp, "priv"))
    assert info() =~ "not installed"
  end

  test "refuses an unknown option" do
    assert_raise Mix.Error, ~r/--form/, fn -> CopyWorker.run(["--form", "x"]) end
  end

  test "is documented for mix help" do
    assert Mix.Task.shortdoc(CopyWorker) =~ "worker"
    assert Mix.Task.moduledoc(CopyWorker) =~ "--from"
  end
end
