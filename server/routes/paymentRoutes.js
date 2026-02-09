import express from "express";
import bodyParser from "body-parser";
import {
    createPaymentIntent,
    getAllPayments,
    getPaymentByTransactionId,
    updatePaymentStatus,
    deletePayment
} from "../controllers/paymentController.js";

const router = express.Router();

// Define routes
router.post("/", createPaymentIntent); // Process a new payment
router.get("/", getAllPayments); // Get all payments
router.get("/:transactionId", getPaymentByTransactionId); // Get payment by transaction ID
router.put("/:transactionId/status", updatePaymentStatus); // Update payment status
router.delete("/:transactionId", deletePayment); // Delete a payment record

export default router;
