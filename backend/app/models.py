import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit_price: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Production(Base):
    __tablename__ = "productions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    label: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="em_andamento")
    production_date: Mapped[date] = mapped_column(Date, default=date.today)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    total_weight: Mapped[float] = mapped_column(Float, default=0)
    total_price: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    exported_pg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    items: Mapped[list["ProductionItem"]] = relationship(
        back_populates="production", cascade="all, delete-orphan"
    )


class ProductionItem(Base):
    __tablename__ = "production_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    barcode: Mapped[str] = mapped_column(String(32))
    product_code: Mapped[str] = mapped_column(String(20))
    product_name: Mapped[str] = mapped_column(String(255))
    weight_kg: Mapped[float] = mapped_column(Float)
    unit_price: Mapped[float] = mapped_column(Float)
    total_price: Mapped[float] = mapped_column(Float)
    production_id: Mapped[str] = mapped_column(String(36), ForeignKey("productions.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    production: Mapped[Production] = relationship(back_populates="items")


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    pg_host: Mapped[str] = mapped_column(String(255), default="192.168.2.26")
    pg_port: Mapped[int] = mapped_column(Integer, default=5432)
    pg_database: Mapped[str] = mapped_column(String(128), default="unico")
    pg_username: Mapped[str] = mapped_column(String(128), default="postgres")
    pg_password: Mapped[str] = mapped_column(String(255), default="postgres")
    source_table: Mapped[str] = mapped_column(String(128), default="catalogo_origem")


class ImportedFile(Base):
    __tablename__ = "imported_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    filename: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(64))
    records: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
