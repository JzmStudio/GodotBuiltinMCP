/**************************************************************************/
/*  mcp_server.h                                                          */
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

#pragma once

#include "core/io/tcp_server.h"
#include "core/object/ref_counted.h"
#include "scene/main/node.h"

class MCPServer : public Node {
	GDCLASS(MCPServer, Node);

public:
	struct ErrorEntry {
		String message;
		String source;
		int line = 0;
		String severity;
	};

private:
	Ref<TCPServer> server;
	bool running = false;
	int port = 29170;
	String bind_address = "127.0.0.1";

	Vector<ErrorEntry> cached_errors;
	Mutex error_mutex;

	void start_server();
	void _on_poll_timeout();
	void _handle_client_request(StreamPeerTCP *p_client);
	String _read_http_request(StreamPeerTCP *p_client);
	Dictionary _parse_jsonrpc(const String &p_json);
	String _handle_jsonrpc_request(const Dictionary &p_request);
	String _create_jsonrpc_response(const Variant &p_result, const Variant &p_id);
	String _create_jsonrpc_error(int p_code, const String &p_message, const Variant &p_id);

	Array get_errors_from_editor();

protected:
	static void _bind_methods();

public:
	bool start(int p_port = 29170);
	void stop();
	bool is_running() const { return running; }
	int get_port() const { return port; }

	Array get_errors();

	MCPServer();
	~MCPServer();
};