import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { formatBRL, formatWeight } from "@/lib/toledo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Play,
  ArrowRight,
  ClipboardList,
  Weight,
  Receipt,
  Package,
  CheckCircle2,
  Trash2,
} from "lucide-react";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}
function todayLabel() {
  return new Date().toLocaleDateString("pt-BR");
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
}

export default function Home() {
  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Production.list("-created_date", 200);
      setProductions(data);
    } catch {
      setProductions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = base44.entities.Production.subscribe((event) => {
      if (event.type === "create") setProductions((prev) => [event.data, ...prev]);
      if (event.type === "update")
        setProductions((prev) =>
          prev.map((p) => (p.id === event.data.id ? event.data : p))
        );
      if (event.type === "delete")
        setProductions((prev) => prev.filter((p) => p.id !== event.data.id));
    });
    return unsub;
  }, []);

  const openProduction = productions.find((p) => p.status === "em_andamento");
  const activeProductions = productions.filter((p) => p.status !== "excluida");
  const deletedProductions = productions.filter((p) => p.status === "excluida");

  const handleStart = async () => {
    if (openProduction) {
      navigate(`/producao/${openProduction.id}`);
      return;
    }
    setCreating(true);
    try {
      const created = await base44.entities.Production.create({
        label: `Produção ${todayLabel()}`,
        status: "em_andamento",
        production_date: todayISO(),
        item_count: 0,
        total_weight: 0,
        total_price: 0,
      });
      navigate(`/producao/${created.id}`);
    } catch {
      toast({ title: "Erro ao iniciar produção", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">
            Produções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inicie a produção do dia, colete as etiquetas e conclua quando finalizar.
          </p>
        </div>
        <Button onClick={handleStart} disabled={creating} className="gap-2">
          {openProduction ? (
            <>
              <Play className="w-4 h-4" />
              Continuar produção
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {creating ? "Iniciando…" : "Iniciar produção do dia"}
            </>
          )}
        </Button>
      </div>

      {openProduction && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <Play className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium">{openProduction.label}</div>
                <div className="text-xs text-muted-foreground">
                  Produção em andamento · {openProduction.item_count || 0} itens
                </div>
              </div>
            </div>
            <Button onClick={() => navigate(`/producao/${openProduction.id}`)} className="gap-2">
              Retomar coleta
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ClipboardList className="w-4 h-4" />
        Histórico de produções
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : activeProductions.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhuma produção registrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inicie a primeira produção do dia para começar a coletar etiquetas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeProductions.map((p) => {
            const open = p.status === "em_andamento";
            return (
              <Card
                key={p.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/producao/${p.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(p.production_date)}
                      </div>
                    </div>
                    {open ? (
                      <Badge className="bg-primary hover:bg-primary text-primary-foreground gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Em andamento
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Concluída
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                        <Package className="w-3 h-3" />
                        Itens
                      </div>
                      <div className="font-medium tabular-nums">{p.item_count || 0}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                        <Weight className="w-3 h-3" />
                        Peso
                      </div>
                      <div className="font-medium tabular-nums">
                        {formatWeight(p.total_weight)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                        <Receipt className="w-3 h-3" />
                        Valor
                      </div>
                      <div className="font-medium tabular-nums">
                        {formatBRL(p.total_price)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {deletedProductions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trash2 className="w-4 h-4" />
            Produções excluídas
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deletedProductions.map((p) => (
              <Card
                key={p.id}
                className="shadow-sm cursor-pointer border-destructive/20 bg-destructive/5"
                onClick={() => navigate(`/producao/${p.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(p.production_date)}
                      </div>
                    </div>
                    <Badge variant="destructive" className="gap-1">
                      <Trash2 className="w-3 h-3" />
                      Excluída
                    </Badge>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    {p.item_count || 0} itens · {formatWeight(p.total_weight)} · {formatBRL(p.total_price)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}