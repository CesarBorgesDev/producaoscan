import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../format.dart';
import 'barcode_scanner_screen.dart';

class CollectEntryCard extends StatefulWidget {
  const CollectEntryCard({
    super.key,
    required this.readOnly,
    required this.processing,
    required this.statusText,
    required this.submitScanLabel,
    required this.submitManualLabel,
    required this.onScan,
    required this.onManual,
  });

  final bool readOnly;
  final bool processing;
  final String statusText;
  final String submitScanLabel;
  final String submitManualLabel;
  final Future<void> Function(String barcode) onScan;
  final Future<void> Function(String productCode, double weightKg) onManual;

  @override
  State<CollectEntryCard> createState() => _CollectEntryCardState();
}

class _CollectEntryCardState extends State<CollectEntryCard> {
  final _barcode = TextEditingController();
  final _code = TextEditingController();
  final _weight = TextEditingController();
  final _barcodeFocus = FocusNode();
  final _codeFocus = FocusNode();
  bool _manual = false;

  @override
  void initState() {
    super.initState();
    _code.addListener(_refresh);
    _weight.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _code.removeListener(_refresh);
    _weight.removeListener(_refresh);
    _barcode.dispose();
    _code.dispose();
    _weight.dispose();
    _barcodeFocus.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  Future<void> _openCamera() async {
    if (widget.readOnly || widget.processing) return;
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScannerScreen()),
    );
    if (!mounted || code == null || code.trim().isEmpty) return;
    _barcode.text = code.trim();
    await widget.onScan(code.trim());
    if (mounted) _barcode.clear();
  }

  Future<void> _submitScan() async {
    final code = _barcode.text.trim();
    if (code.isEmpty) return;
    await widget.onScan(code);
    if (mounted) {
      _barcode.clear();
      _barcodeFocus.requestFocus();
    }
  }

  Future<void> _submitManual() async {
    final code = _code.text.trim();
    final weight = parseWeightKg(_weight.text);
    if (code.isEmpty || weight == null) return;
    await widget.onManual(code, weight);
    if (mounted) {
      _code.clear();
      _weight.clear();
      _codeFocus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Leitor'), icon: Icon(Icons.qr_code_scanner)),
                ButtonSegment(value: true, label: Text('Digitar'), icon: Icon(Icons.keyboard_outlined)),
              ],
              selected: {_manual},
              onSelectionChanged: widget.readOnly
                  ? null
                  : (value) {
                      setState(() => _manual = value.first);
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (_manual) {
                          _codeFocus.requestFocus();
                        } else {
                          _barcodeFocus.requestFocus();
                        }
                      });
                    },
            ),
            const SizedBox(height: 16),
            if (!_manual) ...[
              const Text('Coleta de etiquetas', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              TextField(
                controller: _barcode,
                focusNode: _barcodeFocus,
                enabled: !widget.readOnly && !widget.processing,
                decoration: InputDecoration(
                  hintText: widget.readOnly ? widget.statusText : 'Posicione o leitor ou digite a etiqueta…',
                  border: const OutlineInputBorder(),
                ),
                style: const TextStyle(fontFamily: 'monospace', fontSize: 18, letterSpacing: 2),
                onSubmitted: (_) => _submitScan(),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: widget.readOnly || widget.processing ? null : _openCamera,
                icon: const Icon(Icons.photo_camera),
                label: Text(widget.processing ? 'Processando…' : widget.submitScanLabel),
              ),
              const SizedBox(height: 8),
              Text(
                'Padrão: 2CCCC0TTTTTT (C=código, T=quantidade em kg). Toque para abrir a câmera.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ] else ...[
              const Text('Código e pesagem', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _code,
                      focusNode: _codeFocus,
                      enabled: !widget.readOnly && !widget.processing,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'Código',
                        hintText: 'Ex.: 1110',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _weight,
                      enabled: !widget.readOnly && !widget.processing,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Peso (kg)',
                        hintText: 'Ex.: 1,250',
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _submitManual(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: widget.readOnly ||
                        widget.processing ||
                        _code.text.trim().isEmpty ||
                        parseWeightKg(_weight.text) == null
                    ? null
                    : _submitManual,
                icon: const Icon(Icons.keyboard_outlined),
                label: Text(widget.processing ? 'Processando…' : widget.submitManualLabel),
              ),
              const SizedBox(height: 8),
              Text(
                'Digite o código do produto cadastrado e o peso em kg (vírgula ou ponto).',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
