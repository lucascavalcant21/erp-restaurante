"use client";

import { Suspense } from "react";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-hf-bg text-hf-text font-sans">
      <Suspense fallback={<div className="p-8 text-center text-hf-muted">Carregando Control Plane SaaS...</div>}>
        {children}
      </Suspense>
    </div>
  );
}
