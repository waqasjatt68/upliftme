import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI || !MONGODB_URI.trim()) {
            console.error("MONGODB_URI is not set in .env. Add MONGODB_URI to your server .env file.");
            process.exit(1);
        }
        const uri = MONGODB_URI.trim();
        const connectionInstance = await mongoose.connect(uri);
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        console.log(`Database Name: ${connectionInstance.connection.name || DB_NAME}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1);
    }
};

export default connectDB