import express from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import sendEmail from "../utils/emailService.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// User Signup with Verification Link
router.post("/signup", async (req, res) => {
  try {
    const newUser = new User({ ...req.body, verificationToken: uuidv4() });
    await newUser.save();

    const verificationLink = `${process.env.FRONTEND_URL}/verify/${newUser.verificationToken}`;
    console.log(verificationLink);
    sendEmail(
      newUser.email,
      "Verify Your Email",
      `Please verify your email to complete registration by clicking the link below.`,
      `Please verify your email to complete registration by clicking the link below.</p>
 <p><a href="${verificationLink}">Verify</a></p>`
    );

    res.status(201).json({
      message: "User created successfully. Check your email for verification.",
    });
  } catch (error) {
    res.status(500).json({ message: "Error signing up", error });
  }
});

// User Email Verification
router.get("/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(404).json({ message: "Invalid token" });

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: "Verification failed", error });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.isVerified) {
      const verificationLink = `${process.env.FRONTEND_URL}/verify/${user.verificationToken}`;
      sendEmail(
        user.email,
        "Resend Verification",
        "Please verify your email.",
        `<a href="${verificationLink}">Verify</a>`
      );
      return res.status(403).json({ message: "Verification email sent again" });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate Access and Refresh Tokens
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ accessToken, refreshToken });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error });
  }
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh token required" });

  jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET,
    async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid refresh token" });

      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      res.json({ accessToken });
    }
  );
});

export default router;
