const db = require('../config/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const IMAGE_DIR = process.env.IMAGE_DIR || 'uploads';

function normalizeImageUrl(value) {
  if (!value) return '';

  const normalized = String(value).replace(/\\/g, '/');

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const noDrive = normalized.replace(/^[A-Za-z]:/, '');
  const cleaned = noDrive.replace(/^\/+/, '');

  if (cleaned.startsWith(`${IMAGE_DIR}/`) || cleaned.startsWith(`/${IMAGE_DIR}/`) || cleaned.startsWith(IMAGE_DIR)) {
    return `/${cleaned.replace(/^\/+/, '')}`;
  }

  if (cleaned.includes('/uploads/') || cleaned.includes('uploads/')) {
    return `/${cleaned.replace(/^\/+/, '')}`;
  }

  if (cleaned && !cleaned.startsWith('http')) {
    const fileName = path.basename(cleaned);
    if (fileName) {
      return `/${IMAGE_DIR}/${fileName}`;
    }
  }

  return `/${IMAGE_DIR}`;
}

function buildPublicImageUrl(value, req) {
  if (!value) return '';

  const valueString = String(value).trim();
  if (!valueString) return '';

  if (/^https?:\/\//i.test(valueString)) {
    return valueString;
  }

  const relative = normalizeImageUrl(valueString);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

  return new URL(relative, baseUrl).toString();
}

// Get Class Students (Standard)
async function getStudents(req, res) {
  const classId = req.params.classId;
  try {
    const [rows] = await db.query('SELECT * FROM students WHERE class_id = $1 AND is_active = true AND (is_deleted IS NOT TRUE)', [classId]);
    const students = rows.map(s => ({
      studentId: s.id,
      fullName: s.full_name,
      rollNumber: s.roll_number || s.roll_no,
      email: s.email,
      hasFaceData: s.has_face_data === true || s.has_face_data === 1
    }));
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Get Class Students (Device)
async function getDeviceStudents(req, res) {
  const targetClassId = 
    req.query?.ClassId || 
    req.query?.classId || 
    req.query?.GroupId || 
    req.query?.groupId || 
    req.query?.class_id || 
    req.body?.ClassId || 
    req.body?.classId || 
    req.body?.GroupId || 
    req.body?.groupId || 
    req.body?.class_id;

  console.log('getDeviceStudents request - URL:', req.originalUrl, 'targetClassId:', targetClassId, 'query:', req.query, 'body:', req.body);

  if (!targetClassId) {
    return res.json({
      objUserStudents: [],
      objUserStudentInfo: [],
      objUserStudentInfoList: [],
      objStudentInfo: [],
      objStudentInfoList: [],
      objStudents: [],
      StudentList: [],
      studentList: [],
      students: [],
      data: [],
      Status: 1,
      Message: 'No class specified',
      Exception: null
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT s.*, c.name as c_name, c.class_name, c.section 
       FROM students s 
       LEFT JOIN classes c ON c.id = s.class_id 
       WHERE (s.class_id::text = $1::text OR c.id::text = $1::text) 
         AND (s.is_active = true OR s.is_active IS NULL)
         AND (s.is_deleted IS NOT TRUE)`,
      [String(targetClassId)]
    );

    const students = rows.map(s => {
      const classNameStr = (s.class_name || s.c_name || ('Class ' + s.class_id)) + (s.section ? ` (${s.section})` : '');
      return {
        GroupId: s.class_id,
        groupId: s.class_id,
        GroupName: classNameStr,
        groupName: classNameStr,
        ClassId: s.class_id,
        classId: s.class_id,
        ClassName: classNameStr,
        className: classNameStr,
        StudentId: s.id,
        studentId: s.id,
        id: s.id,
        Id: s.id,
        StudentName: s.full_name,
        studentName: s.full_name,
        Name: s.full_name,
        name: s.full_name,
        FullName: s.full_name,
        fullName: s.full_name,
        FatherName: s.parent_name || 'Parent',
        fatherName: s.parent_name || 'Parent',
        ParentName: s.parent_name || 'Parent',
        AdmNo: s.roll_number || s.roll_no || s.admission_no || String(s.id),
        admNo: s.roll_number || s.roll_no || s.admission_no || String(s.id),
        RollNo: s.roll_number || s.roll_no || s.admission_no || String(s.id),
        rollNo: s.roll_number || s.roll_no || s.admission_no || String(s.id),
        RollNumber: s.roll_number || s.roll_no || s.admission_no || String(s.id),
        PhotoPath: buildPublicImageUrl(s.photo_url || s.profile_image || '', req),
        photoPath: buildPublicImageUrl(s.photo_url || s.profile_image || '', req),
        PhotoUrl: buildPublicImageUrl(s.photo_url || s.profile_image || '', req),
        photoUrl: buildPublicImageUrl(s.photo_url || s.profile_image || '', req)
      };
    });

    console.log(`[getDeviceStudents] Found ${students.length} students for classId "${targetClassId}":`, students.map(s => s.StudentName));

    if (students.length === 0) {
      return res.json({
        objUserStudents: [],
        objUserStudentInfo: [],
        objUserStudentInfoList: [],
        objStudentInfo: [],
        objStudentInfoList: [],
        objStudents: [],
        StudentList: [],
        studentList: [],
        students: [],
        data: [],
        Status: 0,
        status: 0,
        Message: 'No students in this class',
        message: 'No students in this class',
        Exception: null
      });
    }

    res.json({
      objUserStudents: students,
      objUserStudentInfo: students,
      objUserStudentInfoList: students,
      objStudentInfo: students,
      objStudentInfoList: students,
      objStudents: students,
      StudentList: students,
      studentList: students,
      students: students,
      data: students,
      Status: 1,
      Message: 'Students fetched successfully',
      message: 'Students fetched successfully',
      Exception: null
    });
  } catch (err) {
    console.error('getDeviceStudents error:', err);
    res.json({ Status: 0, Message: 'Failed to fetch students', Exception: err.message });
  }
}

// Face Sync: Register JSON embeddings
async function registerFace(req, res) {
  const { studentId, embedding } = req.body;
  if (!studentId || !embedding) {
    return res.status(400).json({ success: false, message: 'studentId and embedding are required' });
  }

  try {
    const embeddingStr = JSON.stringify(embedding);
    await db.query('UPDATE students SET face_embedding = $1, has_face_data = true WHERE id = $2', [embeddingStr, studentId]);

    await db.query(
      `INSERT INTO student_face_images (student_id, face_embedding, quality_score, is_primary) 
      VALUES ($1, $2, 1.0, true) RETURNING id`,
      [studentId, embeddingStr]
    );

    res.json({ success: true, message: 'Face embedding registered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database registration failed: ' + err.message });
  }
}

// Face Sync: Base64 enrollment image upload
async function uploadFaceImage(req, res) {
  const { studentId, imageBase64 } = req.body;
  if (!studentId || !imageBase64) {
    return res.status(400).json({ success: false, message: 'studentId and imageBase64 are required' });
  }

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    const filename = `student-${studentId}-${Date.now()}.jpg`;
    const filePath = path.join(IMAGE_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/${IMAGE_DIR}/${filename}`;

    await db.query(
      `INSERT INTO student_face_images (student_id, image_path, image_url, is_primary) 
      VALUES ($1, $2, $3, true) RETURNING id`,
      [studentId, publicUrl, publicUrl]
    );

    res.json({ success: true, message: 'Student face image uploaded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
}

// Get All Registered Faces (For Syncing)
async function getAllFaces(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.full_name as name, s.face_embedding as embedding 
      FROM students s 
      WHERE s.has_face_data = true AND (s.is_deleted IS NOT TRUE)`
    );

    const faces = rows.map(r => ({
      id: r.id.toString(),
      name: r.name,
      embedding: r.embedding ? JSON.parse(r.embedding) : []
    }));

    res.json({ success: true, faces: faces });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve faces: ' + err.message });
  }
}

// Get Face Photos for Student (Device)
async function getStudentFacePhotos(req, res) {
  const { StudentId } = req.query;
  if (!StudentId) {
    return res.json({ Status: 0, Message: 'StudentId is required' });
  }

  try {
    // Retrieve all images for the student, ordered by insertion ID
    const [rows] = await db.query('SELECT * FROM student_face_images WHERE student_id = $1 ORDER BY id', [StudentId]);
    const expectedTypes = ['Front', 'LeftSide', 'RightSide', 'Top', 'Original'];
    const photos = rows.map((r, idx) => ({
      StudentId: r.student_id,
      PhotoType: expectedTypes[idx] || 'Front',
      PhotoPath: buildPublicImageUrl(r.image_url || r.image_path || '', req)
    }));

    res.json({
      objStudentPhotos: photos,
      Status: 1,
      Message: 'Student photos loaded successfully',
      Exception: null
    });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to load photos', Exception: err.message });
  }
}

// Save Student Photo Reference
async function saveStudentPhoto(req, res) {
  const { StudentId, PhotoPath } = req.body;
  if (!StudentId || !PhotoPath) {
    return res.json({ Status: 0, Message: 'StudentId and PhotoPath are required' });
  }

  try {
    const relativeUrl = normalizeImageUrl(PhotoPath);
    await db.query(
      `INSERT INTO student_face_images (student_id, image_path, image_url, quality_score, is_primary) 
      VALUES ($1, $2, $3, 1.0, true) RETURNING id`,
      [StudentId, relativeUrl, relativeUrl]
    );

    await db.query('UPDATE students SET has_face_data = true WHERE id = $1', [StudentId]);

    res.json({ Status: 1, Message: 'Student photo linked successfully', Exception: null });
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to link photo', Exception: err.message });
  }
}

// Save Profile Photo Reference for Teacher
async function saveProfilePhoto(req, res) {
  const { PhotoPath, UserId } = req.body;
  if (!UserId || !PhotoPath) {
    return res.json({ Status: 0, Message: 'UserId and PhotoPath are required' });
  }

  try {
    const publicPhotoPath = normalizeImageUrl(PhotoPath);

    // Accept either numeric id or staff identifier (staff_id or username)
    const updateQuery = `UPDATE staff SET profile_image = $1, photo_url = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id::text = $2::text OR staff_id = $2::text OR username = $2::text RETURNING *`;

    const result = await db.query(updateQuery, [publicPhotoPath, String(UserId)]);

    if (result && result.rows && result.rows.length > 0) {
      res.json({ Status: 1, Message: 'Profile photo updated successfully', staff: result.rows[0], Exception: null });
    } else {
      res.json({ Status: 0, Message: 'No matching staff record found for provided UserId', Exception: null });
    }
  } catch (err) {
    res.json({ Status: 0, Message: 'Failed to update profile photo', Exception: err.message });
  }
}

// Get Image Profile Placement Types
function getPhoneTypes(req, res) {
  res.json({
    objPhotoTypeList: [
      { PhotoTypeId: 1, PhotoType: 'Front' },
      { PhotoTypeId: 2, PhotoType: 'LeftSide' },
      { PhotoTypeId: 3, PhotoType: 'RightSide' },
      { PhotoTypeId: 4, PhotoType: 'Top' }
    ],
    Status: 1,
    Message: 'Success',
    Exception: null
  });
}

// Single multipart file uploader
function uploadFile(req, res) {
  if (!req.file) {
    return res.json({ FilePath: '', Status: 0, Message: 'No file uploaded', Exception: null });
  }

  const relativePath = `${IMAGE_DIR}/${req.file.filename}`;
  res.json({
    FilePath: relativePath,
    Status: 1,
    Message: 'File uploaded successfully',
    Exception: null
  });
}

// Enroll Student on FR Server (mock)
function enrollStudent(req, res) {
  res.json({ success: true, message: 'Student face enrolled on recognition server' });
}

module.exports = {
  getStudents,
  getDeviceStudents,
  registerFace,
  uploadFaceImage,
  getAllFaces,
  getStudentFacePhotos,
  saveStudentPhoto,
  saveProfilePhoto,
  getPhoneTypes,
  uploadFile,
  enrollStudent
};
