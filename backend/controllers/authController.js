const jwt = require("jsonwebtoken");
const {
  createUser,
  findByEmail,
  findById,
  comparePassword,
  updatePassword,
} = require("../models/userModel");

const createToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const register = async (req, res, next) => {
  try {
    const {
      name,
      fullName,
      firstName,
      lastName,
      email,
      password,
      role = "guest",
      phone,
    } = req.body;
    const existingUser = await findByEmail(email);

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const displayName =
      name ||
      fullName ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      "Guest";
    const userId = await createUser({
      name: displayName,
      fullName: displayName,
      email,
      password,
      role,
      phone,
    });
    const user = await findById(userId);
    const token = createToken(user);

    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { user, token },
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await findByEmail(email);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const token = createToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

const profile = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: { user: req.user },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie("token");
    res
      .status(200)
      .json({ success: true, message: "Logout successful", data: {} });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await findByEmail(req.user.email);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await comparePassword(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    await updatePassword(req.user.id, newPassword);
    res.status(200).json({
      success: true,
      message: "Password updated successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  profile,
  logout,
  changePassword,
};
