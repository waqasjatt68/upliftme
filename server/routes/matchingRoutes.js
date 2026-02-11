// routes/matchingRoutes.js - NEW FILE
import express from "express";
import {
  findMatch,
  checkMatch,
  cleanupUser,
  logEvent,
  getQueueStatus,
} from "../controllers/matchingController.js";

const router = express.Router();

// Find a match (no auth required for initial search)
router.post("/find-match", findMatch);

// Check if match found (polling endpoint)
router.post("/check-match", checkMatch);

// Cleanup user from queue
router.post("/cleanup", cleanupUser);

// Log matching events
router.post("/log-event", logEvent);

// Get queue status (for debugging)
router.get("/queue-status", getQueueStatus);

export default router;