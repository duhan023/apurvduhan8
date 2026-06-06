import os, http.server, socketserver
os.chdir(os.path.dirname(os.path.abspath(__file__)))
with socketserver.TCPServer(("", 8743), http.server.SimpleHTTPRequestHandler) as h:
    h.serve_forever()
