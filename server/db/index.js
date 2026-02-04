import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
const connectDB = async () => {
    try {
        // Use environment variable if available, otherwise use hardcoded values
        const MONGODB_URI = process.env.MONGODB_URI || `mongodb://localhost:27017/${DB_NAME}?retryWrites=true&w=majority&connectTimeoutMS=30000`;
        
        const connectionInstance = await mongoose.connect(MONGODB_URI);
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        console.log(`Database Name: ${DB_NAME}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB