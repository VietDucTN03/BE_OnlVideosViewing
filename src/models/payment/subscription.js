const mongoose = require('mongoose');

// ** Thông tin gói dịch vụ.

const subscriptionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ['Basic', 'Premium']
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        periodType: {
            type: String,
            enum: ['day', 'week', 'month'],
            required: true
        },
        features: [String],   // ? Tính năng của gói.
        isActive: {
            type: Boolean,
            default: true
        },
        totalSubscribers: {
            type: Number,
            default: 0
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);