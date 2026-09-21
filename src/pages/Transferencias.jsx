import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatBRL, formatWeight } from "@/lib/toledo";
import {
  api,
  formatDate,
  isDeleted,
  isExported,
  isOpen,
  statusLabel,
} from "@/lib/apiClient";
import TransferStartDialog from "@/components/TransferStartDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Package,
  Play,
  Plus,
  Receipt,
  Trash2,
  Weight,
} from "lucide-react";

const TABS = [
  { id: "active", label: "Abertas" },
  { id: "done", label: "Concluídas" },
  { id: "sent", label: "Uniplus" },
  { id: "deleted", label: "Excluídas" },
];

export default function Transferencias() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTransfers(await api.listTransfers(true));
    } catch (err) {
      setTransfers([]);
      toast({
        title: "Erro ao carregar transferências",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openTransfers = transfers.filter((item) => isOpen(item));
  const doneTransfers = transfers.filter((item) => item.status === "concluida" && !isExported(item));
  const sentTransfers = transfers.filter((item) => isExported(item) && !isDeleted(item));
  const deletedTransfers = transfers.filter((item) => isDeleted(item));
  const list =
    tab === "deleted"
      ? deletedTransfers
      : tab === "done"
        ? doneTransfers
        : tab === "sent"
          ? sentTransfers
          : openTransfers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight lg:text-3xl">
            Transferências
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione a filial e colete as etiquetas com peso e quantidade, como na produção.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova requisição
        </Button>
      </div>

      {openTransfers.length > 0 && tab === "active" && (
        <div className="space-y-3">
          {openTransfers.map((item) => (
            <Card key={item.id} className="border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <ArrowLeftRight className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{item.filial_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Em andamento · {item.item_count || 0} itens · {formatWeight(item.total_weight)}
                    </div>
                  </div>
                </div>
                <Button onClick={() => navigate(`/transferencia/${item.id}`)} className="gap-2">
                  Retomar coleta
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : list.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {tab === "deleted"
                ? "Nenhuma requisição excluída"
                : tab === "done"
                  ? "Nenhuma requisição concluída"
                  : tab === "sent"
                    ? "Nenhuma requisição enviada"
                    : "Nenhuma requisição aberta"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tab === "active"
                ? "Crie uma requisição, escolha a filial e comece a coletar as etiquetas."
                : tab === "sent"
                  ? "Quando a requisição for exportada para o Uniplus, o registro aparece aqui."
                  : "Os registros desta aba aparecem depois de concluir ou excluir uma requisição."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => {
            const open = isOpen(item);
            const deleted = isDeleted(item);
            const exported = isExported(item);
            return (
              <Card
                key={item.id}
                className={`cursor-pointer shadow-sm transition-shadow hover:shadow-md ${
                  deleted
                    ? "border-destructive/20 bg-destructive/5"
                    : exported
                      ? "border-primary/20 bg-primary/5"
                      : ""
                }`}
                onClick={() => navigate(`/transferencia/${item.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.filial_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.filial_code ? `${item.filial_code} · ` : ""}
                        {formatDate(item.request_date)}
                      </div>
                    </div>
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
                    ) : open ? (
                      <Badge className="gap-1">
                        <Play className="h-3 w-3" />
                        Em andamento
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {statusLabel(item.status)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Package className="h-3 w-3" />
                        Itens
                      </div>
                      <div className="font-medium tabular-nums">{item.item_count || 0}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Weight className="h-3 w-3" />
                        Peso
                      </div>
                      <div className="font-medium tabular-nums">{formatWeight(item.total_weight)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Receipt className="h-3 w-3" />
                        Valor
                      </div>
                      <div className="font-medium tabular-nums">{formatBRL(item.total_price)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TransferStartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(created) => navigate(`/transferencia/${created.id}`)}
      />
    </div>
  );
}
