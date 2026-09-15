import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiUrl = TextEditingController(text: ApiClient.instance.baseUrl);
  final _host = TextEditingController();
  final _port = TextEditingController(text: '5432');
  final _database = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _table = TextEditingController(text: 'catalogo_origem');
  bool _loading = true;
  bool _saving = false;
  bool _busy = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _apiUrl.dispose();
    _host.dispose();
    _port.dispose();
    _database.dispose();
    _username.dispose();
    _password.dispose();
    _table.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      await ApiClient.instance.setBaseUrl(_apiUrl.text.trim());
      final settings = await ApiClient.instance.getSettings();
      if (!mounted) return;
      _host.text = settings.pgHost;
      _port.text = settings.pgPort.toString();
      _database.text = settings.pgDatabase;
      _username.text = settings.pgUsername;
      _password.text = settings.pgPassword;
      _table.text = settings.sourceTable;
    } catch (e) {
      _status = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  PgSettings _form() => PgSettings(
        pgHost: _host.text.trim(),
        pgPort: int.tryParse(_port.text.trim()) ?? 5432,
        pgDatabase: _database.text.trim(),
        pgUsername: _username.text.trim(),
        pgPassword: _password.text,
        sourceTable: _table.text.trim().isEmpty ? 'catalogo_origem' : _table.text.trim(),
      );

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.setBaseUrl(_apiUrl.text.trim());
      await ApiClient.instance.saveSettings(_form());
      _status = 'Configurações salvas.';
    } catch (e) {
      _status = e.toString();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _test() async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.setBaseUrl(_apiUrl.text.trim());
      await ApiClient.instance.saveSettings(_form());
      final result = await ApiClient.instance.testConnection();
      final tables = (result['tables'] as List?)?.join(', ') ?? '';
      _status = '${result['message']}${tables.isEmpty ? '' : '\nTabelas: $tables'}';
    } catch (e) {
      _status = e.toString();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _importPg() async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.setBaseUrl(_apiUrl.text.trim());
      await ApiClient.instance.saveSettings(_form());
      final result = await ApiClient.instance.importFromPostgres(table: _table.text.trim());
      _status =
          'Importação PostgreSQL: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados.';
    } catch (e) {
      _status = e.toString();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _importFile() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv', 'json'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final file = picked.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      setState(() => _status = 'Não foi possível ler o arquivo.');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await ApiClient.instance.importFile(file.name, bytes);
      _status =
          'Arquivo ${file.name}: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados.';
    } catch (e) {
      _status = e.toString();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Configurações', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Conexão PostgreSQL usada na importação do catálogo e no envio das produções (registroproducao).',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('API Python', style: Theme.of(context).textTheme.titleMedium),
                TextField(
                  controller: _apiUrl,
                  decoration: const InputDecoration(labelText: 'URL do backend'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('PostgreSQL (catálogo e envio da produção)', style: Theme.of(context).textTheme.titleMedium),
                TextField(controller: _host, decoration: const InputDecoration(labelText: 'Host / IP')),
                TextField(controller: _port, decoration: const InputDecoration(labelText: 'Porta')),
                TextField(controller: _database, decoration: const InputDecoration(labelText: 'Banco de dados')),
                TextField(controller: _username, decoration: const InputDecoration(labelText: 'Usuário')),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Senha'),
                ),
                TextField(
                  controller: _table,
                  decoration: const InputDecoration(labelText: 'Tabela de origem'),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: const Icon(Icons.save),
                      label: Text(_saving ? 'Salvando…' : 'Salvar'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _test,
                      icon: const Icon(Icons.wifi_tethering),
                      label: const Text('Testar conexão'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _busy ? null : _importPg,
                      icon: const Icon(Icons.cloud_download),
                      label: const Text('Importar do PostgreSQL'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _importFile,
                      icon: const Icon(Icons.upload_file),
                      label: const Text('Importar CSV/JSON'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (_status != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_status!),
            ),
          ),
        ],
      ],
    );
  }
}
