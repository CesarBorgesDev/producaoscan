from datetime import date, datetime

from pydantic import BaseModel, Field


class ProductIn(BaseModel):
    code: str
    name: str
    category: str | None = None
    unit_price: float


class ProductOut(ProductIn):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductionIn(BaseModel):
    label: str
    status: str = "em_andamento"
    production_date: date | None = None


class ProductionOut(BaseModel):
    id: str
    label: str
    status: str
    production_date: date
    item_count: int
    total_weight: float
    total_price: float
    created_at: datetime
    deleted_at: datetime | None = None
    exported_at: datetime | None = None
    exported_pg_id: int | None = None

    model_config = {"from_attributes": True}


class ProductionItemOut(BaseModel):
    id: str
    barcode: str
    product_code: str
    product_name: str
    weight_kg: float
    unit_price: float
    total_price: float
    production_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanIn(BaseModel):
    barcode: str


class SettingsIn(BaseModel):
    pg_host: str
    pg_port: int = 5432
    pg_database: str
    pg_username: str
    pg_password: str = ""
    source_table: str = "catalogo_origem"


class SettingsOut(SettingsIn):
    id: int

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    source: str
    detail: str = ""


class ImportedFileOut(BaseModel):
    id: str
    filename: str
    source: str
    records: int
    detail: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestOut(BaseModel):
    ok: bool
    message: str
    tables: list[str] = Field(default_factory=list)


class ExportResult(BaseModel):
    ok: bool
    registroproducao_id: int
    codigo: str
    items: int
    message: str
    unmatched: list[str] = Field(default_factory=list)


class DashboardTotals(BaseModel):
    productions: int = 0
    items: int = 0
    weight: float = 0
    value: float = 0


class DashboardDay(BaseModel):
    date: date
    productions: int = 0
    items: int = 0
    weight: float = 0
    value: float = 0


class DashboardStatus(BaseModel):
    status: str
    count: int = 0
    items: int = 0
    weight: float = 0
    value: float = 0


class DashboardTopProduct(BaseModel):
    product_code: str
    product_name: str
    items: int = 0
    weight: float = 0
    value: float = 0


class DashboardOut(BaseModel):
    days: int
    from_date: date
    to_date: date
    today: DashboardTotals
    yesterday: DashboardTotals
    period: DashboardTotals
    previous_period: DashboardTotals
    catalog_products: int = 0
    pending_export: int = 0
    deleted_count: int = 0
    open_production: ProductionOut | None = None
    series: list[DashboardDay] = Field(default_factory=list)
    by_status: list[DashboardStatus] = Field(default_factory=list)
    top_products: list[DashboardTopProduct] = Field(default_factory=list)
    recent: list[ProductionOut] = Field(default_factory=list)
