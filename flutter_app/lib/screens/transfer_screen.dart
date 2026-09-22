import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'collect_entry_card.dart';

class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key, required this.transferId});

  final String transferId;

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  TransferRequest? _transfer;
  List<ProductionItem> _items = [];
  bool _loading = true;
  bool _processing = false;
  bool _busy = false;

  bool get _readOnly => _transfer == null || !_transfer!.isOpen || _transfer!.isExported;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.getTransfer(widget.transferId),
        ApiClient.instance.listTransferItems(widget.transferId),
      ]);
      if (!mounted) return;
      setState(() {
        _transfer = results[0] as TransferRequest;
        _items = results[1] as List<ProductionItem>;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _added(ProductionItem created) async {
    setState(() => _items = [created, ..._items]);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${created.productName} · ${formatWeight(created.weightKg)} · ${formatBRL(created.totalPrice)}',
        ),
      ),
    );
    await _refresh();
  }

  Future<void> _register(String code) async {
    if (code.isEmpty || _readOnly) return;
    setState(() => _processing = true);
    try {
      await _added(await ApiClient.instance.scanTransfer(widget.transferId, code));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _registerManual(String productCode, double weightKg) async {
    if (_readOnly) return;
    setState(() => _processing = true);
    try {
      await _added(await ApiClient.instance.addTransferItem(widget.transferId, productCode, weightKg));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _refresh() async {
    final row = await ApiClient.instance.getTransfer(widget.transferId);
    if (mounted) setState(() => _transfer = row);
  }

  Future<void> _delete(ProductionItem item) async {
    try {
      await ApiClient.instance.deleteTransferItem(widget.transferId, item.id);
      setState(() => _items = _items.where((e) => e.id != item.id).toList());
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _finish() async {
    final transfer = _transfer;
    if (transfer == null) return;
    try {
      final updated = await ApiClient.instance.updateTransfer(transfer.id, {
        'filial_id': transfer.filialId,
        'label': transfer.label,
        'status': 'concluida',
        'request_date': transfer.requestDate,
      });
      setState(() => _transfer = updated);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Requisição concluída')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _export() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Exportar para Sistema Uniplus'),
        content: const Text(
          'A requisição será gravada no Uniplus e não poderá mais ser alterada nem excluída.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Exportar')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      final result = await ApiClient.instance.exportTransfer(widget.transferId);
      await _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.message)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _exclude() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir requisição'),
        content: const Text('A requisição sai da coleta ativa, mas permanece no histórico de excluídas.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ApiClient.instance.deleteTransfer(widget.transferId);
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final transfer = _transfer;
    final weight = _items.fold<double>(0, (s, it) => s + it.weightKg);
    final price = _items.fold<double>(0, (s, it) => s + it.totalPrice);

    return Scaffold(
      appBar: AppBar(
        title: Text(transfer?.filialName ?? 'Transferência'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12, top: 12, bottom: 12),
            child: Chip(label: Text(transfer?.statusLabel ?? '')),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (transfer?.isDeleted == true)
            Card(
              color: Colors.red.shade50,
              child: const ListTile(
                leading: Icon(Icons.delete_forever),
                title: Text('Requisição excluída'),
                subtitle: Text('A coleta está bloqueada.'),
              ),
            ),
          if (transfer?.isExported == true)
            Card(
              color: const Color(0xFFE3F2FD),
              child: const ListTile(
                leading: Icon(Icons.cloud_done),
                title: Text('Enviada ao Uniplus'),
                subtitle: Text('Esta requisição está bloqueada.'),
              ),
            ),
          CollectEntryCard(
            readOnly: _readOnly,
            processing: _processing,
            statusText: transfer?.statusLabel ?? 'Somente leitura',
            submitScanLabel: 'Adicionar à transferência',
            submitManualLabel: 'Adicionar à transferência',
            onScan: _register,
            onManual: _registerManual,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Peso total'),
                        Text(formatWeight(weight), style: Theme.of(context).textTheme.headlineSmall),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Card(
                  color: Theme.of(context).colorScheme.primary,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Valor total', style: TextStyle(color: Theme.of(context).colorScheme.onPrimary)),
                        Text(
                          formatBRL(price),
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: Theme.of(context).colorScheme.onPrimary,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!_readOnly)
            FilledButton.icon(
              onPressed: _busy ? null : _finish,
              icon: const Icon(Icons.check_circle),
              label: const Text('Concluir requisição'),
            ),
          if (transfer?.isExported != true && transfer?.isDeleted != true) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _export,
              icon: const Icon(Icons.cloud_upload),
              label: const Text('Exportar para Sistema Uniplus'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _exclude,
              icon: const Icon(Icons.delete_outline),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
              label: const Text('Excluir requisição'),
            ),
          ],
          const SizedBox(height: 20),
          Text('Itens coletados (${_items.length})', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Nenhum item coletado. Use o leitor ou digite código e peso.', textAlign: TextAlign.center),
              ),
            )
          else
            ..._items.map(
              (it) => Card(
                child: ListTile(
                  title: Text(it.productName),
                  subtitle: Text('#${it.productCode} · ${formatWeight(it.weightKg)} × ${formatBRL(it.unitPrice)}/kg'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(formatBRL(it.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (!_readOnly)
                        IconButton(onPressed: () => _delete(it), icon: const Icon(Icons.delete_outline)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
