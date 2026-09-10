# Timetable & Attendance Setup — API Documentation
**Central School Management System**  
**Version:** 2.0  
**Base URL:** `http://localhost:5000/api`

---

## 📑 Table of Contents
1. [Authentication & Headers](#1-authentication--headers)
2. [Attendance Modes Architecture](#2-attendance-modes-architecture)
3. [Organisation Default Morning & Evening APIs](#3-organisation-default-morning--evening-apis)
   - [GET /api/timetable/org-default](#31-get-org-default-session-times)
   - [POST /api/timetable/org-default](#32-save-org-default-session-times)
4. [Class-Specific Timetable & Settings APIs](#4-class-specific-timetable--settings-apis)
   - [GET /api/timetable/settings/:classId](#41-get-class-attendance-settings--timetable)
   - [POST /api/timetable/settings/:classId](#42-save-class-attendance-mode--timetable)
   - [DELETE /api/timetable/slot/:slotId](#43-delete-single-timetable-slot)
5. [SuperAdmin Permission & Mode Control APIs](#5-superadmin-permission--mode-control-apis)
   - [GET /api/settings](#51-get-organisation-settings--permissions)
   - [PUT /api/super-admin/organisations/:id](#52-update-organisation-timetable-permissions)
6. [Mobile Device Attendance Punch APIs](#6-mobile-device-attendance-punch-apis)
   - [GET /api/classes/teacher/:teacherId](#61-get-teacher-classes--timetable-slots)
   - [POST /api/attendance/session](#62-submit-attendance-session-punch)
   - [GET /api/attendance/students](#63-get-student-attendance-report)

---

## 1. Authentication & Headers

All requests to `/api/timetable/*`, `/api/settings`, and `/api/attendance/*` require standard Bearer token authentication:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 2. Attendance Modes Architecture

| Mode Value | Name | Description |
| :--- | :--- | :--- |
| **`MORNING_EVENING`** | 🌅 Morning & Evening Mode | Attendance is taken twice a day (AM & PM sessions). Applies organisation-wide for all classes without class selection needed. |
| **`PERIOD_WISE`** | 📖 Period-wise (Subject) Mode | Attendance is taken period-by-period for specific subjects and assigned teachers per Class/Section. |

---

## 3. Organisation Default Morning & Evening APIs

### 3.1. GET Org Default Session Times
Fetches the organisation-wide default Morning (AM) and Evening (PM) attendance session times.

- **Method:** `GET`
- **Endpoint:** `/api/timetable/org-default`
- **Auth Required:** Yes (Admin Token)

#### 📤 Request Payload
*None (Query parameters not required)*

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "attendanceMode": "MORNING_EVENING",
  "slots": [
    {
      "id": 1,
      "org_id": 1,
      "class_id": null,
      "attendance_mode": "MORNING_EVENING",
      "slot_type": "morning",
      "slot_number": 1,
      "slot_name": "Morning (AM)",
      "subject_name": null,
      "start_time": "09:00:00",
      "end_time": "09:30:00",
      "teacher_id": null,
      "is_active": true,
      "created_at": "2026-09-02T11:25:00.000Z"
    },
    {
      "id": 2,
      "org_id": 1,
      "class_id": null,
      "attendance_mode": "MORNING_EVENING",
      "slot_type": "evening",
      "slot_number": 2,
      "slot_name": "Evening (PM)",
      "subject_name": null,
      "start_time": "15:30:00",
      "end_time": "16:00:00",
      "teacher_id": null,
      "is_active": true,
      "created_at": "2026-09-02T11:25:00.000Z"
    }
  ]
}
```

---

### 3.2. Save Org Default Session Times
Saves/Updates the organisation-wide default Morning and Evening session times.

- **Method:** `POST`
- **Endpoint:** `/api/timetable/org-default`
- **Auth Required:** Yes (Admin Token)

#### 📤 Request Payload
```json
{
  "slots": [
    {
      "slotType": "morning",
      "slotNumber": 1,
      "slotName": "Morning (AM)",
      "startTime": "09:00",
      "endTime": "09:30",
      "isActive": true
    },
    {
      "slotType": "evening",
      "slotNumber": 2,
      "slotName": "Evening (PM)",
      "startTime": "15:30",
      "endTime": "16:00",
      "isActive": true
    }
  ]
}
```

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "message": "Organisation default Morning & Evening attendance saved!"
}
```

#### 📥 Response (400 Bad Request)
```json
{
  "success": false,
  "message": "Slots array is required."
}
```

---

## 4. Class-Specific Timetable & Settings APIs

### 4.1. Get Class Attendance Settings & Timetable
Fetches the attendance mode (`MORNING_EVENING` or `PERIOD_WISE`) and configured subject timetable periods for a specific class.

- **Method:** `GET`
- **Endpoint:** `/api/timetable/settings/:classId`
- **URL Parameters:**
  - `classId` *(integer, required)*: The ID of the class.
- **Auth Required:** Yes (Admin Token)

#### 📥 Response (200 OK — Period-wise Mode Example)
```json
{
  "success": true,
  "classId": 6,
  "hasCustomSetting": true,
  "attendanceMode": "PERIOD_WISE",
  "slots": [
    {
      "id": 14,
      "org_id": 1,
      "class_id": 6,
      "attendance_mode": "PERIOD_WISE",
      "slot_type": "period",
      "slot_number": 1,
      "slot_name": "Period 1",
      "subject_name": "Mathematics",
      "start_time": "09:00:00",
      "end_time": "09:45:00",
      "teacher_id": 2,
      "teacher_name": "John Doe",
      "is_active": true,
      "created_at": "2026-09-02T11:45:00.000Z"
    },
    {
      "id": 15,
      "org_id": 1,
      "class_id": 6,
      "attendance_mode": "PERIOD_WISE",
      "slot_type": "period",
      "slot_number": 2,
      "slot_name": "Period 2",
      "subject_name": "Physics",
      "start_time": "09:45:00",
      "end_time": "10:30:00",
      "teacher_id": 4,
      "teacher_name": "Sarah Connor",
      "is_active": true,
      "created_at": "2026-09-02T11:45:00.000Z"
    }
  ]
}
```

#### 📥 Response (200 OK — Unconfigured Class Default)
```json
{
  "success": true,
  "classId": 6,
  "hasCustomSetting": false,
  "attendanceMode": "MORNING_EVENING",
  "slots": []
}
```

---

### 4.2. Save Class Attendance Mode & Timetable
Configures whether a specific class operates in `PERIOD_WISE` or `MORNING_EVENING` mode, and saves its period slots.

- **Method:** `POST`
- **Endpoint:** `/api/timetable/settings/:classId`
- **URL Parameters:**
  - `classId` *(integer, required)*: The ID of the class.
- **Auth Required:** Yes (Admin Token)

#### 📤 Request Payload (Period-wise Configuration)
```json
{
  "attendanceMode": "PERIOD_WISE",
  "slots": [
    {
      "slotType": "period",
      "slotNumber": 1,
      "slotName": "Period 1",
      "startTime": "09:00",
      "endTime": "09:45",
      "subjectName": "Mathematics",
      "teacherId": 2,
      "isActive": true
    },
    {
      "slotType": "period",
      "slotNumber": 2,
      "slotName": "Period 2",
      "startTime": "09:45",
      "endTime": "10:30",
      "subjectName": "Physics",
      "teacherId": 4,
      "isActive": true
    },
    {
      "slotType": "period",
      "slotNumber": 3,
      "slotName": "Period 3",
      "startTime": "10:45",
      "endTime": "11:30",
      "subjectName": "Chemistry",
      "teacherId": 5,
      "isActive": true
    }
  ]
}
```

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "message": "Timetable & attendance configuration saved successfully!"
}
```

---

### 4.3. Delete Single Timetable Slot
Removes an individual slot from a class timetable.

- **Method:** `DELETE`
- **Endpoint:** `/api/timetable/slot/:slotId`
- **URL Parameters:**
  - `slotId` *(integer, required)*: The slot ID to delete.
- **Auth Required:** Yes (Admin Token)

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "message": "Timetable slot deleted."
}
```

---

## 5. SuperAdmin Permission & Mode Control APIs

### 5.1. Get Organisation Settings & Permissions
Returns current organisation settings including timetable access permission and allowed attendance modes.

- **Method:** `GET`
- **Endpoint:** `/api/settings`
- **Auth Required:** Yes (Admin Token)

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "settings": {
    "id": 1,
    "name": "Venkat Training School",
    "code": "VENKAT",
    "domain": "venkat.school.com",
    "logo_url": null,
    "address": "Hyderabad Main Campus",
    "phone": "+91 9876543210",
    "email": "admin@venkat.school.com",
    "timetable_access": true,
    "allowed_attendance_mode": "BOTH"
  }
}
```

> **`allowed_attendance_mode` Values:**
> - `'BOTH'`: Organisation admin can configure either Morning & Evening or Period-wise mode.
> - `'MORNING_EVENING'`: Organisation admin is restricted to Morning & Evening mode only.
> - `'PERIOD_WISE'`: Organisation admin is restricted to Period-wise mode only.

---

### 5.2. Update Organisation Timetable Permissions
SuperAdmin controls whether the organisation has Timetable Setup access and which modes are allowed.

- **Method:** `PUT`
- **Endpoint:** `/api/super-admin/organisations/:id`
- **Auth Required:** Yes (SuperAdmin Token `superToken`)

#### 📤 Request Payload
```json
{
  "name": "Venkat Training School",
  "code": "VENKAT",
  "domain": "venkat.school.com",
  "address": "Hyderabad Main Campus",
  "phone": "+91 9876543210",
  "email": "admin@venkat.school.com",
  "isActive": true,
  "timetableAccess": true,
  "allowedAttendanceMode": "PERIOD_WISE"
}
```

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "message": "Organisation updated successfully."
}
```

---

## 6. Mobile Device Attendance Punch APIs

### 6.1. Get Teacher Classes & Timetable Slots
Fetches assigned classes for a teacher on the biometric/mobile attendance device. Returns dynamic `AttendanceMode` and configured `TimetableSlots`.

- **Method:** `GET` or `POST`
- **Endpoint:** `/api/classes/teacher/:teacherId` or `/api/Device/ValidateUser`
- **Auth Required:** Device / Staff Token

#### 📥 Response (200 OK)
```json
{
  "Status": 1,
  "Message": "Classes fetched successfully",
  "objUserClassInfo": [
    {
      "ClassId": 6,
      "ClassName": "class11 (A)",
      "Section": "A",
      "StudentCount": 35,
      "TeacherId": 2,
      "AttendanceMode": "PERIOD_WISE",
      "TimetableSlots": [
        {
          "timetableSlotId": 14,
          "slotType": "period",
          "slotNumber": 1,
          "slotName": "Period 1",
          "subjectName": "Mathematics",
          "startTime": "09:00:00",
          "endTime": "09:45:00",
          "teacherId": 2,
          "isActive": true
        },
        {
          "timetableSlotId": 15,
          "slotType": "period",
          "slotNumber": 2,
          "slotName": "Period 2",
          "subjectName": "Physics",
          "startTime": "09:45:00",
          "endTime": "10:30:00",
          "teacherId": 4,
          "isActive": true
        }
      ]
    }
  ]
}
```

---

### 6.2. Submit Attendance Session Punch
Submits captured student face punch records for a class session (Morning, Evening, or Period).

- **Method:** `POST`
- **Endpoint:** `/api/attendance/session`
- **Auth Required:** Bearer Token

#### 📤 Request Payload
```json
{
  "classId": 6,
  "teacherId": 2,
  "timetableSlotId": 14,
  "sessionDate": "2026-09-03",
  "sessionTime": "09:15:00",
  "totalStudents": 35,
  "presentCount": 33,
  "absentCount": 2,
  "latitude": 17.3850,
  "longitude": 78.4867,
  "locationAddress": "Hyderabad Campus Room 101",
  "records": [
    {
      "studentId": 1,
      "status": "present",
      "confidence": 0.98,
      "recognitionMethod": "face_biometric",
      "remarks": "On time"
    },
    {
      "studentId": 2,
      "status": "present",
      "confidence": 0.95,
      "recognitionMethod": "face_biometric",
      "remarks": "On time"
    },
    {
      "studentId": 3,
      "status": "absent",
      "confidence": null,
      "recognitionMethod": "manual",
      "remarks": "Absent without leave"
    }
  ]
}
```

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "message": "Attendance submitted successfully",
  "sessionId": 18
}
```

---

### 6.3. Get Student Attendance Report
Queries student attendance history by date, branch, and class.

- **Method:** `GET`
- **Endpoint:** `/api/attendance/students`
- **Query Parameters:**
  - `date` *(YYYY-MM-DD, optional)*: Single date query (defaults to today).
  - `branch_id` *(integer, optional)*: Filter by branch.
  - `class_id` *(integer, optional)*: Filter by class.
  - `from_date` *(YYYY-MM-DD, optional)*: Range start date.
  - `to_date` *(YYYY-MM-DD, optional)*: Range end date.

#### 📥 Response (200 OK)
```json
{
  "success": true,
  "summary": {
    "total": 35,
    "present": 33,
    "absent": 2,
    "late": 0
  },
  "records": [
    {
      "id": 1,
      "full_name": "Aarav Sharma",
      "admission_no": "ADM001",
      "roll_no": "101",
      "photo_url": "/uploads/students/aarav.jpg",
      "class_name": "class11",
      "section": "A",
      "branch_name": "Main Campus",
      "check_in": "09:15:00",
      "check_out": null,
      "status": "present",
      "mode": "device",
      "notes": "On time",
      "date": "2026-09-03"
    }
  ]
}
```

---

## 7. Status & Error Codes Reference

| HTTP Status Code | Meaning | Common Cause |
| :---: | :--- | :--- |
| **`200 OK`** | Success | Request succeeded and data returned. |
| **`400 Bad Request`** | Validation Error | Missing required fields, invalid `attendanceMode` string, or invalid slot start/end times. |
| **`401 Unauthorized`** | Authentication Failed | Expired or missing JWT token. |
| **`403 Forbidden`** | Permission Denied | Organisation does not have `timetable_access` enabled by SuperAdmin. |
| **`404 Not Found`** | Resource Missing | Specified `classId` or `slotId` does not exist. |
| **`500 Server Error`** | Internal Error | Database query exception or constraint violation. |

---
*Documentation validated and synchronized with active Central School Management REST API.*
