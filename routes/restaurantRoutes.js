import express from "express";
import multer from "multer";
import Restaurant from "../models/Restaurant.js";
import { authMiddleware } from "../utils/authMiddleware.js";
import cloudinary from "../config/cloudinaryConfig.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Add Restaurant (Protected)
router.post(
  "/register",
  authMiddleware,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const { name, description, contact, email, totalSeats, workingHours } =
        req.body;

      if (!name || !description || !contact || !totalSeats || !email) {
        return res
          .status(400)
          .json({ message: "All fields except images are required." });
      }

      const imageUrls = await Promise.all(
        req.files.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path);
          return result.secure_url;
        })
      );

      const newRestaurant = new Restaurant({
        name,
        description,
        contact,
        email,
        totalSeats,
        workingHours: JSON.parse(workingHours),
        images: imageUrls,
        userId: req.user.id, // Store the owner (user) of the restaurant
      });

      await newRestaurant.save();
      res.status(201).json(newRestaurant);
    } catch (error) {
      res.status(500).json({ message: "Error registering restaurant", error });
    }
  }
);

// Fetch All Restaurants (Public View)
router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: "Error fetching restaurants", error });
  }
});

// Fetch User-Specific Restaurants (Protected)
router.get("/my-restaurants", authMiddleware, async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ userId: req.user.id });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: "Error fetching your restaurants", error });
  }
});

// Fetch a Single Restaurant by ID
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: "Error fetching restaurant", error });
  }
});

// Update a Restaurant by ID (Protected)
router.put(
  "/:id",
  authMiddleware,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const { name, description, contact, email, totalSeats, workingHours } =
        req.body;

      const restaurant = await Restaurant.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!restaurant) {
        return res
          .status(404)
          .json({ message: "Restaurant not found or unauthorized" });
      }

      // Handle Image Upload if New Images Are Provided
      let imageUrls = restaurant.images;
      if (req.files.length > 0) {
        const uploadedImages = await Promise.all(
          req.files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path);
            return result.secure_url;
          })
        );
        imageUrls = [...imageUrls, ...uploadedImages]; // Append new images
      }

      // Update Restaurant Details
      restaurant.name = name || restaurant.name;
      restaurant.description = description || restaurant.description;
      restaurant.contact = contact || restaurant.contact;
      restaurant.email = email || restaurant.email;
      restaurant.totalSeats = totalSeats || restaurant.totalSeats;
      restaurant.workingHours = workingHours
        ? JSON.parse(workingHours)
        : restaurant.workingHours;
      restaurant.images = imageUrls;

      await restaurant.save();

      res
        .status(200)
        .json({ message: "Restaurant updated successfully", restaurant });
    } catch (error) {
      res.status(500).json({ message: "Error updating restaurant", error });
    }
  }
);

// Delete a Restaurant by ID (Protected)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!restaurant) {
      return res
        .status(404)
        .json({ message: "Restaurant not found or unauthorized" });
    }

    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting restaurant", error });
  }
});

export default router;
