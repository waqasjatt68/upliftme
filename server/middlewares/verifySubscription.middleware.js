import User from "../models/user.model.js"; // Adjust path
import Subscription from "../models/subscription.model.js";
const verifySubscription = async (req, res, next) => {
  try {
    const userId = req.user._id; // Comes from authMiddleware
    const subscription = await Subscription.findOne({
      userId: userId,
    });

    // Check if userId is present
    // console.log("User ID from token request:", userId);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user info" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    const { role } = user;
    // console.log("User role:", role);
    // SuperUser always allowed
    if (role === "superUser") {
      return next();
    }

    // Uplifter always allowed
    if (role === "uplifter") {
      return next();
    }

    // Hero must have a subscription



    if (role === "hero") {
      const hasValidBundle = subscription.hasExtendedSubscription && subscription.sessionBalance > 0;
      const hasValidWeekly = subscription.hasWeeklySubscription && new Date(subscription.weeklyExpiresAt) > new Date() && subscription.sessionBalance > 0;
      // console.log(hasValidBundle, hasValidWeekly);

      if (hasValidBundle || hasValidWeekly) {
        return next();
      }

      return res.status(403).json({
        message: "Access denied: Subscription expired or invalid",
      });
    }

    // Deny all other roles by default
    return res.status(403).json({ message: "Access denied: Unauthorized role" });

  } catch (error) {
    // console.error("Subscription middleware error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default verifySubscription;
