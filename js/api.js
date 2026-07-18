// Works whether opened as file:// or http://localhost:3000
const API_BASE = "https://hotel-management-system-qtss.onrender.com/api";
/*  Core HTTP helper */
/**
 * Central fetch wrapper.
 * Attaches JWT, handles JSON encoding, parses responses, throws on errors.
 * @param {string} endpoint  – path after /api
 * @param {object} options   – fetch init overrides
 * @returns {Promise<any>}   – parsed JSON body
 */
async function request(endpoint, options = {}) {
  const token = Auth.getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    ...(options.body && typeof options.body === "object"
      ? { body: JSON.stringify(options.body) }
      : {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);

    // Handle 401 – token expired or invalid
    if (res.status === 401) {
      Auth.logout();
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      throw new APIError(
        data.message || "Something went wrong",
        res.status,
        data,
      );
    }

    return data;
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError("Network error – please check your connection", 0);
  }
}

/* Custom error class */
class APIError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

/*  AUTH API */
const AuthAPI = {
  /**
   * Login with email + password.
   * @returns {{ token, user }}
   */
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),

  /**
   * Register new guest account.
   */
  register: (userData) =>
    request("/auth/register", { method: "POST", body: userData }),

  /**
   * Fetch current authenticated user's profile.
   */
  me: () => request("/auth/me"),

  /**
   * Change own password.
   */
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),
};

/*  ROOMS API */
const RoomsAPI = {
  /**
   * List rooms with optional filters.
   * @param {object} params – { type, status, minPrice, maxPrice, search, page, limit }
   */
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v != null),
      ),
    ).toString();
    return request(`/rooms${qs ? "?" + qs : ""}`);
  },

  /** Get single room by ID */
  get: (id) => request(`/rooms/${id}`),

  /** Create room (Admin) */
  create: (data) => request("/rooms", { method: "POST", body: data }),

  /** Update room (Admin) */
  update: (id, data) => request(`/rooms/${id}`, { method: "PUT", body: data }),

  /** Delete room (Admin) */
  delete: (id) => request(`/rooms/${id}`, { method: "DELETE" }),

  /** Update room availability status */
  updateStatus: (id, status) =>
    request(`/rooms/${id}/status`, { method: "PATCH", body: { status } }),
};

/*  BOOKINGS API*/
const BookingsAPI = {
  /**
   * Create a booking.
   * @param {object} data – { roomId, checkIn, checkOut, guests, specialRequests }
   */
  create: (data) => request("/bookings", { method: "POST", body: data }),

  /** List all bookings (Admin / Staff) or own bookings (Guest) */
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v != null),
      ),
    ).toString();
    return request(`/bookings${qs ? "?" + qs : ""}`);
  },

  /** Get own bookings (Guest) */
  myBookings: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v != null),
      ),
    ).toString();
    return request(`/bookings/my${qs ? "?" + qs : ""}`);
  },

  /** Get single booking */
  get: (id) => request(`/bookings/${id}`),

  /** Update booking status (Staff / Admin) */
  updateStatus: (id, status) =>
    request(`/bookings/${id}/status`, { method: "PATCH", body: { status } }),

  /** Cancel booking */
  cancel: (id) => request(`/bookings/${id}/cancel`, { method: "PATCH" }),

  /** Check-in (Staff) */
  checkIn: (id) => request(`/bookings/${id}/check-in`, { method: "PATCH" }),

  /** Check-out (Staff) */
  checkOut: (id) => request(`/bookings/${id}/check-out`, { method: "PATCH" }),

  /** Generate invoice */
  invoice: (id) => request(`/bookings/${id}/invoice`),
};

/*  USERS / GUESTS / STAFF API */
const UsersAPI = {
  /** List all users with optional role filter (Admin) */
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v != null),
      ),
    ).toString();
    return request(`/users${qs ? "?" + qs : ""}`);
  },

  /** Get user by ID */
  get: (id) => request(`/users/${id}`),

  /** Update user (Admin or self) */
  update: (id, data) => request(`/users/${id}`, { method: "PUT", body: data }),

  /** Update own profile */
  updateProfile: (data) =>
    request("/users/profile", { method: "PUT", body: data }),

  /** Delete user (Admin) */
  delete: (id) => request(`/users/${id}`, { method: "DELETE" }),

  /** Create staff member (Admin) */
  createStaff: (data) =>
    request("/users/staff", { method: "POST", body: data }),

  /** Get all staff with profiles */
  getStaffProfiles: () => request("/users/staff-profiles"),

  /** Update staff profile (position/salary) */
  updateStaffProfile: (userId, data) =>
    request(`/users/staff-profiles/${userId}`, { method: "PUT", body: data }),

  /** Pay staff salary */
  paySalary: (userId, data) =>
    request(`/users/staff-profiles/${userId}/pay`, {
      method: "POST",
      body: data,
    }),

  /** Get salary payment history */
  getSalaryHistory: (userId) =>
    request(`/users/staff-profiles/${userId}/payments`),
};

/*  REPORTS / ANALYTICS API (Admin)                                    */
const ReportsAPI = {
  /** Dashboard summary statistics */
  dashboard: () => request("/reports/dashboard"),

  /** Occupancy report */
  occupancy: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/occupancy${qs ? "?" + qs : ""}`);
  },

  /** Revenue report */
  revenue: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/revenue${qs ? "?" + qs : ""}`);
  },

  /** Booking trends */
  bookingTrends: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/bookings${qs ? "?" + qs : ""}`);
  },
};

/*  CONTACT / MESSAGES API                                             */
const ContactAPI = {
  /** Submit contact form */
  submit: (data) => request("/contact", { method: "POST", body: data }),
};

/* Expose APIError globally so other modules can use it */
window.APIError = APIError;
