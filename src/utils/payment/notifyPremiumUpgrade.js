const sendMail = require("../sendMail/sendMail");
const Notification = require("../../models/interactions/notification");
const User = require("../../models/user/user");
const { io } = require("../socket.io/socket");
require("dotenv").config();

const urlClient = process.env.URL_CLIENT;
const emailAdmin = process.env.EMAIL_NAME;

async function notifyPremiumUpgrade({ userId, paymentMethod, subscription, startDate, endDate, channelId }) {
    try {
        // 1️⃣ Lấy thông tin user
        const user = await User.findById(userId);
        if (!user) return;

        // 2️⃣ Gửi email thông báo
        if (user.email) {
            await sendMail({
                from: emailAdmin,
                email: user.email,
                subject: "Chúc mừng! Tài khoản của bạn đã nâng cấp Premium 🎉",
                html: `
                    <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#f0fdfa;">
                        <div style="background:linear-gradient(90deg,#14b8a6,#06b6d4);color:white;padding:24px;text-align:center;">
                            <h2 style="margin:0;font-size:24px;">Metube</h2>
                        </div>
                        <div style="padding:24px;">
                            <h3 style="color:#0f172a;margin-top:0;">Xin chào ${user.username},</h3>
                            <p style="color:#334155;line-height:1.6;">
                                Bạn đã đăng ký gói <b>${subscription.name}</b> thành công.
                            </p>
                            <p style="color:#334155;line-height:1.6;">
                                Phương thức thanh toán: <b>${paymentMethod}</b>.
                            </p>
                            <p style="color:#334155;line-height:1.6;">
                                Thời hạn sử dụng: từ <b>${startDate.toLocaleDateString()}</b> đến <b>${endDate.toLocaleDateString()}</b>.
                            </p>
                            <div style="text-align:center;margin:30px 0;">
                                <a href="${urlClient}" style="background:#14b8a6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;">
                                    ✉️ Trải nghiệm ngay.
                                </a>
                            </div>
                            <p style="color:#64748b;font-size:14px;">
                                Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi.
                            </p>
                        </div>
                        <div style="background:#e0f2fe;color:#334155;padding:18px;text-align:center;font-size:13px;">
                            &copy; ${new Date().getFullYear()} Your Platform Name. All rights reserved.
                        </div>
                    </div>
                `
            });
        }

        // 3️⃣ Tạo thông báo trong hệ thống
        const notification = await Notification.create({
            receiverId: channelId,
            type: "premium",
            message: `Tài khoản đã được nâng cấp ${subscription.name} thành công 🎉`,
            detailContent: `Xin chào ${user.username}, chúc mừng bạn đã nâng cấp gói ${subscription.name} thành công! Hiệu lực đến ${endDate.toLocaleDateString()}, thanh toán qua ${paymentMethod}, giá ${subscription.price.toLocaleString()} VND.`,
            createdAt: new Date(),
        });

        // 4️⃣ Gửi thông báo real-time qua socket
        io.to(userId.toString()).emit("premium", {
            receiverId: channelId,
            message: notification.message,
        });

    } catch (error) {
        console.error("Lỗi khi gửi thông báo premium:", error);
    }
}

module.exports = notifyPremiumUpgrade;