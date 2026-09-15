import 'package:flutter_test/flutter_test.dart';
import 'package:producao_scan/main.dart';

void main() {
  testWidgets('app starts', (tester) async {
    await tester.pumpWidget(const ProducaoScanApp());
    expect(find.text('DAMA · Controle de Produção'), findsOneWidget);
  });
}
