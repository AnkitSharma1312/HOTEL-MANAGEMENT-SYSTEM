"use strict";
/*  AUTH  */
const Auth = (() => {
  const TOKEN_KEY = "hms_token";
  const USER_KEY = "hms_user";
  return {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser: () => JSON.parse(localStorage.getItem(USER_KEY) || "null"),
    getRole: () => Auth.getUser()?.role || null,
    isLoggedIn: () => !!Auth.getToken(),
    save(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    logout() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = "index.html";
    },

    /** Redirect to login if not authenticated */
    requireAuth() {
      if (!Auth.isLoggedIn()) {
        // Use relative path — works under both file:// and http://
        window.location.href = "login.html";
        return false;
      }
      return true;
    },

    /** Redirect away from auth pages if already logged in */
    requireGuest() {
      if (Auth.isLoggedIn()) {
        window.location.href = "dashboard.html";
        return false;
      }
      return true;
    },

    /** Check if user has one of the allowed roles */
    hasRole(...roles) {
      return roles.includes(Auth.getRole());
    },

    /** Role-specific dashboard redirect after login */
    redirectToDashboard() {
      window.location.href = "dashboard.html";
    },
  };
})();

/*  TOAST NOTIFICATION SYSTEM */
const Toast = () => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }
};
/**
 * Show a toast notification.
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} title
 * @param {string} message
 * @param {number} duration  ms before auto-dismiss (default 4000)
 */
function show(type, title, message = "", duration = 4000) {
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
      <div class="toast-icon">${icons[type] || "ℹ️"}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ""}
      </div>
      <span class="toast-close" role="button" aria-label="Close">✕</span>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;

  el.querySelector(".toast-close").addEventListener("click", () => dismiss(el));
  getContainer().appendChild(el);
  if (duration > 0) setTimeout(() => dismiss(el), duration);
  return el;
}

function dismiss(el) {
  if (!el || !el.parentNode) return;
  el.classList.add("removing");
  setTimeout(() => el.remove(), 320);
}

return {
  success: (title, msg, dur) => show("success", title, msg, dur),
  error: (title, msg, dur) => show("error", title, msg, dur),
  warning: (title, msg, dur) => show("warning", title, msg, dur),
  info: (title, msg, dur) => show("info", title, msg, dur),
};

/*   MODAL MANAGER  */
const Modal = (() => {
  /**
   * Open a modal overlay by ID.
   * Adds 'open' class; ESC key and backdrop click close it.
   */
  function open(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";

    const close = () => Modal.close(overlayId);

    // Close on backdrop click
    overlay._backdropHandler = (e) => {
      if (e.target === overlay) close();
    };
    overlay.addEventListener("click", overlay._backdropHandler);

    // Close on ESC
    overlay._escHandler = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", overlay._escHandler);
  }

  function close(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    if (overlay._backdropHandler)
      overlay.removeEventListener("click", overlay._backdropHandler);
    if (overlay._escHandler)
      document.removeEventListener("keydown", overlay._escHandler);
  }

  /**
   * Show a simple confirmation dialog.
   * Returns a Promise<boolean>.
   */
  function confirm({
    title = "Are you sure?",
    message = "",
    confirmText = "Confirm",
    danger = false,
  }) {
    return new Promise((resolve) => {
      // Create modal if not exists
      let overlay = document.getElementById("confirm-modal-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "confirm-modal-overlay";
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
          <div class="modal modal-sm confirm-modal">
            <div class="modal-body">
              <div class="confirm-icon">🤔</div>
              <h3 id="confirm-title"></h3>
              <p id="confirm-message"></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="confirm-cancel-btn">Cancel</button>
              <button class="btn btn-primary" id="confirm-ok-btn">Confirm</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }

      overlay.querySelector("#confirm-title").textContent = title;
      overlay.querySelector("#confirm-message").textContent = message;
      const okBtn = overlay.querySelector("#confirm-ok-btn");
      okBtn.textContent = confirmText;
      okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
      overlay.querySelector(".confirm-icon").textContent = danger ? "⚠️" : "🤔";

      const cleanup = (val) => {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
        resolve(val);
      };

      okBtn.onclick = () => cleanup(true);
      overlay.querySelector("#confirm-cancel-btn").onclick = () =>
        cleanup(false);
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    });
  }

  return { open, close, confirm };
})();

/*  UI HELPERS */
const UI = (() => {
  let loaderEl = null;

  return {
    /** Show full-page loading overlay */
    showLoader(text = "Loading...") {
      if (!loaderEl) {
        loaderEl = document.createElement("div");
        loaderEl.className = "loading-overlay";
        loaderEl.innerHTML = `<div class="spinner"></div><div class="loading-text">${text}</div>`;
        document.body.appendChild(loaderEl);
      } else {
        loaderEl.querySelector(".loading-text").textContent = text;
      }
    },

    hideLoader() {
      if (loaderEl) {
        loaderEl.remove();
        loaderEl = null;
      }
    },

    /** Set button to loading state */
    btnLoading(btn, text = "Loading...") {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = `<div class="spinner spinner-sm spinner-inline"></div>${text}`;
      btn.disabled = true;
    },

    /** Restore button from loading state */
    btnReset(btn) {
      if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
      btn.disabled = false;
    },

    /** Render a simple bar chart into a container element */
    renderBarChart(container, data, maxVal) {
      const max = maxVal || Math.max(...data.map((d) => d.value), 1);
      container.innerHTML = `
        <div class="chart-bars">
          ${data
            .map(
              (d) => `
            <div class="chart-bar" style="height:${Math.round((d.value / max) * 100)}%"
                 title="${d.label}: ${d.value}"></div>`,
            )
            .join("")}
        </div>
        <div style="display:flex;justify-content:space-around;font-size:0.72rem;color:var(--text-light);padding:6px 16px 0">
          ${data.map((d) => `<span>${d.label}</span>`).join("")}
        </div>`;
    },

    /**
     * Build pagination controls.
     * @param {HTMLElement} container
     * @param {number} currentPage
     * @param {number} totalPages
     * @param {Function} onPageChange  callback(page)
     */
    renderPagination(container, currentPage, totalPages, onPageChange) {
      if (totalPages <= 1) {
        container.innerHTML = "";
        return;
      }
      const pages = [];
      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
          pages.push(i);
        } else if (pages[pages.length - 1] !== "...") {
          pages.push("...");
        }
      }
      container.innerHTML = `
        <button class="page-btn" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">‹</button>
        ${pages
          .map((p) =>
            p === "..."
              ? `<span class="page-info">…</span>`
              : `<button class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`,
          )
          .join("")}
        <button class="page-btn" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">›</button>
      `;
      container.querySelectorAll(".page-btn:not([disabled])").forEach((btn) => {
        btn.addEventListener("click", () =>
          onPageChange(parseInt(btn.dataset.page)),
        );
      });
    },

    /** Escape HTML to prevent XSS */
    escape(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },

    /** Format currency */
    currency(amount) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount || 0);
    },

    /** Format date to display string */
    formatDate(dateStr) {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },

    /** Compute nights between two date strings */
    nightsBetween(checkIn, checkOut) {
      const d1 = new Date(checkIn),
        d2 = new Date(checkOut);
      return Math.max(1, Math.round((d2 - d1) / 86400000));
    },

    /** Get user initials for avatar */
    initials(name = "") {
      return name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    },

    /** Return a badge HTML string for booking/room status */
    statusBadge(status) {
      const map = {
        available: "badge-success",
        occupied: "badge-danger",
        maintenance: "badge-warning",
        reserved: "badge-info",
        pending: "badge-warning",
        confirmed: "badge-info",
        checked_in: "badge-success",
        checked_out: "badge-secondary",
        cancelled: "badge-danger",
        completed: "badge-gold",
      };
      const cls = map[status] || "badge-secondary";
      return `<span class="badge ${cls}">${status?.replace("_", " ") || "—"}</span>`;
    },
  };
})();

/*  VALIDATOR */
const Validator = (() => {
  /**
   * Validate a set of rules against form fields.
   * @param {Array<{id, rules: {required?, minLength?, email?, match?, custom?}, label}>} fields
   * @returns {boolean} valid
   */
  function validate(fields) {
    let valid = true;
    fields.forEach(({ id, label, rules }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const errEl =
        el.parentNode.querySelector(".form-error") ||
        el.closest(".form-group")?.querySelector(".form-error");
      const val = el.value.trim();
      let errMsg = "";

      if (rules.required && !val) {
        errMsg = `${label} is required.`;
      } else if (
        val &&
        rules.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      ) {
        errMsg = `Please enter a valid email address.`;
      } else if (val && rules.minLength && val.length < rules.minLength) {
        errMsg = `${label} must be at least ${rules.minLength} characters.`;
      } else if (rules.match) {
        const matchEl = document.getElementById(rules.match);
        if (matchEl && val !== matchEl.value.trim()) {
          errMsg = `${label} does not match.`;
        }
      } else if (rules.custom) {
        errMsg = rules.custom(val, el) || "";
      }

      if (errMsg) {
        el.classList.add("error");
        if (errEl) {
          errEl.textContent = errMsg;
          errEl.classList.add("show");
        }
        valid = false;
      } else {
        el.classList.remove("error");
        if (errEl) {
          errEl.textContent = "";
          errEl.classList.remove("show");
        }
      }
    });
    return valid;
  }

  /** Clear all validation errors in a form */
  function clearErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form
      .querySelectorAll(".form-control.error")
      .forEach((el) => el.classList.remove("error"));
    form.querySelectorAll(".form-error.show").forEach((el) => {
      el.textContent = "";
      el.classList.remove("show");
    });
  }

  return { validate, clearErrors };
})();

/* SIDEBAR (Dashboard pages)*/
function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const toggleBtn = document.getElementById("sidebarToggle");
  const closeBtn = document.getElementById("sidebarClose");

  if (!sidebar) return;

  const open = () => {
    sidebar.classList.add("open");
    overlay?.classList.add("show");
  };
  const close = () => {
    sidebar.classList.remove("open");
    overlay?.classList.remove("show");
  };

  toggleBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  // Highlight active link — strip hash so "dashboard.html#checkins" matches "dashboard.html"
  const currentPath =
    window.location.pathname.split("/").pop().split("#")[0] ||
    window.location.href.split("/").pop().split("#")[0].split("?")[0];
  sidebar.querySelectorAll(".nav-item[href]").forEach((link) => {
    const linkPath = link.getAttribute("href").split("#")[0].split("?")[0];
    if (linkPath && linkPath === currentPath) link.classList.add("active");
  });

  // Populate user info in sidebar
  const user = Auth.getUser();
  if (user) {
    const avatarEl = document.getElementById("sidebarAvatar");
    const nameEl = document.getElementById("sidebarUserName");
    const roleEl = document.getElementById("sidebarUserRole");
    if (avatarEl) avatarEl.textContent = UI.initials(user.name || user.email);
    if (nameEl) nameEl.textContent = user.name || "User";
    if (roleEl) roleEl.textContent = user.role;
  }

  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const ok = await Modal.confirm({
      title: "Logout",
      message: "Are you sure you want to log out?",
      confirmText: "Logout",
      danger: true,
    });
    if (ok) {
      Auth.logout(); /* Auth.logout() now redirects */
    }
  });
}

/* Topbar user initials */
function initTopbar() {
  const user = Auth.getUser();
  if (!user) return;
  const av = document.getElementById("topbarAvatar");
  const nm = document.getElementById("topbarUserName");
  if (av) av.textContent = UI.initials(user.name || user.email);
  if (nm) nm.textContent = user.name || "User";
}

/* Show/hide role-specific nav sections */
function applyRoleVisibility() {
  const role = Auth.getRole();
  document.querySelectorAll("[data-role]").forEach((el) => {
    const allowed = el.dataset.role.split(",").map((r) => r.trim());
    el.style.display = allowed.includes(role) ? "" : "none";
  });
}

/* PAGE LANDING (index.html)*/
function initLandingPage() {
  /* --- Navbar scroll effect --- */
  const navbar = document.getElementById("navbar");
  if (navbar) {
    const handleScroll = () => {
      navbar.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  }

  /* --- Mobile nav toggle --- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const navActions = document.getElementById("navActions");
  navToggle?.addEventListener("click", () => {
    navLinks?.classList.toggle("open");
    navActions?.classList.toggle("open");
  });
  // Close menu on link click
  navLinks?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navActions?.classList.remove("open");
    });
  });

  /* --- Update nav CTA based on auth state --- */
  // If user is logged in, replace login/register buttons with Dashboard link
  const navActions = document.getElementById("navActions");
  if (navActions && Auth.isLoggedIn()) {
    navActions.innerHTML = `
      <a href="dashboard.html" class="btn btn-gold btn-sm">Dashboard</a>
      <button onclick="Auth.logout()" class="btn btn-outline-gold btn-sm">Logout</button>`;
  }

  /* --- Load featured rooms --- */
  loadFeaturedRooms();

  /* --- Contact form --- */
  const contactForm = document.getElementById("contactFormLanding");
  contactForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valid = Validator.validate([
      { id: "contactName", label: "Name", rules: { required: true } },
      {
        id: "contactEmail",
        label: "Email",
        rules: { required: true, email: true },
      },
      {
        id: "contactMessage",
        label: "Message",
        rules: { required: true, minLength: 10 },
      },
    ]);
    if (!valid) return;

    const btn = contactForm.querySelector("[type=submit]");
    UI.btnLoading(btn, "Sending...");
    try {
      await ContactAPI.submit({
        name: document.getElementById("contactName").value,
        email: document.getElementById("contactEmail").value,
        subject: document.getElementById("contactSubject")?.value || "Inquiry",
        message: document.getElementById("contactMessage").value,
      });
      Toast.success("Message sent!", "We will get back to you soon.");
      contactForm.reset();
    } catch (err) {
      Toast.error("Failed to send", err.message);
    } finally {
      UI.btnReset(btn);
    }
  });
}

async function loadFeaturedRooms() {
  const container = document.getElementById("featuredRooms");
  if (!container) return;
  container.innerHTML =
    '<div class="page-loader"><div class="spinner"></div></div>';
  try {
    const data = await RoomsAPI.list({ limit: 3, status: "available" });
    const rooms = data.rooms || data.data || data || [];
    if (!rooms.length) {
      container.innerHTML = renderSampleRooms();
      return;
    }
    container.innerHTML = rooms.map(renderRoomCard).join("");
  } catch {
    // If backend not available, show sample data
    container.innerHTML = renderSampleRooms();
  }
}

function renderRoomCard(room) {
  return `
    <div class="room-card">
      <div class="room-card-img">
        ${room.image ? `<img src="${UI.escape(room.image)}" alt="${UI.escape(room.name)}">` : `<div class="room-card-img-placeholder">🛏️</div>`}
        <span class="room-badge">${UI.escape(room.type || "Standard")}</span>
        <div class="room-price-tag"><span>$${room.price || room.pricePerNight || 0}</span>/night</div>
      </div>
      <div class="room-card-body">
        <h3>${UI.escape(room.name || room.roomNumber || "Room")}</h3>
        <p>${UI.escape(room.description || "Elegant and comfortable room with modern amenities.")}</p>
        <div class="room-amenities">
          ${(room.amenities || ["WiFi", "AC", "TV"])
            .slice(0, 4)
            .map((a) => `<span class="amenity-tag">✓ ${UI.escape(a)}</span>`)
            .join("")}
        </div>
      </div>
      <div class="room-card-footer">
        <div class="room-rating">
          <span class="stars">★★★★★</span>
          <span style="font-size:0.82rem;color:var(--text-light)">(${room.reviews || Math.floor(Math.random() * 80 + 20)})</span>
        </div>
        <a href="booking.html?roomId=${room.id || room._id}" class="btn btn-primary btn-sm">Book Now</a>
      </div>
    </div>`;
}

function renderSampleRooms() {
  const samples = [
    {
      id: 1,
      name: "Deluxe King Room",
      type: "Deluxe",
      price: 199,
      description:
        "Spacious room with king bed, city views, and premium bath amenities.",
      amenities: ["Free WiFi", "King Bed", "Mini Bar", "City View"],
      reviews: 124,
    },
    {
      id: 2,
      name: "Executive Suite",
      type: "Suite",
      price: 349,
      description:
        "Luxurious suite with separate living area, jacuzzi, and butler service.",
      amenities: ["Free WiFi", "Jacuzzi", "Butler", "Lounge"],
      reviews: 87,
    },
    {
      id: 3,
      name: "Presidential Villa",
      type: "Villa",
      price: 699,
      description:
        "Our finest accommodation with private pool, chef, and panoramic views.",
      amenities: ["Private Pool", "Chef", "Spa", "Panorama"],
      reviews: 52,
    },
  ];
  return samples.map(renderRoomCard).join("");
}

/*   LOGIN.HTML */
function initLoginPage() {
  if (!Auth.requireGuest()) return;

  // Toggle password visibility
  document
    .getElementById("togglePassword")
    ?.addEventListener("click", function () {
      const input = document.getElementById("loginPassword");
      const isText = input.type === "text";
      input.type = isText ? "password" : "text";
      this.textContent = isText ? "👁" : "🙈";
    });

  document
    .getElementById("loginForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valid = Validator.validate([
        {
          id: "loginEmail",
          label: "Email",
          rules: { required: true, email: true },
        },
        { id: "loginPassword", label: "Password", rules: { required: true } },
      ]);
      if (!valid) return;

      const btn = e.target.querySelector("[type=submit]");
      UI.btnLoading(btn, "Signing in...");

      try {
        const res = await AuthAPI.login(
          document.getElementById("loginEmail").value,
          document.getElementById("loginPassword").value,
        );
        Auth.save(res.token, res.user);
        Toast.success(
          "Welcome back!",
          `Good to see you, ${res.user.name || "there"}.`,
        );
        setTimeout(() => Auth.redirectToDashboard(), 600);
      } catch (err) {
        Toast.error("Login failed", err.message);
        UI.btnReset(btn);
      }
    });
}

/* REGISTER.HTML */
function initRegisterPage() {
  if (!Auth.requireGuest()) return;

  document
    .getElementById("toggleRegPassword")
    ?.addEventListener("click", function () {
      const input = document.getElementById("regPassword");
      input.type = input.type === "text" ? "password" : "text";
      this.textContent = input.type === "text" ? "🙈" : "👁";
    });

  document
    .getElementById("registerForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valid = Validator.validate([
        { id: "regFirstName", label: "First name", rules: { required: true } },
        { id: "regLastName", label: "Last name", rules: { required: true } },
        {
          id: "regEmail",
          label: "Email",
          rules: { required: true, email: true },
        },
        { id: "regPhone", label: "Phone", rules: { required: true } },
        {
          id: "regPassword",
          label: "Password",
          rules: { required: true, minLength: 8 },
        },
        {
          id: "regConfirm",
          label: "Confirm password",
          rules: { required: true, match: "regPassword" },
        },
      ]);
      if (!valid) return;

      // Check terms agreement
      const termsEl = document.getElementById("agreeTerms");
      if (termsEl && !termsEl.checked) {
        Toast.warning(
          "Terms required",
          "Please agree to the Terms of Service to continue.",
        );
        return;
      }

      const btn = e.target.querySelector("[type=submit]");
      UI.btnLoading(btn, "Creating account...");

      try {
        const res = await AuthAPI.register({
          firstName: document.getElementById("regFirstName").value,
          lastName: document.getElementById("regLastName").value,
          email: document.getElementById("regEmail").value,
          phone: document.getElementById("regPhone").value,
          password: document.getElementById("regPassword").value,
        });
        Auth.save(res.token, res.user);
        Toast.success("Account created!", "Welcome to Grand Luxe Hotel.");
        setTimeout(() => Auth.redirectToDashboard(), 800);
      } catch (err) {
        Toast.error("Registration failed", err.message);
        UI.btnReset(btn);
      }
    });
}

/*  DASHBOARD.HTML*/
async function initDashboardPage() {
  if (!Auth.requireAuth()) return;
  initSidebar();
  initTopbar();
  applyRoleVisibility();

  const role = Auth.getRole();
  const user = Auth.getUser();

  // Set welcome message
  const welcomeEl = document.getElementById("dashWelcome");
  if (welcomeEl)
    welcomeEl.textContent = `Welcome back, ${user?.name?.split(" ")[0] || "there"}!`;

  // Load stats
  try {
    if (role === "admin" || role === "staff") {
      const stats = await ReportsAPI.dashboard();
      populateDashboardStats(stats);
      loadRecentBookings();
      if (role === "admin") loadChartData(stats);
    } else {
      loadGuestDashboard();
    }
  } catch {
    // Backend not available — render placeholders and chart with sample data
    populateDashboardStats({});
    if (role === "admin" || role === "staff") {
      loadRecentBookings();
      if (role === "admin") loadChartData({});
    } else {
      loadGuestDashboard();
    }
  }
}

function populateDashboardStats(stats) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("statTotalRooms", stats.totalRooms || "—");
  set("statOccupied", stats.occupied || "—");
  set("statCheckIns", stats.checkInsToday || "—");
  set(
    "statRevenue",
    stats.revenueToday ? UI.currency(stats.revenueToday) : "—",
  );
  set("statTotalGuests", stats.totalGuests || "—");
  set("statPendingBooks", stats.pendingBookings || "—");
}

async function loadRecentBookings() {
  const tbody = document.getElementById("recentBookingsTbody");
  if (!tbody) return;
  try {
    const data = await BookingsAPI.list({ limit: 8 });
    const bookings = data.bookings || data.data || data || [];
    if (!bookings.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">No recent bookings</td></tr>';
      return;
    }
    tbody.innerHTML = bookings
      .map(
        (b) => `
      <tr>
        <td>#${b.id || b._id}</td>
        <td>${UI.escape(b.guestName || b.guest?.name || "—")}</td>
        <td>${UI.escape(b.roomNumber || b.room?.number || "—")}</td>
        <td>${UI.formatDate(b.checkIn)}</td>
        <td>${UI.formatDate(b.checkOut)}</td>
        <td>${UI.statusBadge(b.status)}</td>
      </tr>`,
      )
      .join("");
  } catch {
    tbody.innerHTML =
      '<tr><td colspan="6" class="table-empty">Unable to load bookings</td></tr>';
  }
}

async function loadGuestDashboard() {
  const container = document.getElementById("guestBookingsContainer");
  if (!container) return;
  try {
    const data = await BookingsAPI.myBookings({ limit: 5 });
    const bookings = data.bookings || data.data || data || [];
    if (!bookings.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No bookings yet</h3><p>Ready to plan your stay?</p><a href="rooms.html" class="btn btn-primary">Browse Rooms</a></div>`;
      return;
    }
    container.innerHTML = bookings
      .map(
        (b) => `
      <div class="activity-item">
        <div class="activity-dot ${b.status === "confirmed" ? "green" : b.status === "pending" ? "gold" : "blue"}"></div>
        <div class="activity-text">
          <strong>Room ${UI.escape(b.roomNumber || b.room?.number || b.roomId)} — ${UI.escape(b.roomType || "")}</strong>
          <span>${UI.formatDate(b.checkIn)} → ${UI.formatDate(b.checkOut)}</span>
        </div>
        <div>${UI.statusBadge(b.status)}</div>
      </div>`,
      )
      .join("");
  } catch {
    container.innerHTML =
      '<p style="color:var(--text-light);text-align:center;padding:20px">Could not load bookings.</p>';
  }
}

function loadChartData(stats) {
  const chartEl = document.getElementById("revenueChart");
  if (!chartEl) return;
  const data = (stats && stats.weeklyRevenue) || [
    { label: "Mon", value: 1200 },
    { label: "Tue", value: 1800 },
    { label: "Wed", value: 1100 },
    { label: "Thu", value: 2400 },
    { label: "Fri", value: 3100 },
    { label: "Sat", value: 3800 },
    { label: "Sun", value: 2900 },
  ];
  UI.renderBarChart(chartEl, data);
}

/* ROOMS.HTML */
let roomsState = { page: 1, total: 0, limit: 9 };

async function initRoomsPage() {
  initSidebar();
  initTopbar();
  applyRoleVisibility(); // shows/hides admin Add Room button and role-restricted nav sections

  await loadRooms();

  // Filter form
  document
    .getElementById("roomsFilterForm")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      roomsState.page = 1;
      loadRooms();
    });
  document.getElementById("roomsFilterForm")?.addEventListener("reset", () => {
    setTimeout(() => {
      roomsState.page = 1;
      loadRooms();
    }, 50);
  });

  // Search debounce
  let searchTimer;
  document.getElementById("roomSearch")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      roomsState.page = 1;
      loadRooms();
    }, 400);
  });

  // Admin: Add room button
  document.getElementById("addRoomBtn")?.addEventListener("click", () => {
    openRoomModal(null);
  });
  document
    .getElementById("roomFormModal")
    ?.addEventListener("submit", handleRoomFormSubmit);
}

async function loadRooms() {
  const container = document.getElementById("roomsGrid");
  const paginationEl = document.getElementById("roomsPagination");
  if (!container) return;

  const params = {
    page: roomsState.page,
    limit: roomsState.limit,
    type: document.getElementById("filterRoomType")?.value,
    status: document.getElementById("filterRoomStatus")?.value,
    minPrice: document.getElementById("filterMinPrice")?.value,
    maxPrice: document.getElementById("filterMaxPrice")?.value,
    search: document.getElementById("roomSearch")?.value,
  };

  container.innerHTML =
    '<div class="page-loader"><div class="spinner"></div><span>Loading rooms...</span></div>';
  try {
    const data = await RoomsAPI.list(params);
    const rooms = data.rooms || data.data || data || [];
    const total = data.total || data.totalCount || rooms.length;
    roomsState.total = total;

    if (!rooms.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div><h3>No rooms found</h3>
        <p>Try adjusting your search filters.</p></div>`;
    } else {
      const isAdmin = Auth.hasRole("admin");
      container.innerHTML = rooms
        .map((room) => renderRoomCardWithActions(room, isAdmin))
        .join("");
      attachRoomCardEvents();
    }
    if (paginationEl) {
      UI.renderPagination(
        paginationEl,
        roomsState.page,
        Math.ceil(total / roomsState.limit),
        (p) => {
          roomsState.page = p;
          loadRooms();
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      );
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div><h3>Could not load rooms</h3><p>${UI.escape(err.message)}</p>
      <button class="btn btn-primary" onclick="loadRooms()">Retry</button></div>`;
  }
}

function renderRoomCardWithActions(room, isAdmin) {
  return `
    <div class="room-card" data-room-id="${room.id || room._id}">
      <div class="room-card-img">
        ${room.image ? `<img src="${UI.escape(room.image)}" alt="${UI.escape(room.name)}">` : `<div class="room-card-img-placeholder">🛏️</div>`}
        <span class="room-badge">${UI.escape(room.type || "Standard")}</span>
        <div class="room-price-tag"><span>$${room.price || room.pricePerNight || 0}</span>/night</div>
      </div>
      <div class="room-card-body">
        <h3>${UI.escape(room.name || `Room ${room.roomNumber}`)}</h3>
        <p>${UI.escape((room.description || "").slice(0, 90))}${(room.description || "").length > 90 ? "..." : ""}</p>
        <div class="room-amenities">
          ${(room.amenities || ["WiFi", "AC", "TV"])
            .slice(0, 3)
            .map((a) => `<span class="amenity-tag">✓ ${UI.escape(a)}</span>`)
            .join("")}
        </div>
        <div style="margin-top:8px">${UI.statusBadge(room.status || "available")}</div>
      </div>
      <div class="room-card-footer">
        <div class="room-rating"><span class="stars">★★★★${room.rating >= 5 ? "★" : "☆"}</span></div>
        <div style="display:flex;gap:8px">
          ${
            isAdmin
              ? `
            <button class="btn btn-outline btn-sm edit-room-btn" data-id="${room.id || room._id}">Edit</button>
            <button class="btn btn-danger btn-sm delete-room-btn" data-id="${room.id || room._id}">Delete</button>
          `
              : `
            <a href="booking.html?roomId=${room.id || room._id}" class="btn btn-primary btn-sm ${room.status !== "available" ? "hidden" : ""}">Book</a>
          `
          }
        </div>
      </div>
    </div>`;
}

function attachRoomCardEvents() {
  // Edit room
  document.querySelectorAll(".edit-room-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const room = await RoomsAPI.get(btn.dataset.id);
        openRoomModal(room.room || room);
      } catch (err) {
        Toast.error("Error", err.message);
      }
    });
  });
  // Delete room
  document.querySelectorAll(".delete-room-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await Modal.confirm({
        title: "Delete Room",
        message: "This will permanently delete this room.",
        confirmText: "Delete",
        danger: true,
      });
      if (!ok) return;
      try {
        await RoomsAPI.delete(btn.dataset.id);
        Toast.success("Deleted", "Room has been removed.");
        loadRooms();
      } catch (err) {
        Toast.error("Error", err.message);
      }
    });
  });
}

function openRoomModal(room = null) {
  // The overlay wraps the modal — use its ID directly
  const overlay = document.getElementById("roomModalOverlay");
  if (!overlay) return;
  const form = document.getElementById("roomFormModal");
  form?.reset();
  overlay.querySelector(".modal-title").textContent = room
    ? "Edit Room"
    : "Add New Room";
  if (room) {
    document.getElementById("roomModalId").value = room.id || room._id || "";
    document.getElementById("roomModalName").value = room.name || "";
    document.getElementById("roomModalType").value = room.type || "Standard";
    document.getElementById("roomModalPrice").value =
      room.price || room.pricePerNight || "";
    document.getElementById("roomModalDesc").value = room.description || "";
    document.getElementById("roomModalStatus").value =
      room.status || "available";
    document.getElementById("roomModalNum").value = room.roomNumber || "";
    document.getElementById("roomModalCap").value = room.capacity || 2;
  }
  Modal.open("roomModalOverlay");
}

async function handleRoomFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("roomModalId")?.value;
  const data = {
    name: document.getElementById("roomModalName").value,
    type: document.getElementById("roomModalType").value,
    price: parseFloat(document.getElementById("roomModalPrice").value),
    description: document.getElementById("roomModalDesc").value,
    status: document.getElementById("roomModalStatus").value,
    roomNumber: document.getElementById("roomModalNum").value,
    capacity: parseInt(document.getElementById("roomModalCap").value),
  };
  const btn = e.target.querySelector("[type=submit]");
  UI.btnLoading(btn, "Saving...");
  try {
    if (id) {
      await RoomsAPI.update(id, data);
      Toast.success("Updated", "Room updated successfully.");
    } else {
      await RoomsAPI.create(data);
      Toast.success("Created", "New room added.");
    }
    Modal.close("roomModalOverlay");
    loadRooms();
  } catch (err) {
    Toast.error("Error", err.message);
  } finally {
    UI.btnReset(btn);
  }
}

/*  BOOKING.HTML */
let bookingState = { step: 1, room: null, formData: {} };

async function initBookingPage() {
  if (!Auth.requireAuth()) return;
  initSidebar();
  initTopbar();
  applyRoleVisibility();

  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("roomId");
  const bookingId = urlParams.get("id");
  const openTab = urlParams.get("tab");

  if (bookingId) {
    if (typeof switchBookingTab === "function")
      switchBookingTab(
        "myBookings",
        document.querySelector("[data-tab=myBookings]"),
      );
    await loadMyBookings();
    viewBookingDetail(bookingId);
    return;
  }

  if (
    openTab &&
    ["myBookings", "allBookings", "newBooking"].includes(openTab)
  ) {
    if (typeof switchBookingTab === "function")
      switchBookingTab(
        openTab,
        document.querySelector("[data-tab=" + openTab + "]"),
      );
  }

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("bookCheckIn")?.setAttribute("min", today);
  document.getElementById("bookCheckOut")?.setAttribute("min", today);

  document
    .getElementById("bookCheckIn")
    ?.addEventListener("change", updateBookingSummary);
  document
    .getElementById("bookCheckOut")
    ?.addEventListener("change", updateBookingSummary);
  document
    .getElementById("bookGuests")
    ?.addEventListener("change", updateBookingSummary);

  document
    .getElementById("step1NextBtn")
    ?.addEventListener("click", handleStep1Next);
  document
    .getElementById("step2BackBtn")
    ?.addEventListener("click", () => goToBookingStep(1));
  document
    .getElementById("bookingForm")
    ?.addEventListener("submit", handleBookingSubmit);

  if (roomId) {
    await preSelectRoom(roomId);
  } else {
    await loadAvailableRooms();
  }
}

async function preSelectRoom(roomId) {
  const banner = document.getElementById("preselectedRoomBanner");
  const detailsEl = document.getElementById("preselectedRoomDetails");
  const selectWrap = document.getElementById("roomSelectWrap");
  const hiddenId = document.getElementById("bookRoomId");
  try {
    const data = await RoomsAPI.get(roomId);
    bookingState.room = data.room || data;
    const room = bookingState.room;
    if (hiddenId) hiddenId.value = roomId;
    if (detailsEl)
      detailsEl.innerHTML = `
      <div style="font-weight:700;font-size:1.05rem">${UI.escape(room.name || "Room " + room.roomNumber)}</div>
      <div style="font-size:0.85rem;opacity:0.8;margin-top:3px">
        ${UI.escape(room.type || "Standard")} &middot; Max ${room.capacity || 2} guests
        &nbsp;&middot;&nbsp; <strong style="color:var(--gold-light)">$${room.price || room.pricePerNight || 0}/night</strong>
      </div>`;
    if (banner) banner.classList.remove("hidden");
    if (selectWrap) selectWrap.classList.add("hidden");
    updateRoomSummary(room);
  } catch {
    Toast.error(
      "Error",
      "Could not load room. Please select from the dropdown.",
    );
    await loadAvailableRooms();
  }
}

function updateRoomSummary(room) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("summaryRoomName", room.name || "Room " + room.roomNumber);
  set("summaryRoomType", room.type || "Standard");
  set(
    "summaryRoomPrice",
    UI.currency(room.price || room.pricePerNight || 0) + " / night",
  );
  updateBookingSummary();
}

async function loadAvailableRooms() {
  const select = document.getElementById("bookRoomSelect");
  if (!select) return;
  select.innerHTML = '<option value="">Loading rooms...</option>';
  try {
    const data = await RoomsAPI.list({ status: "available", limit: 100 });
    const rooms = data.rooms || data.data || data || [];
    if (!rooms.length) {
      select.innerHTML = '<option value="">No rooms available</option>';
      return;
    }
    select.innerHTML =
      '<option value="">-- Select a Room --</option>' +
      rooms
        .map(
          (r) =>
            `<option value="${r.id || r._id}">${UI.escape(r.name || "Room " + r.roomNumber)} — ${UI.escape(r.type || "Standard")} — $${r.price || r.pricePerNight}/night</option>`,
        )
        .join("");
    select.addEventListener("change", async () => {
      const infoEl = document.getElementById("bookingRoomInfo");
      if (!select.value) {
        bookingState.room = null;
        if (infoEl) infoEl.innerHTML = "";
        return;
      }
      try {
        const d = await RoomsAPI.get(select.value);
        bookingState.room = d.room || d;
        const room = bookingState.room;
        document.getElementById("bookRoomId").value = select.value;
        if (infoEl)
          infoEl.innerHTML = `
          <div style="background:var(--bg-light);border-radius:var(--radius-md);padding:14px 16px;
            display:flex;gap:14px;align-items:center">
            <div style="font-size:2rem">🛏️</div>
            <div>
              <div style="font-weight:700;color:var(--royal-blue-dark)">${UI.escape(room.name || "Room " + room.roomNumber)}</div>
              <div style="font-size:0.85rem;color:var(--text-mid);margin-top:3px">
                ${UI.escape(room.type || "Standard")} &middot; Max ${room.capacity || 2} guests
                &middot; <span style="color:var(--royal-blue);font-weight:700">$${room.price || room.pricePerNight || 0}/night</span>
              </div>
              ${room.description ? '<div style="font-size:0.82rem;color:var(--text-light);margin-top:4px">' + UI.escape(room.description.slice(0, 100)) + "</div>" : ""}
            </div>
          </div>`;
        updateRoomSummary(room);
      } catch (err) {
        Toast.error("Error", err.message);
      }
    });
  } catch (err) {
    select.innerHTML = '<option value="">Could not load rooms</option>';
    Toast.error("Error loading rooms", err.message);
  }
}

function handleStep1Next() {
  const roomId = document.getElementById("bookRoomId")?.value;
  const selectV = document.getElementById("bookRoomSelect")?.value;
  if (!bookingState.room && !roomId && !selectV) {
    Toast.warning("No room selected", "Please select a room to continue.");
    return;
  }
  if (!bookingState.room && (roomId || selectV)) {
    Toast.info("Loading...", "Room details still loading, please try again.");
    return;
  }
  goToBookingStep(2);
}

function goToBookingStep(step) {
  bookingState.step = step;
  [1, 2, 3].forEach((n) => {
    const panel = document.getElementById("stepPanel" + n);
    if (panel) panel.classList.toggle("active", n === step);
  });
  [1, 2, 3].forEach((n) => {
    const ind = document.getElementById("stepIndicator" + n);
    if (!ind) return;
    ind.classList.toggle("active", n === step);
    ind.classList.toggle("completed", n < step);
  });
  document
    .querySelector(".page-content")
    ?.scrollTo({ top: 0, behavior: "smooth" });
}

function updateBookingSummary() {
  const checkIn = document.getElementById("bookCheckIn")?.value;
  const checkOut = document.getElementById("bookCheckOut")?.value;
  const guests = document.getElementById("bookGuests")?.value || 1;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  if (checkIn && checkOut && checkOut <= checkIn) {
    document.getElementById("bookCheckOut").value = "";
    Toast.warning("Invalid dates", "Check-out must be after check-in.");
    return;
  }

  set("summaryGuests", guests + " guest" + (guests > 1 ? "s" : ""));
  if (checkIn) set("summaryCheckIn", UI.formatDate(checkIn));
  if (checkOut) set("summaryCheckOut", UI.formatDate(checkOut));

  if (checkIn && checkOut) {
    const price =
      bookingState.room?.price || bookingState.room?.pricePerNight || 0;
    const nights = UI.nightsBetween(checkIn, checkOut);
    const subtotal = nights * price;
    const tax = subtotal * 0.12;
    const total = subtotal + tax;
    set("summaryNights", nights + " night" + (nights > 1 ? "s" : ""));
    set("summarySubtotal", UI.currency(subtotal));
    set("summaryTax", UI.currency(tax));
    set("summaryTotal", UI.currency(total));
    bookingState.formData = { checkIn, checkOut, nights, subtotal, tax, total };
  }
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const checkIn = document.getElementById("bookCheckIn").value;
  const checkOut = document.getElementById("bookCheckOut").value;
  const guests = document.getElementById("bookGuests").value;
  const showErr = (id, msg) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.classList.add("show");
    }
  };
  const clearErr = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "";
      el.classList.remove("show");
    }
  };

  clearErr("errCheckIn");
  clearErr("errCheckOut");
  let ok = true;
  if (!checkIn) {
    showErr("errCheckIn", "Check-in date required.");
    ok = false;
  }
  if (!checkOut) {
    showErr("errCheckOut", "Check-out date required.");
    ok = false;
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    showErr("errCheckOut", "Must be after check-in.");
    ok = false;
  }
  if (!ok) return;

  const roomId =
    bookingState.room?.id ||
    bookingState.room?._id ||
    document.getElementById("bookRoomId")?.value;
  if (!roomId) {
    Toast.error("No room", "Please go back and select a room.");
    goToBookingStep(1);
    return;
  }

  const btn = e.target.querySelector("[type=submit]");
  UI.btnLoading(btn, "Confirming...");
  try {
    const res = await BookingsAPI.create({
      roomId,
      checkIn,
      checkOut,
      guests: parseInt(guests),
      specialRequests: document.getElementById("bookSpecialReq")?.value || "",
    });
    const booking = res.booking || res;
    const bId = booking.id || booking._id || "—";

    document.getElementById("confirmationBookingId").textContent = "#" + bId;
    const detEl = document.getElementById("confirmationDetails");
    if (detEl)
      detEl.innerHTML = `
      <div><strong>Room:</strong> ${UI.escape(bookingState.room?.name || "Room")}</div>
      <div><strong>Check-In:</strong> ${UI.formatDate(checkIn)}</div>
      <div><strong>Check-Out:</strong> ${UI.formatDate(checkOut)}</div>
      <div><strong>Guests:</strong> ${guests}</div>
      <div><strong>Total:</strong> ${UI.currency(bookingState.formData.total || booking.total || 0)}</div>`;

    goToBookingStep(3);
    Toast.success("Booking Confirmed! 🎉", "Booking #" + bId + " created.");
  } catch (err) {
    Toast.error("Booking failed", err.message);
    UI.btnReset(btn);
  }
}

async function loadMyBookings() {
  const tbody = document.getElementById("myBookingsTbody");
  if (!tbody) return;
  const statusFilter =
    document.getElementById("myBookingStatusFilter")?.value || "";
  tbody.innerHTML =
    '<tr><td colspan="8" class="table-empty"><div class="page-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>';
  try {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    const data = await BookingsAPI.myBookings(params);
    const bookings = data.bookings || data.data || data || [];
    if (!bookings.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-icon">📅</div><h3>No bookings found</h3>
        <p>${statusFilter ? "No " + statusFilter + " bookings." : "You have not made any bookings yet."}</p>
        <button class="btn btn-primary" onclick="switchBookingTab('newBooking', document.querySelector('[data-tab=newBooking]'))">Make Your First Booking</button>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = bookings
      .map((b) => {
        const nights =
          b.checkIn && b.checkOut
            ? UI.nightsBetween(b.checkIn, b.checkOut)
            : "—";
        const canCancel = ["pending", "confirmed"].includes(b.status);
        return `<tr>
        <td><strong>#${b.id || b._id}</strong></td>
        <td>${UI.escape(b.roomName || b.room?.name || "Room " + (b.roomNumber || b.roomId || ""))}</td>
        <td>${UI.formatDate(b.checkIn)}</td>
        <td>${UI.formatDate(b.checkOut)}</td>
        <td>${nights}</td>
        <td>${UI.currency(b.total || b.totalAmount)}</td>
        <td>${UI.statusBadge(b.status)}</td>
        <td class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="viewBookingDetail('${b.id || b._id}')">View</button>
          ${canCancel ? '<button class="btn btn-danger btn-sm" onclick="cancelBooking(\'' + (b.id || b._id) + "')\">Cancel</button>" : ""}
        </td>
      </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Could not load bookings — ${UI.escape(err.message)}<br><button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="loadMyBookings()">Retry</button></td></tr>`;
  }
}

async function cancelBooking(id) {
  const ok = await Modal.confirm({
    title: "Cancel Booking",
    message: "Are you sure you want to cancel this booking?",
    confirmText: "Yes, Cancel",
    danger: true,
  });
  if (!ok) return;
  try {
    await BookingsAPI.cancel(id);
    Toast.success("Cancelled", "Your booking has been cancelled.");
    loadMyBookings();
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

/*  PROFILE .HTML*/
async function initProfilePage() {
  if (!Auth.requireAuth()) return;
  initSidebar();
  initTopbar();
  applyRoleVisibility();

  try {
    const data = await AuthAPI.me();
    const user = data.user || data;
    populateProfile(user);
  } catch {
    const user = Auth.getUser();
    if (user) populateProfile(user);
  }

  document
    .getElementById("profileForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valid = Validator.validate([
        {
          id: "profileFirstName",
          label: "First name",
          rules: { required: true },
        },
        {
          id: "profileLastName",
          label: "Last name",
          rules: { required: true },
        },
        {
          id: "profileEmail",
          label: "Email",
          rules: { required: true, email: true },
        },
      ]);
      if (!valid) return;
      const btn = e.target.querySelector("[type=submit]");
      UI.btnLoading(btn, "Saving...");
      try {
        const res = await UsersAPI.updateProfile({
          firstName: document.getElementById("profileFirstName").value,
          lastName: document.getElementById("profileLastName").value,
          email: document.getElementById("profileEmail").value,
          phone: document.getElementById("profilePhone").value,
          address: document.getElementById("profileAddress")?.value,
        });
        Auth.save(Auth.getToken(), res.user || res);
        Toast.success("Saved", "Profile updated successfully.");
      } catch (err) {
        Toast.error("Error", err.message);
      } finally {
        UI.btnReset(btn);
      }
    });

  document
    .getElementById("passwordForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valid = Validator.validate([
        {
          id: "currentPassword",
          label: "Current password",
          rules: { required: true },
        },
        {
          id: "newPassword",
          label: "New password",
          rules: { required: true, minLength: 8 },
        },
        {
          id: "confirmNewPass",
          label: "Confirm password",
          rules: { required: true, match: "newPassword" },
        },
      ]);
      if (!valid) return;
      const btn = e.target.querySelector("[type=submit]");
      UI.btnLoading(btn, "Updating...");
      try {
        await AuthAPI.changePassword(
          document.getElementById("currentPassword").value,
          document.getElementById("newPassword").value,
        );
        Toast.success("Password changed", "Your password has been updated.");
        e.target.reset();
      } catch (err) {
        Toast.error("Error", err.message);
      } finally {
        UI.btnReset(btn);
      }
    });
}

function populateProfile(user) {
  const name =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "";
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "";
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };
  set("profileHeaderName", name || user.email);
  set("profileHeaderEmail", user.email || "");
  set("profileHeaderRole", user.role || "guest");
  set("profileAvatarText", UI.initials(name || user.email));
  setVal("profileFirstName", user.firstName || (user.name || "").split(" ")[0]);
  setVal(
    "profileLastName",
    user.lastName || (user.name || "").split(" ").slice(1).join(" "),
  );
  setVal("profileEmail", user.email);
  setVal("profilePhone", user.phone);
  setVal("profileAddress", user.address);
}

/*  ABOUT.HTML*/
function initAboutPage() {
  // Wire mobile nav toggle
  document.getElementById("navToggle")?.addEventListener("click", () => {
    document.getElementById("navLinks")?.classList.toggle("open");
    document.getElementById("navActions")?.classList.toggle("open");
  });
  // Update nav for logged-in users
  const navActions = document.getElementById("navActions");
  if (navActions && Auth.isLoggedIn()) {
    navActions.innerHTML = `
      <a href="dashboard.html" class="btn btn-gold btn-sm">Dashboard</a>
      <button onclick="Auth.logout()" class="btn btn-outline-gold btn-sm">Logout</button>`;
  }
  // Animate stat counters on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateCounter(entry.target);
      });
    },
    { threshold: 0.5 },
  );
  document.querySelectorAll(".counter").forEach((el) => observer.observe(el));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target || "0");
  const duration = 1500;
  const start = Date.now();
  const update = () => {
    const progress = Math.min((Date.now() - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* CONTACT.HTML*/
function initContactPage() {
  // Wire mobile nav toggle
  document.getElementById("navToggle")?.addEventListener("click", () => {
    document.getElementById("navLinks")?.classList.toggle("open");
    document.getElementById("navActions")?.classList.toggle("open");
  });
  // Update nav for logged-in users
  const navActions = document.getElementById("navActions");
  if (navActions && Auth.isLoggedIn()) {
    navActions.innerHTML = `
      <a href="dashboard.html" class="btn btn-gold btn-sm">Dashboard</a>
      <button onclick="Auth.logout()" class="btn btn-outline-gold btn-sm">Logout</button>`;
  }

  document
    .getElementById("contactPageForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valid = Validator.validate([
        { id: "cpName", label: "Name", rules: { required: true } },
        {
          id: "cpEmail",
          label: "Email",
          rules: { required: true, email: true },
        },
        { id: "cpSubject", label: "Subject", rules: { required: true } },
        {
          id: "cpMessage",
          label: "Message",
          rules: { required: true, minLength: 10 },
        },
      ]);
      if (!valid) return;
      const btn = e.target.querySelector("[type=submit]");
      UI.btnLoading(btn, "Sending...");
      try {
        await ContactAPI.submit({
          name: document.getElementById("cpName").value,
          email: document.getElementById("cpEmail").value,
          subject: document.getElementById("cpSubject").value,
          message: document.getElementById("cpMessage").value,
        });
        Toast.success(
          "Message sent!",
          "Our team will respond within 24 hours.",
        );
        e.target.reset();
      } catch (err) {
        Toast.error("Failed to send", err.message);
      } finally {
        UI.btnReset(btn);
      }
    });
}

/*  STAFF: Load and manage all bookings*/
async function loadStaffBookings() {
  const tbody = document.getElementById("staffBookingsTbody");
  if (!tbody) return;
  const status = document.getElementById("staffStatusFilter")?.value || "";
  tbody.innerHTML =
    '<tr><td colspan="8" class="table-empty"><div class="page-loader"><div class="spinner"></div><span>Loading...</span></div></td></tr>';
  try {
    const params = {};
    if (status) params.status = status;
    const data = await BookingsAPI.list(params);
    const bookings = data.bookings || data.data || data || [];
    if (!bookings.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="table-empty">No bookings found.</td></tr>';
      return;
    }
    tbody.innerHTML = bookings
      .map(
        (b) => `
      <tr>
        <td><strong>#${b.id || b._id}</strong></td>
        <td>${UI.escape(b.guestName || b.guest?.name || "—")}</td>
        <td>${UI.escape(b.roomNumber || b.room?.number || "—")}</td>
        <td>${UI.formatDate(b.checkIn)}</td>
        <td>${UI.formatDate(b.checkOut)}</td>
        <td>${UI.currency(b.total || b.totalAmount)}</td>
        <td>${UI.statusBadge(b.status)}</td>
        <td class="actions-cell">
          ${b.status === "confirmed" ? `<button class="btn btn-success btn-sm" onclick="staffCheckIn('${b.id || b._id}')">Check-In</button>` : ""}
          ${b.status === "checked_in" ? `<button class="btn btn-gold btn-sm"    onclick="staffCheckOut('${b.id || b._id}')">Check-Out</button>` : ""}
          <button class="btn btn-outline btn-sm" onclick="viewBookingDetail('${b.id || b._id}')">View</button>
        </td>
      </tr>`,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${UI.escape(err.message)}</td></tr>`;
  }
}

async function staffCheckIn(id) {
  const ok = await Modal.confirm({
    title: "Check-In Guest",
    message: "Confirm check-in for this booking?",
    confirmText: "Check In",
  });
  if (!ok) return;
  try {
    await BookingsAPI.checkIn(id);
    Toast.success("Checked In", "Guest has been checked in.");
    loadStaffBookings();
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

async function staffCheckOut(id) {
  const ok = await Modal.confirm({
    title: "Check-Out Guest",
    message: "Confirm check-out for this booking?",
    confirmText: "Check Out",
  });
  if (!ok) return;
  try {
    await BookingsAPI.checkOut(id);
    Toast.success("Checked Out", "Guest has been checked out.");
    loadStaffBookings();
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

/*  ADMIN Manage users table */
async function loadUsersTable(role = "") {
  const tbody = document.getElementById("usersTbody");
  if (!tbody) return;
  try {
    const data = await UsersAPI.list({ role });
    const users = data.users || data.data || data || [];
    if (!users.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="table-empty">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.id || u._id}</td>
        <td>${UI.escape(u.name || ((u.firstName || "") + " " + (u.lastName || "")).trim())}</td>
        <td>${UI.escape(u.email)}</td>
        <td>${UI.escape(u.phone || "—")}</td>
        <td><span class="badge role-${u.role}">${u.role}</span></td>
        <td class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="viewUser('${u.id || u._id}')">View</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteUser('${u.id || u._id}')">Delete</button>
        </td>
      </tr>`,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">${UI.escape(err.message)}</td></tr>`;
  }
}

async function deleteUser(id) {
  const ok = await Modal.confirm({
    title: "Delete User",
    message: "This will permanently delete the user.",
    confirmText: "Delete",
    danger: true,
  });
  if (!ok) return;
  try {
    await UsersAPI.delete(id);
    Toast.success("Deleted", "User removed.");
    loadUsersTable();
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

/*  SHARED: Booking detail modal (used by both staff and guest views) */
async function viewBookingDetail(id) {
  try {
    const data = await BookingsAPI.get(id);
    const b = data.booking || data;
    let overlay = document.getElementById("bookingDetailOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bookingDetailOverlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3>Booking Details</h3>
            <span class="modal-close" data-modal-close="bookingDetailOverlay" role="button">✕</span>
          </div>
          <div class="modal-body" id="bookingDetailBody"></div>
          <div class="modal-footer">
            <button class="btn btn-outline" data-modal-close="bookingDetailOverlay">Close</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    document.getElementById("bookingDetailBody").innerHTML = `
      <div class="detail-row"><span class="detail-label">Booking #</span><span class="detail-value">${b.id || b._id}</span></div>
      <div class="detail-row"><span class="detail-label">Guest</span><span class="detail-value">${UI.escape(b.guestName || b.guest?.name || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Room</span><span class="detail-value">${UI.escape(b.roomNumber || b.room?.number || b.room?.name || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Check-In</span><span class="detail-value">${UI.formatDate(b.checkIn)}</span></div>
      <div class="detail-row"><span class="detail-label">Check-Out</span><span class="detail-value">${UI.formatDate(b.checkOut)}</span></div>
      <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${b.guests || 1}</span></div>
      <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${UI.currency(b.total || b.totalAmount)}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${UI.statusBadge(b.status)}</span></div>
      ${b.specialRequests ? `<div class="detail-row"><span class="detail-label">Requests</span><span class="detail-value">${UI.escape(b.specialRequests)}</span></div>` : ""}
    `;
    Modal.open("bookingDetailOverlay");
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

async function loadBookingDetail(id) {
  viewBookingDetail(id);
}

/*  SHARED: User detail modal                                         */
async function viewUser(id) {
  try {
    const data = await UsersAPI.get(id);
    const u = data.user || data;
    const name = u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim();
    let overlay = document.getElementById("userDetailOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "userDetailOverlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3>User Details</h3>
            <span class="modal-close" data-modal-close="userDetailOverlay" role="button">✕</span>
          </div>
          <div class="modal-body" id="userDetailBody"></div>
          <div class="modal-footer">
            <button class="btn btn-outline" data-modal-close="userDetailOverlay">Close</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    document.getElementById("userDetailBody").innerHTML = `
      <div style="text-align:center;padding:12px 0 24px">
        <div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,var(--royal-blue),var(--gold));
          display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:800;color:var(--white);margin:0 auto 12px">
          ${UI.initials(name || u.email)}
        </div>
        <h3 style="color:var(--royal-blue-dark)">${UI.escape(name || "—")}</h3>
        <span class="badge role-${u.role}" style="margin-top:4px">${u.role}</span>
      </div>
      <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${UI.escape(u.email)}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${UI.escape(u.phone || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Joined</span><span class="detail-value">${UI.formatDate(u.createdAt || u.joinedAt)}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${UI.escape(u.address || "—")}</span></div>
    `;
    Modal.open("userDetailOverlay");
  } catch (err) {
    Toast.error("Error", err.message);
  }
}

/*  AUTO-INIT based on body[data-page]                               */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const inits = {
    landing: initLandingPage,
    login: initLoginPage,
    register: initRegisterPage,
    dashboard: initDashboardPage,
    rooms: initRoomsPage,
    booking: initBookingPage,
    profile: initProfilePage,
    about: initAboutPage,
    contact: initContactPage,
  };
  if (inits[page]) inits[page]();

  // Global: close modals via [data-modal-close]
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-modal-close]");
    if (closeBtn) Modal.close(closeBtn.dataset.modalClose);
  });
});

/*  GLOBAL WINDOW EXPORTS (for inline onclick="" handlers)           */
window.Auth = Auth;
window.Toast = Toast;
window.cancelBooking = cancelBooking;
window.staffCheckIn = staffCheckIn;
window.staffCheckOut = staffCheckOut;
window.deleteUser = deleteUser;
window.loadStaffBookings = loadStaffBookings;
window.loadUsersTable = loadUsersTable;
window.loadMyBookings = loadMyBookings;
window.viewBookingDetail = viewBookingDetail;
window.viewUser = viewUser;
