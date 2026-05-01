#!/usr/bin/env python3
"""
godot-mcp: A stdio-based MCP bridge for Godot Editor

This script implements the MCP (Model Context Protocol) over stdio,
bridging Claude Code's tool invocation to the Godot Editor's HTTP MCP server.

Usage:
    python godot-mcp.py

Environment:
    GODOT_MCP_HOST - Host of Godot MCP server (default: 127.0.0.1)
    GODOT_MCP_PORT - Port of Godot MCP server (default: 29170)
"""

import sys
import json
import urllib.request
import urllib.error
import os
import signal

# Protocol version per MCP spec
MCP_PROTOCOL_VERSION = "2024-11-05"
MCP_SERVER_NAME = "godot-mcp"
MCP_SERVER_VERSION = "1.0.0"

# Godot MCP server connection settings
GODOT_MCP_HOST = os.environ.get("GODOT_MCP_HOST", "127.0.0.1")
GODOT_MCP_PORT = int(os.environ.get("GODOT_MCP_PORT", "29170"))
GODOT_MCP_URL = f"http://{GODOT_MCP_HOST}:{GODOT_MCP_PORT}/mcp"


def check_python_version():
    """Ensure Python 3.7+ is being used."""
    if sys.version_info < (3, 7):
        print("Error: Python 3.7 or higher required", file=sys.stderr)
        sys.exit(1)


def send_jsonrpc(data):
    """Send a JSON-RPC message to stdout."""
    line = json.dumps(data)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def read_jsonrpc():
    """Read a JSON-RPC message from stdin."""
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line.strip())


def create_error_response(code, message, req_id=None):
    """Create a JSON-RPC error response."""
    return {
        "jsonrpc": "2.0",
        "error": {
            "code": code,
            "message": message
        },
        "id": req_id
    }


def create_success_response(result, req_id):
    """Create a JSON-RPC success response."""
    return {
        "jsonrpc": "2.0",
        "result": result,
        "id": req_id
    }


def call_godot_mcp(method, params=None, req_id=None):
    """
    Forward a JSON-RPC request to the Godot Editor MCP server via HTTP.
    Returns the parsed response or an error.
    """
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or {},
        "id": req_id
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            GODOT_MCP_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result

    except urllib.error.URLError as e:
        return create_error_response(
            -32000,
            f"Cannot connect to Godot Editor at {GODOT_MCP_URL}. Is the editor running with MCP server enabled? Error: {str(e)}",
            req_id
        )
    except urllib.error.HTTPError as e:
        return create_error_response(
            -32001,
            f"Godot MCP server returned HTTP error: {e.code} {e.reason}",
            req_id
        )
    except json.JSONDecodeError as e:
        return create_error_response(
            -32700,
            f"Invalid JSON response from Godot MCP server: {str(e)}",
            req_id
        )
    except Exception as e:
        return create_error_response(
            -32603,
            f"Internal error: {str(e)}",
            req_id
        )


def handle_initialize(params, req_id):
    """Handle the MCP initialize request."""
    # We accept the client's protocol version but respond with our own
    return {
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": {}  # We support tools
        },
        "serverInfo": {
            "name": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION
        }
    }


def handle_tools_list(params, req_id):
    """Handle the tools/list request by forwarding to Godot."""
    response = call_godot_mcp("tools/list", params, req_id)

    # Extract result from nested response if needed
    if "result" in response:
        return response["result"]
    elif "error" in response:
        raise Exception(response["error"].get("message", "Unknown error"))
    return response


def handle_tools_call(params, req_id):
    """Handle the tools/call request by forwarding to Godot."""
    tool_name = params.get("name") if isinstance(params, dict) else None
    arguments = params.get("arguments", {}) if isinstance(params, dict) else {}

    if not tool_name:
        raise Exception("Missing 'name' parameter in tools/call")

    # Forward to Godot MCP server
    godot_params = {
        "name": tool_name,
        "arguments": arguments
    }

    response = call_godot_mcp("tools/call", godot_params, req_id)

    # Extract result from nested response if needed
    if "result" in response:
        return response["result"]
    elif "error" in response:
        raise Exception(response["error"].get("message", "Unknown error"))
    return response


def handle_ping(params, req_id):
    """Handle ping request."""
    response = call_godot_mcp("ping", params, req_id)
    if "result" in response:
        return response["result"]
    elif "error" in response:
        raise Exception(response["error"].get("message", "Unknown error"))
    return response


def handle_notification(method, params):
    """Handle notification messages (no response expected)."""
    # Log but don't respond to notifications
    pass


def process_request(request):
    """
    Process a single JSON-RPC request.
    Returns a response dict, or None for notifications.
    """
    if not isinstance(request, dict):
        return create_error_response(-32600, "Invalid Request", None)

    jsonrpc = request.get("jsonrpc")
    if jsonrpc != "2.0":
        return create_error_response(-32600, "Invalid JSON-RPC version", request.get("id"))

    method = request.get("method")
    params = request.get("params")
    req_id = request.get("id")

    # Check if it's a notification (no id)
    is_notification = req_id is None

    try:
        if method == "initialize":
            result = handle_initialize(params, req_id)
            if is_notification:
                return None
            return create_success_response(result, req_id)

        elif method == "tools/list":
            result = handle_tools_list(params, req_id)
            if is_notification:
                return None
            return create_success_response(result, req_id)

        elif method == "tools/call":
            result = handle_tools_call(params, req_id)
            if is_notification:
                return None
            return create_success_response(result, req_id)

        elif method == "ping":
            result = handle_ping(params, req_id)
            if is_notification:
                return None
            return create_success_response(result, req_id)

        elif method.startswith("notifications/"):
            # Handle notifications (no response needed)
            handle_notification(method, params)
            return None

        else:
            # Forward unknown methods to Godot if it might handle them
            response = call_godot_mcp(method, params, req_id)
            return response

    except Exception as e:
        return create_error_response(-32603, f"Internal error: {str(e)}", req_id)


def process_batch(requests):
    """Process a batch of JSON-RPC requests."""
    responses = []
    for req in requests:
        if not isinstance(req, dict):
            responses.append(create_error_response(-32600, "Invalid Request", None))
        else:
            resp = process_request(req)
            if resp is not None:
                responses.append(resp)
    return responses


def main():
    """Main stdio loop."""
    check_python_version()

    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    initialized = False

    while True:
        try:
            request = read_jsonrpc()
            if request is None:
                # EOF or stdin closed
                break

            # Handle batch requests
            if isinstance(request, list):
                responses = process_batch(request)
                for resp in responses:
                    send_jsonrpc(resp)
            else:
                # Handle single request
                resp = process_request(request)

                # Send notifications/initialized after initialize
                if isinstance(request, dict) and request.get("method") == "initialize" and request.get("id") is not None:
                    # Send the initialize response
                    send_jsonrpc(resp)
                    # Then send notifications/initialized
                    send_jsonrpc({
                        "jsonrpc": "2.0",
                        "method": "notifications/initialized",
                        "params": {}
                    })
                    initialized = True
                elif resp is not None:
                    send_jsonrpc(resp)

        except json.JSONDecodeError as e:
            error_resp = create_error_response(-32700, f"Parse error: {str(e)}", None)
            send_jsonrpc(error_resp)
        except Exception as e:
            error_resp = create_error_response(-32603, f"Internal error: {str(e)}", None)
            send_jsonrpc(error_resp)


if __name__ == "__main__":
    main()
