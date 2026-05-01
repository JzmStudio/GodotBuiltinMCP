# Godot Editor MCP (Model Context Protocol)

内置于 Godot Engine 的 MCP 服务器，允许 AI Agent（如 Claude Code）通过标准 MCP 协议访问 Godot 编辑器的功能。

## 简易使用

可以仅下载 https://github.com/JzmStudio/GodotBuiltinMCP/releases/tag/engine 中的编译好的引擎。

1. 参考官方文档编译引擎。
2. 启动bin中编译好的Godot引擎。
3. 此仓库中.claude文件夹及.mcp.json已经配置好，注意会引用到editor/mcp/godot-mcp.py这个脚本，可以单独下载下来，Claude Code直接定位到此文件夹即可试用。

**此Godot引擎作为方便AI调试之用，现在仅支持读取编辑器报错功能，除MCP外未对Godot做任何修改**

## 功能特性

- **标准 MCP 协议**: 通过 stdio 模式或HTTP与 Claude Code 通信
- **工具调用**: 支持 `ping` 和 `get_errors` 两个工具
- **错误检测**: 获取编辑器底部 Errors 面板中的所有错误
- **零外部依赖**: Python 标准库实现，无需额外安装包

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Claude Code                          │
│                    (MCP Host / Client)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ stdio (stdin/stdout)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    godot-mcp.py                             │
│                  (MCP Bridge)                               │
│   - JSON-RPC 2.0 stdio 通信                                 │
│   - HTTP 转发到 Godot Editor                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Godot Editor                               │
│              (Embedded MCP Server)                           │
│   - TCP 监听 127.0.0.1:29170                                │
│   - JSON-RPC 2.0 over HTTP                                  │
└─────────────────────────────────────────────────────────────┘
```

## 前置要求

- **Python**: 3.7 或更高版本
- **Godot Engine**: 已编译的支持 MCP 的编辑器版本
- **Claude Code**: 支持 MCP stdio 模式的版本

## 快速开始

### 1. 配置 Claude Code

在项目根目录创建或编辑 `.mcp.json` 文件：

```json
{
  "mcpServers": {
    "godot-editor": {
      "command": "python",
      "args": ["editor/mcp/godot-mcp.py"],
      "env": {
        "GODOT_MCP_HOST": "127.0.0.1",
        "GODOT_MCP_PORT": "29170"
      }
    }
  }
}
```

**Windows 用户**如果 `python` 命令不可用，尝试使用 `py` 或 `python3`：

```json
{
  "mcpServers": {
    "godot-editor": {
      "command": "py",
      "args": ["-3", "editor/mcp/godot-mcp.py"]
    }
  }
}
```

### 2. 启动 Godot Editor

确保 Godot Editor 已编译并运行， MCP 服务器会自动在 `127.0.0.1:29170` 启动。

### 3. 重启 Claude Code

添加或修改 `.mcp.json` 后，需要重启 Claude Code 使配置生效。

## 可用工具

### ping

测试与 Godot 编辑器的连接。

**请求参数**: 无

**返回**:

```json
{"pong": true}
```

**Claude Code 示例**:

```
Ask: "Test the Godot editor connection"
```

### get_errors

获取 Godot 编辑器底部 Errors 面板中的所有错误消息。

**请求参数**: 无

**返回**:

```json
[
  {
    "message": "Parser Error: Unexpected token at line 10",
    "type": "error",
    "count": 1
  }
]
```

**Claude Code 示例**:

```
Ask: "What errors are in the Godot editor?"
Ask: "Get the Godot editor errors and help me fix them"
```

## 测试 MCP 服务器

### 手动测试 HTTP 端点

```bash
curl -X POST http://localhost:29170/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":{},"id":1}'
```

### 手动测试 stdio Bridge

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05"},"id":1}' | python editor/mcp/godot-mcp.py
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' | python editor/mcp/godot-mcp.py
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_errors","arguments":{}},"id":3}' | python editor/mcp/godot-mcp.py
```

## 环境变量

| 变量               | 默认值        | 说明                 |
| ------------------ | ------------- | -------------------- |
| `GODOT_MCP_HOST` | `127.0.0.1` | Godot MCP 服务器地址 |
| `GODOT_MCP_PORT` | `29170`     | Godot MCP 服务器端口 |

## 故障排除

### Claude Code 无法发现工具

1. 确认 `.mcp.json` 格式正确
2. 重启 Claude Code
3. 检查 Python 路径是否正确

### Connection Error

**错误**: `Cannot connect to Godot Editor at http://127.0.0.1:29170`

**解决**:

- 确认 Godot Editor 正在运行
- 确认 MCP 服务器已启动（查看编辑器日志中的 `MCPServer: Started` 消息）
- 检查端口是否被占用

### curl 显示 "transfer closed with N bytes remaining to read"

这是旧版本 Godot 的 Content-Length bug。请确保使用最新编译的编辑器。

## MCP 协议版本

- Protocol Version: `2024-11-05`
- JSON-RPC Version: `2.0`

## 文件结构

```
godot-engine/
├── editor/
│   └── mcp/
│       ├── mcp_server.cpp      # Godot 内置 MCP 服务器
│       └── godot-mcp.py       # stdio 桥接脚本
└── .mcp.json                  # Claude Code MCP 配置
```

## 扩展计划

未来可能添加的工具：

- `get_warnings` - 获取警告列表
- `get_console_messages` - 获取控制台输出
- `get_scene_tree` - 获取场景树结构
- `execute_script` - 执行 GDScript 代码片段

## 协议规范

本实现遵循 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 规范。

### 实现的方法

| 方法                          | 说明         |
| ----------------------------- | ------------ |
| `initialize`                | MCP 握手协议 |
| `tools/list`                | 列出可用工具 |
| `tools/call`                | 调用指定工具 |
| `notifications/initialized` | 握手完成通知 |
