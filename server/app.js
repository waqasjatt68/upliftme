import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import SocketSetup from "./services/websocketService.js"
import connectDB from "./db/index.js";
import userRoutes from "./routes/userRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import flaggedUserRoutes from "./routes/flaggedUserRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import matchingRoutes from "./routes/matchingRoutes.js"
import authMiddleware from "./middlewares/auth.middleware.js"
import { AccessToken } from 'livekit-server-sdk'
import twilio from 'twilio';
import  verifySubscription  from "./middlewares/verifySubscription.middleware.js"; // Adjust the path as needed
const apiKey = 'APItSDnBLzLn8Y4'; // Use your real API Key
const apiSecret = 'N0PpdPK2UeIVrTse2gbd4GNDIQrZ1U4P'; // Use your real API Secret
// Twilio Video (use env vars in production: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_SECRET)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC122a623d92ce90b6678467519142d53c';
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || 'SK76e1d498bc8b4ba6bb67918622c9ee00';
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET || 'N0PpdPK2UeIVrTse2gbd4GNDIQrZ1U4P';
import {
    handleStripeWebhook
} from "./controllers/paymentController.js";

dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);

app.post(
  "/api/payments/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

SocketSetup(server, { 
  cors: { 
    credentials: true,
  } 
});




app.use(cors({
  // origin: `${process.env.CLIENT_URI}`,
  origin: ["http://127.0.0.1:5173","http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use("/api/verifyhook/webhook", bodyParser.raw({ type: "application/json" }));
app.use("/api/verifyhook",((req, res,next)=>{
  console.log("verifyhook middleware called");
  next()
}), paymentRoutes);
app.post("/api/payments/webhook", bodyParser.raw({type: "application/json"}), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser()); // 🔥 MUST be BEFORE routes



// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Backend server is running successfully!",
    status: "OK",
    port: 4000,
    availableAPIs: {
      user: "/api/user",
      admin: "/api/admin",
      sessions: "/api/sessions",
      payments: "/api/payments",
      referrals: "/api/referrals",
      subscriptions: "/api/subscriptions",
      token: "/api/token (POST)",
      "get-twilio-token": "/api/get-twilio-token (POST)",
      matching:"/api/matching"
    }
  });
});

// Twilio Video token (must be before other /api routes so it's always registered)
app.post('/api/get-twilio-token', authMiddleware, (req, res) => {
  try {
    const { identity, roomName } = req.body;
    const id = identity || req.user?.username || req.user?.email || `user-${Date.now()}`;
    const room = roomName || 'upliftme-room';

    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_SECRET,
      { identity: id, ttl: 3600 }
    );
    const videoGrant = new VideoGrant({ room });
    token.addGrant(videoGrant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Twilio token error:', err);
    res.status(500).json({ error: 'Failed to create video token' });
  }
});

//Routes
app.use("/api/user", userRoutes);
app.post('/api/token', authMiddleware, verifySubscription, async(req, res) => {
  const { callerName, roomName } = req.body;

  if (!callerName || !roomName) {
    return res.status(400).json({ error: 'Missing caller name or roomName' });
  }

  // Generate the token
  const at =  new AccessToken(apiKey, apiSecret, {
    identity: callerName, // User Identity
    ttl: 60 * 60, // Token valid for 1 hour
  });

  // Add required grants (permissions)
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  
  
  // Generate the token (JWT)
  const token = await at.toJwt();
  
  
  // Send the token back to the client
  res.json({ token });
});

app.use("/api/admin", adminRoutes);
app.use("/api/sessions",authMiddleware, sessionRoutes);
app.use("/api/flagged-users", authMiddleware, flaggedUserRoutes);
app.use("/api/payments", authMiddleware, paymentRoutes);
app.use("/api/verifyhook", paymentRoutes);
app.use("/api/referrals", authMiddleware, referralRoutes);
app.use("/api/subscriptions",authMiddleware, subscriptionRoutes);
app.use("/api/matching",authMiddleware, matchingRoutes);



connectDB().then(() => {
  server.listen(4000, () => console.log("Server running on port 4000"));
}).catch((err) => console.log("Error while connecting to DB", err));







