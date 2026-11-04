
const verifyAdmin = async (req, res, next) => {
    try {
        const usersCollection = req.app.locals.usersCollection;

        if (!usersCollection) {
            return res.status(503).send({
                success: false,
                message: "User database is unavailable",
            });
        }

        const user = await usersCollection.findOne({
            uid: req.user.uid,
        });

        if (!user) {
            return res.status(403).send({
                success: false,
                message: "User account not found",
            });
        }

        if (user.role !== "admin" && user.role !== "superadmin") {
            return res.status(403).send({
                success: false,
                message: "Admin access denied",
            });
        }

        req.admin = user;

        next();

    } catch (error) {
        console.error("Admin verification failed:", error);

        return res.status(500).send({
            success: false,
            message: "Failed to verify admin access",
        });
    }
};

module.exports = verifyAdmin;
