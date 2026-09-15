import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ProtectedRoute({ fallback, unauthenticatedElement }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;
    base44.auth
      .isAuthenticated()
      .then((ok) => active && setState(ok ? "authed" : "unauthed"))
      .catch(() => active && setState("unauthed"));
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      fallback || (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      )
    );
  }

  if (state === "unauthed") {
    return unauthenticatedElement || <Navigate to="/login" replace />;
  }

  return <Outlet />;
}