import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatBRL, formatWeight } from "@/lib/toledo";
import { api, isExported, isDeleted, isOpen, statusLabel } from "@/lib/apiClient";
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
  CloudUpload,
  Cloud,
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
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prod, its] = await Promise.all([api.getProduction(id), api.listItems(id)]);
      setProduction(prod);
      setItems(its);
    } catch (err) {
      toast({ title: "Produção não encontrada", description: err.message, variant: "destructive" });
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

  const exported = isExported(production);
  const deleted = isDeleted(production);
  const readOnly = !production || !isOpen(production) || exported;

  const totals = items.reduce(
    (acc, it) => {
      acc.weight += Number(it.weight_kg) || 0;
      acc.price += Number(it.total_price) || 0;
      return acc;
    },
    { weight: 0, price: 0 }
  );

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const refreshProduction = async () => {
    const updated = await api.getProduction(id);
    setProduction(updated);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    const code = barcode.trim();
    if (!code) return;
    setProcessing(true);
    try {
      const created = await api.scan(id, code);
      setItems((prev) => [created, ...prev]);
      await refreshProduction();
      toast({
        title: "Produto adicionado",
        description: `${created.product_name} · ${formatWeight(created.weight_kg)} · ${formatBRL(created.total_price)}`,
      });
    } catch (err) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
    } finally {
      setBarcode("");
      setProcessing(false);
      focusInput();
    }
  };

  const handleDelete = async (itemId) => {
    if (readOnly) return;
    try {
      await api.deleteItem(id, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await refreshProduction();
    } catch (err) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = () => {
    toast({ title: "Produção salva", description: "Você pode continuar a coleta depois." });
    navigate("/");
  };

  const handleFinish = async () => {
    if (!production) return;
    setBusy(true);
    try {
      const updated = await api.updateProduction(id, {
        label: production.label,
        status: "concluida",
        production_date: production.production_date,
      });
      setProduction(updated);
      toast({ title: "Produção concluída" });
    } catch (err) {
      toast({ title: "Erro ao concluir", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleExclude = async () => {
    if (!window.confirm("A produção sai da coleta ativa, mas permanece no histórico de produções excluídas.")) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteProduction(id);
      toast({ title: "Produção movida para excluídas" });
      navigate("/");
    } catch (err) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    setBusy(true);
    try {
      await api.downloadProductionPdf(id, production?.label);
      toast({ title: "PDF gerado" });
    } catch (err) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (
      !window.confirm(
        "A produção será gravada no Uniplus e não poderá mais ser alterada nem excluída."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await api.exportProduction(id);
      await refreshProduction();
      toast({ title: result.message || "Produção enviada ao Uniplus" });
    } catch (err) {
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
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
            {deleted ? (
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="w-3 h-3" />
                Excluída
              </Badge>
            ) : exported ? (
              <Badge className="gap-1 bg-sky-600 hover:bg-sky-600">
                <Cloud className="w-3 h-3" />
                Uniplus
              </Badge>
            ) : readOnly ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                {statusLabel(production?.status)}
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
              ? new Date(`${production.production_date}T00:00:00`).toLocaleDateString("pt-BR")
              : ""}
          </p>
        </div>
      </div>

      {deleted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="w-4 h-4 shrink-0" />
            Produção excluída — o registro foi mantido no histórico. A coleta está bloqueada.
          </CardContent>
        </Card>
      )}
      {exported && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-primary">
            <Cloud className="w-4 h-4 shrink-0" />
            Enviada ao Uniplus — esta produção está bloqueada. Não é possível alterar nem excluir.
          </CardContent>
        </Card>
      )}
      {readOnly && !deleted && !exported && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-primary">
            <Lock className="w-4 h-4 shrink-0" />
            Produção concluída — a coleta está bloqueada. Gere o PDF para o registro.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                  placeholder={readOnly ? statusLabel(production?.status) : "Posicione o leitor ou digite…"}
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
                <div className="mt-2 text-2xl font-semibold tabular-nums">{formatWeight(totals.weight)}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm bg-primary text-primary-foreground">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">
                  <Receipt className="w-3.5 h-3.5" />
                  Valor total
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{formatBRL(totals.price)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            {!readOnly && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleSave} variant="outline" className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
                <Button onClick={handleFinish} disabled={busy} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {busy ? "Concluindo…" : "Concluir"}
                </Button>
              </div>
            )}
            <Button onClick={handlePdf} disabled={busy} variant="outline" className="gap-2 w-full">
              <FileText className="w-4 h-4" />
              Gerar PDF da produção
            </Button>
            {!exported && !deleted && (
              <>
                <Button onClick={handleExport} disabled={busy} variant="outline" className="gap-2 w-full">
                  <CloudUpload className="w-4 h-4" />
                  Exportar para Sistema Uniplus
                </Button>
                <Button
                  onClick={handleExclude}
                  disabled={busy}
                  variant="outline"
                  className="gap-2 w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir produção
                </Button>
              </>
            )}
            {readOnly && (
              <Button onClick={() => navigate("/")} variant="outline" className="gap-2 w-full">
                <ArrowLeft className="w-4 h-4" />
                Voltar para produções
              </Button>
            )}
          </div>
        </div>

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
                          <span className="font-medium text-sm truncate">{it.product_name}</span>
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
                        <div className="font-semibold tabular-nums text-sm">{formatBRL(it.total_price)}</div>
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
                      <div className="text-lg font-semibold tabular-nums">{formatBRL(totals.price)}</div>
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
