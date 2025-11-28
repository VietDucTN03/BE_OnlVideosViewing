const mongoose = require('mongoose');

// ** Payment method.

const paymentSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ['momo', 'vnpay'],
            required: true
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
        paymentMeta: {   // ? Information depends on the method.
            type: Object,
            default: {}
        },
        paymentDate: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);