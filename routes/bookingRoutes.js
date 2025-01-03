import express from "express";
import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";
import sendEmail from "../utils/emailService.js";
import mongoose from "mongoose";

const router = express.Router();

// Helper function to convert duration to milliseconds
function durationToMs(duration) {
  const timeMap = {
    "15min": 15 * 60 * 1000,
    "30min": 30 * 60 * 1000,
    "45min": 45 * 60 * 1000,
    "1h": 60 * 60 * 1000,
  };
  return timeMap[duration] || 60 * 60 * 1000; // Default to 1 hour
}

router.get("/seats/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { reservationTime, duration = "1h" } = req.query;

    if (!reservationTime || isNaN(new Date(reservationTime).getTime())) {
      return res.status(400).json({ message: "Invalid reservation time." });
    }

    const objectId = new mongoose.Types.ObjectId(restaurantId);

    // 1. Fetch the restaurant
    const restaurant = await Restaurant.findById(objectId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // 2. Calculate time range based on duration
    const startTime = new Date(reservationTime);
    const endTime = new Date(startTime.getTime() + durationToMs(duration));

    // 3. Query overlapping bookings for the time slot
    const overlappingBookings = await Booking.find({
      restaurantId: objectId,
      reservationTime: {
        $lt: endTime, // Booking starts before requested end time
        $gte: startTime, // Booking ends after requested start time
      },
    });

    // 4. Calculate total booked seats during the time slot
    const totalBookedSeats = overlappingBookings.reduce(
      (sum, booking) => sum + booking.guests,
      0
    );

    // 5. Calculate available seats
    const availableSeats = Math.max(
      restaurant.totalSeats - totalBookedSeats,
      0
    );

    res.json({ availableSeats });
  } catch (error) {
    console.error("Error fetching available seats:", error);
    res.status(500).json({ message: "Error fetching available seats", error });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate({
      path: "restaurantId",
      select: "name totalSeats",
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Return only required fields
    const response = {
      _id: booking._id,
      restaurantId: booking.restaurantId._id,
      restaurantName: booking.restaurantId.name,
      totalSeats: booking.restaurantId.totalSeats,
      guests: booking.guests,
      reservationTime: booking.reservationTime,
      duration: booking.duration,
      userEmail: booking.userEmail,
      userName: booking.userName,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Error fetching booking", error });
  }
});

// Create Booking
router.post("/", async (req, res) => {
  try {
    const {
      restaurantId,
      reservationTime,
      guests,
      userEmail,
      userName,
      duration,
    } = req.body;

    if (!restaurantId || !reservationTime || !guests || !userEmail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (guests > restaurant.totalSeats) {
      return res.status(400).json({
        message: `Cannot exceed total restaurant capacity of ${restaurant.totalSeats} seats.`,
      });
    }
    // Calculate start and end times
    const startTime = new Date(reservationTime);
    const endTime = new Date(startTime.getTime() + durationToMs(duration));

    // Query for overlapping bookings during the requested time slot
    const overlappingBookings = await Booking.find({
      restaurantId,
      reservationTime: {
        $lt: endTime, // Bookings that end after the requested start
        $gte: startTime, // Bookings that start before the requested end
      },
    });

    // Calculate total booked seats during this time slot
    const totalBookedSeats = overlappingBookings.reduce(
      (sum, booking) => sum + booking.guests,
      0
    );

    // Check available seats dynamically
    const availableSeats = restaurant.totalSeats - totalBookedSeats;

    if (guests > availableSeats) {
      return res
        .status(400)
        .json({ message: `Not enough available seats at this time.` });
    }

    // Create new booking
    const newBooking = new Booking({
      restaurantId,
      reservationTime,
      guests,
      userEmail,
      userName,
      duration,
    });

    await newBooking.save();

    // Send confirmation email
    const modifyLink = `${process.env.FRONTEND_URL}/bookings/${newBooking._id}`;
    sendEmail(
      userEmail,
      "Booking Confirmation",
      `Hi ${userName}, your booking is confirmed for ${reservationTime}.`,
      `<p>Your booking is confirmed for ${reservationTime} with a duration of ${duration} for ${guests} guests.</p>
       <p><a href='${modifyLink}'>Modify or Cancel Booking</a></p>`
    );

    res.status(201).json(newBooking);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Error creating booking", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { reservationTime, guests, duration } = req.body;

    // Find the existing booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Find the associated restaurant
    const restaurant = await Restaurant.findById(booking.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Hard Limit Check: Guests cannot exceed totalSeats
    if (guests > restaurant.totalSeats) {
      return res.status(400).json({
        message: `Cannot exceed total restaurant capacity of ${restaurant.totalSeats} seats.`,
      });
    }

    // Prevent past-time modification
    const now = new Date();
    if (new Date(reservationTime) <= now) {
      return res
        .status(400)
        .json({ message: "Cannot modify to a past reservation." });
    }

    // Calculate overlapping bookings (excluding the current booking)
    const startTime = new Date(reservationTime);
    const endTime = new Date(startTime.getTime() + durationToMs(duration));

    const overlappingBookings = await Booking.find({
      restaurantId: booking.restaurantId,
      _id: { $ne: booking._id },
      reservationTime: {
        $lt: endTime,
        $gte: startTime,
      },
    });

    // Calculate total booked seats excluding the current booking
    let totalBookedSeats = overlappingBookings.reduce(
      (sum, b) => sum + b.guests,
      0
    );

    // Subtract the guests from the current booking (if modifying)
    totalBookedSeats -= booking.guests;

    // Calculate available seats
    const availableSeats = restaurant.totalSeats - totalBookedSeats;

    // Check if the new guest count exceeds available seats
    if (guests > availableSeats) {
      return res.status(400).json({
        message: `Only ${availableSeats} seats available at this time.`,
      });
    }

    // Update bookedSeats in the restaurant model
    restaurant.bookedSeats = totalBookedSeats + guests;
    await restaurant.save();

    // Update booking details
    booking.reservationTime = reservationTime;
    booking.guests = guests;
    booking.duration = duration;
    await booking.save();

    // Create Modify/Cancel Link
    const modifyLink = `${process.env.FRONTEND_URL}/bookings/${booking._id}`;

    // Send Confirmation Email with Modify Link
    sendEmail(
      booking.userEmail,
      "Booking Updated",
      `Hi ${booking.userName}, your booking has been modified.`,
      `<p>Your updated booking is for ${reservationTime} with ${guests} guests.</p>
      <p><a href='${modifyLink}'>Modify or Cancel Booking</a></p>`
    );

    res.status(200).json({
      message: "Booking updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ message: "Error updating booking", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    // Find the booking to delete
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Find the associated restaurant
    const restaurant = await Restaurant.findById(booking.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Adjust booked seats before deleting the booking
    restaurant.bookedSeats = Math.max(
      (restaurant.bookedSeats || 0) - booking.guests,
      0
    );
    await restaurant.save();

    // Delete the booking
    await Booking.findByIdAndDelete(req.params.id);

    // Send cancellation email
    sendEmail(
      booking.userEmail,
      "Booking Cancelled",
      `Hi ${booking.userName}, your booking at ${booking.reservationTime} has been successfully cancelled.`,
      `<p>Your booking for ${booking.reservationTime} has been cancelled.</p>`
    );

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ message: "Error deleting booking", error });
  }
});

export default router;
