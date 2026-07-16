const {
  createBooking: createBookingModel,
  getBookings: getBookingsModel,
  getBookingById: getBookingByIdModel,
  updateBooking: updateBookingModel,
  deleteBooking: deleteBookingModel,
  getBookingOverlap,
  createPayment,
  getPayments: getPaymentsModel,
} = require("../models/bookingModel");
const { getRoomById, updateRoomStatus } = require("../models/roomModel");
const { pool } = require("../config/db");

const createBooking = async (req, res, next) => {
  try {
    const {
      roomId,
      room_id,
      checkIn,
      check_in_date,
      checkOut,
      check_out_date,
      guests = 1,
    } = req.body;
    const resolvedRoomId = roomId ?? room_id;
    const resolvedCheckIn = checkIn ?? check_in_date;
    const resolvedCheckOut = checkOut ?? check_out_date;
    const room = await getRoomById(resolvedRoomId);

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    if (room.status !== "available") {
      return res
        .status(400)
        .json({ success: false, message: "Room is not available" });
    }

    if (Number(guests) > Number(room.capacity)) {
      return res
        .status(400)
        .json({ success: false, message: "Guest count exceeds room capacity" });
    }

    const startDate = new Date(resolvedCheckIn);
    const endDate = new Date(resolvedCheckOut);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Check-out date must be after check-in date",
      });
    }

    const overlap = await getBookingOverlap(
      resolvedRoomId,
      resolvedCheckIn,
      resolvedCheckOut,
    );
    if (overlap.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Room is already booked for the selected dates",
      });
    }

    const nights = Math.max(
      1,
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
    );
    const totalAmount =
      Number(room.price || room.price_per_night || 0) * nights;
    const bookingId = await createBookingModel({
      user_id: req.user.id,
      room_id: resolvedRoomId,
      check_in_date: resolvedCheckIn,
      check_out_date: resolvedCheckOut,
      guests,
      total_amount: totalAmount,
      status: "confirmed",
    });

    await createPayment({
      booking_id: bookingId,
      amount: totalAmount,
      payment_method: "cash",
      status: "paid",
      transaction_id: `TXN-${bookingId}`,
    });
    await updateRoomStatus(resolvedRoomId, "reserved");

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: { bookingId, totalAmount, nights },
      booking: { id: bookingId, totalAmount, nights },
    });
  } catch (error) {
    next(error);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const bookings = await getBookingsModel(req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: bookings,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const booking = await getBookingByIdModel(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (req.user.role !== "admin" && booking.guest_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      data: booking,
      booking,
    });
  } catch (error) {
    next(error);
  }
};

const updateBooking = async (req, res, next) => {
  try {
    const booking = await getBookingByIdModel(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    const updated = await updateBookingModel(req.params.id, req.body);
    if (!updated) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    if (req.body.booking_status === "checked_out") {
      await updateRoomStatus(booking.room_id, "available");
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

const deleteBooking = async (req, res, next) => {
  try {
    await deleteBookingModel(req.params.id);
    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const payments = await getPaymentsModel(
      req.user.role === "admin" ? null : req.user.id,
    );
    res.status(200).json({
      success: true,
      message: "Payment history fetched successfully",
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT b.*, r.room_number AS room_name, r.room_type_id, p.amount, p.payment_method, p.transaction_id FROM bookings b JOIN rooms r ON b.room_id = r.id LEFT JOIN payments p ON p.booking_id = b.id WHERE b.id = ?",
      [req.params.id],
    );
    const invoice = rows[0];

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "Invoice generated successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getPayments,
  getInvoice,
};
