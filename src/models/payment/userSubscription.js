const mongoose = require('mongoose');

// ** Lịch sử đăng ký gói của kênh.

const userSubscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            required: true
        },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: true
        },
        autoRenew: {    // ? Tự động gia hạn.
            type: Boolean,
            // default: true
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        cancelledAt: Date
    },
    { timestamps: true }
);

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);