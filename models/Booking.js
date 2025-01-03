import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  userEmail: { type: String, required: true },
  userName: String,
  phoneNumber: String,
  guests: Number,
  reservationTime: Date,
  duration: String,
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
