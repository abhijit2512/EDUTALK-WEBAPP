// server.js
// Simple Node.js + Express app for Azure App Service with MongoDB Atlas


const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");

// ----- App & Middleware -----
const app = express();
app.use(cors());
app.use(express.json());

// ----- Configuration -----
const PORT = process.env.PORT || 8080; // Azure injects PORT -> DO NOT hardcode 3000
const MONGO_URI = process.env.MONGO_URI; // Set this in Azure: App Service -> Environment variables

// ----- MongoDB Connection -----
let dbStatus = "not_connected";

async function connectDB() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is not set in environment variables.");
    dbStatus = "missing_uri";
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
    });
    await mongoose.connection.db.admin().command({ ping: 1 });
    dbStatus = "connected";
    console.log("✅ Connected to MongoDB Atlas!");
  } catch (err) {
    dbStatus = "connection_error";
    console.error("❌ MongoDB connection error:", err.message);
  }
}

// Kick off the connection (non-blocking)
connectDB();

// ----- Example API -----
app.get("/api/hello", (req, res) => {
  res.json({
    message: "Hello from Edutalk WebApp API!",
    db: dbStatus,
  });
});

// ----- Serve Frontend (static files) -----
app.use(express.static(path.join(__dirname, "public")));

// Fallback to index.html for any other route (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown (optional)
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server...");
  mongoose.connection.close(false, () => {
    console.log("Mongo connection closed.");
    process.exit(0);
  });
});
