# Contributing to MaplibreX

Thanks for taking the time to contribute. Bug reports, documentation fixes and
pull requests are all welcome.

## Getting set up

```bash
git clone https://github.com/CountlinkX-Solutions/maplibrex.git
cd maplibrex
mix setup      # fetches Elixir deps and runs npm install in assets/
mix test       # should print "405 tests, 0 failures"
```

You need Elixir 1.14+, Erlang/OTP 25+ and Node 18+.

## Before you open a pull request

```bash
mix ci         # format check, warnings-as-errors, credo --strict, tests
mix typecheck  # tsc --noEmit over the TypeScript hooks
```

Both must pass. CI runs the same commands.

## Working on a component

A MaplibreX component is two halves that have to agree:

1. **The Elixir component** in `lib/maplibrex/components/`. It validates its
   attributes, serialises a config map to JSON, and renders a `<div>` carrying
   `phx-hook` and `data-config`.
2. **The TypeScript hook** in `assets/js/maplibrex/hooks/`. It reads
   `data-config`, talks to MapLibre GL JS, and implements `mounted`, `updated`
   and `destroyed`.

When adding one, please also:

- Register it in `lib/maplibrex/components.ex` and `assets/js/maplibrex/hooks/index.ts`
- Export its hook from `assets/js/maplibrex.ts`
- Add it to the right group in `docs/` in `mix.exs`
- Write tests in `test/maplibrex/components/` — cover the rendered output,
  attribute validation and edge cases
- Document attributes, events and at least one example in the `@moduledoc`
- Add a CHANGELOG entry under `## [Unreleased]`

## The committed bundle

`priv/static/assets/js/maplibrex.js` is a build artifact that is checked in on
purpose. Applications that depend on MaplibreX through git have no build step
for it, so the file has to exist in the repository — the same reason phoenix
and phoenix_live_view commit theirs.

If you touch anything under `assets/js/`, rebuild it and commit the result:

```bash
MIX_ENV=prod mix assets.deploy
```

CI fails if you forget.

## Conventions

- **Language**: all code, comments, documentation and commit messages are in
  English.
- **Naming**: Elixir attributes are `snake_case`; they are converted to
  MapLibre's `camelCase` when building the config map.
- **Cleanup**: every hook must remove its layers, sources, listeners and
  controls in `destroyed`. Leaks show up immediately under LiveView navigation.
- **Logging**: use `logger.debug` from `core/logger` for lifecycle output — it
  is silent unless debugging is enabled. Reserve `console.warn`/`console.error`
  for genuine problems.
- **No new bundled dependencies**: anything large enough to matter belongs in
  `peerDependencies` and gets marked external in `config/config.exs`.

## Commit messages

Conventional Commits, e.g. `feat: add ContourLayer component`,
`fix(marker): clear drag listeners on destroy`, `docs: ...`.

## Reporting bugs

Please include your Elixir, LiveView, MapLibre GL and MaplibreX versions, a
minimal LiveView that reproduces the issue, and anything the browser console
printed with `window.__MAPLIBREX_DEBUG__ = true`.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
