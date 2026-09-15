import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Save, Database, Server, Wifi, CloudDownload, Upload } from "lucide-react";

const defaults = {
  pg_host: "",
  pg_port: 5432,
  pg_database: "",
  pg_username: "",
  pg_password: "",
  source_table: "catalogo_origem",
};

export default function Configuracoes() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const fileRef = useRef(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.getSettings();
      setForm({
        pg_host: s.pg_host || "",
        pg_port: s.pg_port ?? 5432,
        pg_database: s.pg_database || "",
        pg_username: s.pg_username || "",
        pg_password: s.pg_password || "",
        source_table: s.source_table || "catalogo_origem",
      });
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payload = () => ({
    pg_host: form.pg_host.trim(),
    pg_port: Number(form.pg_port) || 5432,
    pg_database: form.pg_database.trim(),
    pg_username: form.pg_username.trim(),
    pg_password: form.pg_password,
    source_table: form.source_table.trim() || "catalogo_origem",
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.pg_host.trim()) {
      toast({ title: "Informe o IP/Host do PostgreSQL.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.saveSettings(payload());
      setStatus("Configurações salvas.");
      toast({ title: "Configurações salvas" });
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      await api.saveSettings(payload());
      const result = await api.testConnection();
      const tables = Array.isArray(result.tables) ? result.tables.join(", ") : "";
      setStatus(`${result.message || "Conexão OK."}${tables ? `\nTabelas: ${tables}` : ""}`);
      toast({ title: "Conexão testada" });
    } catch (err) {
      setStatus(err.message);
      toast({ title: "Falha na conexão", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleImportPg = async () => {
    setBusy(true);
    try {
      await api.saveSettings(payload());
      const result = await api.importFromPostgres(form.source_table.trim());
      setStatus(
        `Importação PostgreSQL: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados.`
      );
      toast({ title: "Catálogo importado" });
    } catch (err) {
      setStatus(err.message);
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const result = await api.importFile(file);
      setStatus(
        `Arquivo ${file.name}: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados.`
      );
      toast({ title: "Arquivo importado" });
    } catch (err) {
      setStatus(err.message);
      toast({ title: "Erro ao importar arquivo", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conexão PostgreSQL usada na importação do catálogo e no envio das produções (Uniplus).
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base">PostgreSQL (catálogo e envio da produção)</CardTitle>
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

              <div className="space-y-2">
                <Label htmlFor="source_table">Tabela de origem</Label>
                <Input
                  id="source_table"
                  value={form.source_table}
                  onChange={(e) => setForm({ ...form, source_table: e.target.value })}
                  placeholder="catalogo_origem"
                  className="font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={handleTest} className="gap-2">
                  <Wifi className="w-4 h-4" />
                  Testar conexão
                </Button>
                <Button type="button" disabled={busy} onClick={handleImportPg} className="gap-2">
                  <CloudDownload className="w-4 h-4" />
                  Importar do PostgreSQL
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  Importar CSV/JSON
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {status && (
        <Card className="shadow-sm">
          <CardContent className="p-4 text-sm whitespace-pre-wrap">{status}</CardContent>
        </Card>
      )}
    </div>
  );
}
