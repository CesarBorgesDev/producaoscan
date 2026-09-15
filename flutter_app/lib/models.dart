class Product {
  Product({
    required this.id,
    required this.code,
    required this.name,
    this.category,
    required this.unitPrice,
  });

  final String id;
  final String code;
  final String name;
  final String? category;
  final double unitPrice;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        category: json['category'] as String?,
        unitPrice: (json['unit_price'] as num).toDouble(),
      );
}

class Production {
  Production({
    required this.id,
    required this.label,
    required this.status,
    required this.productionDate,
    required this.itemCount,
    required this.totalWeight,
    required this.totalPrice,
    this.exportedPgId,
  });

  final String id;
  final String label;
  final String status;
  final String productionDate;
  final int itemCount;
  final double totalWeight;
  final double totalPrice;
  final int? exportedPgId;

  bool get isOpen => status == 'em_andamento';
  bool get isDeleted => status == 'excluida';
  bool get isFinished => status == 'concluida';
  bool get isExported => exportedPgId != null || status == 'enviada';

  String get statusLabel {
    switch (status) {
      case 'em_andamento':
        return 'Em andamento';
      case 'concluida':
        return 'Concluída';
      case 'excluida':
        return 'Excluída';
      case 'enviada':
        return 'Enviada ao Uniplus';
      default:
        return status;
    }
  }

  factory Production.fromJson(Map<String, dynamic> json) => Production(
        id: json['id'] as String,
        label: json['label'] as String,
        status: json['status'] as String,
        productionDate: json['production_date'] as String,
        itemCount: json['item_count'] as int,
        totalWeight: (json['total_weight'] as num).toDouble(),
        totalPrice: (json['total_price'] as num).toDouble(),
        exportedPgId: (json['exported_pg_id'] as num?)?.toInt(),
      );
}

class ProductionItem {
  ProductionItem({
    required this.id,
    required this.barcode,
    required this.productCode,
    required this.productName,
    required this.weightKg,
    required this.unitPrice,
    required this.totalPrice,
  });

  final String id;
  final String barcode;
  final String productCode;
  final String productName;
  final double weightKg;
  final double unitPrice;
  final double totalPrice;

  factory ProductionItem.fromJson(Map<String, dynamic> json) => ProductionItem(
        id: json['id'] as String,
        barcode: json['barcode'] as String,
        productCode: json['product_code'] as String,
        productName: json['product_name'] as String,
        weightKg: (json['weight_kg'] as num).toDouble(),
        unitPrice: (json['unit_price'] as num).toDouble(),
        totalPrice: (json['total_price'] as num).toDouble(),
      );
}

class PgSettings {
  PgSettings({
    required this.pgHost,
    required this.pgPort,
    required this.pgDatabase,
    required this.pgUsername,
    required this.pgPassword,
    required this.sourceTable,
  });

  final String pgHost;
  final int pgPort;
  final String pgDatabase;
  final String pgUsername;
  final String pgPassword;
  final String sourceTable;

  factory PgSettings.fromJson(Map<String, dynamic> json) => PgSettings(
        pgHost: json['pg_host'] as String? ?? '',
        pgPort: json['pg_port'] as int? ?? 5432,
        pgDatabase: json['pg_database'] as String? ?? '',
        pgUsername: json['pg_username'] as String? ?? '',
        pgPassword: json['pg_password'] as String? ?? '',
        sourceTable: json['source_table'] as String? ?? 'catalogo_origem',
      );

  Map<String, dynamic> toJson() => {
        'pg_host': pgHost,
        'pg_port': pgPort,
        'pg_database': pgDatabase,
        'pg_username': pgUsername,
        'pg_password': pgPassword,
        'source_table': sourceTable,
      };
}

class ImportResult {
  ImportResult({
    required this.imported,
    required this.updated,
    required this.skipped,
    required this.source,
    required this.detail,
  });

  final int imported;
  final int updated;
  final int skipped;
  final String source;
  final String detail;

  factory ImportResult.fromJson(Map<String, dynamic> json) => ImportResult(
        imported: json['imported'] as int,
        updated: json['updated'] as int,
        skipped: json['skipped'] as int,
        source: json['source'] as String,
        detail: json['detail'] as String? ?? '',
      );
}

class ExportResult {
  ExportResult({
    required this.ok,
    required this.registroproducaoId,
    required this.codigo,
    required this.items,
    required this.message,
  });

  final bool ok;
  final int registroproducaoId;
  final String codigo;
  final int items;
  final String message;

  factory ExportResult.fromJson(Map<String, dynamic> json) => ExportResult(
        ok: json['ok'] == true,
        registroproducaoId: json['registroproducao_id'] as int? ?? 0,
        codigo: json['codigo'] as String? ?? '',
        items: json['items'] as int? ?? 0,
        message: json['message'] as String? ?? '',
      );
}
