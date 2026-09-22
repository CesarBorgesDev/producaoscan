import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatBRL, formatWeight } from "@/lib/toledo";
import { api, isDeleted, isOpen, statusLabel } from "@/lib/apiClient";
import CollectEntryCard from "@/components/CollectEntryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  PackageSearch,
  Receipt,
  Save,
  Trash2,
  Weight,
} from "lucide-react";

export default function Perda() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loss, setLoss] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [row, collected] = await Promise.all([api.getLoss(id), api.listLossItems(id)]);
      setLoss(row);
      setItems(collected);
    } catch (err) {
      toast({ title: "Perda não encontrada", description: err.message, variant: "destructive" });
      navigate("/perdas");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const deleted = isDeleted(loss);
  const readOnly = !loss || !isOpen(loss);

  const totals = items.reduce(
    (acc, item) => {
      acc.weight += Number(item.weight_kg) || 0;
      acc.price += Number(item.total_price) || 0;
      return acc;
    },
    { weight: 0, price: 0 }
  );

  const refreshLoss = async () => {
    setLoss(await api.getLoss(id));
  };

  const handleScan = async (code) => {
    if (readOnly) return false;
    setProcessing(true);
    try {
      const created = await api.scanLoss(id, code);
      setItems((prev) => [created, ...prev]);
      await refreshLoss();
      toast({
        title: "Perda registrada",
        description: `${created.product_name} · ${formatWeight(created.weight_kg)} · ${formatBRL(created.total_price)}`,
      });
      return true;
    } catch (err) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleManual = async (payload) => {
    if (readOnly) return false;
    setProcessing(true);
    try {
      const created = await api.addLossItem(id, payload);
      setItems((prev) => [created, ...prev]);
      await refreshLoss();
      toast({
        title: "Perda registrada",
        description: `${created.product_name} · ${formatWeight(created.weight_kg)} · ${formatBRL(created.total_price)}`,
      });
      return true;
    } catch (err) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (readOnly) return;
    try {
      await api.deleteLossItem(id, itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      await refreshLoss();
    } catch (err) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = () => {
    toast({ title: "Perda salva", description: "Você pode continuar a coleta depois." });
    navigate("/perdas");
  };

  const handleFinish = async () => {
    if (!loss) return;
    setBusy(true);
    try {
      setLoss(
        await api.updateLoss(id, {
          label: loss.label,
          status: "concluida",
          loss_date: loss.loss_date,
        })
      );
      toast({ title: "Perda concluída", description: "Registro mantido apenas no aplicativo." });
    } catch (err) {
      toast({ title: "Erro ao concluir", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleExclude = async () => {
    if (!window.confirm("A perda sai da coleta ativa, mas permanece no histórico de excluídas.")) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteLoss(id);
      toast({ title: "Perda movida para excluídas" });
      navigate("/perdas");
    } catch (err) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/perdas")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight lg:text-2xl">
              {loss?.label}
            </h1>
            {deleted ? (
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="h-3 w-3" />
                Excluída
              </Badge>
            ) : readOnly ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                {statusLabel(loss?.status)}
              </Badge>
            ) : (
              <Badge className="gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Em andamento
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Somente neste aplicativo ·{" "}
            {loss?.loss_date ? new Date(`${loss.loss_date}T00:00:00`).toLocaleDateString("pt-BR") : ""}
          </p>
        </div>
      </div>

      {deleted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <Trash2 className="h-4 w-4 shrink-0" />
            Perda excluída — o registro foi mantido no histórico. A coleta está bloqueada.
          </CardContent>
        </Card>
      )}
      {readOnly && !deleted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-primary">
            <Lock className="h-4 w-4 shrink-0" />
            Perda concluída — a coleta está bloqueada. Este registro não é enviado ao Uniplus.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <CollectEntryCard
            readOnly={readOnly}
            statusText={statusLabel(loss?.status)}
            processing={processing}
            submitScanLabel="Adicionar à perda"
            submitManualLabel="Adicionar à perda"
            onScan={handleScan}
            onManual={handleManual}
          />

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
            {!deleted && (
              <Button
                onClick={handleExclude}
                disabled={busy}
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Excluir perda
              </Button>
            )}
            {readOnly && (
              <Button onClick={() => navigate("/perdas")} variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar para perdas
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
                  <span className="text-sm font-medium">Itens da perda</span>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>

              {items.length === 0 ? (
                <div className="px-5 py-20 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Nenhum item registrado</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escaneie a etiqueta ou digite o código e o peso da perda.
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
                    <span className="text-sm text-muted-foreground">Total da perda</span>
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
