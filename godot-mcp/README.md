# Godot MCP

Model Context Protocol (MCP) server for Godot engine integration. This server enables AI assistants to interact with the Godot game engine, providing capabilities to:

- Read Godot editor logs
- Launch and control games
- Monitor runtime errors

## Installation

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
GODOT_PATH=C:\Program Files\Godot\Godot.exe
GODOT_LOG_PATH=C:\Users\YourUser\AppData\Roaming\Godot\logs
LOG_LEVEL=INFO
ENABLE_DEBUG=false
```

### Configuration Options

- **GODOT_PATH**: Path to your Godot executable
- **GODOT_LOG_PATH**: Path to Godot log files
- **LOG_LEVEL**: Minimum log level to capture (DEBUG, INFO, WARN, ERROR)
- **ENABLE_DEBUG**: Enable debug output

## Usage

### Building

```bash
npm run build
```

### Running

```bash
npm start
```

### Development

```bash
npm run dev
```

## MCP Tools

### get_editor_logs

Get logs from the Godot editor.

**Parameters:**
- `level` (optional): Filter by log level (DEBUG, INFO, WARN, ERROR)
- `limit` (optional): Maximum number of logs to return
- `offset` (optional): Offset for pagination

**Example:**
```json
{
  "name": "get_editor_logs",
  "arguments": {
    "level": "ERROR",
    "limit": 10
  }
}
```

### run_game

Launch a game in the Godot editor.

**Parameters:**
- `scene_path` (optional): Path to specific scene to launch

**Example:**
```json
{
  "name": "run_game",
  "arguments": {
    "scene_path": "res://scenes/main.tscn"
  }
}
```

### stop_game

Stop the currently running game.

**Example:**
```json
{
  "name": "stop_game"
}
```

### get_game_status

Get the current game status.

**Example:**
```json
{
  "name": "get_game_status"
}
```

### get_runtime_errors

Get runtime errors from the game.

**Parameters:**
- `clear` (optional): Clear error buffer after retrieval

**Example:**
```json
{
  "name": "get_runtime_errors",
  "arguments": {
    "clear": true
  }
}
```

### subscribe_errors

Subscribe to runtime error events (real-time).

## Integration with MCP Clients

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["path/to/godot-mcp/dist/index.js"],
      "env": {
        "GODOT_PATH": "path/to/godot.exe"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["path/to/godot-mcp/dist/index.js"]
    }
  }
}
```

## Development

### Project Structure

```
godot-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # MCP server implementation
│   ├── config.ts          # Configuration management
│   ├── types.ts           # TypeScript interfaces
│   ├── logReader.ts       # Log reading service
│   ├── logWatcher.ts      # Log file watching
│   ├── gameProcess.ts     # Game process management
│   ├── errorParser.ts     # Error parsing from stderr
│   └── errorBuffer.ts     # Error buffer management
├── package.json
├── tsconfig.json
└── .env.example
```

### Testing

```bash
npm test
```

## Troubleshooting

### Godot process won't start

1. Verify GODOT_PATH in configuration
2. Ensure Godot executable has proper permissions
3. Check if another Godot instance is running

### No logs found

1. Verify GODOT_LOG_PATH is correct
2. Ensure Godot has created log files
3. Check log directory permissions

### Errors not captured

1. Ensure you're running in editor mode
2. Check stderr output from Godot
3. Verify error parsing patterns match your Godot version

## License

MIT
