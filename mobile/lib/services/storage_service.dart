import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';
import '../models/user_model.dart';

class StorageService {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'auth_user';
  static const String _keyOrg = 'auth_org';
  static const String _keyOrgCode = 'saved_org_code';
  static const String _keyBaseUrl = 'custom_base_url';
  static const String _keyRememberMe = 'remember_me';

  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Token
  String? getToken() => _prefs.getString(_keyToken);
  Future<void> setToken(String token) => _prefs.setString(_keyToken, token);
  Future<void> clearToken() => _prefs.remove(_keyToken);

  // User
  User? getUser() {
    final str = _prefs.getString(_keyUser);
    if (str == null) return null;
    try {
      return User.fromJson(jsonDecode(str));
    } catch (_) {
      return null;
    }
  }

  Future<void> setUser(User user) =>
      _prefs.setString(_keyUser, jsonEncode(user.toJson()));

  // Org
  Organisation? getOrg() {
    final str = _prefs.getString(_keyOrg);
    if (str == null) return null;
    try {
      return Organisation.fromJson(jsonDecode(str));
    } catch (_) {
      return null;
    }
  }

  Future<void> setOrg(Organisation org) =>
      _prefs.setString(_keyOrg, jsonEncode(org.toJson()));

  // Org Code
  String? getOrgCode() => _prefs.getString(_keyOrgCode);
  Future<void> setOrgCode(String code) => _prefs.setString(_keyOrgCode, code);

  // Base URL
  String getBaseUrl() {
    final val = _prefs.getString(_keyBaseUrl);
    if (val == null || val.contains('localhost') || val.contains('10.0.2.2')) {
      return ApiConstants.defaultBaseUrl;
    }
    return val;
  }

  Future<void> setBaseUrl(String url) => _prefs.setString(_keyBaseUrl, url);

  // Remember Me
  bool getRememberMe() => _prefs.getBool(_keyRememberMe) ?? false;
  Future<void> setRememberMe(bool val) => _prefs.setBool(_keyRememberMe, val);

  // Logout / Clear Session
  Future<void> clearSession() async {
    await _prefs.remove(_keyToken);
    await _prefs.remove(_keyUser);
    await _prefs.remove(_keyOrg);
  }
}

