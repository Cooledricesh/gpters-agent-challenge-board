import http from "node:http";

import { createHandler } from "./app.mjs";
import { loadConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { createRepository } from "./repository.mjs";

const config = loadConfig();
const pool = createDatabase(config);
const repository = createRepository(pool);
const server = http.createServer(
  createHandler({ repository, serviceToken: config.SERVICE_TOKEN }),
);

server.requestTimeout = 10_000;
server.headersTimeout = 12_000;
server.keepAliveTimeout = 5_000;
server.listen(config.API_PORT, config.API_HOST, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "server_started",
    host: config.API_HOST,
    port: config.API_PORT,
  }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
