"use client";

import { useEffect, useRef, useState } from "react";

export default function ShareButton({
  path,
  title,
  label = "Compartir",
  variant = "light",
}: {
  path: string;
  title?: string;
  label?: string;
  variant?: "light" | "accent";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = () => `${window.location.origin}${path}`;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copyLink() {
    setError(null);
    const fullUrl = url();
    let ok = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(fullUrl);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = fullUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setError("No se pudo copiar. Copialo manualmente desde la barra.");
    }
  }

  async function handleClick() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: url() });
        return;
      } catch {
        // usuario canceló o share no disponible -> menú manual
      }
    }
    setOpen((v) => !v);
  }

  const waLink =
    typeof window !== "undefined"
      ? `https://wa.me/?text=${encodeURIComponent(`${title ? `${title}: ` : ""}${url()}`)}`
      : "";

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition select-none touch-manipulation";
  const styles =
    variant === "accent"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100";
  const menuItem =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100";

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button type="button" onClick={handleClick} className={`${base} ${styles}`}>
        {copied ? (
          <>
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M4 10.5l4 4 8-9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            ¡Link copiado!
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M9 3.5a2.5 2.5 0 10-3.2 3.6A2.5 2.5 0 009 8.8m2-3.3a2.5 2.5 0 113.2 3.6A2.5 2.5 0 0111 5.5zM9 8.8v5.9m0 0l2-2m-2 2l-2-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {label}
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <button type="button" onClick={copyLink} className={menuItem}>
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
              <path
                d="M7 7V5.5A2.5 2.5 0 019.5 3h3A2.5 2.5 0 0115 5.5v5a2.5 2.5 0 01-2.5 2.5H11m-5-8A2.5 2.5 0 003.5 7v5A2.5 2.5 0 006 14.5h3A2.5 2.5 0 0011.5 12V7A2.5 2.5 0 009 4.5H6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className={menuItem}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
              <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1120 12a8 8 0 01-8 8zm4.5-6.2c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.4 6.4 0 01-2-1.2 7.4 7.4 0 01-1.4-1.7c-.1-.2 0-.4.1-.5s.2-.3.4-.4l.2-.3a.5.5 0 000-.5c0-.1-.5-1.3-.7-1.8s-.4-.4-.5-.4h-.5a1 1 0 00-.7.3 2.9 2.9 0 00-.9 2.2 5 5 0 001 2.7 11.5 11.5 0 004.4 3.9c.6.3 1.1.4 1.5.6a3.6 3.6 0 001.7.1 2.8 2.8 0 001.8-1.3 2.2 2.2 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" />
            </svg>
            Compartir por WhatsApp
          </a>
          {error && <p className="px-3 pb-1.5 pt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}