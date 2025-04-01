const { default: mongoose } = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        if (conn.connection.readyState === 1) {
            console.log("MongoDB connection is successful ✅");
        } else {
            console.log("MongoDB connection is failed ❌");
        }
    } catch (error) {
        console.log("Database connection is failed ❌");
        throw new Error(error);
    }
}

module.exports = connectDB;