const Channel = require("../../models/user/channel");
const Notification = require("../../models/interactions/notification");
const { io } = require("../../utils/socket.io/socket");
const sendMail = require("../sendMail/sendMail");
require("dotenv").config();

const urlClient = process.env.URL_CLIENT;

const updateUserSubscription = async ({ userId, subscriptionName, endDate, type }) => {
  try {
    const channel = await Channel.findOne({ owner: userId }).populate("owner", "email username");

    if (!channel || !channel.owner) {
      console.warn(`Không tìm thấy channel hoặc user cho userId: ${userId}`);
      return;
    }

    const channelId = channel._id;

    const email = channel.owner.email;
    const username = channel.owner.username;

    const subject = type === "expired" ? "Gói Premium của bạn đã hết hạn" : "Gói Premium của bạn đã bị hủy";

    const html = `
        <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#f0fdfa;">
            <div style="background:linear-gradient(90deg,#14b8a6,#06b6d4);color:white;padding:24px;text-align:center;">
                <h2 style="margin:0;font-size:24px;">Metube</h2>
            </div>
            <div style="padding:24px;">
                <h3 style="color:#0f172a;margin-top:0;">Xin chào ${username},</h3>
                <p style="color:#334155;line-height:1.6;">
                    Gói <b>${subscriptionName}</b> của bạn ${type === "expired" ? "đã hết hạn" : "đã bị hủy"} vào ngày ${new Date(endDate).toLocaleString()}.
                </p>
                <p style="color:#334155;line-height:1.6;">
                    Hãy nâng cấp trải nghiệm Metube của bạn bằng cách đăng ký gói Premium.
                </p>
                <div style="text-align:center;margin:30px 0;">
                    <a href="${urlClient}/payment" style="background:#14b8a6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;">
                        ✉️ Nâng cấp ngay.
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
    `;

    await sendMail({
      from: `"Support Team" <${process.env.EMAIL_NAME}>`,
      email,
      subject,
      html,
    });

    await Notification.create({
      receiverId: channelId,
      type: "expired",
      message: subject,
      detailContent: `Gói ${subscriptionName} ${type === "expired" ? "đã hết hạn" : "đã bị hủy"}.`,
      // metadata: { endDate, type },
    });

    io.to(channelId.toString()).emit("expired", {
      subscriptionName,
      endDate,
      type,
    });

    console.log(`✅ updateUserSubscription: đã gửi thông báo cho user ${userId}`);
  } catch (error) {
    console.error("❌ Lỗi trong updateUserSubscription:", error);
  }
};

module.exports = updateUserSubscription;
