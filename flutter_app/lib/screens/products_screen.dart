import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final _query = TextEditingController();
  List<Product> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.listProducts(_query.text.trim());
      if (!mounted) return;
      setState(() => _items = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit([Product? product]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _ProductDialog(product: product),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Product product) async {
    try {
      await ApiClient.instance.deleteProduct(product.id);
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Produtos', style: Theme.of(context).textTheme.headlineSmall),
                    Text(
                      'Cadastro dos produtos pesáveis — código de 5 dígitos da etiqueta Toledo.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: () => _edit(),
                icon: const Icon(Icons.add),
                label: const Text('Novo'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _query,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Buscar por nome, código ou categoria…',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : _items.isEmpty
                        ? const Center(child: Text('Nenhum produto. Importe o catálogo ou cadastre um item.'))
                        : ListView.builder(
                            itemCount: _items.length,
                            itemBuilder: (context, index) {
                              final p = _items[index];
                              return Card(
                                child: ListTile(
                                  leading: const CircleAvatar(child: Icon(Icons.inventory_2_outlined)),
                                  title: Text(p.name),
                                  subtitle: Text(
                                    'Código ${p.code}${p.category == null || p.category!.isEmpty ? '' : ' · ${p.category}'}',
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(formatBRL(p.unitPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                                      IconButton(onPressed: () => _edit(p), icon: const Icon(Icons.edit_outlined)),
                                      IconButton(onPressed: () => _delete(p), icon: const Icon(Icons.delete_outline)),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _ProductDialog extends StatefulWidget {
  const _ProductDialog({this.product});
  final Product? product;

  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _category;
  late final TextEditingController _price;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _code = TextEditingController(text: p?.code ?? '');
    _name = TextEditingController(text: p?.name ?? '');
    _category = TextEditingController(text: p?.category ?? '');
    _price = TextEditingController(text: p == null ? '' : p.unitPrice.toString());
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _category.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final price = double.tryParse(_price.text.replaceAll(',', '.'));
    if (_code.text.trim().isEmpty || _name.text.trim().isEmpty || price == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Preencha código, nome e preço.')),
      );
      return;
    }
    setState(() => _saving = true);
    final payload = {
      'code': _code.text.trim(),
      'name': _name.text.trim(),
      'category': _category.text.trim(),
      'unit_price': price,
    };
    try {
      if (widget.product == null) {
        await ApiClient.instance.createProduct(payload);
      } else {
        await ApiClient.instance.updateProduct(widget.product!.id, payload);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.product == null ? 'Novo produto' : 'Editar produto'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: _code, decoration: const InputDecoration(labelText: 'Código Toledo (5 dígitos)')),
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nome')),
            TextField(controller: _category, decoration: const InputDecoration(labelText: 'Categoria')),
            TextField(
              controller: _price,
              decoration: const InputDecoration(labelText: 'Preço por kg (R\$)'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
        FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Salvando…' : 'Salvar')),
      ],
    );
  }
}
