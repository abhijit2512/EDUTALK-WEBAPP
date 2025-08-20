const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;  // Azure injects PORT env variable
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const path = require('path');

const uri = process.env.MONGO_URI;                // 👈 match Azure setting

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas!');
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

run().catch(console.error);                        // 👈 make sure run() is called

const app = express();
const PORT = process.env.PORT || 8080;             // 👈 Azure injects PORT

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend (public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Example API
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Edutalk WebApp API!' });
});

// SPA fallback (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
