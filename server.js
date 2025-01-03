import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cron from "node-cron";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import sendReminderEmails from "./utils/reminderService.js";

// Load environment variables
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());

// Redirect HTTP to HTTPS in production
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Health Check Route for Render
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend is up and running!" });
});

// API Routes
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/users", userRoutes);

// Schedule Reminder Emails (Runs Every Hour)
cron.schedule("0 * * * *", async () => {
  try {
    console.log("Running reminder email job...");
    await sendReminderEmails();
  } catch (error) {
    console.error("Failed to send reminder emails:", error);
  }
});

// Start the server
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  const HOST = "0.0.0.0"; // Bind to all interfaces for Render
  const server = app.listen(PORT, HOST, () =>
    console.log(`Server is running on port ${PORT}`)
  );

  // Set custom timeouts to avoid Render connection resets
  server.keepAliveTimeout = 120000; // 2 minutes
  server.headersTimeout = 120000; // 2 minutes
}

export { app };
