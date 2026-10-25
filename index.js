
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
// Get public donor information
app.get("/donors", async (req, res) => {
    try {
        const donors = await bloodDonationCollection
            .find({})
            .project({
                _id: 1,
                name: 1,
                bloodGroup: 1,
                district: 1,
                upazila: 1,
                number: 1,
                available: 1,
            })
            .toArray();

        res.send(donors);
    } catch (error) {
        console.error("Failed to get donors:", error);

        res.status(500).send({
            message: "Failed to get donors",
        });
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

// Get donor profile by Firebase UID
app.get("/donors/uid/:uid", async (req, res) => {
    try {
        const uid = req.params.uid;

        const donor = await bloodDonationCollection.findOne({ uid: uid });

        if (!donor) {
            return res.status(404).send({
                message: "Donor profile not found",
            });
        }

        res.send(donor);
    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "Failed to get donor profile",
        });
    }
});

// Update donor profile
app.patch("/donors/uid/:uid", async (req, res) => {
    try {
        const uid = req.params.uid;

        const { name, number, bloodGroup, district, upazila } = req.body;

        const result = await bloodDonationCollection.updateOne(
            { uid: uid },
            {
                $set: {
                    name,
                    number,
                    bloodGroup,
                    district,
                    upazila,
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                message: "Donor profile not found",
            });
        }

        res.send({
            success: true,
            message: "Profile updated successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "Failed to update profile",
        });
    }
});

// Delete account
app.delete("/donors/uid/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        const result = await bloodDonationCollection.deleteOne({ uid });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                message: "Donor profile not found",
            });
        }

        res.send({
            success: true,
            message: "Donor profile deleted successfully",
        });
    } catch (error) {
        console.error("Delete account error:", error);

        res.status(500).send({
            message: "Failed to delete donor profile",
        });
    }
});

async function startServer() {
    await connectDB();

    app.listen(port, () => {
        console.log(`LifeDrop server running on port ${port}`);
    });
}

startServer();
