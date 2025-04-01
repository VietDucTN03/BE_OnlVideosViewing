const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/connectDB");
const rootRouter = require("./routes/rootRouter");
require("./passport");

const app = express();
app.use(cookieParser());
app.use(cors({
    origin: process.env.URL_CLIENT,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

// app.use('/', (req, res) => { res.send('Server is running') });
app.use(rootRouter);

const port = process.env.PORT || 8080;

app.listen(port, () => { console.log(`Server is running on port ${port}`) });

