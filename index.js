
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let bloodDonationCollection;

// MongoDB connection
async function connectDB() {
    try {
        await client.connect();

        console.log("LifeDrop MongoDB connected successfully!");

        bloodDonationCollection = client
            .db("lifedrop")
            .collection("BloodDonors");

    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

app.get("/", (req, res) => {
    res.send("LifeDrop blood donation website server is cooking!");
});
//  read donors data 

// Get all donors
app.get("/donors", async (req, res) => {
    try {
        const donors = await bloodDonationCollection.find().toArray();
        res.send(donors);
    } catch (error) {
        res.status(500).send({ message: "Failed to get donors" });
    }
});
// Donor data save
app.post("/donors", async (req, res) => {
    try {
        const donor = req.body;

        const result = await bloodDonationCollection.insertOne(donor);

        res.send({
            success: true,
            message: "Donor saved successfully",
            insertedId: result.insertedId,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to save donor" });
    }
});

async function startServer() {
    await connectDB();

    app.listen(port, () => {
        console.log(`LifeDrop server running on port ${port}`);
    });
}

startServer();
