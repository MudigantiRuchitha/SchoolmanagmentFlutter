import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'package:http/http.dart' as http;
import '../config/api_constants.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class ApiService {
  final StorageService _storage;

  ApiService(this._storage);

  String get _baseUrl => _storage.getBaseUrl();

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = _storage.getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  dynamic _handleResponse(http.Response res) {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = res.body;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    } else if (res.statusCode == 401) {
      throw ApiException(
        body is Map && body['message'] != null
            ? body['message']
            : 'Session expired. Please log in again.',
        res.statusCode,
      );
    } else {
      final msg = body is Map && body['message'] != null
          ? body['message']
          : 'Request failed with status: ${res.statusCode}';
      throw ApiException(msg, res.statusCode);
    }
  }

  // Generic GET
  Future<dynamic> get(String endpoint, [Map<String, dynamic>? queryParams]) async {
    try {
      var uri = Uri.parse('$_baseUrl$endpoint');
      if (queryParams != null && queryParams.isNotEmpty) {
        final stringParams = queryParams.map(
          (k, v) => MapEntry(k, v?.toString() ?? ''),
        )..removeWhere((k, v) => v.isEmpty);
        uri = uri.replace(queryParameters: stringParams);
      }
      final res = await http.get(uri, headers: _buildHeaders()).timeout(
            const Duration(seconds: 15),
          );
      return _handleResponse(res);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check if backend server is running and accessible at $_baseUrl');
    } on SocketException {
      throw ApiException('Cannot connect to server at $_baseUrl. Check server status or settings.');
    } on http.ClientException {
      throw ApiException('Network connection failed. Check if server is running at $_baseUrl.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // Generic POST
  Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http
          .post(uri, headers: _buildHeaders(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check if backend server is running and accessible at $_baseUrl');
    } on SocketException {
      throw ApiException('Cannot connect to server at $_baseUrl. Check server status or settings.');
    } on http.ClientException {
      throw ApiException('Network connection failed. Check if server is running at $_baseUrl.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // Generic PUT
  Future<dynamic> put(String endpoint, Map<String, dynamic> body) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http
          .put(uri, headers: _buildHeaders(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check if backend server is running and accessible at $_baseUrl');
    } on SocketException {
      throw ApiException('Cannot connect to server at $_baseUrl. Check server status or settings.');
    } on http.ClientException {
      throw ApiException('Network connection failed. Check if server is running at $_baseUrl.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // Generic DELETE
  Future<dynamic> delete(String endpoint) async {
    try {
      final uri = Uri.parse('$_baseUrl$endpoint');
      final res = await http
          .delete(uri, headers: _buildHeaders())
          .timeout(const Duration(seconds: 15));
      return _handleResponse(res);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check if backend server is running and accessible at $_baseUrl');
    } on SocketException {
      throw ApiException('Cannot connect to server at $_baseUrl. Check server status or settings.');
    } on http.ClientException {
      throw ApiException('Network connection failed. Check if server is running at $_baseUrl.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // =========================================================================
  // 1. Auth API
  // =========================================================================

  Future<Map<String, dynamic>> login({
    required String orgCode,
    required String username,
    required String password,
  }) async {
    final res = await post(ApiConstants.login, {
      'orgCode': orgCode.trim(),
      'username': username.trim(),
      'password': password.trim(),
    });
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await get(ApiConstants.me);
    return res as Map<String, dynamic>;
  }

  Future<void> logout() async {
    try {
      await post(ApiConstants.logout, {});
    } catch (_) {}
  }

  // =========================================================================
  // 2. Dashboard API
  // =========================================================================

  Future<Map<String, dynamic>> getDashboardStats() async {
    final res = await get(ApiConstants.dashboardStats);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getTodayAttendance({
    required String type, // 'student' or 'staff'
    String? date,
    dynamic branchId,
    dynamic classId,
  }) async {
    final params = <String, dynamic>{'type': type};
    if (date != null && date.isNotEmpty) params['date'] = date;
    if (branchId != null && branchId.toString().isNotEmpty) {
      params['branch_id'] = branchId.toString();
    }
    if (classId != null && classId.toString().isNotEmpty) {
      params['class_id'] = classId.toString();
    }
    final res = await get(ApiConstants.dashboardAttendanceToday, params);
    return res as Map<String, dynamic>;
  }

  Future<List<dynamic>> getRecentNotices() async {
    final res = await get(ApiConstants.dashboardRecentNotices);
    if (res is Map && res['notices'] is List) {
      return res['notices'] as List<dynamic>;
    }
    return [];
  }

  // =========================================================================
  // 3. Branches & Branch Groups
  // =========================================================================

  Future<List<dynamic>> getBranches() async {
    final res = await get(ApiConstants.branches);
    if (res is Map && res['branches'] is List) {
      return res['branches'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createBranch(Map<String, dynamic> data) async {
    await post(ApiConstants.branches, data);
  }

  Future<void> updateBranch(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.branches}/$id', data);
  }

  Future<void> deleteBranch(int id) async {
    await delete('${ApiConstants.branches}/$id');
  }

  Future<List<dynamic>> getBranchGroups() async {
    final res = await get(ApiConstants.branchGroups);
    if (res is Map && res['branchGroups'] is List) {
      return res['branchGroups'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createBranchGroup(Map<String, dynamic> data) async {
    await post(ApiConstants.branchGroups, data);
  }

  Future<void> updateBranchGroup(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.branchGroups}/$id', data);
  }

  Future<void> deleteBranchGroup(int id) async {
    await delete('${ApiConstants.branchGroups}/$id');
  }

  // =========================================================================
  // 4. Admin Users
  // =========================================================================

  Future<List<dynamic>> getAdmins() async {
    final res = await get(ApiConstants.admins);
    if (res is Map && res['admins'] is List) {
      return res['admins'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createAdmin(Map<String, dynamic> data) async {
    await post(ApiConstants.admins, data);
  }

  Future<void> updateAdmin(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.admins}/$id', data);
  }

  Future<void> deleteAdmin(int id) async {
    await delete('${ApiConstants.admins}/$id');
  }

  // =========================================================================
  // 5. Settings
  // =========================================================================

  Future<Map<String, dynamic>> getSettings() async {
    final res = await get(ApiConstants.settings);
    if (res is Map && res['settings'] != null) {
      return res['settings'] as Map<String, dynamic>;
    }
    return {};
  }

  Future<void> updateSettings(Map<String, dynamic> data) async {
    await put(ApiConstants.settings, data);
  }

  // =========================================================================
  // 6. Academic Data (Years, Classes, Students, Staff)
  // =========================================================================

  Future<List<dynamic>> getAcademicYears() async {
    final res = await get(ApiConstants.academicYears);
    if (res is Map && res['years'] is List) {
      return res['years'] as List<dynamic>;
    }
    return [];
  }

  Future<List<dynamic>> getAcademicClasses([Map<String, dynamic>? params]) async {
    final res = await get(ApiConstants.academicClasses, params);
    if (res is Map && res['classes'] is List) {
      return res['classes'] as List<dynamic>;
    }
    return [];
  }

  Future<List<dynamic>> getAcademicStudents([Map<String, dynamic>? params]) async {
    final res = await get(ApiConstants.academicStudents, params);
    if (res is Map && res['students'] is List) {
      return res['students'] as List<dynamic>;
    }
    return [];
  }

  Future<List<dynamic>> getAcademicStaff([Map<String, dynamic>? params]) async {
    final res = await get(ApiConstants.academicStaff, params);
    if (res is Map && res['staff'] is List) {
      return res['staff'] as List<dynamic>;
    }
    return [];
  }

  // =========================================================================
  // 7. Academic Groups
  // =========================================================================

  Future<List<dynamic>> getAcademicGroups() async {
    final res = await get(ApiConstants.academicGroups);
    if (res is Map && res['groups'] is List) {
      return res['groups'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createAcademicGroup(Map<String, dynamic> data) async {
    await post(ApiConstants.academicGroups, data);
  }

  Future<void> updateAcademicGroup(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.academicGroups}/$id', data);
  }

  Future<void> deleteAcademicGroup(int id) async {
    await delete('${ApiConstants.academicGroups}/$id');
  }

  // =========================================================================
  // 8. Classes
  // =========================================================================

  Future<List<dynamic>> getClasses([Map<String, dynamic>? params]) async {
    final res = await get(ApiConstants.classes, params);
    if (res is Map && res['classes'] is List) {
      return res['classes'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createClass(Map<String, dynamic> data) async {
    await post(ApiConstants.classes, data);
  }

  Future<void> updateClass(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.classes}/$id', data);
  }

  Future<void> deleteClass(int id) async {
    await delete('${ApiConstants.classes}/$id');
  }

  // =========================================================================
  // 9. Staff
  // =========================================================================

  Future<List<dynamic>> getStaff({
    String? search,
    int? branchId,
    String? roleType,
  }) async {
    final params = <String, dynamic>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (branchId != null) params['branch_id'] = branchId;
    if (roleType != null && roleType.isNotEmpty) params['role_type'] = roleType;

    final res = await get(ApiConstants.staff, params);
    if (res is Map && res['staff'] is List) {
      return res['staff'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createStaff(Map<String, dynamic> data) async {
    await post(ApiConstants.staff, data);
  }

  Future<void> updateStaff(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.staff}/$id', data);
  }

  Future<void> deleteStaff(int id) async {
    await delete('${ApiConstants.staff}/$id');
  }

  // =========================================================================
  // 10. Students
  // =========================================================================

  Future<List<dynamic>> getStudents({
    String? search,
    int? classId,
    int? branchId,
    int page = 1,
    int limit = 100,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (classId != null) params['class_id'] = classId;
    if (branchId != null) params['branch_id'] = branchId;

    final res = await get(ApiConstants.students, params);
    if (res is Map && res['students'] is List) {
      return res['students'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createStudent(Map<String, dynamic> data) async {
    await post(ApiConstants.students, data);
  }

  Future<void> updateStudent(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.students}/$id', data);
  }

  Future<void> deleteStudent(int id) async {
    await delete('${ApiConstants.students}/$id');
  }

  // =========================================================================
  // 11. Timetable Setup
  // =========================================================================

  Future<Map<String, dynamic>> getOrgDefaultTimetable() async {
    final res = await get(ApiConstants.orgDefaultTimetable);
    return res as Map<String, dynamic>;
  }

  Future<void> saveOrgDefaultTimetable(Map<String, dynamic> data) async {
    await post(ApiConstants.orgDefaultTimetable, data);
  }

  Future<Map<String, dynamic>> getClassAttendanceSettings(int classId) async {
    final res = await get('${ApiConstants.classAttendanceSettings}/$classId');
    return res as Map<String, dynamic>;
  }

  Future<void> saveClassAttendanceSettings(int classId, Map<String, dynamic> data) async {
    await post('${ApiConstants.classAttendanceSettings}/$classId', data);
  }

  // =========================================================================
  // 12. Student Attendance
  // =========================================================================

  Future<Map<String, dynamic>> getStudentAttendance({
    required String date,
    int? classId,
    int? branchId,
    String? period,
  }) async {
    final params = <String, dynamic>{'date': date};
    if (classId != null) params['class_id'] = classId;
    if (branchId != null) params['branch_id'] = branchId;
    if (period != null) params['period'] = period;

    final res = await get(ApiConstants.studentAttendance, params);
    return res as Map<String, dynamic>;
  }

  Future<void> saveStudentAttendance(List<Map<String, dynamic>> records) async {
    await post(ApiConstants.studentAttendance, {'records': records});
  }

  Future<void> submitBulkAttendancePunch({
    required List<Map<String, dynamic>> punches,
    required String userId,
  }) async {
    await post(ApiConstants.bulkDeviceAttendance, {
      'objDeviceMachineRawPunchInfo': {
        'objAttenanceMarkFor': punches,
      },
      'UserId': userId,
    });
  }

  // =========================================================================
  // 13. Staff Attendance
  // =========================================================================

  Future<Map<String, dynamic>> getStaffAttendance({
    required String date,
    int? branchId,
    String? roleType,
  }) async {
    final params = <String, dynamic>{'date': date};
    if (branchId != null) params['branch_id'] = branchId;
    if (roleType != null && roleType.isNotEmpty) params['role_type'] = roleType;

    final res = await get(ApiConstants.staffAttendance, params);
    return res as Map<String, dynamic>;
  }

  Future<void> saveStaffAttendance(List<Map<String, dynamic>> records) async {
    await post(ApiConstants.staffAttendance, {'records': records});
  }

  // =========================================================================
  // 14. Leaves
  // =========================================================================

  Future<List<dynamic>> getLeaves({String? status}) async {
    final params = <String, dynamic>{};
    if (status != null && status.isNotEmpty) params['status'] = status;
    final res = await get(ApiConstants.leaves, params);
    if (res is Map && res['leaves'] is List) {
      return res['leaves'] as List<dynamic>;
    }
    return [];
  }

  Future<List<dynamic>> getLeaveTypes() async {
    final res = await get(ApiConstants.leaveTypes);
    if (res is Map && res['types'] is List) {
      return res['types'] as List<dynamic>;
    }
    return [];
  }

  Future<void> applyLeave(Map<String, dynamic> data) async {
    await post(ApiConstants.leaves, data);
  }

  Future<void> updateLeaveStatus({
    required int leaveId,
    required String status,
    String? adminRemarks,
  }) async {
    await put('${ApiConstants.leaves}/$leaveId', {
      'status': status,
      'adminRemarks': adminRemarks ?? 'Processed via Mobile App',
    });
  }

  Future<void> deleteLeave(int id) async {
    await delete('${ApiConstants.leaves}/$id');
  }

  // =========================================================================
  // 15. Holidays
  // =========================================================================

  Future<List<dynamic>> getHolidays() async {
    final res = await get(ApiConstants.holidays);
    if (res is Map && res['holidays'] is List) {
      return res['holidays'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createHoliday(Map<String, dynamic> data) async {
    await post(ApiConstants.holidays, data);
  }

  Future<void> updateHoliday(int id, Map<String, dynamic> data) async {
    await put('${ApiConstants.holidays}/$id', data);
  }

  Future<void> deleteHoliday(int id) async {
    await delete('${ApiConstants.holidays}/$id');
  }

  // =========================================================================
  // 16. Notices
  // =========================================================================

  Future<List<dynamic>> getNotices() async {
    final res = await get(ApiConstants.notices);
    if (res is Map && res['notices'] is List) {
      return res['notices'] as List<dynamic>;
    }
    return [];
  }

  Future<void> createNotice({
    required String title,
    required String content,
    String targetType = 'all',
    bool isImportant = false,
  }) async {
    await post(ApiConstants.notices, {
      'title': title,
      'content': content,
      'target_type': targetType,
      'is_important': isImportant,
    });
  }

  Future<void> deleteNotice(int id) async {
    await delete('${ApiConstants.notices}/$id');
  }
}
