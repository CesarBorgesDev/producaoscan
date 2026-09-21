import React, { useEffect, useRef, useState } from "react";
import { Keyboard, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { parseWeightKg } from "@/lib/toledo";
import { cn } from "@/lib/utils";

export default function CollectEntryCard({
  readOnly,
  statusText,
  processing,
  submitScanLabel,
  submitManualLabel,
  onScan,
  onManual,
}) {
  const [mode, setMode] = useState("scan");
  const [barcode, setBarcode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [weight, setWeight] = useState("");
  const scanRef = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    if (readOnly) return;
    if (mode === "scan") scanRef.current?.focus();
    else codeRef.current?.focus();
  }, [mode, readOnly]);

  const focusCurrent = () => {
    setTimeout(() => {
      if (mode === "scan") scanRef.current?.focus();
      else codeRef.current?.focus();
    }, 0);
  };

  const handleScan = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    const code = barcode.trim();
    if (!code) return;
    const ok = await onScan(code);
    if (ok !== false) setBarcode("");
    focusCurrent();
  };

  const handleManual = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    const code = productCode.trim();
    const weightKg = parseWeightKg(weight);
    if (!code || weightKg == null) return;
    const ok = await onManual({ product_code: code, weight_kg: weightKg });
    if (ok !== false) {
      setProductCode("");
      setWeight("");
    }
    focusCurrent();
  };

  return (
    <Card className={readOnly ? "opacity-60" : "border-2 border-primary/10 shadow-sm"}>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-1 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setMode("scan")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "scan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ScanLine className="h-3.5 w-3.5" />
            Leitor
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setMode("manual")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Digitar
          </button>
        </div>

        {mode === "scan" ? (
          <form onSubmit={handleScan} className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <ScanLine className="h-5 w-5" />
              <span className="text-sm font-medium">Coleta de etiquetas</span>
            </div>
            <Input
              ref={scanRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder={readOnly ? statusText : "Posicione o leitor ou digite a etiqueta…"}
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
              {processing ? "Processando…" : submitScanLabel}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Formato: 2CCCC0TTTTTT — C = código (4 dígitos), T = quantidade em kg (6 dígitos, 3 casas).
            </p>
          </form>
        ) : (
          <form onSubmit={handleManual} className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Keyboard className="h-5 w-5" />
              <span className="text-sm font-medium">Código e pesagem</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-product-code">Código</Label>
                <Input
                  id="manual-product-code"
                  ref={codeRef}
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder={readOnly ? statusText : "Ex.: 1110"}
                  className="h-12 font-mono text-lg"
                  autoComplete="off"
                  inputMode="numeric"
                  disabled={readOnly || processing}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-weight">Peso (kg)</Label>
                <Input
                  id="manual-weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Ex.: 1,250"
                  className="h-12 font-mono text-lg"
                  autoComplete="off"
                  inputMode="decimal"
                  disabled={readOnly || processing}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full gap-2"
              disabled={readOnly || processing || !productCode.trim() || parseWeightKg(weight) == null}
            >
              <Keyboard className="h-4 w-4" />
              {processing ? "Processando…" : submitManualLabel}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Digite o código do produto cadastrado e o peso em kg (use vírgula ou ponto).
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
