# LiveSignal Chrome extension (prototype)

This Manifest V3 prototype adapts the active YouTube or Twitch player into two WebMCP tools:

- `get_current_stream_state`
- `jump_to_timestamp`

Load the `extension/` folder as an unpacked extension in Chrome with WebMCP enabled. It intentionally requests no broad host permissions beyond the two supported sites. Captions, event extraction, and watch-rule sync will be added by the LiveSignal event service.
