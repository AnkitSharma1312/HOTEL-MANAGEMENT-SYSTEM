const {
  createRoom: createRoomModel,
  getAllRooms: getAllRoomsModel,
  getRoomById: getRoomByIdModel,
  updateRoom: updateRoomModel,
  deleteRoom: deleteRoomModel,
} = require("../models/roomModel");
const { pool } = require("../config/db");

const createRoom = async (req, res, next) => {
  try {
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const roomId = await createRoomModel({
      ...req.body,
      price_per_night: req.body.price_per_night ?? req.body.price,
      roomNumber: req.body.roomNumber || req.body.name,
      image_url,
    });

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: { id: roomId },
      room: { id: roomId },
    });
  } catch (error) {
    next(error);
  }
};

const getAllRooms = async (req, res, next) => {
  try {
    const rooms = await getAllRoomsModel(req.query);
    res.status(200).json({
      success: true,
      message: "Rooms fetched successfully",
      data: rooms,
      rooms,
    });
  } catch (error) {
    next(error);
  }
};

const getRoomById = async (req, res, next) => {
  try {
    const room = await getRoomByIdModel(req.params.id);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }
    res.status(200).json({
      success: true,
      message: "Room fetched successfully",
      data: room,
      room,
    });
  } catch (error) {
    next(error);
  }
};

const updateRoom = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.image_url = `/uploads/${req.file.filename}`;
    }

    const updated = await updateRoomModel(req.params.id, data);
    if (!updated) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided" });
    }

    res
      .status(200)
      .json({ success: true, message: "Room updated successfully", data: {} });
  } catch (error) {
    next(error);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    await deleteRoomModel(req.params.id);
    res
      .status(200)
      .json({ success: true, message: "Room deleted successfully", data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
};
