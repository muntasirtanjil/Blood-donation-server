
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = require("../firebase-service-account.json");

const app =
    getApps().length > 0
        ? getApps()[0]
        : initializeApp({
              credential: cert(serviceAccount),
          });

module.exports = {
    auth: () => getAuth(app),
};
