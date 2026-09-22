import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'collect_entry_card.dart';

class LossScreen extends StatefulWidget {
  const LossScreen({super.key, required this.lossId});

  final String lossId;

  @override
  State<LossScreen> createState() => _LossScreenState();
}

class _LossScreenState extends State<LossScreen> {
  Loss? _loss;
  List<ProductionItem> _items = [];
  bool _loading = true;
  bool _processing = false;
  bool _busy = false;

  bool get _readOnly => _loss == null || !_loss!.isOpen;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.getLoss(widget.lossId),
        ApiClient.instance.listLossItems(widget.lossId),
      ]);
      if (!mounted) return;
      setState(() {
        _loss = results[0] as Loss;
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
      await _added(await ApiClient.instance.scanLoss(widget.lossId, code));
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
      await _added(await ApiClient.instance.addLossItem(widget.lossId, productCode, weightKg));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _refresh() async {
    final row = await ApiClient.instance.getLoss(widget.lossId);
    if (mounted) setState(() => _loss = row);
  }

  Future<void> _delete(ProductionItem item) async {
    try {
      await ApiClient.instance.deleteLossItem(widget.lossId, item.id);
      setState(() => _items = _items.where((e) => e.id != item.id).toList());
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _finish() async {
    final loss = _loss;
    if (loss == null) return;
    try {
      final updated = await ApiClient.instance.updateLoss(loss.id, {
        'label': loss.label,
        'status': 'concluida',
        'loss_date': loss.lossDate,
      });
      setState(() => _loss = updated);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Perda concluída. Registro mantido apenas no aplicativo.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _exclude() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir perda'),
        content: const Text('A perda sai da coleta ativa, mas permanece no histórico de excluídas.'),
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
      await ApiClient.instance.deleteLoss(widget.lossId);
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
    final loss = _loss;
    final weight = _items.fold<double>(0, (s, it) => s + it.weightKg);
    final price = _items.fold<double>(0, (s, it) => s + it.totalPrice);

    return Scaffold(
      appBar: AppBar(
        title: Text(loss?.label ?? 'Perda'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12, top: 12, bottom: 12),
            child: Chip(label: Text(loss?.statusLabel ?? '')),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (loss?.isDeleted == true)
            Card(
              color: Colors.red.shade50,
              child: const ListTile(
                leading: Icon(Icons.delete_forever),
                title: Text('Perda excluída'),
                subtitle: Text('Registro mantido no histórico. A coleta está bloqueada.'),
              ),
            )
          else if (_readOnly)
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: const ListTile(
                leading: Icon(Icons.lock_outline),
                title: Text('Perda concluída'),
                subtitle: Text('Este registro não é enviado ao Uniplus.'),
              ),
            ),
          CollectEntryCard(
            readOnly: _readOnly,
            processing: _processing,
            statusText: loss?.statusLabel ?? 'Somente leitura',
            submitScanLabel: 'Adicionar à perda',
            submitManualLabel: 'Adicionar à perda',
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
              label: const Text('Concluir perda'),
            ),
          if (loss?.isDeleted != true) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _exclude,
              icon: const Icon(Icons.delete_outline),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
              label: const Text('Excluir perda'),
            ),
          ],
          const SizedBox(height: 20),
          Text('Itens da perda (${_items.length})', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Nenhum item registrado. Use o leitor ou digite código e peso.', textAlign: TextAlign.center),
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
