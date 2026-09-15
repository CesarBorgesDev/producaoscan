import 'package:intl/intl.dart';

final _brl = NumberFormat.currency(locale: 'pt_BR', symbol: r'R$');

String formatBRL(num value) => _brl.format(value);

String formatWeight(num kg) => '${kg.toStringAsFixed(3).replaceAll('.', ',')} kg';

String formatDate(String iso) {
  if (iso.isEmpty) return '';
  final parsed = DateTime.tryParse(iso.length == 10 ? '${iso}T00:00:00' : iso);
  if (parsed == null) return iso;
  return DateFormat('dd/MM/yyyy').format(parsed);
}

String todayLabel() => DateFormat('dd/MM/yyyy').format(DateTime.now());

String todayISO() {
  final now = DateTime.now();
  return '${now.year.toString().padLeft(4, '0')}-'
      '${now.month.toString().padLeft(2, '0')}-'
      '${now.day.toString().padLeft(2, '0')}';
}
