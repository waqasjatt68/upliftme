import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js"
import {deleteUser} from '../controllers/adminController.js'
import {upload} from '../middlewares/multer.middleware.js'


import {
    registerAdmin,
    loginAdmin,
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    getDashboardStats,
    getAllUsersPaginated,
    updateUser,
    updateImage,
    gift3Session,
} from "../controllers/adminController.js";

const router = express.Router();

// Define routes
router.post("/register", registerAdmin); // Register a new admin
router.post("/login", loginAdmin); // Admin login
router.get("/deshboardStats",authMiddleware, getDashboardStats); //get recent sessions and stats
router.get("/deshboardUsers",authMiddleware, getAllUsersPaginated); // get users to Edit
router.delete("/delete", authMiddleware, deleteUser);
router.post("/updateImage", authMiddleware, upload.single("file"), updateImage);
router.put("/updateUser", authMiddleware, updateUser);
router.get("/",authMiddleware, getAllAdmins); // Get all admins
router.get("/:id",authMiddleware, getAdminById); // Get a single admin by ID
router.put("/:id",authMiddleware, updateAdmin); // Update admin details
router.delete("/:id",authMiddleware, deleteAdmin); // Delete an admin
router.post("/:id",authMiddleware, gift3Session); // Delete an admin


export default router;
