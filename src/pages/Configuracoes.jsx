import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Save, Database, Server } from "lucide-react";

const defaults = {
  pg_host: "",
  pg_port: 5432,
  pg_database: "",
  pg_username: "",
  pg_password: "",
};

export default function Configuracoes() {
  const [settingsId, setSettingsId] = useState(null);
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Settings.list("-created_date", 1);
      const s = list && list[0];
      if (s) {
        setSettingsId(s.id);
        setForm({
          pg_host: s.pg_host || "",
          pg_port: s.pg_port ?? 5432,
          pg_database: s.pg_database || "",
          pg_username: s.pg_username || "",
          pg_password: s.pg_password || "",
        });
      }
    } catch {
      // sem registros ainda
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.pg_host.trim()) {
      toast({ title: "Informe o IP/Host do PostgreSQL.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      pg_host: form.pg_host.trim(),
      pg_port: Number(form.pg_port) || 5432,
      pg_database: form.pg_database.trim(),
      pg_username: form.pg_username.trim(),
      pg_password: form.pg_password,
    };
    try {
      if (settingsId) {
        await base44.entities.Settings.update(settingsId, payload);
      } else {
        const created = await base44.entities.Settings.create(payload);
        setSettingsId(created.id);
      }
      toast({ title: "Configurações salvas" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parâmetros de comunicação com o banco de dados PostgreSQL.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base">Conexão PostgreSQL</CardTitle>
              <CardDescription>Informe o endereço do servidor de banco de dados.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="pg_host">Host / IP</Label>
                  <div className="relative">
                    <Server className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pg_host"
                      value={form.pg_host}
                      onChange={(e) => setForm({ ...form, pg_host: e.target.value })}
                      placeholder="192.168.0.10"
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pg_port">Porta</Label>
                  <Input
                    id="pg_port"
                    type="number"
                    value={form.pg_port}
                    onChange={(e) => setForm({ ...form, pg_port: e.target.value })}
                    placeholder="5432"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pg_database">Banco de dados</Label>
                <Input
                  id="pg_database"
                  value={form.pg_database}
                  onChange={(e) => setForm({ ...form, pg_database: e.target.value })}
                  placeholder="producao"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pg_username">Usuário</Label>
                  <Input
                    id="pg_username"
                    value={form.pg_username}
                    onChange={(e) => setForm({ ...form, pg_username: e.target.value })}
                    placeholder="postgres"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pg_password">Senha</Label>
                  <Input
                    id="pg_password"
                    type="password"
                    value={form.pg_password}
                    onChange={(e) => setForm({ ...form, pg_password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando…" : "Salvar configurações"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}