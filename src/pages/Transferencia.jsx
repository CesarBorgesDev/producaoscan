import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatBRL, formatWeight } from "@/lib/toledo";
import { api, isDeleted, isExported, isOpen, statusLabel } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Lock,
  PackageSearch,
  Receipt,
  Save,
  ScanLine,
  Trash2,
  Weight,
} from "lucide-react";

export default function Transferencia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transfer, setTransfer] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [row, collected] = await Promise.all([
        api.getTransfer(id),
        api.listTransferItems(id),
      ]);
      setTransfer(row);
      setItems(collected);
    } catch (err) {
      toast({
        title: "Requisição não encontrada",
        description: err.message,
        variant: "destructive",
      });
      navigate("/transferencias");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const deleted = isDeleted(transfer);
  const exported = isExported(transfer);
  const readOnly = !transfer || !isOpen(transfer) || exported;

  const totals = items.reduce(
    (acc, item) => {
      acc.weight += Number(item.weight_kg) || 0;
      acc.price += Number(item.total_price) || 0;
      return acc;
    },
    { weight: 0, price: 0 }
  );

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const refreshTransfer = async () => {
    setTransfer(await api.getTransfer(id));
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    const code = barcode.trim();
    if (!code) return;
    setProcessing(true);
    try {
      const created = await api.scanTransfer(id, code);
      setItems((prev) => [created, ...prev]);
      await refreshTransfer();
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
      await api.deleteTransferItem(id, itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      await refreshTransfer();
    } catch (err) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const persistStatus = async (status) => {
    if (!transfer) return;
    return api.updateTransfer(id, {
      filial_id: transfer.filial_id,
      label: transfer.label,
      status,
      request_date: transfer.request_date,
    });
  };

  const handleSave = () => {
    toast({ title: "Requisição salva", description: "Você pode continuar a coleta depois." });
    navigate("/transferencias");
  };

  const handleFinish = async () => {
    setBusy(true);
    try {
      setTransfer(await persistStatus("concluida"));
      toast({ title: "Requisição concluída" });
    } catch (err) {
      toast({ title: "Erro ao concluir", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleExclude = async () => {
    if (!window.confirm("A requisição sai da coleta ativa, mas permanece no histórico de excluídas.")) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteTransfer(id);
      toast({ title: "Requisição movida para excluídas" });
      navigate("/transferencias");
    } catch (err) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (
      !window.confirm(
        "A requisição será gravada no Uniplus (requisicaotransferencia) e não poderá mais ser alterada nem excluída."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await api.exportTransfer(id);
      await refreshTransfer();
      toast({ title: result.message || "Requisição enviada ao Uniplus" });
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/transferencias")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight lg:text-2xl">
              {transfer?.filial_name}
            </h1>
            {deleted ? (
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="h-3 w-3" />
                Excluída
              </Badge>
            ) : exported ? (
              <Badge className="gap-1 bg-sky-600 hover:bg-sky-600">
                <Cloud className="h-3 w-3" />
                Uniplus
              </Badge>
            ) : readOnly ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                {statusLabel(transfer?.status)}
              </Badge>
            ) : (
              <Badge className="gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Em andamento
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {transfer?.filial_code ? `Filial ${transfer.filial_code} · ` : "Filial de destino · "}
            {transfer?.request_date
              ? new Date(`${transfer.request_date}T00:00:00`).toLocaleDateString("pt-BR")
              : ""}
          </p>
        </div>
      </div>

      {deleted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <Trash2 className="h-4 w-4 shrink-0" />
            Requisição excluída — a coleta está bloqueada.
          </CardContent>
        </Card>
      )}
      {exported && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-primary">
            <Cloud className="h-4 w-4 shrink-0" />
            Enviada ao Uniplus — esta requisição está bloqueada. Não é possível alterar nem excluir.
          </CardContent>
        </Card>
      )}
      {readOnly && !deleted && !exported && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-primary">
            <Lock className="h-4 w-4 shrink-0" />
            Requisição concluída — a coleta está bloqueada.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card className={readOnly ? "opacity-60" : "border-2 border-primary/10 shadow-sm"}>
            <CardContent className="p-6">
              <form onSubmit={handleScan} className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <ScanLine className="h-5 w-5" />
                  <span className="text-sm font-medium">Coleta de etiquetas</span>
                </div>
                <Input
                  ref={inputRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={readOnly ? statusLabel(transfer?.status) : "Posicione o leitor ou digite…"}
                  className="h-14 font-mono text-lg tracking-widest"
                  autoComplete="off"
                  disabled={readOnly || processing}
                />
                <Button
                  type="submit"
                  className="h-11 w-full gap-2"
                  disabled={readOnly || processing || !barcode.trim()}
                >
                  <ScanLine className="h-4 w-4" />
                  {processing ? "Processando…" : "Adicionar à transferência"}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Formato: 2CCCC0TTTTTT — C = código (4 dígitos), T = quantidade em kg (6 dígitos, 3 casas).
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Weight className="h-3.5 w-3.5" />
                  Peso total
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{formatWeight(totals.weight)}</div>
              </CardContent>
            </Card>
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                  <Receipt className="h-3.5 w-3.5" />
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
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
                <Button onClick={handleFinish} disabled={busy} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {busy ? "Concluindo…" : "Concluir"}
                </Button>
              </div>
            )}
            {!exported && !deleted && (
              <>
                <Button onClick={handleExport} disabled={busy} variant="outline" className="w-full gap-2">
                  <CloudUpload className="h-4 w-4" />
                  Exportar para Sistema Uniplus
                </Button>
                <Button
                  onClick={handleExclude}
                  disabled={busy}
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir requisição
                </Button>
              </>
            )}
            {readOnly && (
              <Button onClick={() => navigate("/transferencias")} variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar para transferências
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Itens coletados</span>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>

              {items.length === 0 ? (
                <div className="px-5 py-20 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Nenhum item coletado</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escaneie a primeira etiqueta para montar a transferência para{" "}
                    {transfer?.filial_name || "a filial"}.
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={item.id} className="group flex items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{item.product_name}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{item.product_code}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span>{formatWeight(item.weight_kg)}</span>
                          <span>× {formatBRL(item.unit_price)}/kg</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatBRL(item.total_price)}</div>
                      </div>
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {items.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-sm text-muted-foreground">Total da transferência</span>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{formatBRL(totals.price)}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">
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
