
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();

        console.log("LifeDrop MongoDB connected successfully!");

        // Database select
        const db = client.db("lifedrop");

        return db;
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

app.get("/", (req, res) => {
    res.send("LifeDrop blood donation website server is cooking!");
});

async function startServer() {
    await connectDB();

    app.listen(port, () => {
        console.log(`LifeDrop server running on port ${port}`);
    });
}

startServer();
