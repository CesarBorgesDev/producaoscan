import React, { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosDevice, isStandaloneApp } from "@/lib/pwa";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = isStandaloneApp();
    setInstalled(standalone);
    if (standalone) return;

    if (sessionStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
    }

    setIos(isIosDevice());

    const onPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  if (installed || dismissed) return null;

  const hint = ios
    ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
    : deferredPrompt
      ? "Instale para abrir em tela cheia, como um aplicativo."
      : "No Chrome ou Edge, use o ícone de instalar na barra de endereço ou o menu do navegador.";

  return (
    <div className="border-b border-sky-100 bg-sky-50/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Instale o aplicativo</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {deferredPrompt ? (
            <Button size="sm" className="h-8 gap-1.5 rounded-full px-3" onClick={handleInstall}>
              <Download className="h-3.5 w-3.5" />
              Instalar app
            </Button>
          ) : ios ? (
            <span className="hidden items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 sm:inline-flex">
              <Share className="h-3 w-3" />
              Compartilhar
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="Fechar aviso de instalação"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
