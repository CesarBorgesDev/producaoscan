import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL, formatWeight } from "@/lib/toledo";
import {
  api,
  formatDate,
  todayISO,
  todayLabel,
  isExported,
  isOpen,
  statusLabel,
} from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowRight,
  Cloud,
  LayoutDashboard,
  Play,
  Plus,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 14, label: "14 dias" },
  { days: 30, label: "30 dias" },
];

const STATUS_STYLE = {
  em_andamento: "bg-primary text-primary-foreground",
  concluida: "bg-emerald-600 text-white",
  enviada: "bg-sky-600 text-white",
};

function emptyTotals() {
  return { productions: 0, items: 0, weight: 0, value: 0 };
}

function changePct(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / before) * 100;
}

function Delta({ value }) {
  if (value == null || Number.isNaN(value)) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const weight = payload.find((item) => item.dataKey === "weight")?.value ?? 0;
  const value = payload.find((item) => item.dataKey === "value")?.value ?? 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-slate-900">{label}</div>
      <div className="space-y-0.5 text-slate-600">
        <div className="flex justify-between gap-6">
          <span>Peso</span>
          <span className="tabular-nums font-medium text-slate-900">{formatWeight(weight)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Valor</span>
          <span className="tabular-nums font-medium text-slate-900">{formatBRL(value)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getDashboard(days, todayISO()));
    } catch (err) {
      setData(null);
      toast({ title: "Erro ao carregar dashboard", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const today = data?.today || emptyTotals();
  const yesterday = data?.yesterday || emptyTotals();
  const period = data?.period || emptyTotals();
  const previous = data?.previous_period || emptyTotals();
  const openProduction = data?.open_production;
  const topProducts = data?.top_products || [];
  const recent = data?.recent || [];
  const byStatus = data?.by_status || [];
  const maxProductValue = Math.max(...topProducts.map((item) => Number(item.value) || 0), 1);

  const chartData = useMemo(
    () =>
      (data?.series || []).map((row) => ({
        ...row,
        label: formatDate(row.date).slice(0, 5),
      })),
    [data]
  );

  const handleStart = async () => {
    if (openProduction) {
      navigate(`/producao/${openProduction.id}`);
      return;
    }
    setCreating(true);
    try {
      const created = await api.createProduction({
        label: `Produção ${todayLabel()}`,
        status: "em_andamento",
        production_date: todayISO(),
      });
      navigate(`/producao/${created.id}`);
    } catch (err) {
      toast({ title: "Erro ao iniciar produção", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Visão geral
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight lg:text-3xl">
            Dashboard de produção
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peso, valor e itens coletados {data ? `de ${formatDate(data.from_date)} a ${formatDate(data.to_date)}` : "no período"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-slate-100 p-1">
            {PERIODS.map((item) => (
              <Button
                key={item.days}
                size="sm"
                variant={days === item.days ? "default" : "ghost"}
                className="h-8 rounded-full px-3"
                onClick={() => setDays(item.days)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Button onClick={handleStart} disabled={creating} className="gap-2">
            {openProduction ? (
              <>
                <Play className="h-4 w-4" />
                Continuar produção
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {creating ? "Iniciando…" : "Iniciar produção"}
              </>
            )}
          </Button>
        </div>
      </div>

      {openProduction && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">{openProduction.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Em andamento · {openProduction.item_count || 0} itens · {formatWeight(openProduction.total_weight)} · {formatBRL(openProduction.total_price)}
              </div>
            </div>
            <Button onClick={() => navigate(`/producao/${openProduction.id}`)} className="gap-2">
              Retomar coleta
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Hoje"
          icon={Scale}
          value={formatWeight(today.weight)}
          hint={`${today.items} itens · ${formatBRL(today.value)}`}
          delta={changePct(today.weight, yesterday.weight)}
          deltaLabel="vs ontem"
        />
        <KpiCard
          title="Peso no período"
          icon={Weight}
          value={formatWeight(period.weight)}
          hint={`${period.productions} produções`}
          delta={changePct(period.weight, previous.weight)}
          deltaLabel="vs período anterior"
        />
        <KpiCard
          title="Valor no período"
          icon={Receipt}
          value={formatBRL(period.value)}
          hint={`${period.items} itens coletados`}
          delta={changePct(period.value, previous.value)}
          deltaLabel="vs período anterior"
        />
        <KpiCard
          title="A enviar ao Uniplus"
          icon={Cloud}
          value={String(data?.pending_export ?? 0)}
          hint={`${data?.catalog_products ?? 0} produtos no catálogo`}
          extra={`${data?.deleted_count ?? 0} excluídas`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="shadow-sm xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução diária</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Carregando…
              </div>
            ) : chartData.every((row) => !row.weight && !row.value) ? (
              <div className="flex h-[280px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium">Sem coleta no período</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inicie uma produção para ver peso e valor por dia.
                </p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(212 80% 42%)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="hsl(212 80% 42%)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160 70% 36%)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="hsl(160 70% 36%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      yAxisId="weight"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                      width={36}
                    />
                    <YAxis
                      yAxisId="value"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value) =>
                        Number(value).toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })
                      }
                      width={40}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      yAxisId="weight"
                      type="monotone"
                      dataKey="weight"
                      name="Peso"
                      stroke="hsl(212 80% 42%)"
                      fill="url(#fillWeight)"
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="value"
                      type="monotone"
                      dataKey="value"
                      name="Valor"
                      stroke="hsl(160 70% 36%)"
                      fill="url(#fillValue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(212,80%,42%)]" />
                Peso (kg)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(160,70%,36%)]" />
                Valor (R$)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status no período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : byStatus.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma produção no período.</p>
            ) : (
              byStatus.map((row) => (
                <div key={row.status} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={STATUS_STYLE[row.status] || "bg-slate-600 text-white"}>
                      {statusLabel(row.status)}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">{row.count}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{row.items} itens</span>
                    <span className="text-right">{formatWeight(row.weight)}</span>
                    <span className="col-span-2 font-medium text-slate-800">{formatBRL(row.value)}</span>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Ver todas as produções
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produtos mais produzidos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum item coletado no período.
              </p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((item) => (
                  <div key={item.product_code}>
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.product_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Cód. {item.product_code} · {item.items} itens · {formatWeight(item.weight)}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(item.value)}</div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(6, (Number(item.value) / maxProductValue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produções recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma produção registrada.</p>
            ) : (
              recent.map((production) => (
                <button
                  key={production.id}
                  type="button"
                  onClick={() => navigate(`/producao/${production.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{production.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(production.production_date)} · {production.item_count || 0} itens · {formatWeight(production.total_weight)}
                    </div>
                  </div>
                  {isExported(production) ? (
                    <Badge className="bg-sky-600 hover:bg-sky-600">Uniplus</Badge>
                  ) : isOpen(production) ? (
                    <Badge>Em andamento</Badge>
                  ) : (
                    <Badge variant="secondary">{statusLabel(production.status)}</Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, icon: Icon, value, hint, delta, deltaLabel, extra }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{hint}</span>
          {delta != null && (
            <>
              <Delta value={delta} />
              <span>{deltaLabel}</span>
            </>
          )}
          {extra && <span>· {extra}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
