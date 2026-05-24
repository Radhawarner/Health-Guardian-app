from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse

PORT = 8000

class MockHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, extra_headers=None):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        print(f"GET {path}")

        if path == '/api/medicines/today':
            self._set_headers()
            self.wfile.write(json.dumps([]).encode())
            return

        if path == '/api/medicines':
            self._set_headers()
            self.wfile.write(json.dumps([]).encode())
            return

        if path == '/api/dashboard':
            body = {
                "today_medicines": [],
                "health_stats": None,
                "alerts": [],
                "risk_prediction": {
                    "overall_risk_level": "low",
                    "overall_risk_score": 10,
                    "diabetes_risk": {"level":"low","score":10},
                    "hypertension_risk": {"level":"low","score":10},
                    "heart_disease_risk": {"level":"low","score":10},
                    "recommendations": ["Maintain healthy lifestyle habits"]
                }
            }
            self._set_headers()
            self.wfile.write(json.dumps(body).encode())
            return

        # default: return a generic object
        self._set_headers(200)
        self.wfile.write(json.dumps({"message": "mock ok"}).encode())

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get('Content-Length', 0))
        body_raw = self.rfile.read(content_length) if content_length else b''
        try:
            body = json.loads(body_raw.decode()) if body_raw else {}
        except Exception:
            body = {}
        print(f"POST {path} -> {body}")

        if path == '/api/auth/login' or path == '/api/auth/register':
            email = body.get('email', 'user@example.com')
            user = {
                "id": "mock-user-1",
                "email": email,
                "name": "Mock User",
                "age": 30,
                "gender": "other"
            }
            resp = {"token": "mock-token-123", "user": user}
            self._set_headers(200)
            self.wfile.write(json.dumps(resp).encode())
            return

        # simple echo for other POSTs
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True, "received": body}).encode())


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), MockHandler)
    print(f"Mock API server running at http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        print("Server stopped")

