// server.js
// Simple Node.js + Express app for Azure App Service with MongoDB Atlas

// ---------- Imports ----------
const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");

// ---------- App & Middleware ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- Configuration ----------
const PORT = process.env.PORT || 8080;          // Azure injects PORT -> DO NOT hardcode 3000
const MONGO_URI = process.env.MONGO_URI;        // Set this in Azure: App Service -> Environment variables

// ---------- MongoDB Connection ----------
let dbStatus = "not_connected";

async function connectDB() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is not set in environment variables.");
    dbStatus = "missing_uri";
    return;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverApi: { version: "1", strict: true, deprecationErrors: true }
    });
    await mongoose.connection.db.admin().command({ ping: 1 });
    dbStatus = "connected";
    console.log("✅ Connected to MongoDB Atlas!");
  } catch (err) {
    dbStatus = "connect_error";
    console.error("❌ MongoDB connection error:", err.message);
  }
}
connectDB();

// ---------- Mongo Model ----------
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true }
  },
  { collection: "videos", timestamps: true }
);
const Video = mongoose.models.Video || mongoose.model("Video", videoSchema);

// ---------- Routes ----------

// Root route (useful for Azure App Service startup check)
app.get("/", (_req, res) => {
  res.send("🚀 API VideoShare backend is running successfully!");
});

// Health check (for Azure + monitoring)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", db: dbStatus });
});

// TEST INSERT: creates a demo video document
app.post("/api/videos/test-insert", async (_req, res) => {
  try {
    const doc = await Video.create({
      title: "Hello from Azure",
      url: "https://example.com/demo.mp4"
    });
    res.json({ ok: true, created: doc });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// LIST: returns all videos
app.get("/api/videos", async (_req, res) => {
  try {
    const list = await Video.find().sort({ _id: -1 }).lean();
    res.json({ ok: true, count: list.length, data: list });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve static files (optional public folder)
app.use(express.static(path.join(__dirname, "public")));

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// ---------- Graceful shutdown ----------
process.on("SIGINT", async () => {
  console.log("⚠️  Shutting down server...");
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(0);
});
