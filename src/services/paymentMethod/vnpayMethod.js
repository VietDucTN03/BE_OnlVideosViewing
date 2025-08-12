const Payment = require("../../models/payment/payment");
const Subscription = require("../../models/payment/subscription");
const UserSubscription = require("../../models/payment/userSubscription");
const User = require("../../models/user/user");
const Channel = require("../../models/user/channel");
const asyncHandler = require("express-async-handler");
require("dotenv").config();
const crypto = require("crypto");
const axios = require("axios");

const notifyPremiumUpgrade = require("../../utils/payment/notifyPremiumUpgrade");

const { VNPay, ignoreLogger, ProductCode, VnpLocate, dateFormat } = require('vnpay');

// ? Payment VNPAY
const tmnCodeVnpay = process.env.TMN_CODE;
const secureSecretVnpay = process.env.SECURE_SECRET;
const urlNgrok = process.env.NGROK;
const urlServer = process.env.URL_SERVER;
const urlClient = process.env.URL_CLIENT;

const createTransactionVnpay = asyncHandler(async (req, res) => {

    const { subscriptionId, userId } = req.body;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
    }
    const amount = subscription.price;

    let clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip;

    if (clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.replace("::ffff:", "");
    }

    console.log("clientIp: ", clientIp);

    const orderId = `${subscriptionId}-${Date.now()}`;

    try {
        const vnpay = new VNPay({
            tmnCode: tmnCodeVnpay,
            secureSecret: secureSecretVnpay,
            vnpayHost: "https://sandbox.vnpayment.vn",
            testMode: true,
            hashAlgorithm: "SHA512",
        });

        // 3. Tạo URL thanh toán
        const paymentUrl = await vnpay.buildPaymentUrl({
            vnp_Amount: amount * 100,
            vnp_IpAddr: clientIp,
            vnp_TxnRef: orderId,
            vnp_OrderInfo: "Thanh toán đơn hàng #" + orderId,
            vnp_OrderType: "billpayment",
            vnp_ReturnUrl: `${urlNgrok || urlServer}/api/payment/vnpay/callback-vnpay?redirect=${encodeURIComponent(urlClient)}`,
            vnp_BankCode: "NCB",
            vnp_CreateDate: dateFormat(new Date(), "yyyymmddHHMMss"),
            vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000), "yyyyMMddHHmmss"),
            vnp_Locale: "vn",
            vnp_Command: "pay",
            vnp_Version: "2.1.0",
        });

        await Payment.create({
            userId,
            subscriptionId,
            amount,
            paymentMethod: "vnpay",
            status: "pending",
            transactionId: orderId,
            paymentMeta: {
                paymentUrl
            }
        });

        return res.status(201).json({ paymentUrl });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Lỗi tạo URL thanh toán VNPay" });
    }
});

const callbackVnpay = asyncHandler(async (req, res) => {
    const data = req.query;
    console.log("Data from VNPay: ", data);
    const redirectUrl = req.query.redirect || urlClient;

    try {
        const payment = await Payment.findOne({ transactionId: data.vnp_TxnRef });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        if (data.vnp_ResponseCode === "00" && data.vnp_TransactionStatus === "00") {
            payment.status = "completed";
            payment.paymentMeta.vnpayCallback = data;
            await payment.save();

            const subscription = await Subscription.findById(payment.subscriptionId);
            if (!subscription) {
                return res.status(404).json({ message: "Subscription not found" });
            }

            const startDate = new Date();
            let endDate = new Date(startDate);

            if (subscription.periodType === "day") {
                endDate.setDate(endDate.getDate() + subscription.duration);
            } else if (subscription.periodType === "week") {
                endDate.setDate(endDate.getDate() + subscription.duration * 7);
            } else if (subscription.periodType === "month") {
                endDate.setMonth(endDate.getMonth() + subscription.duration);
            }

            const channel = await Channel.findOne({ owner: payment.userId });
            if (channel) {
                channel.isPremium = true;
                await channel.save();
            }

            await UserSubscription.create({
                userId: payment.userId,
                subscriptionId: payment.subscriptionId,
                paymentId: payment._id,
                startDate,
                endDate,
                autoRenew: true,
                status: "active"
            });

            await notifyPremiumUpgrade({
                userId: payment.userId,
                paymentMethod: "VNPay",
                subscription,
                startDate,
                endDate,
                channelId: channel?._id
            });

            return res.redirect(redirectUrl);
        } else {
            payment.status = "failed";
            payment.paymentMeta.vnpayCallback = data;
            await payment.save();
            console.warn("VNPay payment failed");
        }

        return res.status(200).json({ message: "VNPay callback processed successfully" });
    } catch (err) {
        console.error("Error processing VNPay callback:", err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = {
    createTransactionVnpay,
    callbackVnpay,
};