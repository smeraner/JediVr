import http.server
import ssl

Handler = http.server.SimpleHTTPRequestHandler
# Handler.extensions_map={
#         '.manifest': 'text/cache-manifest',
#         '.html': 'text/html',
#         '.png': 'image/png',
#         '.jpg': 'image/jpg',
#         '.svg':	'image/svg+xml',
#         '.css':	'text/css',
#         '.js':	'application/x-javascript',
#         '.frag': 'application/javascript',
#         '.vert': 'application/javascript',
#         '': 'application/octet-stream', # Default
#     }
httpd = http.server.HTTPServer(('0.0.0.0', 443), Handler)
httpd.socket = ssl.wrap_socket (httpd.socket, certfile='./server.pem', server_side=True)
httpd.serve_forever()