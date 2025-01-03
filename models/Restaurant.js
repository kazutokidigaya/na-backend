import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  name: String,
  description: String,
  contact: String,
  email: String,
  images: [String],
  workingHours: Object,
  totalSeats: Number,
  bookedSeats: {
    type: Number,
    default: 0, // Initialize with 0 booked seats
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;
