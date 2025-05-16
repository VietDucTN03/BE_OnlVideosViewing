const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
        },
        contentType: {
            type: String,
            enum: ["Video", "Comment", "Blog"],
            required: true,
        },
        contentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
            contentLink: {
            type: String,
            default: "",
        },
        reason: {
            type: String,
            enum: [
                "Nội dung không phù hợp",
                "Ngôn từ thô tục hoặc quấy rối",
                "Thông tin sai sự thật",
                "Spam hoặc quảng cáo",
                "Nội dung phản cảm",
                "Vi phạm bản quyền",
                "Khác",
            ],
            required: true,
        },
        additionalNote: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
