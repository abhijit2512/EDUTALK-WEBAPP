// server.js
// Simple Node + Express app for Azure App Service with MongoDB (Mongoose)

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// Azure gives you a dynamic port in process.env.PORT
const PORT = process.env.PORT || 8080;

// Parse JSON bodies
app.use(express.json());

// Serve the static frontend (public folder)
app.use(express.static(path.join(__dirname, "public")));

// ----- MongoDB connection -----
// Make sure you have set MONGO_URI in Azure App Service > Environment variables
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.warn("⚠️  No MONGO_URI environment variable found. Skipping DB connection.");
} else {
  mongoose
    .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

// Example schema (optional, just to prove DB works)
// You can remove this section if you don’t need it yet.
const PingSchema = new mongoose.Schema(
  { at: { type: Date, default: Date.now } },
  { collection: "pings" }
);
const Ping = mongoose.models.Ping || mongoose.model("Ping", PingSchema);

// ----- API routes -----

// Health/API demo route
app.get("/api/hello", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      // if connected, write a tiny doc just to test
      await Ping.create({});
      return res.json({
        ok: true,
        message: "Hello from Edutalk API + MongoDB!",
        db: "connected",
      });
    }
    return res.json({
      ok: true,
      message: "Hello from Edutalk API!",
      db: "not_connected",
    });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

// ----- Fallback routes -----

// (Optional) sample route used by your button in index.html
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Edutalk WebApp API!" });
});

// For any other request, serve the SPA/landing page
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- Start the server -----
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
