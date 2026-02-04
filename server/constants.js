export const DB_NAME = "testing_db"
export const PLAN_CONFIG = {
  weekly: {
    amount: 9.99,
    currency: 'eur',
    bundleSize: 3,
  },
  extended: {
    amount: 25.00,
    currency: 'eur',
    bundleSize: 10,
  }
};
// const options = {
//     httpOnly: true,
//     secure: false, // 🔥 Set to true if using HTTPS
//     sameSite: "Lax", // 🔥 Set to 'none' if using HTTPS
// }

const options = {
  httpOnly: true,
  secure: false,          // true ONLY on HTTPS
  sameSite: "lax",        // 👈 THIS IS KEY
  path: "/",
};

export default  options