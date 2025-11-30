defmodule MaplibreX.Components.Popup do
  @moduledoc """
  Popup component for displaying information on MapLibre maps.

  Popups are independent overlays that can be positioned at specific coordinates
  or attached to markers. They support both plain text and HTML content.

  ## Examples

  Basic popup with text:

      <.popup
        id="info-popup"
        map_id="my-map"
        lng_lat={[-74.5, 40]}
      >
        <p>New York City</p>
      </.popup>

  Popup with custom styling and options:

      <.popup
        id="styled-popup"
        map_id="my-map"
        lng_lat={[-122.4, 37.8]}
        max_width="300px"
        close_button
        close_on_click
        anchor="bottom"
        class="custom-popup"
      >
        <div>
          <h3>San Francisco</h3>
          <p>The Golden Gate City</p>
        </div>
      </.popup>

  Popup controlled by LiveView state:

      def render(assigns) do
        ~H\"\"\"
        <.popup
          id="dynamic-popup"
          map_id="my-map"
          lng_lat={@popup_location}
          open={@show_popup}
        >
          <%= @popup_content %>
        </.popup>
        \"\"\"
      end

      def handle_event("map:clicked", %{"lngLat" => [lng, lat]}, socket) do
        {:noreply,
         assign(socket,
           show_popup: true,
           popup_location: [lng, lat],
           popup_content: "Clicked at coordinates"
         )}
      end
  """

  use Phoenix.Component
  alias Phoenix.LiveView.JS

  @doc """
  Renders a popup on the map.

  ## Attributes

  * `id` (required) - Unique identifier for the popup
  * `map_id` (required) - ID of the map to add the popup to
  * `lng_lat` - Popup position as `[longitude, latitude]`. If not provided, popup will be created but not displayed until positioned
  * `max_width` - Maximum width of the popup. Defaults to `"240px"`
  * `close_button` - Show close button. Defaults to `true`
  * `close_on_click` - Close popup when clicking on the map. Defaults to `true`
  * `close_on_move` - Close popup when moving the map. Defaults to `false`
  * `anchor` - Popup anchor point. One of: `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`, `"auto"`. Defaults to `"auto"`
  * `offset` - Pixel offset as `[x, y]` or single number for all sides
  * `class_name` - CSS class name for the popup container
  * `open` - Whether the popup should be open. Defaults to `true` when `lng_lat` is provided

  ## Slots

  * `inner_block` (required) - The content to display in the popup

  ## Events

  The popup emits the following events:

  * `popup:opened` - Fired when the popup is opened
  * `popup:closed` - Fired when the popup is closed

  ## JavaScript Commands

  You can control popups from LiveView using:

      # Open popup at specific location
      MaplibreX.Components.Popup.open("popup-id", [-74.5, 40])

      # Close popup
      MaplibreX.Components.Popup.close("popup-id")

      # Toggle popup
      MaplibreX.Components.Popup.toggle("popup-id")

      # Update popup content
      MaplibreX.Components.Popup.set_content("popup-id", "<h3>New Content</h3>")
  """
  attr :id, :string, required: true
  attr :map_id, :string, required: true
  attr :lng_lat, :list, default: nil
  attr :max_width, :string, default: "240px"
  attr :close_button, :boolean, default: true
  attr :close_on_click, :boolean, default: true
  attr :close_on_move, :boolean, default: false
  attr :anchor, :string, default: "auto"
  attr :offset, :any, default: nil
  attr :class_name, :string, default: nil
  attr :open, :boolean, default: nil
  attr :rest, :global

  slot :inner_block, required: true

  def popup(assigns) do
    # Determine if popup should be open by default
    open =
      cond do
        assigns.open != nil -> assigns.open
        assigns.lng_lat != nil -> true
        true -> false
      end

    # Build popup configuration
    config =
      %{
        id: assigns.id,
        mapId: assigns.map_id,
        maxWidth: assigns.max_width,
        closeButton: assigns.close_button,
        closeOnClick: assigns.close_on_click,
        closeOnMove: assigns.close_on_move,
        anchor: assigns.anchor,
        open: open
      }
      |> maybe_put(:lngLat, assigns.lng_lat)
      |> maybe_put(:offset, assigns.offset)
      |> maybe_put(:className, assigns.class_name)

    assigns =
      assigns
      |> assign(:config, Jason.encode!(config))
      |> assign(:open, open)

    ~H"""
    <div
      id={@id}
      phx-hook="PopupHook"
      data-config={@config}
      style="display: none;"
      {@rest}
    >
      <div id={"#{@id}-content"} data-popup-content>
        <%= render_slot(@inner_block) %>
      </div>
    </div>
    """
  end

  # Private helper to conditionally add keys to a map
  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  @doc """
  Opens a popup at the specified coordinates.

  ## Examples

      <button phx-click={MaplibreX.Components.Popup.open("my-popup", [-74.5, 40])}>
        Show Popup
      </button>
  """
  def open(popup_id, lng_lat) when is_list(lng_lat) do
    JS.push("popup:open",
      value: %{popup_id: popup_id, lng_lat: lng_lat},
      target: "##{popup_id}"
    )
  end

  @doc """
  Closes a popup.

  ## Examples

      <button phx-click={MaplibreX.Components.Popup.close("my-popup")}>
        Hide Popup
      </button>
  """
  def close(popup_id) do
    JS.push("popup:close",
      value: %{popup_id: popup_id},
      target: "##{popup_id}"
    )
  end

  @doc """
  Toggles a popup's visibility.

  ## Examples

      <button phx-click={MaplibreX.Components.Popup.toggle("my-popup")}>
        Toggle Popup
      </button>
  """
  def toggle(popup_id) do
    JS.push("popup:toggle",
      value: %{popup_id: popup_id},
      target: "##{popup_id}"
    )
  end

  @doc """
  Sets the popup location without opening it.

  ## Examples

      <button phx-click={MaplibreX.Components.Popup.set_location("my-popup", [-74.5, 40])}>
        Move Popup
      </button>
  """
  def set_location(popup_id, lng_lat) when is_list(lng_lat) do
    JS.push("popup:set_location",
      value: %{popup_id: popup_id, lng_lat: lng_lat},
      target: "##{popup_id}"
    )
  end
end
