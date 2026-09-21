import React, { useEffect, useState } from "react";
import { api, todayISO } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function TransferStartDialog({ open, onOpenChange, onCreated }) {
  const { toast } = useToast();
  const [filiais, setFiliais] = useState([]);
  const [filialId, setFilialId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilialId("");
    setError("");
    setLoading(true);
    api
      .listFiliais()
      .then((data) => {
        setFiliais(data || []);
        if (!data?.length) setError("Nenhuma filial encontrada no Uniplus.");
      })
      .catch((err) => {
        setFiliais([]);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!filialId) return;
    const filial = filiais.find((item) => String(item.id) === String(filialId));
    setSaving(true);
    try {
      const created = await api.createTransfer({
        filial_id: Number(filialId),
        status: "em_andamento",
        request_date: todayISO(),
        label: filial ? `Transferência ${filial.name}` : undefined,
      });
      onOpenChange(false);
      onCreated(created);
    } catch (err) {
      toast({
        title: "Erro ao iniciar transferência",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Requisição de transferência</DialogTitle>
          <DialogDescription>
            Selecione a filial de destino e colete os produtos com o leitor, como na produção.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Filial</Label>
            <Select value={filialId || undefined} onValueChange={setFilialId} disabled={loading || saving}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando filiais…" : "Selecione a filial"} />
              </SelectTrigger>
              <SelectContent>
                {filiais.map((filial) => (
                  <SelectItem key={filial.id} value={String(filial.id)}>
                    {filial.code ? `${filial.code} · ${filial.name}` : filial.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || loading || !filialId}>
              {saving ? "Iniciando…" : "Iniciar coleta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
