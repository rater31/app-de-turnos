"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaff } from "@/app/actions/panel";

export default function ProfesionalRow({
  id,
  name,
  color,
  active,
}: {
  id: string;
  name: string;
  color: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {name.charAt(0)}
        </span>
        <div>
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">
            {active ? "Activo en reservas" : "Inactivo (no aparece en la web)"}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await toggleStaff(id, !active);
            router.refresh();
          });
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
      >
        {active ? "Desactivar" : "Activar"}
      </button>
    </div>
  );
}