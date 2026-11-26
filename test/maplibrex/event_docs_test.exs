defmodule MaplibreX.EventDocsTest do
  use ExUnit.Case, async: true

  # The hooks push `layer:feature_clicked`; docs that say `layer:feature_click`
  # send readers to a handle_event clause that never matches.
  @docs [
    Path.expand("../../README.md", __DIR__),
    Path.expand("../../lib/maplibrex.ex", __DIR__)
  ]

  for path <- @docs do
    test "#{Path.basename(path)} names the event layer:feature_clicked" do
      content = File.read!(unquote(path))

      refute Regex.match?(~r/layer:feature_click(?!ed)/, content),
             "found `layer:feature_click`; the emitted event is `layer:feature_clicked`"

      assert content =~ "layer:feature_clicked"
    end
  end
end
