// ---------- server.js ----------
/**
 * EduTalk VideoShare backend (Express + Mongoose)
 * - Static hosting of /public at root
 * - REST: /videos (GET, POST), /videos/:id/comments, /videos/:id/ratings
 * - MongoDB Atlas persistence
 * - Health endpoint
 * - Backward-compat aliases on /api/*
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// --- App & Middleware ---
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://edutalkUser:<password>@edutalk-cluster.n8jlomv.mongodb.net/edutalk?retryWrites=true&w=majority";

const CREATOR_API_KEY = process.env.CREATOR_API_KEY || "";

// --- DB Connect ---
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err?.message || err));

// --- Schema & Model ---
const commentSchema = new mongoose.Schema(
  { text: String, createdAt: { type: Date, default: Date.now } },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    publisher: { type: String, default: "EduTalk" },
    producer: { type: String, default: "Admin" },
    genre: { type: String, default: "General" },
    age: { type: String, default: "PG" },           // canonical field
    playbackUrl: { type: String, required: true },  // canonical field
    external: { type: Boolean, default: false },    // true for YouTube; UI shows thumbnail only
    comments: { type: [commentSchema], default: [] },
    ratings: { type: [Number], default: [] },       // 1..5
    createdAt: { type: Date, default: Date.now }
  },
  { collection: "videos" }
);

const Video = mongoose.model("Video", videoSchema);

// --- Helpers ---
function dbState() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[mongoose.connection.readyState] || "unknown";
}
function requireCreatorApiKey(req, res, next) {
  if (!CREATOR_API_KEY) return next();
  const key = req.headers["x-api-key"];
  if (key !== CREATOR_API_KEY) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}
// normalize incoming payload (accept old/new field names)
function normalizeBody(b = {}) {
  return {
    title: (b.title || "").trim(),
    publisher: (b.publisher || "").trim(),
    producer: (b.producer || "").trim(),
    genre: (b.genre || "").trim(),
    age: (b.age || b.ageRating || "PG").trim(),
    playbackUrl: (b.playbackUrl || b.url || "").trim(),
    external: !!b.external
  };
}
// serialize for clients (plain array)
function expose(v) {
  return {
    _id: v._id,
    title: v.title,
    publisher: v.publisher,
    producer: v.producer,
    genre: v.genre,
    age: v.age,
    playbackUrl: v.playbackUrl,
    external: !!v.external,
    comments: v.comments || [],
    ratings: v.ratings || [],
    createdAt: v.createdAt
  };
}

// --- REST Routes ---
// Health
app.get("/health", (_req, res) => res.json({ status: "ok", db: dbState() }));

// List videos (plain array)
async function listVideos(_req, res) {
  try {
    const list = await Video.find().sort({ createdAt: -1 }).lean();
    res.json(list.map(expose));
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch videos" });
  }
}
app.get("/videos", listVideos);
app.get("/api/videos", listVideos); // backward-compat

// Create video (creator)
async function createVideo(req, res) {
  try {
    const data = normalizeBody(req.body);
    if (!data.title || !data.playbackUrl) {
      return res.status(400).json({ ok: false, error: "title and playbackUrl/url are required" });
    }
    const doc = await Video.create(data);
    res.status(201).json(expose(doc));
  } catch (err) {
    console.error("Create error:", err);
    res.status(500).json({ ok: false, error: "Failed to create video" });
  }
}
app.post("/videos", requireCreatorApiKey, createVideo);
app.post("/api/videos", requireCreatorApiKey, createVideo); // backward-compat

// Add comment
app.post("/videos/:id/comments", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ ok: false, error: "text required" });
    const v = await Video.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { text: String(text).trim() } } },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "not found" });
    res.json(expose(v));
  } catch (e) {
    console.error("Comment error:", e);
    res.status(500).json({ ok: false, error: "Failed to add comment" });
  }
});

// Add rating (1..5)
app.post("/videos/:id/ratings", async (req, res) => {
  try {
    let { value } = req.body || {};
    value = Number(value);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return res.status(400).json({ ok: false, error: "value must be 1..5" });
    }
    const v = await Video.findByIdAndUpdate(
      req.params.id,
      { $push: { ratings: value } },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "not found" });
    res.json(expose(v));
  } catch (e) {
    console.error("Rating error:", e);
    res.status(500).json({ ok: false, error: "Failed to add rating" });
  }
});

// --- Static frontend at root ---
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Fallback to index.html (so / resolves and unknown paths open the app)
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// --- Start ---
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// --- Graceful shutdown ---
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(async () => {
    try { await mongoose.disconnect(); } catch {}
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
