const express = require("express");

const reportRouter = express.Router();

const reportController = require("../../controllers/interactionsController/reportController");

reportRouter.post("/create-report-review", reportController.createReportReview);

module.exports = reportRouter;