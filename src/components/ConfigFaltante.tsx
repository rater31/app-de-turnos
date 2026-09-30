import { missingSupabaseVars } from "@/lib/env";

// Se muestra cuando el bundle se compiló sin las variables de Supabase. Antes
// esto era un throw a nivel de módulo (pantalla en blanco); ahora dice qué
// falta y cómo arreglarlo.
export default function ConfigFaltante() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Falta configurar la conexión</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta build se compiló sin las variables de entorno de Supabase, así que la app no
          puede conectarse a la base.
        </p>

        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Variables faltantes
          </p>
          <ul className="mt-2 space-y-1">
            {missingSupabaseVars.map((name) => (
              <li key={name} className="font-mono text-sm text-slate-800">
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-600">
          <p>
            <strong className="font-semibold text-slate-900">En local:</strong> copiá{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">.env.example</code>{" "}
            a <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">.env.local</code> y
            completá los valores. Después reiniciá <code className="font-mono text-xs">npm run dev</code>.
          </p>
          <p>
            <strong className="font-semibold text-slate-900">En el deploy:</strong> las variables
            tienen que existir en GitHub → Settings → Secrets and variables → Actions, y el build
            volver a correr para que las tome.
          </p>
        </div>
      </div>
    </main>
  );
}
