const { default: mongoose } = require("mongoose");

const mongoURL = process.env.MONGO_URL;

const connectDB = async () => {
    console.log("Connecting to MongoDB:", process.env.MONGO_URL);
    try {
        const conn = await mongoose.connect(mongoURL);
        if (conn.connection.readyState === 1) {
            console.log("MongoDB connection is successful ✅");
            // console.log("Connected DB name:", mongoose.connection.name); // nên là "videosviewing"
        } else {
            console.log("MongoDB connection is failed ❌");
        }
    } catch (error) {
        console.log("Database connection is failed ❌");
        throw new Error(error);
    }
}

module.exports = connectDB;