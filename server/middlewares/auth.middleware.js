// import jwt from "jsonwebtoken";
// import User from "../models/user.model.js";


//  const authMiddleware = async (req, res,next) => {
//   try {
//     // Get token from cookies (use correct cookie name)
   

//     const token = req.cookies.accessToken; 
   
    
//     if (!token) {
//       return res.status(401).json({ message: "Unauthorized: No token provided" });


//     }
    
//     // Verify JWT token
//     const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//     // Find user in DB
//     const user = await User.findOne({ _id: decoded._id });
//     print(user)

//     if (!user) {
//       return res.status(401).json({ message: "Unauthorized: User not found" });
  

//     }

//     req.user = user;
    
//   } catch (error) {
   

//     return res.status(401).json({ message: "Unauthorized: Invalid token" });
//   }
// };
// export default authMiddleware;

import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const authMiddleware = async (req, res, next) => {
  try {

    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    req.user = user;

    next(); // 🔥 THIS WAS MISSING
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};


export default authMiddleware;
