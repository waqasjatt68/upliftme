// controllers/matchingController.js - NEW FILE
import User from "../models/user.model.js";

// In-memory matching queue (you can move this to Redis later)
const matchingQueue = {
  heroes: new Map(), // userId -> { userName, timestamp, rating }
  uplifters: new Map(),
};

// When user A finds user B in the queue, B is removed. Store B's match so B gets it on their next check-match poll.
const pendingMatches = new Map(); // userId (the one who was in queue) -> { userId, userName, role, score }

// Clean up old entries (older than 30 seconds)
function cleanupOldEntries() {
  const now = Date.now();
  const timeout = 30000; // 30 seconds

  for (const [userId, data] of matchingQueue.heroes.entries()) {
    if (now - data.timestamp > timeout) {
      matchingQueue.heroes.delete(userId);
      console.log("🧹 Removed stale hero:", userId);
    }
  }

  for (const [userId, data] of matchingQueue.uplifters.entries()) {
    if (now - data.timestamp > timeout) {
      matchingQueue.uplifters.delete(userId);
      console.log("🧹 Removed stale uplifter:", userId);
    }
  }
}

/**
 * POST /api/matching/find-match
 * Find a match for a user
 */
export const findMatch = async (req, res) => {
  try {
    const raw = req.body;
    const userId = raw.userId != null ? String(raw.userId) : "";
    const role = raw.role;
    const userName = (raw.userName || "").trim();

    console.log("\n🔍 ========== FIND MATCH ==========");
    console.log("   User ID:", userId);
    console.log("   Role:", role);
    console.log("   Username:", userName);

    // Validate input
    if (!userId || !role || !userName) {
      return res.status(400).json({ 
        message: "userId, role, and userName are required" 
      });
    }

    // Clean up old entries first
    cleanupOldEntries();

    // Determine which queue to search
    const searchQueue = role === "hero" ? matchingQueue.uplifters : matchingQueue.heroes;
    const myQueue = role === "hero" ? matchingQueue.heroes : matchingQueue.uplifters;

    // Check if there's someone waiting in the opposite queue
    if (searchQueue.size > 0) {
      // Get the first person waiting
      const [matchedUserId, matchedData] = searchQueue.entries().next().value;

      // Remove from queue
      searchQueue.delete(matchedUserId);

      // So the other user (who was waiting) gets the match when they poll check-match
      const matchedUserIdStr = String(matchedUserId);
      pendingMatches.set(matchedUserIdStr, {
        userId: userId,
        userName: userName,
        role: role === "hero" ? "uplifter" : "hero",
        score: 100,
      });

      console.log("✅ Match found!");
      console.log("   Matched User ID:", matchedUserId);
      console.log("   Matched Username:", matchedData.userName);
      console.log("======================================\n");

      return res.json({
        message: "Match found",
        match: {
          userId: matchedUserId,
          userName: matchedData.userName,
          role: role === "hero" ? "uplifter" : "hero",
          score: 100, // You can implement rating-based matching later
        },
      });
    }

    // No match found, add to queue (use string key so check-match finds them)
    myQueue.set(String(userId), {
      userName,
      timestamp: Date.now(),
      rating: 0, // You can get this from user profile
    });

    console.log("⏳ No match found, added to queue");
    console.log("   Queue size:", myQueue.size);
    console.log("======================================\n");

    res.json({
      message: "Added to matching queue",
      match: null,
      queueSize: myQueue.size,
    });
  } catch (error) {
    console.error("❌ Find match error:", error);
    res.status(500).json({ 
      message: "Failed to find match", 
      error: error.message 
    });
  }
};

/**
 * POST /api/matching/check-match
 * Check if a match has been found (polling endpoint)
 */
export const checkMatch = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const userIdStr = userId != null ? String(userId) : "";

    if (!userIdStr || !role) {
      return res.status(400).json({
        message: "userId and role are required",
        match: null,
      });
    }

    // Clean up old entries
    cleanupOldEntries();

    // They were matched by someone else (removed from queue in find-match) — return their pending match
    if (pendingMatches.has(userIdStr)) {
      const match = pendingMatches.get(userIdStr);
      pendingMatches.delete(userIdStr);
      console.log("🎉 Pending match delivered (user was matched while waiting):", userIdStr);
      return res.json({
        message: "Match found",
        match,
      });
    }

    // Determine which queue to search
    const searchQueue = role === "hero" ? matchingQueue.uplifters : matchingQueue.heroes;
    const myQueue = role === "hero" ? matchingQueue.heroes : matchingQueue.uplifters;

    // Check if user is still in queue
    if (!myQueue.has(userIdStr)) {
      return res.status(404).json({ 
        message: "User not in queue",
        match: null 
      });
    }

    // Check if there's someone waiting in the opposite queue
    if (searchQueue.size > 0) {
      // Get the first person waiting
      const [matchedUserId, matchedData] = searchQueue.entries().next().value;

      // Remove both from queues
      searchQueue.delete(matchedUserId);
      myQueue.delete(userIdStr);

      console.log("🎉 Match found during polling!");
      console.log("   User:", userId, "matched with", matchedUserId);

      return res.json({
        message: "Match found",
        match: {
          userId: matchedUserId,
          userName: matchedData.userName,
          role: role === "hero" ? "uplifter" : "hero",
          score: 100,
        },
      });
    }

    // Still no match
    res.json({
      message: "Still searching",
      match: null,
      queueSize: myQueue.size,
    });
  } catch (error) {
    console.error("❌ Check match error:", error);
    res.status(500).json({ 
      message: "Failed to check match", 
      error: error.message 
    });
  }
};

/**
 * POST /api/matching/cleanup
 * Remove user from matching queue
 */
export const cleanupUser = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Remove from both queues
    matchingQueue.heroes.delete(userId);
    matchingQueue.uplifters.delete(userId);

    console.log("🧹 Cleaned up user:", userId);

    res.json({ message: "Cleanup successful" });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    res.status(500).json({ 
      message: "Failed to cleanup", 
      error: error.message 
    });
  }
};

/**
 * POST /api/matching/log-event
 * Log matching events (optional analytics)
 */
export const logEvent = async (req, res) => {
  try {
    const { event, metadata } = req.body;
    
    // You can store these in a database if needed
    console.log("📊 Matching event:", event, metadata);
    
    res.json({ message: "Event logged" });
  } catch (error) {
    console.error("❌ Log event error:", error);
    res.status(500).json({ 
      message: "Failed to log event", 
      error: error.message 
    });
  }
};

/**
 * GET /api/matching/queue-status
 * Get current queue status (for debugging)
 */
export const getQueueStatus = async (req, res) => {
  try {
    cleanupOldEntries();

    res.json({
      heroes: {
        count: matchingQueue.heroes.size,
        users: Array.from(matchingQueue.heroes.entries()).map(([id, data]) => ({
          userId: id,
          userName: data.userName,
          waitTime: Math.floor((Date.now() - data.timestamp) / 1000) + "s",
        })),
      },
      uplifters: {
        count: matchingQueue.uplifters.size,
        users: Array.from(matchingQueue.uplifters.entries()).map(([id, data]) => ({
          userId: id,
          userName: data.userName,
          waitTime: Math.floor((Date.now() - data.timestamp) / 1000) + "s",
        })),
      },
    });
  } catch (error) {
    console.error("❌ Queue status error:", error);
    res.status(500).json({ 
      message: "Failed to get queue status", 
      error: error.message 
    });
  }
};