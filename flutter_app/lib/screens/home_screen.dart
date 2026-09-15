import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import 'production_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _pages = PageController(initialPage: 1);
  bool _loading = true;
  bool _creating = false;
  String? _error;
  List<Production> _items = [];
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.listProductions(includeDeleted: true);
      if (!mounted) return;
      setState(() => _items = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Production? get _open {
    for (final p in _items) {
      if (p.isOpen) return p;
    }
    return null;
  }

  List<Production> get _active => _items.where((p) => !p.isDeleted && !p.isExported).toList();
  List<Production> get _deleted => _items.where((p) => p.isDeleted).toList();
  List<Production> get _sent => _items.where((p) => p.isExported && !p.isDeleted).toList();

  Future<void> _start() async {
    final open = _open;
    if (open != null) {
      await _openProduction(open);
      return;
    }
    setState(() => _creating = true);
    try {
      final created = await ApiClient.instance.createProduction({
        'label': 'Produção ${todayLabel()}',
        'status': 'em_andamento',
        'production_date': todayISO(),
      });
      if (!mounted) return;
      await _openProduction(created);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _openProduction(Production production) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProductionScreen(productionId: production.id)),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _page == 0
                      ? 'Produções excluídas'
                      : _page == 2
                          ? 'Enviadas ao Uniplus'
                          : 'Produções',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              _PageDots(index: _page),
            ],
          ),
        ),
        Expanded(
          child: PageView(
            controller: _pages,
            onPageChanged: (value) => setState(() => _page = value),
            children: [
              _buildDeletedPage(),
              _buildActivePage(),
              _buildSentPage(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActivePage() {
    final open = _open;
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
                    Text('Produções', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'Inicie a produção do dia, colete as etiquetas e conclua quando finalizar.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Arraste para a direita para ver as excluídas. Arraste para a esquerda para ver as enviadas ao Uniplus.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _creating ? null : _start,
                icon: Icon(open == null ? Icons.add : Icons.play_arrow),
                label: Text(open == null ? 'Iniciar' : 'Continuar'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (open != null)
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: ListTile(
                leading: const Icon(Icons.play_circle),
                title: Text(open.label),
                subtitle: Text('Em andamento · ${open.itemCount} itens'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openProduction(open),
              ),
            ),
          const SizedBox(height: 16),
          Text('Histórico de produções', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _ErrorBox(message: _error!, onRetry: _load)
          else if (_active.isEmpty)
            const _EmptyBox(
              icon: Icons.assignment_outlined,
              title: 'Nenhuma produção registrada',
              subtitle: 'Inicie a primeira produção do dia para começar a coletar etiquetas.',
            )
          else
            ..._active.map(_productionTile),
        ],
      ),
    );
  }

  Widget _buildDeletedPage() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text('Produções excluídas', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            'Arraste para a esquerda para voltar às produções.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _ErrorBox(message: _error!, onRetry: _load)
          else if (_deleted.isEmpty)
            const _EmptyBox(
              icon: Icons.delete_outline,
              title: 'Nenhuma produção excluída',
              subtitle: 'Quando uma produção for excluída, o registro aparece nesta tela.',
            )
          else
            ..._deleted.map(
              (p) => Card(
                color: Colors.red.shade50,
                child: ListTile(
                  onTap: () => _openProduction(p),
                  leading: const Icon(Icons.delete_forever),
                  title: Text(p.label),
                  subtitle: Text(
                    'Excluída · ${formatDate(p.productionDate)}\n${p.itemCount} itens · ${formatWeight(p.totalWeight)}',
                  ),
                  isThreeLine: true,
                  trailing: Text(formatBRL(p.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSentPage() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text('Enviadas ao Uniplus', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            'Arraste para a direita para voltar às produções.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _ErrorBox(message: _error!, onRetry: _load)
          else if (_sent.isEmpty)
            const _EmptyBox(
              icon: Icons.cloud_done_outlined,
              title: 'Nenhuma produção enviada',
              subtitle: 'Quando a produção for exportada para o Uniplus, o registro aparece nesta tela.',
            )
          else
            ..._sent.map(
              (p) => Card(
                color: const Color(0xFFE3F2FD),
                child: ListTile(
                  onTap: () => _openProduction(p),
                  leading: const Icon(Icons.cloud_done),
                  title: Text(p.label),
                  subtitle: Text(
                    'Enviada ao Uniplus · ${formatDate(p.productionDate)}\n${p.itemCount} itens · ${formatWeight(p.totalWeight)}',
                  ),
                  isThreeLine: true,
                  trailing: Text(formatBRL(p.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _productionTile(Production p) {
    return Card(
      child: ListTile(
        onTap: () => _openProduction(p),
        title: Text(p.label),
        subtitle: Text(
          '${p.statusLabel} · ${formatDate(p.productionDate)}\n${p.itemCount} itens · ${formatWeight(p.totalWeight)}',
        ),
        isThreeLine: true,
        trailing: Text(formatBRL(p.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    final active = Theme.of(context).colorScheme.primary;
    return Row(
      children: [
        Icon(Icons.chevron_left, size: 18, color: index == 0 ? active : Theme.of(context).hintColor),
        const SizedBox(width: 4),
        _Dot(selected: index == 0),
        const SizedBox(width: 6),
        _Dot(selected: index == 1),
        const SizedBox(width: 6),
        _Dot(selected: index == 2),
        const SizedBox(width: 4),
        Icon(Icons.chevron_right, size: 18, color: index == 2 ? active : Theme.of(context).hintColor),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.selected});
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: selected ? 10 : 8,
      height: selected ? 10 : 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? Theme.of(context).colorScheme.primary : Theme.of(context).hintColor,
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.icon, required this.title, required this.subtitle});
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(icon, size: 36, color: Theme.of(context).hintColor),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(subtitle, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Tentar novamente')),
          ],
        ),
      ),
    );
  }
}
