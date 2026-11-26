defmodule MaplibreXTest do
  use ExUnit.Case
  doctest MaplibreX

  describe "MaplibreX module" do
    test "exports correct version" do
      assert MaplibreX.version() == "0.1.1"
    end
  end
end
