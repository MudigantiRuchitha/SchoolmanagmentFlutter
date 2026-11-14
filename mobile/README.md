# ACS School Management Mobile (Flutter)

A native cross-platform mobile application companion for the **ACS School Management Portal**. Designed specifically for School Administrators, Principals, and Staff to manage daily academic operations directly from Android or iOS smartphones.

> **Strict Backend Isolation**: Built exclusively as a frontend mobile client consuming the existing Node.js REST API without requiring any changes to the backend codebase.

---

## 📱 App Highlights & Features

### 1. 📊 Executive Dashboard
- **Live KPI Metric Cards**: Total students, enrolled staff members, active classrooms, and pending leave approvals.
- **Attendance Summaries (Today)**: Real-time progress bars for both Student and Staff attendance with breakdown for Present, Absent, Late, and Half-Day.
- **Recent Announcements**: Instant preview of latest circulars and urgent alerts.
- **Quick Action Hub**: 1-tap shortcuts to Take Attendance, Face Scanner, Staff Roster, and Leave Requests.

### 2. 📸 Dual-Mode Attendance System
- **Manual Quick-Marking**:
  - Class & Section filter with date picker.
  - One-tap batch actions: **All Present**, **All Absent**, and **Clear All**.
  - Segmented status selector (**P**, **A**, **L**, **HD**) per student/staff member.
  - Floating bottom save bar with change indicators.
- **Biometric Face Recognition Scan**:
  - Full-screen live camera stream with guided oval face reticle.
  - Google ML Kit on-device face landmark detection.
  - Real-time match confidence rating & automated biometric punch sync with `/api/Device/BulkAttendanceMark`.

### 3. 👥 Student Directory & Profile Viewer
- Instant search by Name, Admission Number, or Roll Number.
- Class and Section filtering.
- Detailed student profile with enrollment status, parent contact info with 1-tap clipboard copy, and biometric enrollment badge.

### 4. 👔 Staff Directory & Timings
- Complete staff list segmented by role type: **Teaching**, **Non-Teaching**, and **Management**.
- Detailed working hours and arrival expectations (e.g. 9:00 AM – 5:00 PM).
- Direct access to contact numbers and campus branch locations.

### 5. 📝 Leave Management & Approvals
- Tabbed view: **Pending**, **Approved**, **Rejected**, and **All**.
- Staff leave cards displaying date ranges, duration in days, leave type, and employee reasons.
- In-app **Approve** and **Reject** dialogs with customizable admin remarks.

### 6. 📢 School Circulars & Notice Board
- Feed of institutional circulars with priority tags (**IMPORTANT** vs standard).
- Floating action button to publish announcements school-wide, to staff only, or to specific classes.

### 7. ⚙️ Dynamic Server IP Switcher
- Instant 1-tap switching between:
  - **Android Emulator**: `http://10.0.2.2:5000/api`
  - **Local Machine**: `http://localhost:5000/api`
  - **Physical Device over Wi-Fi**: `http://<your-lan-ip>:5000/api`
- Built-in connection tester to verify backend reachability before logging in.

---

## 🏗️ Project Architecture

```
mobile/
├── android/                   # Native Android wrapper & Manifest (Camera, Internet)
├── lib/
│   ├── config/
│   │   ├── api_constants.dart # Backend endpoints mapping
│   │   └── app_theme.dart     # Material 3 styling matching ACS portal palette
│   ├── models/
│   │   ├── attendance_model.dart
│   │   ├── dashboard_stats_model.dart
│   │   ├── leave_model.dart
│   │   ├── notice_model.dart
│   │   ├── staff_model.dart
│   │   ├── student_model.dart
│   │   └── user_model.dart
│   ├── providers/             # State Management (Provider)
│   │   ├── attendance_provider.dart
│   │   ├── auth_provider.dart
│   │   ├── dashboard_provider.dart
│   │   ├── leaves_provider.dart
│   │   ├── staff_provider.dart
│   │   └── students_provider.dart
│   ├── screens/
│   │   ├── attendance/        # Hub, Student, Staff, Face Scanner
│   │   ├── auth/              # Login screen with Org Code
│   │   ├── dashboard/         # Metrics and KPI cards
│   │   ├── leaves/            # Leave approvals workflow
│   │   ├── notices/           # Circulars feed & creation
│   │   ├── settings/          # Server IP config & user profile
│   │   ├── staff/             # Staff directory
│   │   ├── students/          # Student search & profile view
│   │   ├── main_navigation.dart
│   │   └── splash_screen.dart
│   ├── services/
│   │   ├── api_service.dart   # Authenticated HTTP client
│   │   └── storage_service.dart # SharedPreferences session cache
│   └── main.dart              # MultiProvider bootstrap
└── pubspec.yaml               # Flutter dependencies
```

---

## 🚀 How to Run the Mobile App

### Prerequisites
- Flutter SDK installed (tested with Flutter 3.47+).
- Node.js backend running on port `5000` (`npm start` inside `backend/`).

### Step 1: Open the mobile directory
```powershell
cd mobile
```

### Step 2: Install dependencies (if needed)
```powershell
flutter pub get
```

### Step 3: Run on connected Device or Emulator
```powershell
flutter run
```

### Physical Android Device Setup (over Wi-Fi)
1. Ensure your phone and development computer are connected to the same Wi-Fi network.
2. Find your computer's local IP address (e.g. `ipconfig` -> `192.168.1.50`).
3. Launch the app and tap **Server Settings (⚙️)** on the login screen.
4. Set the API Base URL to:
   ```
   http://192.168.1.50:5000/api
   ```
5. Tap **Test Connection** -> then log in using your standard organization credentials (e.g., Org Code: `vts`, Username: `admin`, Password: `adminpassword`).
