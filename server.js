"use strict";
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use((req, res, next) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); next(); });
app.use(morgan("dev"));

// Routes
app.use("/nearest-hospital", require("./routes/hospitals"));
app.use("/nearest-police",   require("./routes/police"));
app.use("/nearest-towing",   require("./routes/towing"));
app.use("/challans",         require("./routes/challans"));
app.use("/incidents",        require("./routes/incidents"));
app.use("/chat",             require("./routes/chat"));

app.get("/", (_req, res) => res.json({ status:"ok", message:"RoadSoS API Running!" }));
app.get("/health", (_req, res) => res.json({ status:"healthy", port: PORT }));

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.listen(PORT, () => {
  console.log("╔══════════════════════════════════╗");
  console.log("║   🚨 RoadSoS API Running 🚨      ║");
  console.log("╚══════════════════════════════════╝");
  console.log(`   URL: http://localhost:${PORT}`);
});

module.exports = app;