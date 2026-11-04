
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const verifyFirebaseToken = require("./middleware/verifyFirebaseToken");
const verifyDonorOwner = require("./middleware/verifyDonorOwner");
const verifyAdmin = require("./middleware/verifyAdmin");
const verifySuperAdmin = require("./middleware/verifySuperAdmin");

const { auth } = require("./config/firebaseAdmin");

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
let usersCollection;

async function connectDB() {
    if (!connectionPromise) {
        connectionPromise = client
            .connect()
            .then(() => {
                const database = client.db("lifedrop");

                bloodDonationCollection = database.collection("BloodDonors");
                usersCollection = database.collection("Users");

                app.locals.usersCollection = usersCollection;

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
            success: false,
            message: "Database temporarily unavailable",
        });
    }
});

// ======================================
// SUPER ADMIN DASHBOARD
// ======================================

app.get(
    "/superadmin/dashboard",
    verifyFirebaseToken,
    verifySuperAdmin,
    (req, res) => {
        res.send({
            success: true,
            message: "Welcome Super Admin!",
            user: {
                name: req.superAdmin.name,
                email: req.superAdmin.email,
                role: req.superAdmin.role,
            },
        });
    }
);

// ======================================
// GET ALL USERS
// Admin + Super Admin
// ======================================

app.get(
    "/admin/users",
    verifyFirebaseToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const users = await usersCollection
                .find(
                    {},
                    {
                        projection: {
                            _id: 0,
                            password: 0,
                        },
                    }
                )
                .toArray();

            res.send({
                success: true,
                totalUsers: users.length,
                users,
            });
        } catch (error) {
            console.error("Get users error:", error);

            res.status(500).send({
                success: false,
                message: "Failed to fetch users",
            });
        }
    }
);

// ======================================
// DELETE USER
// Admin + Super Admin
// ======================================

app.delete(
    "/admin/users/:uid",
    verifyFirebaseToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const targetUid = req.params.uid;
            const currentUid = req.user.uid;

            // Check verified email
            if (req.user.email_verified !== true) {
                return res.status(403).send({
                    success: false,
                    message: "Please verify your email first",
                });
            }

            // Prevent self deletion
            if (targetUid === currentUid) {
                return res.status(403).send({
                    success: false,
                    message: "You cannot delete your own account",
                });
            }

            // Find target user
            const targetUser = await usersCollection.findOne({
                uid: targetUid,
            });

            if (!targetUser) {
                return res.status(404).send({
                    success: false,
                    message: "User not found",
                });
            }

            // Super Admin protection
            if (targetUser.role === "superadmin") {
                return res.status(403).send({
                    success: false,
                    message: "Super Admin cannot be deleted",
                });
            }

            // Admin can delete only normal users
            if (
                req.admin.role === "admin" &&
                targetUser.role !== "user"
            ) {
                return res.status(403).send({
                    success: false,
                    message: "Admin can only delete normal users",
                });
            }

            // Delete Firebase Authentication account
            await auth().deleteUser(targetUid);

            // Delete MongoDB donor profile
            await bloodDonationCollection.deleteOne({
                uid: targetUid,
            });

            // Delete MongoDB user document
            await usersCollection.deleteOne({
                uid: targetUid,
            });

            res.send({
                success: true,
                message: "User and donor profile deleted successfully",
            });

        } catch (error) {
            console.error("Delete user error:", error);

            res.status(500).send({
                success: false,
                message: "Failed to delete user",
            });
        }
    }
);

// ======================================
// SERVER STATUS
// ======================================

app.get("/", (req, res) => {
    res.send("LifeDrop blood donation website server is running!");
});

// ======================================
// GET PUBLIC DONOR INFORMATION
// ======================================

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

// ======================================
// SAVE NEW DONOR
// ======================================

app.post("/donors", verifyFirebaseToken, async (req, res) => {
    try {
        if (req.user.email_verified !== true) {
            return res.status(403).send({
                success: false,
                message: "Please verify your email first",
            });
        }

        const { name, number, bloodGroup, district, upazila } = req.body;

        const uid = req.user.uid;
        const email = req.user.email;

        if (!email || !name || !number || !bloodGroup || !district || !upazila) {
            return res.status(400).send({
                success: false,
                message: "Required donor information is missing",
            });
        }

        const existingDonor = await bloodDonationCollection.findOne({ uid });

        if (existingDonor) {
            return res.status(409).send({
                success: false,
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
            success: false,
            message: "Failed to save donor",
        });
    }
});

// ======================================
// SAVE USER INFORMATION
// ======================================

app.post("/users", verifyFirebaseToken, async (req, res) => {
    try {
        if (req.user.email_verified !== true) {
            return res.status(403).send({
                success: false,
                message: "Please verify your email first",
            });
        }

        const uid = req.user.uid;

        const existingUser = await usersCollection.findOne({ uid });

        if (existingUser) {
            return res.status(200).send({
                success: true,
                message: "User already exists",
            });
        }

        const newUser = {
            uid,
            name: req.body.name || "",
            email: req.user.email,
            role: "user",
            createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.status(201).send({
            success: true,
            message: "User created successfully",
            insertedId: result.insertedId,
        });
    } catch (error) {
        console.error("User creation failed:", error);

        res.status(500).send({
            success: false,
            message: "Failed to create user",
        });
    }
});

// ======================================
// GET DONOR PROFILE BY UID
// OWNER ONLY
// ======================================

app.get(
    "/donors/uid/:uid",
    verifyFirebaseToken,
    verifyDonorOwner,
    async (req, res) => {
        try {
            const donor = await bloodDonationCollection.findOne({
                uid: req.params.uid,
            });

            if (!donor) {
                return res.status(404).send({
                    message: "Donor profile not found",
                });
            }

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
    }
);

// ======================================
// UPDATE DONOR PROFILE
// OWNER ONLY
// ======================================

app.patch(
    "/donors/uid/:uid",
    verifyFirebaseToken,
    verifyDonorOwner,
    async (req, res) => {
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

            if (name !== undefined) updateFields.name = name;
            if (number !== undefined) updateFields.number = number;
            if (bloodGroup !== undefined) updateFields.bloodGroup = bloodGroup;
            if (district !== undefined) updateFields.district = district;
            if (upazila !== undefined) updateFields.upazila = upazila;

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
    }
);

// ======================================
// DELETE OWN DONOR PROFILE
// OWNER ONLY
// ======================================

app.delete(
    "/donors/uid/:uid",
    verifyFirebaseToken,
    verifyDonorOwner,
    async (req, res) => {
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
    }
);

// ======================================
// LOCAL DEVELOPMENT
// ======================================

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

// ======================================
// VERCEL SERVERLESS ENTRY POINT
// ======================================

module.exports = app;
