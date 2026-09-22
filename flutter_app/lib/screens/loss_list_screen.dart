import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'loss_screen.dart';

class LossListScreen extends StatefulWidget {
  const LossListScreen({super.key});

  @override
  State<LossListScreen> createState() => _LossListScreenState();
}

class _LossListScreenState extends State<LossListScreen> {
  bool _loading = true;
  bool _creating = false;
  String? _error;
  List<Loss> _items = [];
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
      final data = await ApiClient.instance.listLosses(includeDeleted: true);
      if (!mounted) return;
      setState(() => _items = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Loss> get _open => _items.where((e) => e.isOpen).toList();
  List<Loss> get _done => _items.where((e) => e.status == 'concluida').toList();
  List<Loss> get _deleted => _items.where((e) => e.isDeleted).toList();

  List<Loss> get _list {
    switch (_tab) {
      case 1:
        return _done;
      case 2:
        return _deleted;
      default:
        return _open;
    }
  }

  Future<void> _openLoss(Loss item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => LossScreen(lossId: item.id)),
    );
    _load();
  }

  Future<void> _start() async {
    if (_open.isNotEmpty) {
      await _openLoss(_open.first);
      return;
    }
    setState(() => _creating = true);
    try {
      final created = await ApiClient.instance.createLoss({
        'label': 'Perda ${todayLabel()}',
        'status': 'em_andamento',
        'loss_date': todayISO(),
      });
      if (!mounted) return;
      await _openLoss(created);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
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
                    Text('Perdas', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'Registre perdas com leitor ou digitação. Os dados ficam só neste aplicativo.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: _creating ? null : _start,
                icon: Icon(_open.isEmpty ? Icons.add : Icons.play_arrow),
                label: Text(_open.isEmpty ? 'Nova' : 'Continuar'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Abertas')),
              ButtonSegment(value: 1, label: Text('Feitas')),
              ButtonSegment(value: 2, label: Text('Excluídas')),
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
                child: Text('Nenhuma perda nesta aba.', textAlign: TextAlign.center),
              ),
            )
          else
            ..._list.map(
              (item) => Card(
                color: item.isDeleted ? Colors.red.shade50 : null,
                child: ListTile(
                  onTap: () => _openLoss(item),
                  title: Text(item.label),
                  subtitle: Text(
                    '${item.statusLabel} · ${formatDate(item.lossDate)}\n${item.itemCount} itens · ${formatWeight(item.totalWeight)}',
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
