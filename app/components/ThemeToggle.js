"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

// Botão de alternância claro/escuro. Persiste em localStorage("erp-theme").
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const el = document.documentElement;
    const novo = !el.classList.contains("dark");
    el.classList.toggle("dark", novo);
    try { localStorage.setItem("erp-theme", novo ? "dark" : "light"); } catch (_) {}
    setDark(novo);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="fixed bottom-5 left-5 z-[200] w-11 h-11 rounded-full flex items-center justify-center border shadow-lg transition-colors"
      style={{
        background: "var(--card)",
        borderColor: "var(--line)",
        color: "var(--fg-soft)",
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
