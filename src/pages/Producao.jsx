import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { parseToledoBarcode, formatBRL, formatWeight } from "@/lib/toledo";
import { generateProductionPdf } from "@/lib/productionPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Trash2,
  ScanLine,
  ArrowLeft,
  Save,
  CheckCircle2,
  PackageSearch,
  AlertCircle,
  Weight,
  Receipt,
  FileText,
  Lock,
} from "lucide-react";

export default function Producao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [production, setProduction] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prod, its] = await Promise.all([
        base44.entities.Production.get(id),
        base44.entities.ProductionItem.filter({ production_id: id }, "-created_date", 1000),
      ]);
      setProduction(prod);
      setItems(its);
    } catch {
      toast({ title: "Produção não encontrada", variant: "destructive" });
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const readOnly = production?.status === "concluida" || production?.status === "excluida";
  const isDeleted = production?.status === "excluida";

  const totals = items.reduce(
    (acc, it) => {
      acc.weight += Number(it.weight_kg) || 0;
      acc.price += Number(it.total_price) || 0;
      return acc;
    },
    { weight: 0, price: 0 }
  );

  const syncTotals = async (newItems) => {
    const weight = newItems.reduce((s, it) => s + (Number(it.weight_kg) || 0), 0);
    const price = newItems.reduce((s, it) => s + (Number(it.total_price) || 0), 0);
    try {
      const updated = await base44.entities.Production.update(id, {
        total_weight: Math.round(weight * 1000) / 1000,
        total_price: Math.round(price * 100) / 100,
        item_count: newItems.length,
      });
      setProduction(updated);
    } catch {}
  };

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const handleScan = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    const code = barcode.trim();
    if (!code) return;
    const parsed = parseToledoBarcode(code);
    if (!parsed) {
      toast({
        title: "Etiqueta inválida",
        description: "Use o padrão 2CCCC0TTTTTT (C=código, T=quantidade em kg).",
        variant: "destructive",
      });
      setBarcode("");
      focusInput();
      return;
    }
    setProcessing(true);
    try {
      const products = await base44.entities.Product.filter(
        { code: parsed.productCode },
        "-created_date",
        1
      );
      let product = products && products[0];
      if (!product && parsed.productCodePadded !== parsed.productCode) {
        const padded = await base44.entities.Product.filter(
          { code: parsed.productCodePadded },
          "-created_date",
          1
        );
        product = padded && padded[0];
      }
      if (!product) {
        toast({
          title: "Produto não cadastrado",
          description: `Código ${parsed.productCode} não encontrado.`,
          variant: "destructive",
        });
        setBarcode("");
        focusInput();
        return;
      }
      const weightKg = parsed.weightKg;
      const unitPrice = Number(product.unit_price) || 0;
      const total = Math.round(weightKg * unitPrice * 100) / 100;
      const created = await base44.entities.ProductionItem.create({
        barcode: parsed.raw,
        product_code: product.code,
        product_name: product.name,
        weight_kg: weightKg,
        unit_price: unitPrice,
        total_price: total,
        production_id: id,
      });
      const newItems = [created, ...items];
      setItems(newItems);
      syncTotals(newItems);
      toast({
        title: "Produto adicionado",
        description: `${product.name} · ${formatWeight(weightKg)} · ${formatBRL(total)}`,
      });
    } catch {
      toast({ title: "Erro ao registrar", variant: "destructive" });
    } finally {
      setBarcode("");
      setProcessing(false);
      focusInput();
    }
  };

  const handleDelete = async (itemId) => {
    if (readOnly) return;
    try {
      await base44.entities.ProductionItem.delete(itemId);
      const newItems = items.filter((i) => i.id !== itemId);
      setItems(newItems);
      syncTotals(newItems);
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleSave = () => {
    toast({ title: "Produção salva", description: "Você pode continuar a coleta depois." });
    navigate("/");
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      const updated = await base44.entities.Production.update(id, { status: "concluida" });
      setProduction(updated);
      toast({ title: "Produção concluída" });
    } catch {
      toast({ title: "Erro ao concluir", variant: "destructive" });
    } finally {
      setFinishing(false);
    }
  };

  const handleExclude = async () => {
    if (!window.confirm("Excluir esta produção? O registro permanece em Produções excluídas.")) {
      return;
    }
    setDeleting(true);
    try {
      const updated = await base44.entities.Production.update(id, { status: "excluida" });
      setProduction(updated);
      toast({ title: "Produção excluída", description: "O registro foi mantido no histórico." });
      navigate("/");
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handlePdf = () => {
    if (items.length === 0) {
      toast({ title: "Lote vazio", description: "Adicione itens antes de exportar.", variant: "destructive" });
      return;
    }
    try {
      generateProductionPdf({ items, totals, production });
      toast({ title: "PDF gerado" });
    } catch {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl lg:text-2xl font-semibold tracking-tight truncate">
              {production?.label}
            </h1>
            {isDeleted ? (
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="w-3 h-3" />
                Excluída
              </Badge>
            ) : readOnly ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                Concluída
              </Badge>
            ) : (
              <Badge className="bg-primary hover:bg-primary text-primary-foreground gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Em andamento
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {production?.production_date
              ? new Date(production.production_date + "T00:00:00").toLocaleDateString("pt-BR")
              : ""}
          </p>
        </div>
      </div>

      {isDeleted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="w-4 h-4 shrink-0" />
            Produção excluída — o registro foi mantido no histórico. A coleta está bloqueada.
          </CardContent>
        </Card>
      )}
      {readOnly && !isDeleted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-primary">
            <Lock className="w-4 h-4 shrink-0" />
            Produção concluída — a coleta está bloqueada. Gere o PDF para o registro.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Scan panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className={readOnly ? "opacity-60" : "border-2 border-primary/10 shadow-sm"}>
            <CardContent className="p-6">
              <form onSubmit={handleScan} className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <ScanLine className="w-5 h-5" />
                  <span className="text-sm font-medium">Coleta de etiquetas</span>
                </div>
                <Input
                  ref={inputRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={readOnly ? "Produção concluída" : "Posicione o leitor ou digite…"}
                  className="h-14 text-lg font-mono tracking-widest"
                  autoComplete="off"
                  disabled={readOnly || processing}
                />
                <Button
                  type="submit"
                  className="w-full h-11 gap-2"
                  disabled={readOnly || processing || !barcode.trim()}
                >
                  <ScanLine className="w-4 h-4" />
                  {processing ? "Processando…" : "Adicionar à produção"}
                </Button>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Formato: 2CCCC0TTTTTT — C = código (4 dígitos), T = quantidade em kg (6 dígitos, 3 casas).
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  <Weight className="w-3.5 h-3.5" />
                  Peso total
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatWeight(totals.weight)}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm bg-primary text-primary-foreground">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">
                  <Receipt className="w-3.5 h-3.5" />
                  Valor total
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatBRL(totals.price)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handlePdf} variant="outline" className="gap-2 w-full">
              <FileText className="w-4 h-4" />
              Gerar PDF da produção
            </Button>
            {!readOnly ? (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleSave} variant="outline" className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
                <Button onClick={handleFinish} disabled={finishing} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {finishing ? "Concluindo…" : "Concluir"}
                </Button>
              </div>
            ) : (
              <Button onClick={() => navigate("/")} variant="outline" className="gap-2 w-full">
                <ArrowLeft className="w-4 h-4" />
                Voltar para produções
              </Button>
            )}
            {!isDeleted && (
              <Button
                onClick={handleExclude}
                disabled={deleting}
                variant="outline"
                className="gap-2 w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Excluindo…" : "Excluir produção"}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            “Salvar” mantém a produção em andamento para continuar depois.
          </p>
        </div>

        {/* List */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-2">
                  <PackageSearch className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Itens coletados</span>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>

              {items.length === 0 ? (
                <div className="px-5 py-20 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Nenhum item coletado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escaneie a primeira etiqueta para iniciar a coleta.
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {items.map((it) => (
                    <li key={it.id} className="px-5 py-4 flex items-center gap-4 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {it.product_name}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{it.product_code}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span>{formatWeight(it.weight_kg)}</span>
                          <span>× {formatBRL(it.unit_price)}/kg</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums text-sm">
                          {formatBRL(it.total_price)}
                        </div>
                      </div>
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(it.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {items.length > 0 && (
                <>
                  <Separator />
                  <div className="px-5 py-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total da produção</span>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">
                        {formatBRL(totals.price)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatWeight(totals.weight)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}