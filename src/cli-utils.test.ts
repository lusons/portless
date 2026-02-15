import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import * as net from "node:net";
import { findFreePort, isProxyRunning } from "./cli-utils.js";

describe("findFreePort", () => {
  it("returns a port in the default range", async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThanOrEqual(4000);
    expect(port).toBeLessThanOrEqual(4999);
  });

  it("returns a port that is actually bindable", async () => {
    const port = await findFreePort();
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => resolve());
      server.on("error", reject);
    });
    server.close();
  });

  it("respects custom port range", async () => {
    const port = await findFreePort(9000, 9010);
    expect(port).toBeGreaterThanOrEqual(9000);
    expect(port).toBeLessThanOrEqual(9010);
  });

  it("throws when no port is available in a tiny occupied range", async () => {
    // Occupy a single-port range
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(9999, () => resolve()));
    try {
      await expect(findFreePort(9999, 9999)).rejects.toThrow("No free port found");
    } finally {
      server.close();
    }
  });
});

describe("isProxyRunning", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    for (const s of servers) {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
    servers.length = 0;
  });

  it("returns false when nothing is listening", async () => {
    // Use an unlikely port so nothing is listening
    const result = await isProxyRunning(19876);
    expect(result).toBe(false);
  });

  it("returns true when a server is listening", async () => {
    const server = http.createServer((_req, res) => {
      res.end("ok");
    });
    servers.push(server);

    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr !== "string") {
          resolve(addr.port);
        }
      });
    });

    const result = await isProxyRunning(port);
    expect(result).toBe(true);
  });
});
