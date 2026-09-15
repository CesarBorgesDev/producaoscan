import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'barcode_scanner_screen.dart';

class ProductionScreen extends StatefulWidget {
  const ProductionScreen({super.key, required this.productionId});

  final String productionId;

  @override
  State<ProductionScreen> createState() => _ProductionScreenState();
}

class _ProductionScreenState extends State<ProductionScreen> {
  final _barcode = TextEditingController();
  final _focus = FocusNode();
  Production? _production;
  List<ProductionItem> _items = [];
  bool _loading = true;
  bool _processing = false;
  bool _busy = false;

  bool get _readOnly =>
      _production == null || !_production!.isOpen || _production!.isExported;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _barcode.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.getProduction(widget.productionId),
        ApiClient.instance.listItems(widget.productionId),
      ]);
      if (!mounted) return;
      setState(() {
        _production = results[0] as Production;
        _items = results[1] as List<ProductionItem>;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      Navigator.of(context).pop();
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        _focus.requestFocus();
      }
    }
  }

  Future<void> _openCameraScanner() async {
    if (_readOnly || _processing) return;
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScannerScreen()),
    );
    if (!mounted || code == null || code.trim().isEmpty) return;
    _barcode.text = code.trim();
    await _register(code.trim());
  }

  Future<void> _register(String code) async {
    if (code.isEmpty) return;
    setState(() => _processing = true);
    try {
      final created = await ApiClient.instance.scan(widget.productionId, code);
      setState(() {
        _items = [created, ..._items];
        _barcode.clear();
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${created.productName} · ${formatWeight(created.weightKg)} · ${formatBRL(created.totalPrice)}',
          ),
        ),
      );
      await _refreshTotals();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      _barcode.clear();
    } finally {
      if (mounted) {
        setState(() => _processing = false);
        _focus.requestFocus();
      }
    }
  }

  Future<void> _refreshTotals() async {
    final production = await ApiClient.instance.getProduction(widget.productionId);
    if (mounted) setState(() => _production = production);
  }

  Future<void> _delete(ProductionItem item) async {
    try {
      await ApiClient.instance.deleteItem(widget.productionId, item.id);
      setState(() => _items = _items.where((e) => e.id != item.id).toList());
      await _refreshTotals();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _finish() async {
    final production = _production;
    if (production == null) return;
    try {
      final updated = await ApiClient.instance.updateProduction(production.id, {
        'label': production.label,
        'status': 'concluida',
        'production_date': production.productionDate,
      });
      setState(() => _production = updated);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Produção concluída')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _generatePdf() async {
    setState(() => _busy = true);
    try {
      final bytes = await ApiClient.instance.getProductionPdf(widget.productionId);
      await Printing.sharePdf(
        bytes: Uint8List.fromList(bytes),
        filename: 'producao-${widget.productionId.substring(0, 8)}.pdf',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _exportPostgres() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Exportar para Sistema Uniplus'),
        content: const Text(
          'A produção será gravada no Uniplus e não poderá mais ser alterada nem excluída.',
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
      final result = await ApiClient.instance.exportProduction(widget.productionId);
      await _refreshTotals();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.message)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _excludeProduction() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir produção'),
        content: const Text(
          'A produção sai da coleta ativa, mas permanece no histórico de produções excluídas.',
        ),
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
      await ApiClient.instance.deleteProduction(widget.productionId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Produção movida para excluídas')),
      );
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
    final production = _production;
    final weight = _items.fold<double>(0, (s, it) => s + it.weightKg);
    final price = _items.fold<double>(0, (s, it) => s + it.totalPrice);

    return Scaffold(
      appBar: AppBar(
        title: Text(production?.label ?? 'Produção'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12, top: 12, bottom: 12),
            child: Chip(
              label: Text(production?.statusLabel ?? ''),
              backgroundColor: production?.isOpen == true ? const Color(0xFFD6E4F7) : null,
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (production?.isDeleted == true)
            Card(
              color: Colors.red.shade50,
              child: const ListTile(
                leading: Icon(Icons.delete_forever),
                title: Text('Produção excluída'),
                subtitle: Text('Registro mantido no histórico. A coleta está bloqueada.'),
              ),
            ),
          if (production?.isExported == true)
            Card(
              color: const Color(0xFFE3F2FD),
              child: const ListTile(
                leading: Icon(Icons.cloud_done),
                title: Text('Enviada ao Uniplus'),
                subtitle: Text('Esta produção está bloqueada. Não é possível alterar nem excluir.'),
              ),
            ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Coleta de etiquetas', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _barcode,
                    focusNode: _focus,
                    enabled: !_readOnly && !_processing,
                    decoration: InputDecoration(
                      hintText: _readOnly ? production?.statusLabel ?? 'Somente leitura' : 'Código lido ou digitado…',
                      border: const OutlineInputBorder(),
                    ),
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 18, letterSpacing: 2),
                    onSubmitted: (value) => _register(value.trim()),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _readOnly || _processing ? null : _openCameraScanner,
                    icon: const Icon(Icons.photo_camera),
                    label: Text(_processing ? 'Processando…' : 'Adicionar à produção'),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Padrão: 2CCCC0TTTTTT (C=código, T=quantidade em kg). Toque para abrir a câmera.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
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
              label: const Text('Concluir produção'),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : _generatePdf,
            icon: const Icon(Icons.picture_as_pdf),
            label: const Text('Gerar PDF da produção'),
          ),
          if (production?.isExported != true && production?.isDeleted != true) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _exportPostgres,
              icon: const Icon(Icons.cloud_upload),
              label: const Text('Exportar para Sistema Uniplus'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _excludeProduction,
              icon: const Icon(Icons.delete_outline),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
              label: const Text('Excluir produção'),
            ),
          ],
          const SizedBox(height: 20),
          Text('Itens coletados (${_items.length})', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Nenhum item coletado. Toque em Adicionar à produção para abrir a câmera.',
                  textAlign: TextAlign.center,
                ),
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
                        IconButton(
                          onPressed: () => _delete(it),
                          icon: const Icon(Icons.delete_outline),
                        ),
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
