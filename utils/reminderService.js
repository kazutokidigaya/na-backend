import Booking from "../models/Booking.js";
import sendEmail from "./emailService.js";

const sendReminderEmails = async () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60000);

  const upcomingBookings = await Booking.find({
    reservationTime: { $gte: now, $lte: oneHourLater },
  });

  for (const booking of upcomingBookings) {
    const { userEmail, userName, reservationTime } = booking;
    sendEmail(
      userEmail,
      "Upcoming Booking Reminder",
      `Hi ${userName}, this is a reminder for your booking at ${reservationTime}.`,
      `<p>Your reservation is approaching soon at ${reservationTime}.</p>`
    );
  }
};

export default sendReminderEmails;
