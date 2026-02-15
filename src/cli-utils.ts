import * as net from "node:net";

/**
 * Find a free port in the 4000-4999 range.
 * Tries random ports first, then falls back to sequential scan.
 */
export async function findFreePort(minPort = 4000, maxPort = 4999): Promise<number> {
  const tryPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on("error", () => resolve(false));
    });
  };

  // Try random ports first
  for (let i = 0; i < 50; i++) {
    const port = minPort + Math.floor(Math.random() * (maxPort - minPort + 1));
    if (await tryPort(port)) {
      return port;
    }
  }

  // Fall back to sequential
  for (let port = minPort; port <= maxPort; port++) {
    if (await tryPort(port)) {
      return port;
    }
  }

  throw new Error(`No free port found in range ${minPort}-${maxPort}`);
}

/**
 * Check if something is listening on port 80 at 127.0.0.1.
 */
export function isProxyRunning(port = 80): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}
