/**************************************************************************/
/*  mcp_server.cpp                                                        */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT ENGINE                               */
/*                        https://godotengine.org                         */
/**************************************************************************/
/* Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md). */
/* Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.                  */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

#include "mcp_server.h"

#include "core/io/json.h"
#include "core/io/tcp_server.h"
#include "core/io/stream_peer_tcp.h"
#include "core/object/callable_mp.h"
#include "core/object/class_db.h"
#include "core/os/os.h"
#include "core/string/print_string.h"
#include "editor/editor_log.h"
#include "editor/editor_node.h"
#include "scene/main/timer.h"

void MCPServer::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start", "port"), &MCPServer::start, DEFVAL(29170));
	ClassDB::bind_method(D_METHOD("stop"), &MCPServer::stop);
	ClassDB::bind_method(D_METHOD("is_running"), &MCPServer::is_running);
	ClassDB::bind_method(D_METHOD("get_port"), &MCPServer::get_port);
	ClassDB::bind_method(D_METHOD("get_errors"), &MCPServer::get_errors);
}

MCPServer::MCPServer() {
	server.instantiate();
	running = false;
	port = 29170;
}

void MCPServer::start_server() {
	// Create a timer to poll for connections at 100ms interval
	Timer *timer = memnew(Timer);
	timer->set_wait_time(0.1);
	timer->set_one_shot(false);
	timer->set_autostart(true);
	timer->connect("timeout", callable_mp(this, &MCPServer::_on_poll_timeout));
	add_child(timer);
	print_line("MCPServer: Timer started for connection polling");
}

void MCPServer::_on_poll_timeout() {
	if (!running || !server.is_valid()) {
		return;
	}

	if (server->is_connection_available()) {
		Ref<StreamPeerTCP> client = server->take_connection();
		if (client.is_valid()) {
			print_line("MCPServer: Client connected!");
			_handle_client_request(client.ptr());
		}
	}
}

MCPServer::~MCPServer() {
	stop();
}

bool MCPServer::start(int p_port) {
	if (running) {
		print_line("MCPServer: Already running");
		return true;
	}

	port = p_port;
	server.instantiate();

	// Try to listen on the specified port, with fallback to subsequent ports
	int attempts = 0;
	int current_port = port;
	while (attempts < 10) {
		Error err = server->listen(current_port, bind_address);
		if (err == OK) {
			port = current_port;
			running = true;
			print_line("MCPServer: Started on http://" + bind_address + ":" + itos(port));
			start_server();
			return true;
		}
		attempts++;
		current_port++;
	}

	print_line("MCPServer: Failed to start on ports " + itos(port) + " to " + itos(current_port - 1));
	server.unref();
	return false;
}

void MCPServer::stop() {
	if (!running) {
		return;
	}

	running = false;

	if (server.is_valid()) {
		server->stop();
		server.unref();
	}

	print_line("MCPServer: Stopped");
}

void MCPServer::_handle_client_request(StreamPeerTCP *p_client) {
	print_line("MCPServer: Handling client request...");
	// Read the HTTP request line
	String request_line = _read_http_request(p_client);
	print_line("MCPServer: Request line: " + request_line);
	if (request_line.is_empty()) {
		return;
	}

	// Parse request line: "POST /mcp HTTP/1.1"
	Vector<String> parts = request_line.split(" ");
	if (parts.size() < 3) {
		return;
	}

	String method = parts[0];
	String path = parts[1];

	// Read headers
	HashMap<String, String> headers;
	String line = _read_http_request(p_client);
	while (!line.is_empty()) {
		int colon_pos = line.find(": ");
		if (colon_pos >= 0) {
			String key = line.substr(0, colon_pos).to_lower();
			String value = line.substr(colon_pos + 2, line.length() - colon_pos - 2);
			headers[key] = value;
		}
		line = _read_http_request(p_client);
	}

	// Read body if Content-Length is present
	String body;
	if (headers.has("content-length")) {
		int content_length = headers["content-length"].to_int();
		if (content_length > 0 && content_length < 1048576) { // Limit to 1MB
			Vector<char> buffer;
			buffer.resize(content_length);
			int bytes_read = 0;
			while (bytes_read < content_length) {
				p_client->poll();
				int available = p_client->get_available_bytes();
				if (available > 0) {
					int to_read = MIN(content_length - bytes_read, available);
					uint8_t temp_buf[1024];
					int to_read_this_time = MIN(to_read, 1024);
					Error err = p_client->get_data(temp_buf, to_read_this_time);
					if (err == OK) {
						for (int i = 0; i < to_read_this_time && bytes_read < content_length; i++) {
							buffer.write[bytes_read++] = (char)temp_buf[i];
						}
					} else {
						break;
					}
				} else {
					// Small delay to allow more data to arrive
					OS::get_singleton()->delay_usec(1000);
					if (bytes_read < content_length) {
						// Timeout after a while
						int wait_count = 0;
						while (bytes_read < content_length && wait_count < 1000) {
							p_client->poll();
							if (p_client->get_available_bytes() > 0) {
								break;
							}
							OS::get_singleton()->delay_usec(1000);
							wait_count++;
						}
						break;
					}
				}
			}
			body = String::utf8(buffer.ptr(), bytes_read);
		}
	}

	String response;
	int status_code = 200;
	String content_type = "application/json";

	if (method == "OPTIONS") {
		// CORS preflight
		response = "";
		status_code = 200;
		content_type = "text/plain";
	} else if (method == "POST" && path == "/mcp") {
		// Handle MCP JSON-RPC request (single or batch)
		Variant parsed = JSON::parse_string(body);
		if (parsed.get_type() == Variant::NIL) {
			response = "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32600,\"message\":\"Parse error\"},\"id\":null}";
		} else if (parsed.get_type() == Variant::ARRAY) {
			// Handle batch requests
			Array requests = parsed;
			Array responses;
			for (int i = 0; i < requests.size(); i++) {
				if (requests[i].get_type() == Variant::DICTIONARY) {
					Dictionary req = requests[i];
					String resp = _handle_jsonrpc_request(req);
					if (!resp.is_empty()) {
						Variant resp_parsed = JSON::parse_string(resp);
						if (resp_parsed.get_type() == Variant::DICTIONARY) {
							responses.push_back(resp_parsed);
						}
					}
				}
			}
			response = JSON::stringify(responses);
		} else if (parsed.get_type() == Variant::DICTIONARY) {
			Dictionary json_request = parsed;
			response = _handle_jsonrpc_request(json_request);
		} else {
			response = "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32600,\"message\":\"Invalid Request\"},\"id\":null}";
		}
	} else {
		// Not found
		status_code = 404;
		content_type = "text/html";
		response = "{\"error\": \"Not found\"}";
	}

	// Send HTTP response
	// First get UTF-8 size of just the body
	Vector<uint8_t> body_bytes = response.to_utf8_buffer();
	int body_size = body_bytes.size();

	// Build full HTTP response with correct Content-Length
	String http_response;
	http_response = "HTTP/1.1 " + itos(status_code) + " OK\r\n";
	http_response += "Content-Type: " + content_type + "\r\n";
	http_response += "Content-Length: " + itos(body_size) + "\r\n";
	http_response += "Access-Control-Allow-Origin: *\r\n";
	http_response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
	http_response += "Access-Control-Allow-Headers: Content-Type\r\n";
	http_response += "\r\n";
	http_response += response;

	Vector<uint8_t> response_data = http_response.to_utf8_buffer();
	p_client->put_data(response_data.ptr(), response_data.size());
	p_client->disconnect_from_host();
}

String MCPServer::_read_http_request(StreamPeerTCP *p_client) {
	String line;
	int timeout_count = 0;

	while (timeout_count < 100) {
		p_client->poll();
		int available = p_client->get_available_bytes();
		if (available > 0) {
			uint8_t byte;
			Error err = p_client->get_data(&byte, 1);
			if (err == OK) {
				char c = (char)byte;
				if (c == '\n') {
					break;
				} else if (c != '\r') {
					line += c;
				}
			}
		} else {
			OS::get_singleton()->delay_usec(1000);
			timeout_count++;
		}
	}

	return line.strip_edges();
}

Dictionary MCPServer::_parse_jsonrpc(const String &p_json) {
	Dictionary result;
	if (p_json.is_empty()) {
		result["error"] = "Parse error";
		return result;
	}

	Variant parsed = JSON::parse_string(p_json);
	if (parsed.get_type() == Variant::NIL) {
		result["error"] = "Parse error";
		return result;
	}

	if (parsed.get_type() != Variant::DICTIONARY) {
		result["error"] = "Invalid request format";
		return result;
	}

	return parsed;
}

String MCPServer::_handle_jsonrpc_request(const Dictionary &p_request) {
	if (p_request.has("error")) {
		return _create_jsonrpc_error(-32600, "Invalid Request", p_request.get("id", Variant()));
	}

	String method = p_request.get("method", "");
	Variant id = p_request.get("id", Variant());
	Variant params = p_request.get("params", Variant());

	if (method == "get_errors") {
		Array errors = get_errors();
		return _create_jsonrpc_response(errors, id);
	} else if (method == "ping") {
		Dictionary pong_result;
		pong_result["pong"] = true;
		return _create_jsonrpc_response(pong_result, id);
	} else if (method == "rpc.listMethods") {
		// Return list of all available methods
		Array methods;
		methods.push_back("ping");
		methods.push_back("get_errors");
		methods.push_back("rpc.listMethods");
		methods.push_back("rpc.call");
		methods.push_back("rpc.parse_request");
		methods.push_back("rpc.parse_response");
		methods.push_back("rpc.serialize");
		methods.push_back("initialize");
		methods.push_back("tools/list");
		methods.push_back("tools/call");
		methods.push_back("prompt/create");
		methods.push_back("prompt/list");
		methods.push_back("prompt/delete");
		return _create_jsonrpc_response(methods, id);
	} else if (method == "initialize") {
		// Standard MCP initialize method
		Dictionary result;
		result["protocolVersion"] = "2024-11-05";
		Dictionary capabilities;
		capabilities["tools"] = true;
		result["capabilities"] = capabilities;
		Dictionary server_info;
		server_info["name"] = "godot-editor-mcp";
		server_info["version"] = "1.0.0";
		result["serverInfo"] = server_info;
		return _create_jsonrpc_response(result, id);
	} else if (method == "tools/list") {
		// Return list of available tools with proper JSON Schema
		Dictionary result;
		Array tools;

		// ping tool
		Dictionary ping_tool;
		ping_tool["name"] = "ping";
		ping_tool["description"] = "Test connection to Godot editor. Returns pong: true if successful.";
		Dictionary ping_schema;
		ping_schema["type"] = "object";
		ping_schema["properties"] = Dictionary();
		ping_schema["required"] = Array();
		ping_tool["inputSchema"] = ping_schema;
		tools.push_back(ping_tool);

		// get_errors tool
		Dictionary errors_tool;
		errors_tool["name"] = "get_errors";
		errors_tool["description"] = "获取 Godot 编辑器底部 Errors 面板中的所有错误消息。Returns a list of errors from the Godot editor's error panel.";
		Dictionary errors_schema;
		errors_schema["type"] = "object";
		errors_schema["properties"] = Dictionary();
		errors_schema["required"] = Array();
		errors_tool["inputSchema"] = errors_schema;
		tools.push_back(errors_tool);

		result["tools"] = tools;
		return _create_jsonrpc_response(result, id);
	} else if (method == "tools/call") {
		// Call a tool by name with input
		if (params.get_type() != Variant::DICTIONARY) {
			return _create_jsonrpc_error(-32602, "Invalid params: expected object with 'name' and 'arguments'", id);
		}
		Dictionary call_params = params;
		if (!call_params.has("name")) {
			return _create_jsonrpc_error(-32602, "Invalid params: missing 'name' field", id);
		}
		String tool_name = call_params["name"];
		Dictionary arguments = call_params.has("arguments") ? (Dictionary)call_params["arguments"] : Dictionary();
		if (tool_name == "ping") {
			Dictionary tool_result;
			tool_result["pong"] = true;
			Dictionary content;
			content["type"] = "text";
			content["text"] = "{\"pong\": true}";
			Array content_arr;
			content_arr.push_back(content);
			Dictionary result;
			result["content"] = content_arr;
			return _create_jsonrpc_response(result, id);
		} else if (tool_name == "get_errors") {
			Array errors = get_errors();
			Dictionary content;
			content["type"] = "text";
			content["text"] = JSON::stringify(errors);
			Array content_arr;
			content_arr.push_back(content);
			Dictionary result;
			result["content"] = content_arr;
			return _create_jsonrpc_response(result, id);
		} else {
			return _create_jsonrpc_error(-32601, "Tool not found: " + tool_name, id);
		}
	} else if (method == "rpc.call") {
		// Call a method by name with params: {method: "...", params: {...}}
		if (params.get_type() != Variant::DICTIONARY) {
			return _create_jsonrpc_error(-32602, "Invalid params: expected object with 'method' and 'params'", id);
		}
		Dictionary call_params = params;
		if (!call_params.has("method")) {
			return _create_jsonrpc_error(-32602, "Invalid params: missing 'method' field", id);
		}
		String call_method = call_params["method"];
		Variant call_method_params = call_params.has("params") ? call_params["params"] : Variant();
		Dictionary inner_request;
		inner_request["method"] = call_method;
		inner_request["params"] = call_method_params;
		inner_request["id"] = id;
		return _handle_jsonrpc_request(inner_request);
	} else if (method == "rpc.parse_request") {
		// Parse JSON string to request object
		if (params.get_type() != Variant::DICTIONARY) {
			return _create_jsonrpc_error(-32602, "Invalid params: expected JSON string", id);
		}
		Dictionary parse_params = params;
		if (!parse_params.has("json")) {
			return _create_jsonrpc_error(-32602, "Invalid params: missing 'json' field", id);
		}
		String json_str = parse_params["json"];
		Dictionary parsed = _parse_jsonrpc(json_str);
		if (parsed.has("error")) {
			return _create_jsonrpc_error(-32603, "Internal error: " + String(parsed["error"]), id);
		}
		return _create_jsonrpc_response(parsed, id);
	} else if (method == "rpc.parse_response") {
		// Parse JSON string to response object
		if (params.get_type() != Variant::DICTIONARY) {
			return _create_jsonrpc_error(-32602, "Invalid params: expected object with 'json' field", id);
		}
		Dictionary parse_params = params;
		if (!parse_params.has("json")) {
			return _create_jsonrpc_error(-32602, "Invalid params: missing 'json' field", id);
		}
		String json_str = parse_params["json"];
		Dictionary parsed = _parse_jsonrpc(json_str);
		if (parsed.has("error")) {
			return _create_jsonrpc_error(-32603, "Internal error: " + String(parsed["error"]), id);
		}
		return _create_jsonrpc_response(parsed, id);
	} else if (method == "rpc.serialize") {
		// Serialize object to JSON string
		if (params.get_type() != Variant::DICTIONARY) {
			return _create_jsonrpc_error(-32602, "Invalid params: expected object with 'object' field", id);
		}
		Dictionary serialize_params = params;
		if (!serialize_params.has("object")) {
			return _create_jsonrpc_error(-32602, "Invalid params: missing 'object' field", id);
		}
		Variant obj = serialize_params["object"];
		String json_str = JSON::stringify(obj);
		Dictionary result;
		result["json"] = json_str;
		return _create_jsonrpc_response(result, id);
	} else {
		return _create_jsonrpc_error(-32601, "Method not found: " + method, id);
	}

	return "{}";
}

String MCPServer::_create_jsonrpc_response(const Variant &p_result, const Variant &p_id) {
	Dictionary response;
	response["jsonrpc"] = "2.0";
	response["result"] = p_result;
	response["id"] = p_id;

	return JSON::stringify(response);
}

String MCPServer::_create_jsonrpc_error(int p_code, const String &p_message, const Variant &p_id) {
	Dictionary error_obj;
	error_obj["code"] = p_code;
	error_obj["message"] = p_message;

	Dictionary response;
	response["jsonrpc"] = "2.0";
	response["error"] = error_obj;
	response["id"] = p_id;

	return JSON::stringify(response);
}

Array MCPServer::get_errors() {
	Array errors;

	// Get errors from EditorLog via singleton if available
	EditorLog *editor_log = EditorNode::get_log();
	if (!editor_log) {
		return errors;
	}

	// Get the error messages from EditorLog
	errors = editor_log->get_errors();

	return errors;
}