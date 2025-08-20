// server.js
// Simple Node.js + Express app for Azure App Service with MongoDB Atlas

// ----- Imports -----
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const mongoose = require("mongoose");

// ----- App & Middleware -----
const app = express();
app.use(cors());
app.use(express.json());

// ----- Configuration -----
// Azure injects PORT. Do NOT hardcode 3000/8080; just use the env var with a dev fallback.
const PORT      = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI; // set this in Azure → App Service → Environment variables

// ----- MongoDB connection (non-blocking) -----
let dbStatus = "not_connected";

async function connectDB() {
  if (!MONGO_URI) {
    console.warn("⚠️  MONGO_URI is not set in environment variables.");
    dbStatus = "missing_uri";
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
      // You can add options below if needed
      // dbName: "<optional-db-name>"
    });

    // Optional sanity ping
    await mongoose.connection.db.admin().command({ ping: 1 });

    dbStatus = "connected";
    console.log("✅ Connected to MongoDB Atlas!");
  } catch (err) {
    dbStatus = "connection_error";
    console.error("❌ MongoDB connection error:", err?.message || err);
  }
}

// ----- Routes -----
// Simple API hello
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Edutalk WebApp API!", db: dbStatus });
});

// Basic ping route; returns DB status
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, db: dbStatus, time: new Date().toISOString() });
});

// ----- Serve frontend (static files) -----
app.use(express.static(path.join(__dirname, "public")));

// Fallback to index.html for any other (non-API) route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- Start server (important: always start listening) -----
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  // Kick off DB connect after server is up, so the app still responds even if DB is down
  connectDB();
});

// ----- Graceful shutdown (optional) -----
function shutdown() {
  console.log("⬇️  Shutting down...");
  mongoose.connection.close(false, () => {
    console.log("🔌 MongoDB connection closed.");
    server.close(() => {
      console.log("🛑 HTTP server closed. Bye!");
      process.exit(0);
    });
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
