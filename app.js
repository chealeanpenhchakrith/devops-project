import express from "express";

const app = express();

app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.status(200).send("Hello World from version 2");
});

app.get("/health", (req, res) => {
  res.status(200).type("text/plain").send("OK");
});

export default app;
