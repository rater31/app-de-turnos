import Link from "next/link";
import RegistroForm from "@/components/RegistroForm";

export const metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            TurnoFácil
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Creá la cuenta de tu negocio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            En 10 minutos tenés tu página de reservas lista.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <RegistroForm />
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}