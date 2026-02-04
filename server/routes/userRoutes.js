// import express from "express";
// import { userSignUp ,loginUser,updateUserProfile,getUserStats, getUserStats2,toggleUserRole, getUserProfile,logoutUser } from "../controllers/userController.js";

// import authMiddleware  from "../middlewares/auth.middleware.js";
// import {upload} from "../middlewares/multer.middleware.js"
// // import { authenticate } from "../middlewares/authMiddleware.js";

// const router = express.Router();

// // router.get("/createAccount", authenticate, getUserProfile);
// router.post("/createAccount", userSignUp);
// router.post("/login", loginUser);
// router.get("/me", authMiddleware, getUserProfile);
// router.get("/stats",authMiddleware,getUserStats);
// router.get("/stats2",authMiddleware,getUserStats2);
// router.patch("/toggleUserRole",authMiddleware,toggleUserRole)
// router.post("/logout", authMiddleware, logoutUser);
// router.post("/createProfile",authMiddleware, upload.single("file"), updateUserProfile);

// export default router;



import express from "express";
import { userSignUp ,loginUser,updateUserProfile,getUserStats, getUserStats2,toggleUserRole, getUserProfile,logoutUser } from "../controllers/userController.js";

import authMiddleware  from "../middlewares/auth.middleware.js";
import {upload} from "../middlewares/multer.middleware.js"
// import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Root route - API information
router.get("/", (req, res) => {
  res.json({
    message: "User API is running!",
    availableEndpoints: {
      "POST /api/user/createAccount": "Sign up a new user",
      "POST /api/user/login": "Login user",
      "GET /api/user/me": "Get current user profile (requires auth)",
      "GET /api/user/stats": "Get user statistics (requires auth)",
      "GET /api/user/stats2": "Get user statistics 2 (requires auth)",
      "PATCH /api/user/toggleUserRole": "Toggle user role (requires auth)",
      "POST /api/user/logout": "Logout user (requires auth)",
      "POST /api/user/createProfile": "Update user profile with image (requires auth)"
    }
  });
});

// router.get("/createAccount", authenticate, getUserProfile);
router.post("/createAccount", userSignUp);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getUserProfile);
router.get("/stats",authMiddleware,getUserStats);
router.get("/stats2",authMiddleware,getUserStats2);
router.patch("/toggleUserRole",authMiddleware,toggleUserRole)
router.post("/logout", authMiddleware, logoutUser);
router.post("/createProfile",authMiddleware, upload.single("file"), updateUserProfile);


export default router;