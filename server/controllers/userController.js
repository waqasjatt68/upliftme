import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import options from "../constants.js";
import jwt from "jsonwebtoken";
import Subscription from "../models/subscription.model.js";
import Referral from "../models/referral.model.js";
import uploadToCloudinary from "../utilities/cloudinary.js";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { log } from "console";
import { userInfo } from "os";

const generateTokens = async (userId) => {
    try {
        // console.log(userId);

        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }

        // console.log(user);


        // Call methods on the user instance, not the model
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Save refreshToken to user
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
};

export const userSignUp = async (req, res) => {
    const { email, password, referredBy } = req.body;
    

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Create new user
        const newUser = new User({ email, password });
        await newUser.save({ validateBeforeSave: false });
        
        

        if (!newUser) {
            return res.status(400).json({ message: "User not created" });
        }

        // Create default subscription (all false/empty)
        const defaultSubscription = new Subscription({
            userId: newUser._id,
            hasWeeklySubscription: false,
            weeklyExpiresAt: null,
            hasBundleSubscription: false,
            sessionBalance: 0,
            lastUpdated: null,
        });
        await defaultSubscription.save({ validateBeforeSave: false });

        // Save referral if applicable
        if (referredBy) {
            await new Referral({
                referrerId: referredBy,
                referredUserId: newUser._id,
            }).save({ validateBeforeSave: false });
        }

        // Generate tokens
        const { accessToken, refreshToken } = await generateTokens(newUser._id);
        if (!accessToken || !refreshToken) {
            return res.status(400).json({ message: "Error generating tokens" });
        }

            

            // Send response with cookies
            res
            .cookie("accessToken", accessToken, {
                httpOnly: true,
                sameSite: "lax",   // ❗ NOT strict
                secure: false,     // ❗ localhost ke liye false
                path: "/"
            })
            .cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                path: "/"
            })

            

            .status(201)
            .json({
                message: "User created successfully",
                data: newUser,
                id: newUser._id,
            });

    } catch (error) {
        res.status(500).json({
            message: "Signup failed",
            error: error.message,
        });
    }
};


export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {

        const user = await User.findOne({ email });

        const subscription = await Subscription.findOne({ userId: user._id });

        // Auto-expire weekly subscription if expired
         if (
            subscription?.hasWeeklySubscription &&
           ( new Date(subscription.weeklyExpiresAt) < new Date())
        )
         {
            subscription.hasWeeklySubscription = false;
            subscription.weeklyExpiresAt = undefined;
            subscription.hasExtendedSubscription = false;
            subscription.specialKeyAccess= false;
            subscription.sessionBalance = 0;
        }
        if(subscription.hasExtendedSubscription && subscription.sessionBalance===0){
            subscription.hasExtendedSubscription = false;
        }
        if (subscription?.isModified()) {
            await subscription.save();
        }
        

        if (!user || !(await user.isPasswordCorrect(password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const { accessToken, refreshToken } = await generateTokens(user);
        res.cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json({
            message: "Login successful",
            id: user._id,
            data: { email: user.email, username: user.userName },
        });
    } catch (error) {

        res.status(500).json({ message: "Login failed", error: error.message });
    }
};

export const getUserProfile = async (req, res) => {
   
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({
            id: user._id,
            email: user.email,
            status: user.status,
            username: user.userName,
            role: user.role || null,
            ratings: user.ratings || null,
            profile: {
                bio: user.profile?.bio || "",
                avatar: user.profile?.avatar || ""
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to fetch profile", error: error.message });
    }
};


export const updateUserProfile = async (req, res) => {
  const { bio, role, username } = req.body;

  console.log("\n📝 ========== UPDATE PROFILE ==========");
  console.log("   Username:", username);
  console.log("   Bio:", bio);
  console.log("   Role:", role);
  console.log("   File:", req.file ? req.file.filename : "No file");

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update text fields
    if (bio !== undefined) user.profile.bio = bio;
    if (username !== undefined) user.userName = username;
    if (role !== undefined) user.role = role;

    // Handle file upload
    if (req.file) {
      console.log("\n📸 Processing uploaded file...");
      
      const tempDir = './public/temp';
      let finalFileName = req.file.filename;
      const fileExt = path.extname(req.file.originalname).toLowerCase();

      // Convert HEIC/HEIF/WebP to JPG
      if (['.heic', '.heif', '.webp'].includes(fileExt)) {
        console.log("🔄 Converting image format...");
        
        const originalFilePath = path.join(tempDir, req.file.filename);
        const newFileName = path.basename(req.file.filename, fileExt) + '.jpg';
        const newFilePath = path.join(tempDir, newFileName);

        await sharp(originalFilePath)
          .jpeg({ quality: 90 })
          .toFile(newFilePath);

        await fs.unlink(originalFilePath);
        finalFileName = newFileName;
        
        console.log("✅ Converted to JPG:", newFileName);
      }

      // Delete old avatar from Cloudinary
      if (user.profile.avatar && user.profile.avatar.includes('cloudinary.com')) {
        console.log("🗑️ Deleting old avatar...");
        try {
          await deleteFromCloudinary(user.profile.avatar);
          console.log("✅ Old avatar deleted");
        } catch (err) {
          console.warn("⚠️ Could not delete old avatar:", err.message);
        }
      }

      // Upload to Cloudinary
      // ✅ IMPORTANT: Pass ONLY the filename, not the full path!
      console.log("☁️ Uploading to Cloudinary...");
      const cloudinaryUrl = await uploadToCloudinary(finalFileName);
      
      user.profile.avatar = cloudinaryUrl;
      console.log("✅ Avatar uploaded:", cloudinaryUrl);
    }

    // Save user
    await user.save({ validateBeforeSave: false });

    console.log("✅ Profile updated successfully!");
    console.log("======================================\n");

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        bio: user.profile?.bio,
        avatar: user.profile?.avatar,
        role: user.role,
      },
      profile: user.profile
    });

  } catch (error) {
    console.error("❌ Update error:", error);
    res.status(500).json({ 
      message: "Update failed", 
      error: error.message 
    });
  }
};


export const toggleUserRole = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        //   console.log(user.role);

        // Toggle the role
        user.role = user.role === "hero" ? "uplifter" : "hero";

        await user.save({ validateBeforeSave: false });

        res.json({ message: `Role updated to ${user.role}`, role: user.role });
    } catch (error) {
        res.status(500).json({ message: "Failed to update role", error: error.message });
    }
};


export const getUserStats = async (req, res) => {
    try {
        
        
        const userId = req.user._id; // Assuming user is authenticated and `req.user._id` is available
        const subscription = await Subscription.findOne({ userId: userId });

        // Auto-expire weekly subscription if expired
        if (
            subscription?.hasWeeklySubscription &&
            new Date(subscription.weeklyExpiresAt) < new Date()
        )
         {
            subscription.hasWeeklySubscription = false;
            subscription.weeklyExpiresAt = undefined;
        }
       
       
        // Auto-expire bundle subscription if session balance is 0 or less
        if (
            subscription?.hasBundleSubscription &&
            (subscription.sessionBalance === 0 || subscription.sessionBalance < 0)
        ) {
            subscription.hasBundleSubscription = false;
            subscription.sessionBalance = 0;
        }

        // Save only if any change occurred
        if (subscription?.isModified()) {
            await subscription.save();
        }


        const user = await User.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(userId) } // Match the user
            },
            {
                $project: {
                    password: 0  // Exclude password from the result
                }
            },
            {
                $lookup: {
                    from: "sessions",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: ["$heroId", "$$userId"] },
                                        { $eq: ["$uplifterId", "$$userId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "uplifterId",
                                foreignField: "_id",
                                as: "uplifters",
                                pipeline: [
                                    {
                                        $project: {
                                            password: 0
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "heroId",
                                foreignField: "_id",
                                as: "heros",
                                pipeline: [
                                    {
                                        $project: {
                                            password: 0
                                        }
                                    }
                                ]
                            }
                        },

                        {
                            $project: {
                                password: 0
                            }
                        }
                    ],
                    as: "sessions"
                }
            },

            {
                $addFields: {
                    // Convert the array of uplifters to an object (first element of the array)
                    uplifter: { $arrayElemAt: ["$sessions.uplifters", 0] }, // Flatten the array to an object
                    hero: { $arrayElemAt: ["$sessions.heros", 0] },
                }
            },
            {
                $project: {
                    sessions: 1,
                    uplifter: 1, // Include the uplifter object
                    email: 1,
                    userName: 1,
                    hero: 1,
                    role: 1,
                    profile: 1,
                    subscription: 1,
                    status: 1
                }
            }
        ])

        if (!user) {
            return res.status(404).json({ message: "User not found or no data available" });
        }
        // console.log(user[0]);

        res.json({
            message: "User stats fetched successfully",
            stats: user[0] // Send the stats as response
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch user stats", error: error.message });
    }
}

// export const getUserStats = async (req, res) => {
//     try {
//       const userId = req.user._id; // Assuming user is authenticated and `req.user._id` is available
//       console.log(userId);

//       const user = await User.aggregate([
//         {
//           $match: { _id: new mongoose.Types.ObjectId(userId) } // Match the user
//         },
//         {
//           $project: {
//             password: 0  // Exclude password from the result
//           }
//         },
//         {
//           $lookup: {
//             from: "sessions",
//             let: { userId: "$_id" },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $or: [
//                       { $eq: ["$heroId", "$$userId"] },
//                       { $eq: ["$uplifterId", "$$userId"] }
//                     ]
//                   }
//                 }
//               },
//               // Add lookup for hero data
//               {
//                 $lookup: {
//                   from: "users",
//                   localField: "heroId",
//                   foreignField: "_id",
//                   as: "heroData",
//                   pipeline: [
//                     {
//                       $project: {
//                         password: 0,
//                         email: 1,
//                         userName: 1,
//                         profile: 1,
//                         role: 1
//                       }
//                     }
//                   ]
//                 }
//               },
//               // Add lookup for uplifter data
//               {
//                 $lookup: {
//                   from: "users",
//                   localField: "uplifterId",
//                   foreignField: "_id",
//                   as: "uplifterData",
//                   pipeline: [
//                     {
//                       $project: {
//                         password: 0,
//                         email: 1,
//                         userName: 1,
//                         profile: 1,
//                         role: 1
//                       }
//                     }
//                   ]
//                 }
//               },
//               // Restructure each session to include the appropriate counterpart user data
//               {
//                 $addFields: {
//                   counterpartUser: {
//                     $cond: {
//                       if: { $eq: ["$heroId", new mongoose.Types.ObjectId(userId)] },
//                       then: { $arrayElemAt: ["$uplifterData", 0] }, // If user is hero, add uplifter data
//                       else: { $arrayElemAt: ["$heroData", 0] }      // If user is uplifter, add hero data
//                     }
//                   }
//                 }
//               },
//               {
//                 $project: {
//                   _id: 1,
//                   heroId: 1,
//                   uplifterId: 1,
//                   initialMood: 1,
//                   finalMood: 1,
//                   duration: 1,
//                   date: 1,
//                   status: 1,
//                   counterpartUser: 1,
//                   // Remove the arrays we used to create the counterpartUser
//                   heroData: 0,
//                   uplifterData: 0
//                 }
//               }
//             ],
//             as: "sessions"
//           }
//         },
//         {
//           $project: {
//             sessions: 1,
//             email: 1,
//             userName: 1,
//             role: 1,
//             profile: 1,
//             subscription: 1,
//             status: 1
//           }
//         }
//       ]);

//       if (!user || user.length === 0) {
//         return res.status(404).json({ message: "User not found or no data available" });
//       }

//       res.json({
//         message: "User stats fetched successfully",
//         stats: user[0] // Send the stats as response
//       });
//     } catch (error) {
//       res.status(500).json({ message: "Failed to fetch user stats", error: error.message });
//     }
//   };

export const getUserStats2 = async (req, res) => {
    try {
        // console.log("Fetching user stats for:", req.user._id);
        const userId = req.user._id;

        const subscription = await Subscription.findOne({ userId: userId });

        // Auto-expire weekly subscription if expired
        if (
            subscription?.hasWeeklySubscription &&
           ( new Date(subscription.weeklyExpiresAt) < new Date())
        )
         {
            subscription.hasWeeklySubscription = false;
            subscription.weeklyExpiresAt = undefined;
            subscription.hasExtendedSubscription = false
            subscription.specialKeyAccess = false
            subscription.sessionBalance = 0;
        }
        if(subscription.hasExtendedSubscription && subscription.sessionBalance===0){
            subscription.hasExtendedSubscription = false;
        }
        
        // subscription.sessionBalance=0

        // Save only if any change occurred
        if (subscription?.isModified()) {
            await subscription.save();
        }
        // console.log(subscription);
        
        const user = await User.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(userId) }
            },
            {
                $lookup: {
                    from: "sessions",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$heroId", "$$userId"] }
                            }
                        }
                    ],
                    as: "heroSessions"
                }
            },
            {
                $lookup: {
                    from: "sessions",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$uplifterId", "$$userId"] }
                            }
                        }
                    ],
                    as: "uplifterSessions"
                }
            },
            {
                $project: {
                    _id: 1,
                    heroStats: {
                        totalSessions: { $size: "$heroSessions" },
                        averageFinalMood: { $avg: "$heroSessions.finalMood" },
                        totalDuration: { $sum: "$heroSessions.duration" }
                    },
                    uplifterStats: {
                        totalSessions: { $size: "$uplifterSessions" },
                        averageFinalMood: { $avg: "$uplifterSessions.finalMood" },
                        totalDuration: { $sum: "$uplifterSessions.duration" }
                    }
                }
            }
        ]);

        if (!user || user.length === 0) {
            return res.status(404).json({ message: "User not found or no data available" });
        }

        res.json({
            message: "User stats fetched successfully",
            stats: user[0],
            subscription: await Subscription.findOne({ userId: userId }),
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch user stats", error: error.message });
    }
};

export const logoutUser = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    // console.log("User logged out");	

    res.clearCookie("accessToken").clearCookie("refreshToken").json("User logged out");
};
