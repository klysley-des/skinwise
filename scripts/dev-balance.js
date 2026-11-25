import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lbPort = Number(process.env.LB_PORT) || 8091;
const servers = [
  { id: "web01", port: 3061 },
  { id: "web02", port: 3062 },
];

let shuttingDown = false;
const children = servers.map((server) => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(server.port), HOST: "127.0.0.1", SERVER_ID: server.id },
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${server.id} stopped (${signal || code})`);
      shutdown(1);
    }
  });
  return child;
});

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function waitHealthy(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No healthy server on ${port}`);
}

function proxy(req, res, target, attempt) {
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: target.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${target.port}` },
  }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", () => {
    const other = servers.find((server) => server.port !== target.port);
    if (!res.headersSent && attempt === 0 && other) {
      proxy(req, res, other, 1);
      return;
    }
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("Both application servers failed.\n");
    }
  });
  upstream.end();
}

try {
  await Promise.all(servers.map((server) => waitHealthy(server.port)));
} catch (error) {
  console.error(error.message);
  shutdown(1);
}

let cursor = 0;
http.createServer((req, res) => {
  const target = servers[cursor % servers.length];
  cursor += 1;
  proxy(req, res, target, 0);
}).listen(lbPort, "127.0.0.1", () => {
  console.log(`SkinWise load balancer on http://127.0.0.1:${lbPort}`);
});
