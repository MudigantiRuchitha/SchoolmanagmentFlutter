import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_management_mobile/config/api_constants.dart';
import 'package:school_management_mobile/services/storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'migrates the previously saved Wi-Fi API URL to the current default',
    () async {
      SharedPreferences.setMockInitialValues({
        'custom_base_url': '${ApiConstants.legacyDefaultBaseUrl}/',
      });
      final storage = StorageService();
      await storage.init();

      expect(storage.getBaseUrl(), ApiConstants.defaultBaseUrl);
    },
  );
}
