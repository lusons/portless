import * as http from "node:http";
import httpProxy from "http-proxy";
import type { ProxyServerOptions } from "./types.js";
import { escapeHtml } from "./utils.js";

/**
 * Create an HTTP proxy server that routes requests based on the Host header.
 *
 * The `getRoutes` callback is invoked on every request so callers can provide
 * either a static list or a live-updating one.
 */
export function createProxyServer(options: ProxyServerOptions): http.Server {
  const { getRoutes, onError = (msg: string) => console.error(msg) } = options;

  const proxy = httpProxy.createProxyServer({});

  proxy.on("error", (err, req, res) => {
    onError(`Proxy error for ${req.headers.host}: ${err.message}`);
    if (res && "writeHead" in res) {
      const serverRes = res as http.ServerResponse;
      if (!serverRes.headersSent) {
        const errWithCode = err as NodeJS.ErrnoException;
        const message =
          errWithCode.code === "ECONNREFUSED"
            ? "Bad Gateway: the target app is not responding. It may have crashed."
            : "Bad Gateway: the target app may not be running.";
        serverRes.writeHead(502, { "Content-Type": "text/plain" });
        serverRes.end(message);
      }
    }
  });

  const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const routes = getRoutes();
    const host = (req.headers.host || "").split(":")[0];

    if (!host) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing Host header");
      return;
    }

    const route = routes.find((r) => r.hostname === host);

    if (!route) {
      const safeHost = escapeHtml(host);
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head><title>portless - Not Found</title></head>
          <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>Not Found</h1>
            <p>No app registered for <strong>${safeHost}</strong></p>
            ${
              routes.length > 0
                ? `
              <h2>Active apps:</h2>
              <ul>
                ${routes.map((r) => `<li><a href="http://${escapeHtml(r.hostname)}">${escapeHtml(r.hostname)}</a> - localhost:${escapeHtml(String(r.port))}</li>`).join("")}
              </ul>
            `
                : "<p><em>No apps running.</em></p>"
            }
            <p>Start an app with: <code>portless ${safeHost.replace(".localhost", "")} your-command</code></p>
          </body>
        </html>
      `);
      return;
    }

    proxy.web(req, res, {
      target: `http://127.0.0.1:${route.port}`,
      xfwd: true,
    });
  };

  const handleUpgrade = (
    req: http.IncomingMessage,
    socket: import("node:net").Socket,
    head: Buffer
  ) => {
    const routes = getRoutes();
    const host = (req.headers.host || "").split(":")[0];
    const route = routes.find((r) => r.hostname === host);

    if (!route) {
      socket.destroy();
      return;
    }

    proxy.ws(req, socket, head, {
      target: `http://127.0.0.1:${route.port}`,
      xfwd: true,
    });
  };

  const httpServer = http.createServer(handleRequest);
  httpServer.on("upgrade", handleUpgrade);

  return httpServer;
}
