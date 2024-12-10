const express = require("express"); // For both proxy and cacheUpdate
const { createProxyMiddleware } = require("http-proxy-middleware"); // For proxy
const cors = require("cors"); // For both proxy and cacheUpdate
const fs = require("fs"); // For cacheUpdate

// Create Express Server
const appProxy = express();
appProxy.use(cors());

// Configuration
const PORT_PROXY = 3000;
const HOST_PROXY = "localhost";
const API_URL_PROXY = "https://boardgamegeek.com";

// Proxy endpoints
appProxy.use(
  "/bgg-internal-json-api",
  createProxyMiddleware({
    target: API_URL_PROXY,
    changeOrigin: true,
    pathRewrite: {
      "^/bgg-internal-json-api": "",
    },
  })
);

// Start the Proxy
appProxy.listen(PORT_PROXY, HOST_PROXY, () => {
  console.log(`Starting Proxy at ${HOST_PROXY}:${PORT_PROXY}`);
});

const PORT_CACHE_UPDATE = 2096;
const appCacheUpdate = express();
appCacheUpdate.use(express.json({ limit: "50mb" })); // Automatically parses JSON in the request body
appCacheUpdate.use(cors());

appCacheUpdate.post("/cache-update", (req, res) => {
  const newCache = req.body;
  try {
    fs.writeFileSync(
      "./cache.js",
      `const cache = ${JSON.stringify(newCache)}`,
      "utf8"
    );
    console.log("Successfully updated cache.js");
    res.send("Successfully updated cache.js");
  } catch (error) {
    console.error("Error updating cache.js:", error);
    res.status(500).send("Error updating cache.js:", error);
  }
});

appCacheUpdate.listen(PORT_CACHE_UPDATE, () => {
  console.log(`Cache update server is running on port ${PORT_CACHE_UPDATE}`);
});
