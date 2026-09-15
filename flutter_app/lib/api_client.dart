import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _defaultBase = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );
  String _baseUrl = _defaultBase;

  String get baseUrl => _baseUrl;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('api_base_url') ?? _defaultBase;
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', _baseUrl);
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl$path').replace(queryParameters: query);

  String _errorBody(http.Response res) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['detail'] != null) {
        return body['detail'].toString();
      }
    } catch (_) {}
    return 'Erro ${res.statusCode}';
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final res = await http.get(_uri(path, query));
    if (res.statusCode >= 400) throw ApiException(_errorBody(res));
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final uri = _uri(path);
    final headers = {'Content-Type': 'application/json'};
    final encoded = body == null ? null : jsonEncode(body);
    late http.Response res;
    switch (method) {
      case 'POST':
        res = await http.post(uri, headers: headers, body: encoded);
        break;
      case 'PUT':
        res = await http.put(uri, headers: headers, body: encoded);
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: headers);
        break;
      default:
        throw ApiException('Método inválido');
    }
    if (res.statusCode >= 400) throw ApiException(_errorBody(res));
    if (res.body.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  Future<bool> health() async {
    try {
      final data = await _get('/api/health');
      return data['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<List<Product>> listProducts([String? q]) async {
    final data = await _get('/api/products', q == null || q.isEmpty ? null : {'q': q});
    return (data as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Product> createProduct(Map<String, dynamic> payload) async {
    final data = await _send('POST', '/api/products', payload);
    return Product.fromJson(data as Map<String, dynamic>);
  }

  Future<Product> updateProduct(String id, Map<String, dynamic> payload) async {
    final data = await _send('PUT', '/api/products/$id', payload);
    return Product.fromJson(data as Map<String, dynamic>);
  }

  Future<void> deleteProduct(String id) => _send('DELETE', '/api/products/$id');

  Future<List<Production>> listProductions({bool includeDeleted = false}) async {
    final data = await _get(
      '/api/productions',
      includeDeleted ? {'include_deleted': 'true'} : null,
    );
    return (data as List).map((e) => Production.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Production> createProduction(Map<String, dynamic> payload) async {
    final data = await _send('POST', '/api/productions', payload);
    return Production.fromJson(data as Map<String, dynamic>);
  }

  Future<Production> getProduction(String id) async {
    final data = await _get('/api/productions/$id');
    return Production.fromJson(data as Map<String, dynamic>);
  }

  Future<Production> updateProduction(String id, Map<String, dynamic> payload) async {
    final data = await _send('PUT', '/api/productions/$id', payload);
    return Production.fromJson(data as Map<String, dynamic>);
  }

  Future<List<ProductionItem>> listItems(String productionId) async {
    final data = await _get('/api/productions/$productionId/items');
    return (data as List).map((e) => ProductionItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ProductionItem> scan(String productionId, String barcode) async {
    final data = await _send('POST', '/api/productions/$productionId/scan', {'barcode': barcode});
    return ProductionItem.fromJson(data as Map<String, dynamic>);
  }

  Future<void> deleteItem(String productionId, String itemId) =>
      _send('DELETE', '/api/productions/$productionId/items/$itemId');

  Future<Production> deleteProduction(String id) async {
    final data = await _send('POST', '/api/productions/$id/delete');
    return Production.fromJson(data as Map<String, dynamic>);
  }

  Future<List<int>> getProductionPdf(String id) async {
    final res = await http.get(_uri('/api/productions/$id/pdf'));
    if (res.statusCode >= 400) throw ApiException(_errorBody(res));
    return res.bodyBytes;
  }

  Future<ExportResult> exportProduction(String id) async {
    final data = await _send('POST', '/api/productions/$id/export');
    return ExportResult.fromJson(data as Map<String, dynamic>);
  }

  Future<PgSettings> getSettings() async {
    final data = await _get('/api/settings');
    return PgSettings.fromJson(data as Map<String, dynamic>);
  }

  Future<PgSettings> saveSettings(PgSettings settings) async {
    final data = await _send('PUT', '/api/settings', settings.toJson());
    return PgSettings.fromJson(data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> testConnection() async {
    final data = await _send('POST', '/api/settings/test-connection');
    return data as Map<String, dynamic>;
  }

  Future<ImportResult> importFromPostgres({String? table}) async {
    final path = table == null || table.isEmpty
        ? '/api/import/postgresql'
        : '/api/import/postgresql?table=${Uri.encodeQueryComponent(table)}';
    final data = await _send('POST', path);
    return ImportResult.fromJson(data as Map<String, dynamic>);
  }

  Future<ImportResult> importFile(String filename, List<int> bytes) async {
    final request = http.MultipartRequest('POST', _uri('/api/import/file'));
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
        contentType: MediaType('application', 'octet-stream'),
      ),
    );
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode >= 400) throw ApiException(_errorBody(res));
    return ImportResult.fromJson(jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>);
  }
}
