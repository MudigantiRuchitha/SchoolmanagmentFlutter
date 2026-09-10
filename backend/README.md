# School Attendance Management System Backend

This repository contains the production-ready Node.js/Express backend that maps all mobile app endpoints (authentication, class/student management, telemetry logging, leave applications, holidays, and face recognition APIs) to a MySQL database.

## Folder Structure

```
backend/
├── config/
│   └── db.js                 # MySQL Pool configuration
├── middleware/
│   └── auth.js               # JWT verification & database token validation
├── controllers/
│   ├── authController.js     # Teacher login and session management
│   ├── classController.js    # Fetch classes
│   ├── studentController.js  # Fetch students & manage face enrollment
│   ├── attendanceController.js # Attendance session submission & records
│   └── telemetryController.js # App metrics, telemetry, and failure logs
├── routes/
│   ├── authRoutes.js
│   ├── classRoutes.js
│   ├── studentRoutes.js
│   ├── attendanceRoutes.js
│   └── telemetryRoutes.js
├── utils/
│   ├── jwt.js                # Token signing/verification utils
│   └── password.js           # Bcrypt hashing & validation utils
├── .env.example              # Example environment configuration
├── .env                      # Configuration parameters (DB, Port, JWT Secret)
├── server.js                 # Entry point setting up Express app and routes
├── schema.sql                # SQL database table definitions
├── setup.js                  # Database creation and seeding script
└── package.json              # Backend dependencies
```

## Prerequisites

- **Node.js** (v18+)
- **MySQL Server** (v8.0+)

## Getting Started

1. **Install Dependencies**
   Run the following command inside the `backend` directory:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` and fill in your MySQL credentials:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and update `DB_PASSWORD` with your MySQL root password if applicable.*

3. **Initialize Database**
   Run the database initialization script to automatically create the schema and populate default sample data:
   ```bash
   npm run setup
   ```

4. **Start the server**
   Start the production server:
   ```bash
   npm start
   ```
   Or run the server in development mode with live reload:
   ```bash
   npm run dev
   ```

## Default Credentials

- **Teacher username**: `teacher`
- **Teacher password**: `teacher123`
- **Default Organization Code**: `myorg` (or any string matching `/^[a-z0-9_-]{2,30}$/`)
