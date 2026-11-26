defmodule MaplibreX.Components.Events do
  @moduledoc false

  # The optional `events` attribute of every component that pushes events to
  # the LiveView (#45): a list of event names. Given, it goes into the
  # component's `data-config` and its hook pushes only the events named in it;
  # absent, the config has no `events` key and every event is pushed.

  @doc false
  @spec put(map(), [String.t()] | nil) :: map()
  def put(config, nil), do: config
  def put(config, events) when is_list(events), do: Map.put(config, :events, events)
end
