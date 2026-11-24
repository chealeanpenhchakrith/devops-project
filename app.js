import express from "express";
import client from "prom-client";
import { setTimeout as sleep } from "node:timers/promises";

// Default Node/process metrics (process_cpu_seconds_total, nodejs_heap_size_used_bytes, ...)
client.collectDefaultMetrics();

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request latency in seconds",
  labelNames: ["method", "route"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 3],
});

// 1. The app must exist before anything uses it.
const app = express();

app.disable("x-powered-by");

// 2. Instrumentation middleware: every request EXCEPT the scrape itself.
app.use((req, res, next) => {
  if (req.path === "/metrics") {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    // 3. req.route is only set once a route matched -> template, not raw path
    const route = req.route?.path ?? "unmatched";

    httpDuration.observe({ method: req.method, route }, seconds);
    httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : "info",
      method: req.method,
      path: req.path,
      route,
      status: res.statusCode,
      duration_ms: Math.round(seconds * 1000),
    }));
  });

  next();
});

// 4. The endpoint Prometheus scrapes.
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.get("/", (req, res) => {
  res.status(200).send("Hello World from version 2");
});

app.get("/health", (req, res) => {
  res.status(200).type("text/plain").send("OK");
});

// 5. Lab 4 / 1.2 - random delay up to 2 s
app.get("/slow", async (req, res) => {
  const delayMs = Math.floor(Math.random() * 2000);
  await sleep(delayMs);
  res.status(200).json({ delayed_ms: delayMs });
});

// 6. Lab 4 / 1.2 - HTTP 500 about 30 % of the time
app.get("/error", (req, res) => {
  if (Math.random() < 0.3) {
    return res.status(500).json({ error: "simulated failure" });
  }
  res.status(200).json({ status: "ok" });
});

export default app;