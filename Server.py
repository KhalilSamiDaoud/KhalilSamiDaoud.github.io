#Use to create local host
import functools
import http.server
import os
import socketserver

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Local development server: always send the latest files instead of letting the browser reuse stale copies
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

Handler = functools.partial(NoCacheHandler, directory=DIRECTORY)
http.server.SimpleHTTPRequestHandler.extensions_map.update({
      ".js": "application/javascript",
})

# Threaded so one slow or streaming request (e.g. PDF.js loading the resume) can't block every other request
socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer.daemon_threads = True
with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print(f"Serving {DIRECTORY} at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
