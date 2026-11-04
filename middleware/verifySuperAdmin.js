const verifySuperAdmin = async (req, res, next) => {
    try {
        const usersCollection = req.app.locals.usersCollection;

        if (!usersCollection) {
            return res.status(503).send({
                success: false,
                message: "Database is not available",
            });
        }

        if (req.user.email_verified !== true) {
            return res.status(403).send({
                success: false,
                message: "Please verify your email first",
            });
        }

        const user = await usersCollection.findOne({
            uid: req.user.uid,
        });

        if (!user || user.role !== "superadmin") {
            return res.status(403).send({
                success: false,
                message: "Super Admin access required",
            });
        }

        req.superAdmin = user;
        next();
    } catch (error) {
        console.error("Super Admin verification error:", error);

        res.status(500).send({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = verifySuperAdmin;