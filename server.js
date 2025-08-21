// ---------- server.js ----------
/**
 * EduTalk VideoShare backend
 * - MongoDB Atlas via Mongoose
 * - Simple REST API for videos
 * - Health endpoint for Azure readiness
 * - Static hosting for /public (and optional /web)
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// --- App & Middleware ---
const app = express();
app.use(cors());
app.use(express.json()); // parse application/json

// --- Configuration (env) ---
const PORT = process.env.PORT || 8080;

// Prefer env var MONGO_URI (Azure App Service -> Configuration -> App settings)
// Fallback only for local/dev usage — replace <password> if you really need to run locally.
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://edutalkUser:<password>@edutalk-cluster.n8jlomv.mongodb.net/edutalk?retryWrites=true&w=majority";

// Optional simple API key to protect creator routes (POST /api/videos)
const CREATOR_API_KEY = process.env.CREATOR_API_KEY || "";

// --- Mongoose Connection ---
mongoose
  .connect(MONGO_URI, {
    // Options are default in Mongoose 7+, kept for clarity
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // You can add serverSelectionTimeoutMS if you want shorter fail time
    // serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err?.message || err);
  });

// --- Mongoose Schema & Model ---
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    publisher: { type: String, default: "EduTalk" },
    producer: { type: String, default: "Admin" },
    genre: { type: String, default: "General" },
    ageRating: { type: String, default: "PG" }, // e.g., "PG", "13", "18"
    url: { type: String, required: true }, // video URL
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "videos", // matches your Atlas collection name
  }
);

const Video = mongoose.model("Video", videoSchema);

// --- Helpers ---
function dbState() {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[mongoose.connection.readyState] || "unknown";
}

function requireCreatorApiKey(req, res, next) {
  if (!CREATOR_API_KEY) return next(); // not enforced if not set
  const key = req.headers["x-api-key"];
  if (!key || key !== CREATOR_API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// --- Routes ---
// Root – simple confirmation page
app.get("/", (_req, res) => {
  res.send("🚀 API VideoShare backend is running successfully!");
});

// Health – used by Azure & you
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", db: dbState() });
});

// List videos (consumers)
app.get("/api/videos", async (_req, res) => {
  try {
    const list = await Video.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, count: list.length, data: list });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch videos" });
  }
});

// Create video (creators) – protects with x-api-key if CREATOR_API_KEY is set
app.post("/api/videos", requireCreatorApiKey, async (req, res) => {
  try {
    const { title, publisher, producer, genre, ageRating, url, createdAt } = req.body;

    if (!title || !url) {
      return res.status(400).json({ ok: false, error: "title and url are required" });
    }

    const doc = await Video.create({
      title,
      publisher,
      producer,
      genre,
      ageRating,
      url,
      createdAt,
    });

    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ ok: false, error: "Failed to create video" });
  }
});

// --- Static frontend (optional) ---
// If you keep assets in /public
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Optional: if you plan a lightweight SPA in /web
const webDir = path.join(__dirname, "web");
app.use(express.static(webDir));

// --- Start server ---
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// --- Graceful shutdown ---
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
