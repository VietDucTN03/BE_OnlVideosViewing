const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/connectDB");
const rootRouter = require("./routes/rootRouter");
require("./passport");

const { app, httpServer } = require("./utils/socket.io/socket");

const fileUpload = require("express-fileupload");

// const { generalLimiter } = require("./middlewares/rateLimit");

const errorHandler = require("./middlewares/errorHandler");

const initCronJobs = require("./utils/cronJobs/initCronJobs");

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.URL_CLIENT,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

// app.use(generalLimiter);

app.use(
  fileUpload({
    createParentPath: true, // Ensure the parent path is created if it does not exist.
  })
);

// app.use('/', (req, res) => { res.send('Server is running') });
app.use(rootRouter);

app.use(errorHandler);

initCronJobs();

const port = process.env.PORT || 5000;

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
