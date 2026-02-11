import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import uploadToCloudinary from "../utilities/cloudinary.js";
import { deleteFromCloudinary } from "../utilities/cloudinary.js";
import moment from 'moment';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Subscription from "../models/subscription.model.js";

// Register a new admin
export const registerAdmin = async (req, res) => {
    try {
        const { userName, email, password, privileges } = req.body;

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists." });
        }

        const newAdmin = new Admin({ userName, email, password, privileges });
        await newAdmin.save();

        res.status(201).json({ message: "Admin registered successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Admin login
export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        const isMatch = await admin.isPasswordCorrect(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const accessToken = admin.generateAccessToken();
        const refreshToken = admin.generateRefreshToken();

        res.status(200).json({ message: "Login successful", accessToken, refreshToken });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all admins
export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find();
        res.status(200).json(admins);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// Get a single admin by ID

export const getAdminById = async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }
        res.status(200).json(admin);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// Update admin details

export const updateAdmin = async (req, res) => {
    try {
        const updatedAdmin = await Admin.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedAdmin) {
            return res.status(404).json({ message: "Admin not found." });
        }
        res.status(200).json({ message: "Admin updated successfully", updatedAdmin });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// Delete an admin

export const deleteAdmin = async (req, res) => {
    try {
        const deletedAdmin = await Admin.findByIdAndDelete(req.params.id);
        if (!deletedAdmin) {
            return res.status(404).json({ message: "Admin not found." });
        }
        res.status(200).json({ message: "Admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // ✅ Step 1: Check if user is admin
        const requestingUser = await User.findById(userId);
        if (!requestingUser || requestingUser.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        // ✅ Step 2: User counts
        const totalUsers = await User.countDocuments();
        const heroUsers = await User.countDocuments({ role: "hero" });
        const uplifterUsers = await User.countDocuments({ role: "uplifter" });

        // ✅ Step 3: Session counts
        const totalSessions = await Session.countDocuments();

        const ratingAgg = await Session.aggregate([
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: "$ratingGiven" }
                }
            }
        ]);
        const averageRating = ratingAgg[0]?.avgRating || 0;

        // ✅ Step 4: Get recent sessions (limit to 5)
        const recentSessions = await Session.find({})
            .sort({ updatedAt: -1 })
            .limit(5)
            .select("status duration ratingGiven feedback heroId uplifterId updatedAt")
            .populate("heroId", "userName email")
            .populate("uplifterId", "userName email");

        const formattedSessions = recentSessions.map(session => ({
            status: session.status,
            duration: session.duration,
            ratingGiven: session.ratingGiven,
            feedback: session.feedback || 'No feedback provided', // Include feedback if available
            hero: session.heroId ? {
                userName: session.heroId.userName,
                email: session.heroId.email
            } : null,
            uplifter: session.uplifterId ? {
                userName: session.uplifterId.userName,
                email: session.uplifterId.email
            } : null,
            dateTime: moment(session.updatedAt).format('YYYY-MM-DD HH:mm:ss') // Format date and time
        }));

        // ✅ Step 5: Send response
        res.status(200).json({
            message: "Dashboard stats fetched successfully",
            userStats: {
                totalUsers,
                heroUsers,
                uplifterUsers,
                totalSessions,
                averageRating: Number(averageRating.toFixed(2))
            },
            recentSessions: formattedSessions
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch dashboard stats",
            error: error.message
        });
    }
};

export const getAllUsersPaginated = async (req, res) => {
    try {
        const userId = req.user._id;

        // ✅ Step 1: Check if the requester is an admin
        const requestingUser = await User.findById(userId);
        if (!requestingUser || requestingUser.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        // ✅ Step 2: Extract query parameters
        const {
            page = 1,
            status,
            role,
            hasFlags,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query;

        const limit = 10;
        const skip = (parseInt(page) - 1) * limit;

        // ✅ Step 3: Build filter object based on query params
        const filter = {};

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (role && role !== 'all') {
            filter.role = role;
        }

        if (hasFlags === 'true') {
            filter.flags = { $gt: 0 };
        }

        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } },
            ];
        }

        // ✅ Step 4: Build sort object
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // ✅ Step 5: Get total user count based on filters
        const totalUsers = await User.countDocuments(filter);

        // ✅ Step 6: Fetch filtered and paginated users
        const users = await User.find(filter)
            .skip(skip)
            .limit(limit)
            .select("userName email status flags profile.bio profile.avatar role profile.ratings")
            .sort(sortOptions);

        // ✅ Step 7: Send response with pagination and filtered results
        res.status(200).json({
            message: "Users fetched successfully",
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
            users
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch users",
            error: error.message
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const adminId = req.user._id;
        const userIdToDelete = req.body.userIdToDelete;


        // ✅ Step 1: Check admin privileges
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        // ✅ Step 2: Check if userIdToDelete is valid
        if (!userIdToDelete) {
            return res.status(400).json({ message: "Missing userId query parameter." });
        }

        // ✅ Step 3: Prevent admin from deleting themselves
        if (adminId.toString() === userIdToDelete) {
            return res.status(400).json({ message: "You cannot delete yourself." });
        }

        // ✅ Step 4: Delete the user
        const deletedUser = await User.findByIdAndDelete(userIdToDelete);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // ✅ Step 5: Respond
        res.status(200).json({ message: "User deleted successfully", userId: userIdToDelete });

    } catch (error) {
        res.status(500).json({
            message: "Failed to delete user",
            error: error.message,
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const adminId = req.user._id;

        // ✅ Step 1: Check if the requester is an admin
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        const { userId, userName, email, role, status, flags, bio } = req.body;

        // ✅ Step 2: Validate required fields
        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // ✅ Step 3: Validate input types based on your schema
        if (userName && typeof userName !== 'string') {
            return res.status(400).json({ message: "Invalid userName type." });
        }
        if (email && typeof email !== 'string') {
            return res.status(400).json({ message: "Invalid email type." });
        }
        if (role && !["hero", "uplifter", "admin"].includes(role)) {
            return res.status(400).json({ message: "Invalid role type." });
        }
        if (status && !["active", "block", "pending"].includes(status)) {
            return res.status(400).json({ message: "Invalid status type." });
        }
        if (flags && (isNaN(flags) || typeof flags !== 'number')) {
            return res.status(400).json({ message: "Invalid flags value." });
        }
        if (bio && typeof bio !== 'string') {
            return res.status(400).json({ message: "Invalid bio type." });
        }

        // ✅ Step 4: Safely update fields
        if (userName) user.userName = userName;
        if (email) user.email = email;
        if (role) user.role = role;
        if (status) user.status = status;
        if (typeof flags === 'number') user.flags = flags;
        if (bio) user.profile.bio = bio;

        await user.save({ "validateBeforeSave": false });

        return res.status(200).json({ message: "User updated successfully.", data: user });

    } catch (error) {
        console.error("Error in updateUser:", error);
        return res.status(500).json({ message: "Failed to update user.", error: error.message });
    }
};

export const updateImage = async (req, res) => {
    try {
        // console.log(req.body.userId);
        // Check if file is received

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        if (!req.body.userId) {
            return res.status(400).json({ message: "No user id provided" });
        }

        const userFound = await User.findById(req.body.userId);
        if (!userFound) {
            return res.status(400).json({ message: "No user found" });
        }
        // console.log(userFound);

        if (userFound.profile.avatar) {
            await deleteFromCloudinary(userFound.profile.avatar).then((responce) => {
                // console.log(responce);

            })


        }
        // Upload file to cloudinary
        const uploadedImageUrl = await uploadToCloudinary(req.file.filename);
        userFound.profile.avatar = uploadedImageUrl || userFound.profile.avatar;
        await userFound.save({ validateBeforeSave: false });

        // Success response
        return res.status(200).json({
            message: "Image uploaded successfully",
            imageUrl: uploadedImageUrl,
        });

    } catch (error) {
        // console.log("Image upload error:", error);
        return res.status(500).json({
            message: "Failed to upload image",
            error: error.message,
        });
    }
};

export const gift3Session = async (req, res) => {
  try {
    const adminId = req.user._id;
    const userId = req.body.userIdToGift;
    const giftedSessions = 3;

    // ✅ Step 1: Check admin privileges
    const adminUser = await User.findById(adminId);
    console.log("admin",adminUser);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    

    // ✅ Step 2: Validate userId
    if (!userId) {
      return res.status(400).json({ message: "Missing userId parameter." });
    }

    // ✅ Step 3: Find user and subscription
    const userToGift = await User.findById(userId);
    if (!userToGift) {
      return res.status(404).json({ message: "User not found." });
    }
    // console.log("user to Gift",userToGift);
    
    const existingSub = await Subscription.findOne({ userId });

    // ✅ If no subscription, create new
    if (!existingSub) {
      const newSub = new Subscription({
        userId,
        totalSpent: 0,
        lastUpdated: new Date(),
        hasWeeklySubscription: true,
        sessionBalance: giftedSessions,
        weeklyExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        specialKeyAccess:true,
        purchasedBundles: [
          {
            bundleSize: giftedSessions,
            amountPaid: 0,
          
          },
        ],
      });

      await newSub.save();
    //   console.log("🆕 Created new subscription:", newSub);
      return res.status(200).json({ message: "3 sessions gifted successfully", subscription: newSub });
    }

    // ✅ If subscription exists, update
    const updateFields = {
        $inc:{
          sessionBalance: giftedSessions,
        },
      $set: {
        lastUpdated: new Date(),
        hasWeeklySubscription: true,
        weeklyExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        specialKeyAccess:true,
      },
      $push: {
        purchasedBundles: {
          bundleSize: giftedSessions,
          amountPaid: 0,
        },
      },
    };

    const updatedSub = await Subscription.findOneAndUpdate(
      { userId },
      updateFields,
      { upsert: true, new: true }
    );

    console.log("🎁 Gifted 3 sessions to user:", userId);
    return res.status(200).json({ message: "3 sessions gifted successfully", subscription: updatedSub });
  } catch (error) {
    console.error("❌ Error gifting sessions:", error);
    return res.status(500).json({
      message: "Failed to gift sessions",
      error: error.message,
    });
  }
};
