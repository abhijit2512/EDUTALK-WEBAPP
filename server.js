// ---------- server.js ----------
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
// allow same-site/front-end calls; customize origin if you want to restrict
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://edutalkUser:MyPass123@edutalk-cluster.n8jlomv.mongodb.net/edutalk?retryWrites=true&w=majority";
const CREATOR_API_KEY = process.env.CREATOR_API_KEY || "";

// --- DB ---
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) =>
    console.error("❌ MongoDB connection error:", err?.message || err)
  );

const commentSchema = new mongoose.Schema(
  { text: String, createdAt: { type: Date, default: Date.now } },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    publisher: { type: String, default: "UNKNOWN" },
    producer: { type: String, default: "UNKNOWN" },
    genre: { type: String, default: "General" },
    age: { type: String, default: "PG" },
    playbackUrl: { type: String, required: true }, // either YT or MP4/WebM/Ogg
    external: { type: Boolean, default: false },
    comments: { type: [commentSchema], default: [] },
    ratings: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "videos" }
);

const Video = mongoose.model("Video", videoSchema);

// helpers
const dbState = () =>
  (
    [
      "disconnected",
      "connected",
      "connecting",
      "disconnecting",
    ][mongoose.connection.readyState] || "unknown"
  );

const requireCreatorApiKey = (req, res, next) => {
  // if key not configured, don't block (dev mode)
  if (!CREATOR_API_KEY) return next();
  if (req.headers["x-api-key"] !== CREATOR_API_KEY)
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
};

const norm = (b = {}) => ({
  title: (b.title || "").trim(),
  publisher: (b.publisher || "").trim(),
  producer: (b.producer || "").trim(),
  genre: (b.genre || "").trim(),
  age: (b.age || b.ageRating || "PG").trim(),
  playbackUrl: (b.playbackUrl || b.url || "").trim(),
  external: !!b.external,
});

const expose = (v) => ({
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
  createdAt: v.createdAt,
});

const isYouTube = (url = "") => /(?:youtube\.com|youtu\.be)/i.test(String(url));

// API
app.get("/health", (_req, res) => res.json({ status: "ok", db: dbState() }));

app.get("/videos", async (_req, res) => {
  try {
    const list = await Video.find().sort({ createdAt: -1 }).lean();
    res.json(list.map(expose));
  } catch (e) {
    console.error("List error:", e);
    res.status(500).json({ ok: false, error: "Failed to fetch" });
  }
});

app.post("/videos", requireCreatorApiKey, async (req, res) => {
  try {
    const data = norm(req.body);
    if (!data.title || !data.playbackUrl)
      return res
        .status(400)
        .json({ ok: false, error: "title and playbackUrl required" });
    const doc = await Video.create(data);
    res.status(201).json(expose(doc));
  } catch (e) {
    console.error("Create error:", e);
    res.status(500).json({ ok: false, error: "Failed to create" });
  }
});

app.post("/videos/:id/comments", async (req, res) => {
  try {
    const t = (req.body?.text || "").trim();
    if (!t) return res.status(400).json({ ok: false, error: "text required" });
    const v = await Video.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { text: t } } },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "not found" });
    res.json(expose(v));
  } catch (e) {
    console.error("Comment error:", e);
    res.status(500).json({ ok: false, error: "Failed to add comment" });
  }
});

app.post("/videos/:id/ratings", async (req, res) => {
  try {
    const val = Number(req.body?.value);
    if (!Number.isFinite(val) || val < 1 || val > 5)
      return res
        .status(400)
        .json({ ok: false, error: "value must be 1..5" });
    const v = await Video.findByIdAndUpdate(
      req.params.id,
      { $push: { ratings: val } },
      { new: true }
    );
    if (!v) return res.status(404).json({ ok: false, error: "not found" });
    res.json(expose(v));
  } catch (e) {
    console.error("Rating error:", e);
    res.status(500).json({ ok: false, error: "Failed to add rating" });
  }
});

/* -----------------------------
   Deletion endpoints
------------------------------*/

// delete a single video by id (requires x-api-key if configured)
app.delete("/videos/:id", requireCreatorApiKey, async (req, res) => {
  try {
    const v = await Video.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("Delete error:", e);
    res.status(500).json({ ok: false, error: "Failed to delete" });
  }
});

// bulk purge of YouTube-linked items (matches the front-end call DELETE /videos?provider=youtube)
app.delete("/videos", requireCreatorApiKey, async (req, res) => {
  try {
    if (String(req.query.provider || "").toLowerCase() !== "youtube") {
      return res
        .status(400)
        .json({ ok: false, error: "unsupported bulk delete; use provider=youtube" });
    }
    const r = await Video.deleteMany({
      playbackUrl: { $regex: /(youtube\.com|youtu\.be)/i },
    });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    console.error("Bulk delete error:", e);
    res.status(500).json({ ok: false, error: "Failed to purge" });
  }
});

// Static site
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ✅ explicit file routes BEFORE catch-all
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/videos.html", (_req, res) =>
  res.sendFile(path.join(publicDir, "videos.html"))
);
app.get("/upload.html", (_req, res) =>
  res.sendFile(path.join(publicDir, "upload.html"))
);

// ❗ catch-all LAST
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

const server = app.listen(PORT, () =>
  console.log(`✅ Server on :${PORT}`)
);

// graceful shutdown
function shutdown(sig) {
  console.log(`\n${sig} received. Closing...`);
  server.close(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
