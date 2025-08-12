const express = require("express");

const paymentRouter = express.Router();

const verifyChannelOwnership = require("../../middlewares/verifyChannelOwnership");

const verifyLoggedIn = require("../../middlewares/verifyLoggedIn");

const momoMethod = require("../../services/paymentMethod/momoMethod");

const vnpayMethod = require("../../services/paymentMethod/vnpayMethod");

// ** MOMO

paymentRouter.post("/momo/create-transaction-momo", verifyLoggedIn, momoMethod.createTransactionMomo);

paymentRouter.post("/momo/callback", momoMethod.callbackMomo);

paymentRouter.post("/momo/transaction-status", momoMethod.transactionStatus);

// ** VNPay

paymentRouter.post("/vnpay/create-transaction-vnpay", verifyLoggedIn, vnpayMethod.createTransactionVnpay);

paymentRouter.get("/vnpay/callback-vnpay", vnpayMethod.callbackVnpay);

module.exports = paymentRouter;