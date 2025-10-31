from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class MockMCP(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/invoke":
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)
            query = data.get("query", "")
            response = {
                "tool": "mock-mcp",
                "output": f"MockMCP received your query: '{query}'"
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

server = HTTPServer(("127.0.0.1", 8000), MockMCP)
print("🚀 Mock MCP running at http://127.0.0.1:8000")
server.serve_forever()
