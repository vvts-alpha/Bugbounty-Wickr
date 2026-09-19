import http.server, socketserver, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # always serve the harness dir
PORT = int(sys.argv[1]) if len(sys.argv)>1 else 8972
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js':'text/javascript', '.mjs':'text/javascript', '.txt':'text/plain', '.html':'text/html'}
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
    print("serving harness dir on", PORT); httpd.serve_forever()
