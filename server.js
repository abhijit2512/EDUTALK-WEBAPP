// server.js
// Express app for Azure App Service with MongoDB Atlas

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI (from environment variables in Azure)
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in environment variables!");
  process.exit(1);
}

// MongoDB Connection
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}
connectDB();

// --- Routes ---

// Root route (for Azure App Service startup check)
app.get("/", (req, res) => {
  res.send("🚀 API VideoShare backend is running successfully!");
});

// Health check endpoint (used by Azure & monitoring)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Example API route (expand later for video data)
app.get("/api/videos", (req, res) => {
  res.json({ message: "Video list will go here" });
});

// Serve static files (public folder)
app.use(express.static(path.join(__dirname, "public")));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("⚠️ Shutting down server...");
  await mongoose.disconnect();
  process.exit(0);
});
