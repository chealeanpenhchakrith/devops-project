import app from "./app.js";

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    message: "Server started",
    port,
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    message: "Server shutting down",
    signal,
  }));

  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));