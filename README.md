# EquipRent Server — Equipment Rental Platform Backend API

A high-performance, secure, and production-ready Express.js & MongoDB REST API powering the **EquipRent** Equipment Rental Platform.

##  Project Overview & Purpose
The Equipment Rental Platform connects equipment owners with customers seeking tools and machinery for construction, photography, agriculture, events, electronics, and transportation. The server powers:
- Secure JWT-based authentication with bcrypt password hashing and Google social login.
- Role-Based Access Control (RBAC) with granular middlewares for **Customer**, **Owner**, and **Admin**.
- Real-time MongoDB search, multi-category filtering, price range, availability checks, sorting, and pagination.
- Stripe Checkout session generation and payment verification with transaction records in the `payments` collection.
- Dynamic business analytics aggregations for Admin (platform-wide metrics) and Equipment Owners (revenue, rentals, inventory).
- Automated rental expiry management via `node-cron` with email notification simulation.

---

##  Live Deployment & Repository
- **Server GitHub Repository**: [https://github.com/Shanto472/Ph-Assignment-09-Server](https://github.com/Shanto472/Ph-Assignment-09-Server)
- **Client GitHub Repository**: [https://github.com/Shanto472/Ph-Assignment-09-Client-](https://github.com/Shanto472/Ph-Assignment-09-Client-)
- **Live Server URL**: [https://equiprent-server.vercel.app](https://equiprent-server.vercel.app) *(or your deployed Render / Vercel endpoint)*

---

##  Default Demo Credentials
| Role | Email | Password |
|---|---|---|
| **SuperAdmin** | `admin@equiprent.com` | `Admin123456` |
| **Equipment Owner** | `owner@equiprent.com` | `Owner123456` |
| **Customer / Renter** | `customer@equiprent.com` | `Customer123456` |

---

## 🛠️ NPM Packages Used & Justification
- `express` (^4.21.2) — Lightweight, robust Node.js web application framework for crafting performant RESTful endpoints.
- `mongodb` (^6.12.0) — Official native MongoDB driver for resilient database operations, indexing, and aggregations.
- `jsonwebtoken` (^9.0.2) — Industry-standard signed stateless JWT token creation and verification for RBAC.
- `bcryptjs` (^2.4.3) — Secure cryptographic password hashing with salts to safeguard credentials.
- `cors` (^2.8.5) — Cross-Origin Resource Sharing middleware for safe frontend-backend communication.
- `dotenv` (^16.4.7) — Zero-dependency module that loads sensitive environment variables from `.env`.
- `stripe` (^17.5.0) — Official Stripe SDK for creating checkout sessions, managing payments, and webhook verification.
- `node-cron` (^3.0.3) — Background task scheduler to automatically mark expired rental bookings as completed.
- `nodemon` (^3.1.9) — Development utility that monitors file changes and automatically restarts the server.

---

## 🔑 Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/equiprent_db
JWT_SECRET=super_secret_jwt_key_equiprent_2026_secure
STRIPE_SECRET_KEY=sk_test_placeholder_key_for_evaluation
CLIENT_URL=http://localhost:3000
```

---

## 🚀 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new user with password validation (uppercase, lowercase, 6+ chars).
- `POST /api/auth/login` — Authenticate existing user and receive signed JWT token.
- `POST /api/auth/google` — Google OAuth user login / auto-registration (defaults to `Customer` role).
- `GET /api/auth/me` — Retrieve currently logged-in user profile with role & metadata.

### 👥 User Management (`/api/users`)
- `PATCH /api/users/profile` — Update logged-in user profile (name, photo, phone, address).
- `GET /api/users` — *(Admin)* Fetch all registered platform users.
- `PATCH /api/users/:id/role` — *(Admin)* Update user role (`Customer`, `Owner`, `Admin`).
- `DELETE /api/users/:id` — *(Admin)* Remove a user account.

### 🚜 Equipment Management (`/api/equipment`)
- `GET /api/equipment/featured` — Fetch 6 latest approved equipment items using `.limit(6)`.
- `GET /api/equipment` — Server-side search (name, location, category), filter (category, price, rentalType, availability), sort, and pagination.
- `GET /api/equipment/:id` — Retrieve comprehensive single equipment details.
- `POST /api/equipment` — *(Owner/Admin)* Add new equipment (defaults to `pending` status).
- `GET /api/equipment/owner/my` — *(Owner)* View all equipment listed by current owner.
- `PATCH /api/equipment/:id` — *(Owner/Admin)* Update equipment details.
- `DELETE /api/equipment/:id` — *(Owner/Admin)* Delete equipment listing.
- `PATCH /api/equipment/:id/status` — *(Admin)* Approve or reject equipment listing (`approved` / `rejected`).
- `GET /api/equipment/admin/all` — *(Admin)* Retrieve all equipment across all statuses.
- `GET /api/equipment/meta/filters` — Get dynamic category counts, price bounds, and stats.

### ⭐ Favorites (`/api/favorites`)
- `POST /api/favorites` — *(Customer)* Add equipment to user favorites.
- `GET /api/favorites` — *(Customer)* Retrieve user's saved favorite equipment list.
- `GET /api/favorites/check/:equipmentId` — Check if specific equipment is in user favorites.
- `DELETE /api/favorites/:equipmentId` — *(Customer)* Remove item from user favorites.

### 📅 Bookings & Rentals (`/api/bookings`)
- `POST /api/bookings` — *(Customer)* Calculate duration and total amount, verify inventory, initiate rental booking.
- `GET /api/bookings/my` — *(Customer)* Fetch logged-in customer's rental bookings table.
- `GET /api/bookings/owner` — *(Owner)* Fetch rental bookings for owner's equipment.
- `GET /api/bookings/admin` — *(Admin)* Fetch all platform rental bookings.
- `GET /api/bookings/:id` — View single booking breakdown.
- `PATCH /api/bookings/:id/status` — *(Owner/Admin)* Update booking status (`confirmed`, `active`, `completed`, `cancelled`).
- `DELETE /api/bookings/:id` — *(Admin)* Cancel and remove booking record.
- `POST /api/bookings/sync-expired` — *(Admin)* Manually trigger rental expiry status synchronization.

### 💳 Payments & Stripe (`/api/payments`)
- `POST /api/payments/create-checkout-session` — Create Stripe Checkout session for rental booking.
- `POST /api/payments/verify` — Verify Stripe transaction, insert record into `payments` collection, update booking `paymentStatus: 'paid'`, and deduct inventory.
- `GET /api/payments/my` — *(Customer)* Retrieve user's payment transaction history.
- `GET /api/payments/all` — *(Admin)* Retrieve all platform payment transaction records.

### 📊 Dynamic Analytics (`/api/analytics`)
- `GET /api/analytics/admin` — *(Admin)* Real-time metrics: total users, total equipment, total bookings, pending approvals, completed rentals, total revenue, and monthly trends.
- `GET /api/analytics/owner` — *(Owner)* Real-time metrics: total listed equipment, completed rentals, total earnings, and monthly earnings breakdown.

---

## 🛠️ Local Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Shanto472/Ph-Assignment-09-Server.git
   cd Ph-Assignment-09-Server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up `.env` (refer to `.env.example`).
4. Start the server:
   ```bash
   npm start
   # or development mode:
   npm run dev
   ```
5. Server will run at `http://localhost:5000` with automatic DB connection and data seeding.
