%{
  configs: [
    %{
      name: "default",
      files: %{
        included: ["lib/", "test/", "config/", "mix.exs"],
        excluded: [~r"/_build/", ~r"/deps/", ~r"/node_modules/"]
      },
      strict: true,
      checks: %{
        disabled: [
          # Tests deliberately call components through their full module path —
          # it is the clearest way to show which component is under test.
          {Credo.Check.Design.AliasUsage, []},
          # Component moduledocs carry long HEEx examples that read worse wrapped.
          {Credo.Check.Readability.MaxLineLength, []}
        ]
      }
    }
  ]
}
