const cron = require("node-cron");
const { checkExpiredSubscriptions } = require("../../services/subscriptionServices/subscriptionServices");

function initCronJobs() {
    cron.schedule("*/10 * * * *", async () => {
        console.log("🔄 Đang kiểm tra subscription hết hạn mỗi 10 phút...");
        await checkExpiredSubscriptions();
    });
};

module.exports = initCronJobs;