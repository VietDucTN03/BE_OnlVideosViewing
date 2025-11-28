const cron = require("node-cron");
const { checkExpiredSubscriptions } = require("../../services/subscriptionServices/subscriptionServices");

function initCronJobs() {
    cron.schedule("*/10 * * * *", async () => {
        console.log("🔄 Checking for subscription expiration every 10 minutes...");
        await checkExpiredSubscriptions();
    });
};

module.exports = initCronJobs;