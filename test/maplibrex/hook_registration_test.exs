defmodule MaplibreX.HookRegistrationTest do
  use ExUnit.Case, async: true

  # Every component renders `phx-hook="X"`; LiveView only finds X when it is a
  # key of the `MapHooks` object that applications pass to `LiveSocket`.
  @entry Path.expand("../../assets/js/maplibrex.ts", __DIR__)
  @lib Path.expand("../../lib", __DIR__)

  defp rendered_hooks do
    Path.wildcard(Path.join(@lib, "**/*.ex"))
    |> Enum.flat_map(fn file ->
      Regex.scan(~r/phx-hook="([A-Za-z0-9_]+)"/, File.read!(file), capture: :all_but_first)
    end)
    |> List.flatten()
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp registered_hooks, do: registered_hooks(File.read!(@entry))

  defp registered_hooks(source) do
    [_, body] = Regex.run(~r/export const MapHooks = \{(.*?)\};/s, source)
    body = String.replace(body, ~r{/\*.*?\*/|//[^\n]*}s, "")

    ~r/\b([A-Za-z0-9_]+Hook)\b/
    |> Regex.scan(body, capture: :all_but_first)
    |> List.flatten()
    |> Enum.uniq()
    |> Enum.sort()
  end

  test "a hook named only in a comment does not count as registered" do
    source = """
    export const MapHooks = {
      RealHook, // GhostHook,
      /* BlockGhostHook, */
      OtherHook
    };
    """

    assert registered_hooks(source) == ["OtherHook", "RealHook"]
  end

  test "components render at least one hook" do
    refute rendered_hooks() == []
  end

  test "every phx-hook rendered under lib/ is registered in MapHooks" do
    missing = rendered_hooks() -- registered_hooks()

    assert missing == [],
           "rendered but not registered in MapHooks (assets/js/maplibrex.ts): #{inspect(missing)}"
  end
end
