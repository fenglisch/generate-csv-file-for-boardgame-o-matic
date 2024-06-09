const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

// Create Express Server
const app = express();
app.use(cors());

// Configuration
const PORT = 3000;
const HOST = "localhost";
const API_SERVICE_URL = "https://boardgamegeek.com";

// Proxy endpoints
app.use(
  "/",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
  })
);

// Start the Proxy
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});
