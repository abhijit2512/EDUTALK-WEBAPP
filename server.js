const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend (static files inside "public" folder)
app.use(express.static(path.join(__dirname, "public")));

// Example API route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Edutalk WebApp API!" });
});

// Fallback to index.html for frontend routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
