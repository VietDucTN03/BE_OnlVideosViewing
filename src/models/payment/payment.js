const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            required: true,
            enum: ['credit_card', 'paypal', 'bank_transfer']
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: {
            type: String,
            unique: true
        },
        paymentDate: {
            type: Date,
            default: Date.now
        }
    },  
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);