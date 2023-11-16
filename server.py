import http.server
import ssl

DIRECTORY = ".."
ADDRESS='0.0.0.0'

print("Serving at: https://localhost:443/JediVr/")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

httpd = http.server.HTTPServer(('0.0.0.0', 443), Handler)
httpd.socket = ssl.wrap_socket (httpd.socket, certfile='./server.pem', server_side=True)
httpd.serve_forever()