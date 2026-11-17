import app from "./app.js";

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing the server`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
