const sendMail = require("../sendMail/sendMail");
const Notification = require("../../models/interactions/notification");
const User = require("../../models/user/user");
const { io } = require("../socket.io/socket");
require("dotenv").config();

const urlClient = process.env.URL_CLIENT;
const emailAdmin = process.env.EMAIL_NAME;

async function notifyPremiumUpgrade({ userId, paymentMethod, subscription, startDate, endDate, channelId }) {
    try {
        // Get user information
        const user = await User.findById(userId);
        if (!user) return;

        // Send email
        if (user.email) {
            await sendMail({
                from: emailAdmin,
                email: user.email,
                subject: "Congratulations! Your account has been upgraded to Premium!",
                html: `
                    <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#f0fdfa;">
                        <div style="background:linear-gradient(90deg,#14b8a6,#06b6d4);color:white;padding:24px;text-align:center;">
                            <h2 style="margin:0;font-size:24px;">Metube</h2>
                        </div>
                        <div style="padding:24px;">
                            <h3 style="color:#0f172a;margin-top:0;">Hello ${user.username},</h3>
                            <p style="color:#334155;line-height:1.6;">
                                You have successfully subscribed to the <b>${subscription.name}</b> package.
                            </p>
                            <p style="color:#334155;line-height:1.6;">
                                Payment method: <b>${paymentMethod}</b>.
                            </p>
                            <p style="color:#334155;line-height:1.6;">
                                Expiration date: from <b>${startDate.toLocaleDateString()}</b> to <b>${endDate.toLocaleDateString()}</b>.
                            </p>
                            <div style="text-align:center;margin:30px 0;">
                                <a href="${urlClient}" style="background:#14b8a6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;">
                                    Experience now.
                                </a>
                            </div>
                            <p style="color:#64748b;font-size:14px;">
                                Thank you for trusting and using our services.
                            </p>
                        </div>
                        <div style="background:#e0f2fe;color:#334155;padding:18px;text-align:center;font-size:13px;">
                            &copy; ${new Date().getFullYear()} Your Platform Name. All rights reserved.
                        </div>
                    </div>
                `
            });
        }

        // Create notification
        const notification = await Notification.create({
            receiverId: channelId,
            type: "premium",
            message: `Account ${subscription.name} has been upgraded successfully 🎉`,
            detailContent: `Hi ${user.username}, congratulations on successfully upgrading your ${subscription.name} package! Valid until ${endDate.toLocaleDateString()}, paid via ${paymentMethod}, price ${subscription.price.toLocaleString()} VND.`,
            createdAt: new Date(),
        });

        // Send real-time notifications via socket
        io.to(userId.toString()).emit("premium", {
            receiverId: channelId,
            message: notification.message,
        });

    } catch (error) {
        console.error("Error notifying premium upgrade:", error);
    }
}

module.exports = notifyPremiumUpgrade;