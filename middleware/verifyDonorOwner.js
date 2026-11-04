
const verifyDonorOwner = (req, res, next) => {
    const requestedUid = req.params.uid;

    // Check whether the logged-in user owns this donor profile
    if (req.user.uid !== requestedUid) {
        return res.status(403).send({
            success: false,
            message: "You are not allowed to access this donor profile",
        });
    }

    next();
};

module.exports = verifyDonorOwner;
