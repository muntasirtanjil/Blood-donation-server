
const { auth } = require("../config/firebaseAdmin");

const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return res.status(401).send({
                success: false,
                message: "Unauthorized access",
            });
        }

        const token = authorization.split(" ")[1];

        const decodedToken = await auth().verifyIdToken(token);

        req.user = decodedToken;

        next();

    } catch (error) {
        console.error("Token verification failed:", error.message);

        return res.status(401).send({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

module.exports = verifyFirebaseToken;
