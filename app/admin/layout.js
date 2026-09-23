"use client";

import { Suspense } from "react";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans">
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando Control Plane SaaS...</div>}>
        {children}
      </Suspense>
    </div>
  );
}
