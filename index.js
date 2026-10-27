
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error("MONGODB_URI is missing from environment variables");
}

const client = new MongoClient(uri);

let connectionPromise;
let bloodDonationCollection;

async function connectDB() {
    if (!connectionPromise) {
        connectionPromise = client.connect()
            .then(() => {
                bloodDonationCollection = client
                    .db("lifedrop")
                    .collection("BloodDonors");

                console.log("LifeDrop MongoDB connected successfully!");
            })
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    await connectionPromise;
}

// Ensure MongoDB is ready before handling API requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("MongoDB connection failed:", error);

        res.status(503).send({
            message: "Database temporarily unavailable",
        });
    }
});

// Server status
app.get("/", (req, res) => {
    res.send("LifeDrop blood donation website server is running!");
});

// Get public donor information
app.get("/donors", async (req, res) => {
    try {
        const donors = await bloodDonationCollection
            .find({})
            .project({
                _id: 1,
                uid: 1,
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

// Save new donor
app.post("/donors", async (req, res) => {
    try {
        const {
            uid,
            name,
            email,
            number,
            bloodGroup,
            district,
            upazila,
        } = req.body;

        if (!uid || !email) {
            return res.status(400).send({
                message: "Required donor information is missing",
            });
        }

        // Prevent duplicate donor profiles
        const existingDonor = await bloodDonationCollection.findOne({ uid });

        if (existingDonor) {
            return res.status(409).send({
                message: "Donor profile already exists",
            });
        }

        const donor = {
            uid,
            name,
            email,
            number,
            bloodGroup,
            district,
            upazila,

            // Every new donor starts as available
            available: true,
        };

        const result = await bloodDonationCollection.insertOne(donor);

        res.status(201).send({
            success: true,
            message: "Donor saved successfully",
            insertedId: result.insertedId,
            available: true,
        });
    } catch (error) {
        console.error("Failed to save donor:", error);

        res.status(500).send({
            message: "Failed to save donor",
        });
    }
});

// Get donor profile by Firebase UID
app.get("/donors/uid/:uid", async (req, res) => {
    try {
        const donor = await bloodDonationCollection.findOne({
            uid: req.params.uid,
        });

        if (!donor) {
            return res.status(404).send({
                message: "Donor profile not found",
            });
        }

        // Treat older documents without availability as available
        if (typeof donor.available !== "boolean") {
            donor.available = true;
        }

        res.send(donor);
    } catch (error) {
        console.error("Failed to get donor profile:", error);

        res.status(500).send({
            message: "Failed to get donor profile",
        });
    }
});

// Update donor profile and/or availability
app.patch("/donors/uid/:uid", async (req, res) => {
    try {
        const {
            name,
            number,
            bloodGroup,
            district,
            upazila,
            available,
        } = req.body;

        const updateFields = {};

        // Update only fields explicitly provided
        if (name !== undefined) updateFields.name = name;
        if (number !== undefined) updateFields.number = number;
        if (bloodGroup !== undefined) updateFields.bloodGroup = bloodGroup;
        if (district !== undefined) updateFields.district = district;
        if (upazila !== undefined) updateFields.upazila = upazila;

        // Availability must be a real Boolean
        if (available !== undefined) {
            if (typeof available !== "boolean") {
                return res.status(400).send({
                    message: "Availability must be true or false",
                });
            }

            updateFields.available = available;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).send({
                message: "No valid fields provided for update",
            });
        }

        const result = await bloodDonationCollection.updateOne(
            { uid: req.params.uid },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                message: "Donor profile not found",
            });
        }

        res.send({
            success: true,
            message: "Donor profile updated successfully",
            updatedFields: updateFields,
        });
    } catch (error) {
        console.error("Failed to update donor profile:", error);

        res.status(500).send({
            message: "Failed to update donor profile",
        });
    }
});

// Delete donor profile
app.delete("/donors/uid/:uid", async (req, res) => {
    try {
        const result = await bloodDonationCollection.deleteOne({
            uid: req.params.uid,
        });

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
        console.error("Failed to delete donor profile:", error);

        res.status(500).send({
            message: "Failed to delete donor profile",
        });
    }
});

// Local development
if (require.main === module) {
    const port = process.env.PORT || 3000;

    connectDB()
        .then(() => {
            app.listen(port, () => {
                console.log(`LifeDrop server running on port ${port}`);
            });
        })
        .catch((error) => {
            console.error("Failed to start server:", error);
            process.exitCode = 1;
        });
}

// Vercel serverless entry point
module.exports = app;
