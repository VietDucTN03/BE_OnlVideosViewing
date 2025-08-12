const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Channel",
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            ref: "Channel",
        },
        senderName: {
            type: String,
            required: false,
        },
        senderAvatar: {
            type: String,
            required: false,
        },        
        type: {
            type: String,
            enum: ["subscribe", "unsubscribe", "like", "comment", "reply", "summary", "comment_summary", "reply_summary", "warning", "banned", "premium", "subscriptionChanged", "expired"],
            required: true,
        },
        groupId: String,  // Id Comment gốc
        counter: { type: Number, default: 0 }, // số người đã reply
        message: {
            type: String,
            required: true,
        },
        detailContent: {
            type: String,
            required: false,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);