
// my old working code before livekit intigration start

import { Server } from "socket.io";
import mongoose from "mongoose";
import Session from "../models/session.model.js";
import Subscription from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
const MAX_CALL_DURATION = 7 * 60 * 1000; // 15 minutes in milliseconds

// User data structure
class User {
  constructor(socketId, username, dbId, role, rating, profilePicture,connectionState) {
    this.socketId = socketId;
    this.username = username;
    this.dbId = dbId;
    this.role = role;
    this.state = "online";
    this.sessionId = null;
    this.rating = rating;
    this.profilePicture = profilePicture;
    this.lastActivity = Date.now();
    this.connectionState = "disconnected"; // away, connected, disconnected
  }
}

// Call connection data structure
class CallConnection {
  constructor(callerSocketId, calleeSocketId) {
    this.id = `${callerSocketId}-${calleeSocketId}`;
    this.callerSocketId = callerSocketId;
    this.calleeSocketId = calleeSocketId;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = "initiating"; // "initiating", "connected", "ended"
    this.iceQueue = {
      caller: [],
      callee: []
    };
    this.timeout = null;
  }
}

const SocketSetup = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Enhanced data structures
  const emailToSocketIdMap = new Map();
  const socketIdToEmailMap = new Map();
  const socketIdToUserMap = new Map();
  const dbIdToSocketIdMap = new Map();
  const activeConnections = new Map(); // Stores CallConnection objects

  // Helper to get all online users as array
  const getOnlineUsers = () => {
    return Array.from(socketIdToUserMap.values());
  };

  // Helper to broadcast updated users list
  const broadcastUsersList = () => {
    io.emit("usersList", getOnlineUsers());
    io.emit("onlineUsers", socketIdToUserMap.size);
    io.emit("activeCalls", activeConnections.size);
  };

  io.on("connection", (socket) => {
    socket.emit("me", socket.id);
    broadcastUsersList();

    socket.on("getUsers", () => {
      // console.log(socketIdToUserMap);
      // console.log(socketIdToUserMap.size);

      socket.emit("onlineUsers", socketIdToUserMap.size);
      socket.emit("activeCalls", activeConnections.size);
    });

    socket.on("registerUser", ({ username, dbid, role, rating, profilePicture }) => {
      if (!username || !dbid) {
        console.warn("registerUser: Missing required fields:", { username, dbid });
        socket.emit("error", { message: "Username and dbid are required" });
        return;
      }


      try {
        // Check if this user already exists with a different socket
        const existingSocketId = dbIdToSocketIdMap.get(dbid);
        if (existingSocketId && existingSocketId !== socket.id) {
          // console.log(`User already exists with socket ${existingSocketId}, removing old reference`);
          // Clean up the old socket reference
          socketIdToUserMap.delete(existingSocketId);
        }

        // Check rating is valid (to avoid NaN or undefined which caused issues)
        const validRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;

        // Create or update user
        const user = new User(socket.id, username, dbid, role, validRating, profilePicture);
        socketIdToUserMap.set(socket.id, user);
        dbIdToSocketIdMap.set(dbid, socket.id);

        // console.log(`User registered successfully: ${username} (${dbid})`);

        // Send confirmation to the user
        socket.emit("registrationSuccess", {
          socketId: socket.id,
          username,
          role
        });

        // Broadcast updated users list
        broadcastUsersList();
      } catch (error) {
        console.error("Error registering user:", error);
        socket.emit("error", { message: "Failed to register user" });
      }
    });


    
    // Video Call with LivekitApp code from here
    socket.on("offerVideoCall", async ({
      callerName,
      roomName,
      colleeId,
      userMood,
    }) => {
      // console.log("Video call offer initiated:", {
      //   callerSocketId: socket.id,
      //   calleeSocketId: colleeId,
      //   callerName,
      //   roomName
      // });

      // Validate both users exist before proceeding
      const caller = socketIdToUserMap.get(socket.id);
      const callee = socketIdToUserMap.get(colleeId);

      if (!caller) {
        console.error("Call failed: Caller not found in user map:", socket.id);
        socket.emit("call:error", "Your session data is missing. Please reconnect.");
        return;
      }

      if (!callee) {
        console.error("Call failed: Callee not found in user map:", colleeId);
        socket.emit("call:error", "The user you're trying to call is no longer available.");
        return;
      }

      // Check if either user is already in a call
      if (caller.state === "busy") {
        console.warn("Call failed: Caller is already in another call");
        socket.emit("call:error", "You are already in an active call.");
        return;
      }

      if (callee.state === "busy") {
        console.warn("Call failed: Callee is already in another call");
        socket.emit("call:error", "This user is already in another call.");
        return;
      }

      // Update user states
      caller.state = "busy";
      callee.state = "busy";

      // Create connection
      const connection = new CallConnection(socket.id, colleeId);
      activeConnections.set(connection.id, connection);

      // Create session in database
      try {
        // console.log("Creating session in database:", {
        //   heroId: caller.dbId,
        //   uplifterId: callee.dbId,
        //   initialMood: userMood
        // });

        const callResponse = await Session.create({
          heroId: new mongoose.Types.ObjectId(caller.dbId),
          uplifterId: new mongoose.Types.ObjectId(callee.dbId),
          startTime: new Date(),
          status: "ongoing",
          initialMood: userMood,
          paymentStatus: "free", // TODO: Change this to paid when we have payment integration
        });

        // console.log("Session created successfully:", callResponse._id);
        connection.callId = callResponse._id;

        // Store session ID in user objects
        if (callResponse) {
          caller.sessionId = callResponse._id.toString();
          callee.sessionId = callResponse._id.toString();
          // console.log("Session ID stored in user objects:", callResponse._id.toString());
        }
      } catch (error) {
        console.error("Error creating call session:", error);
        socket.emit("call:error", "Failed to create call session");

        // Reset user states
        caller.state = "online";
        callee.state = "online";

        // Remove connection
        activeConnections.delete(connection.id);
        return;
      }

      // Set timeout for max call duration
      connection.timeout = setTimeout(() => {
        // console.log("Call timed out after max duration:", MAX_CALL_DURATION);
        socket.emit("endVideoCall");
        socket.to(colleeId).emit("endVideoCall");
        activeConnections.delete(connection.id);

        // Reset user states
        if (socketIdToUserMap.has(socket.id)) {
          socketIdToUserMap.get(socket.id).state = "online";
        }
        if (socketIdToUserMap.has(colleeId)) {
          socketIdToUserMap.get(colleeId).state = "online";
        }

        broadcastUsersList();
      }, MAX_CALL_DURATION);

      broadcastUsersList();

      // Send offer to callee
      // console.log("Sending call offer to:", colleeId);
      socket.to(colleeId).emit("offerVideoCall", {
        callerName: callerName,
        roomName: roomName,
        socketId: socket.id
      });
    });

    socket.on("endVideoCall", async ({ idToEndCall }) => {
      // console.log("Call ending request received:", {
      //   fromSocketId: socket.id,
      //   toSocketId: idToEndCall
      // });

      // Get user and validate
      const user = socketIdToUserMap.get(socket.id);
      if (!user) {
        console.warn("endVideoCall: User not found in socket map:", socket.id);
        return;
      }

      // Get session ID and validate
      const sessionId = user.sessionId;
      if (!sessionId) {
        console.warn("No active session found for call end:", {
          userId: user.dbId,
          username: user.username
        });
        return;
      }

      try {
        // console.log(`Finding session to end: ${sessionId}`);
        const session = await Session.findOne({
          _id: sessionId,
          status: "ongoing"
        });

        if (!session) {
          console.warn(`Session not found or not ongoing: ${sessionId}`);
          // Still reset the user state
          user.state = "online";
          user.sessionId = null;
          broadcastUsersList();
          return;
        }

        // console.log(`Updating session ${sessionId} to pending status`);
        // Update session status and end time
        session.status = "pending";
        session.endTime = new Date();

        // Calculate duration
        const now = new Date();
        const diffMs = now - session.startTime;
        const diffSec = Math.floor(diffMs / 1000);
        session.duration = diffSec;

        await session.save();

         const subscription = await Subscription.findOne({ userId: session.heroId });

              if (subscription) {
                const now = new Date();

                // ✅ Case 1: User has a valid weekly subscription (unlimited)
                if (subscription.hasWeeklySubscription && subscription.weeklyExpiresAt > now && subscription.sessionBalance >= 1) {
                  // console.log(`User ${session.heroId} has a valid weekly subscription (unlimited). No deduction needed.`);
                  subscription.sessionBalance -= 1; // Reset session balance for unlimited weekly subscription
                  subscription.lastUpdated = now;
                  await subscription.save();
                  // ✅ Case 2: No valid weekly — check and deduct from bundle
                } else if (subscription.hasExtendedSubscription && subscription.sessionBalance >= 1) {
                  subscription.sessionBalance -= 1;
                  subscription.lastUpdated = now;
                  await subscription.save();
                  // console.log(`Decreased session balance for user ${session.heroId}`);

                  // ❌ Case 3: Neither valid weekly nor available bundle sessions
                } else {
                  // console.log(`User ${session.heroId} has no valid subscription or sessions left.`);
                  // Optionally: notify user, block session, etc.
                }

              } else {
                // console.log(`No subscription found for user ${session.heroId}`);
                // Optionally: handle this (e.g., deny session, notify admin, etc.)
              }

        // console.log("Hero Id", session.heroId);

        // console.log(`Session updated: ${sessionId}, duration: ${diffSec}s`);

        // Clear session reference and reset state
        user.state = "online";


        // Find connection and clear timeout
        for (const [connectionId, connection] of activeConnections.entries()) {
          if (connection.callerSocketId === socket.id || connection.calleeSocketId === socket.id) {
            clearTimeout(connection.timeout);
            activeConnections.delete(connectionId);
            // console.log(`Connection removed: ${connectionId}`);
            break;
          }
        }

        // Reset other user if they're still online
        if (idToEndCall && socketIdToUserMap.has(idToEndCall)) {
          const otherUser = socketIdToUserMap.get(idToEndCall);
          otherUser.state = "online";
          // console.log(`Reset state for other user: ${otherUser.username}`);
        }

        // Notify the other party
        if (idToEndCall) {
          // console.log(`Sending endVideoCall event to: ${idToEndCall}`);
          socket.to(idToEndCall).emit("endVideoCall");
        }

      } catch (error) {
        console.error("Error ending call session:", error);
      }

      // Always broadcast updated users list
      broadcastUsersList();
    });


    socket.on("endFromPromptVideoCall", async (data) => {
      // console.log("Call ended");
      const user = socketIdToUserMap.get(socket.id);
      const sessionId = user.sessionId;
      if (user) {
        user.state = "online";
      }
      const otherUser = socketIdToUserMap.get(data.socketId);
      if (otherUser) {
        otherUser.state = "online";
      }
      if (!sessionId) {
        // console.log("No active session found for feedback");
        return;
      }

      const session = await Session.findOne({
        _id: sessionId,
        status: "ongoing"
      });
      if (session) {
        session.status = "declined";
        await session.save();
        user.sessionId = null;
      }
      socket.to(data.socketId).emit("endFromPromptVideoCall");
      broadcastUsersList();
    })
    // Video Call with LivekitApp code End Here



    socket.on("feedback", async ({ callerId, finalMood, feedback, inappropriate, uplifterRating }) => {
      const user = socketIdToUserMap.get(socket.id);
      console.log(user);

      if (!user || user.role !== "hero") {
        console.warn("Unauthorized or unknown user tried to send feedback.");
        return;
      }

      if (typeof finalMood !== 'number' || typeof uplifterRating !== 'number') {
        socket.emit("error", { message: "Invalid feedback data." });
        console.log("Invalid feedback data:", { finalMood, feedback, inappropriate, uplifterRating });

        return;
      }

      const sessionId = user.sessionId;
      if (!sessionId) {
        console.warn("No active session found for feedback:", user);
        return;
      }

      try {
        const session = await Session.findOne({ _id: sessionId, status: { $in: ["ongoing", "pending"] } });
        if (!session) {
          console.warn("Session not found or already completed:", sessionId);
          return;
        }
        console.log(session);

        session.finalMood = finalMood;
        session.feedback = feedback;
        session.ratingGiven = uplifterRating;
        session.inappropriate = !!inappropriate;
        session.status = "completed";
        await session.save();
        user.sessionId = null;

        const uplifter = await UserModel.findById(session.uplifterId);
        if (!uplifter) {
          console.warn("Uplifter not found:", session.uplifterId);
          return;
        }

        if (uplifterRating > 0) {
          uplifter.ratings = uplifter.ratings > 0
            ? Math.round((uplifter.ratings + uplifterRating) / 2)
            : uplifterRating;
        }

        if (inappropriate) {
          uplifter.flags = (uplifter.flags || 0) + 1;
        }

        await uplifter.save();
        user.sessionId = null;
        socket.emit("registerAgain");
        io.to(session.uplifterId).emit("registerAgain");
      } catch (error) {
        console.error("Error updating feedback:", {
          error: error.message,
          callerId,
          sessionId,
        });
        socket.emit("error", { message: "Internal server error processing feedback." });
      }

      broadcastUsersList();
    });

    socket.on("callAccepted", (data) => {
      console.log("Call accepted by:", {
        calleeSocketId: socket.id,
        callerSocketId: data.callerId
      });
      const callee = socketIdToUserMap.get(socket.id);
      callee.connectionState = "connected";
      const caller = socketIdToUserMap.get(data.callerId);
      caller.connectionState = "connected";

      socket.to(data.callerId).emit("callAccepted")
    })


    socket.on("disconnect", async () => {
      // console.log(`Socket disconnected: ${socket.id}`);

      const user = socketIdToUserMap.get(socket.id);

      if (user) {
        const sessionId = user.sessionId;

        // Reset user state
        user.state = "offline";

        // Clear session state if one exists
        if (sessionId) {
          try {
            const session = await Session.findOne({
              _id: sessionId,
              status: "ongoing"
            });

            if (session) {
              session.status = "completed"; // Mark session as completed
              session.endTime = new Date();
              session.finalMood = 3; // Reset final mood
              session.feedback = "User disconnected before providing feedback.";
              session.inappropriate = false; // Reset inappropriate flag
              session.ratingGiven = 0; // Reset rating given


              // Calculate session duration
              const now = new Date();
              const diffMs = now - session.startTime;
              const diffSec = Math.floor(diffMs / 1000);
              session.duration = diffSec;

              await session.save();
              const connectionState = user.connectionState;
              if (connectionState === "connected") {
                 const subscription = await Subscription.findOne({ userId: session.heroId });

              if (subscription) {
                const now = new Date();

                // ✅ Case 1: User has a valid weekly subscription (unlimited)
                if (subscription.hasWeeklySubscription && subscription.weeklyExpiresAt > now) {
                  // console.log(`User ${session.heroId} has a valid weekly subscription (unlimited). No deduction needed.`);

                  // ✅ Case 2: No valid weekly — check and deduct from bundle
                } else if (subscription.hasBundleSubscription && subscription.sessionBalance > 0) {
                  subscription.sessionBalance -= 1;
                  subscription.lastUpdated = now;
                  await subscription.save();
                  // console.log(`Decreased session balance for user ${session.heroId}`);

                  // ❌ Case 3: Neither valid weekly nor available bundle sessions
                } else {
                  // console.log(`User ${session.heroId} has no valid subscription or sessions left.`);
                  // Optionally: notify user, block session, etc.
                }

              } else {
                // console.log(`No subscription found for user ${session.heroId}`);
                // Optionally: handle this (e.g., deny session, notify admin, etc.)
              }
              }
             


              // console.log(`Session marked completed due to disconnect: ${sessionId}`);

              // console.log(`Session marked pending due to disconnect: ${sessionId}`);
            }
          } catch (err) {
            console.error("Error finalizing session on disconnect:", err.message);
          }
        }

        // Remove user from maps
        socketIdToUserMap.delete(socket.id);
        dbIdToSocketIdMap.delete(user.dbId);

        // Remove any active connection
        for (const [connectionId, connection] of activeConnections.entries()) {
          if (
            connection.callerSocketId === socket.id ||
            connection.calleeSocketId === socket.id
          ) {
            clearTimeout(connection.timeout);
            activeConnections.delete(connectionId);

            const otherSocketId =
              connection.callerSocketId === socket.id
                ? connection.calleeSocketId
                : connection.callerSocketId;

            if (socketIdToUserMap.has(otherSocketId)) {
              const otherUser = socketIdToUserMap.get(otherSocketId);
              otherUser.state = "online";
              otherUser.sessionId = null;

              io.to(otherSocketId).emit("endVideoCall");
              // console.log(`Call partner notified: ${otherUser.username}`);
            }

            break;
          }
        }
      }

      broadcastUsersList();
    });



  });

  return io;
};

export default SocketSetup;



