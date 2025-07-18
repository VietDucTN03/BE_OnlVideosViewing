const mongoose = require('mongoose');

const channelSubscriptionSchema = new mongoose.Schema(
    {
        channelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Channel',
            required: true
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            required: true
        },
        startDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: true
        },
        autoRenew: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        cancelledAt: {
            type: Date
        }
    }, 
    { timestamps: true }
);

module.exports = mongoose.model('ChannelSubscription', channelSubscriptionSchema);