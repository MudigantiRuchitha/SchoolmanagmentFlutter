import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api;
  final StorageService _storage;

  User? _user;
  Organisation? _org;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider(this._api, this._storage) {
    _loadFromStorage();
  }

  User? get user => _user;
  Organisation? get org => _org;
  bool get isAuthenticated => _storage.getToken() != null && _user != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  String get currentBaseUrl => _storage.getBaseUrl();
  String get baseUrl => _storage.getBaseUrl();
  String? get savedOrgCode => _storage.getOrgCode();
  String? get savedUsername => _storage.getUsername();

  void _loadFromStorage() {
    _user = _storage.getUser();
    _org = _storage.getOrg();
    notifyListeners();
  }

  Future<bool> checkAuth() async {
    final token = _storage.getToken();
    if (token == null) return false;

    try {
      final res = await _api.getMe();
      if (res['success'] == true && res['user'] != null) {
        _user = User.fromJson(res['user']);
        await _storage.setUser(_user!);
        if (res['org'] != null) {
          _org = Organisation.fromJson(res['org']);
          await _storage.setOrg(_org!);
        }
        notifyListeners();
        return true;
      }
    } catch (_) {
      // If token expired or network failed, fall back to offline user if available
      if (_user != null) return true;
    }
    return false;
  }

  Future<bool> login({
    required String orgCode,
    required String username,
    required String password,
    bool rememberMe = true,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.login(
        orgCode: orgCode,
        username: username,
        password: password,
      );

      if (res['success'] == true && res['token'] != null) {
        final token = res['token'] as String;
        await _storage.setToken(token);
        await _storage.setOrgCode(orgCode);
        await _storage.setUsername(username);
        await _storage.setRememberMe(rememberMe);

        if (res['user'] != null) {
          _user = User.fromJson(res['user']);
          await _storage.setUser(_user!);
        }
        if (res['org'] != null) {
          _org = Organisation.fromJson(res['org']);
          await _storage.setOrg(_org!);
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res['message'] ?? 'Login failed. Please check credentials.';
      }
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> updateBaseUrl(String url) async {
    var trimmed = url.trim();
    if (trimmed.endsWith('/')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    if (!trimmed.endsWith('/api')) {
      trimmed = '$trimmed/api';
    }
    await _storage.setBaseUrl(trimmed);
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.logout();
    await _storage.clearSession();
    _user = null;
    _org = null;
    notifyListeners();
  }
}
