import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'transfer_screen.dart';

class TransferListScreen extends StatefulWidget {
  const TransferListScreen({super.key});

  @override
  State<TransferListScreen> createState() => _TransferListScreenState();
}

class _TransferListScreenState extends State<TransferListScreen> {
  bool _loading = true;
  String? _error;
  List<TransferRequest> _items = [];
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.listTransfers(includeDeleted: true);
      if (!mounted) return;
      setState(() => _items = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<TransferRequest> get _open => _items.where((e) => e.isOpen).toList();
  List<TransferRequest> get _done =>
      _items.where((e) => e.status == 'concluida' && !e.isExported).toList();
  List<TransferRequest> get _sent => _items.where((e) => e.isExported && !e.isDeleted).toList();
  List<TransferRequest> get _deleted => _items.where((e) => e.isDeleted).toList();

  List<TransferRequest> get _list {
    switch (_tab) {
      case 1:
        return _done;
      case 2:
        return _sent;
      case 3:
        return _deleted;
      default:
        return _open;
    }
  }

  Future<void> _openTransfer(TransferRequest item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => TransferScreen(transferId: item.id)),
    );
    _load();
  }

  Future<void> _start() async {
    final created = await showModalBottomSheet<TransferRequest>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _StartTransferSheet(),
    );
    if (created == null || !mounted) return;
    await _openTransfer(created);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Transferências', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'Selecione a filial e colete as etiquetas, como na produção.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: _start,
                icon: const Icon(Icons.add),
                label: const Text('Nova'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Abertas')),
              ButtonSegment(value: 1, label: Text('Feitas')),
              ButtonSegment(value: 2, label: Text('Uniplus')),
              ButtonSegment(value: 3, label: Text('Excluídas')),
            ],
            selected: {_tab},
            onSelectionChanged: (value) => setState(() => _tab = value.first),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: _load, child: const Text('Tentar novamente')),
                  ],
                ),
              ),
            )
          else if (_list.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Nenhuma requisição nesta aba.', textAlign: TextAlign.center),
              ),
            )
          else
            ..._list.map(
              (item) => Card(
                color: item.isDeleted
                    ? Colors.red.shade50
                    : item.isExported
                        ? const Color(0xFFE3F2FD)
                        : null,
                child: ListTile(
                  onTap: () => _openTransfer(item),
                  title: Text(item.filialName),
                  subtitle: Text(
                    '${item.statusLabel} · ${formatDate(item.requestDate)}\n${item.itemCount} itens · ${formatWeight(item.totalWeight)}',
                  ),
                  isThreeLine: true,
                  trailing: Text(formatBRL(item.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StartTransferSheet extends StatefulWidget {
  const _StartTransferSheet();

  @override
  State<_StartTransferSheet> createState() => _StartTransferSheetState();
}

class _StartTransferSheetState extends State<_StartTransferSheet> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<Filial> _filiais = [];
  int? _filialId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.listFiliais();
      if (!mounted) return;
      setState(() {
        _filiais = data;
        _error = data.isEmpty ? 'Nenhuma filial encontrada no Uniplus.' : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final filialId = _filialId;
    if (filialId == null) return;
    final filial = _filiais.cast<Filial?>().firstWhere((e) => e?.id == filialId, orElse: () => null);
    setState(() => _saving = true);
    try {
      final created = await ApiClient.instance.createTransfer({
        'filial_id': filialId,
        'status': 'em_andamento',
        'request_date': todayISO(),
        if (filial != null) 'label': 'Transferência ${filial.name}',
      });
      if (!mounted) return;
      Navigator.of(context).pop(created);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Requisição de transferência', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text('Selecione a filial de destino e colete os produtos.'),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else
            DropdownButtonFormField<int>(
              value: _filialId,
              decoration: const InputDecoration(labelText: 'Filial', border: OutlineInputBorder()),
              items: _filiais
                  .map((filial) => DropdownMenuItem(value: filial.id, child: Text(filial.label)))
                  .toList(),
              onChanged: _saving ? null : (value) => setState(() => _filialId = value),
            ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving || _loading || _filialId == null ? null : _submit,
            child: Text(_saving ? 'Iniciando…' : 'Iniciar coleta'),
          ),
        ],
      ),
    );
  }
}
