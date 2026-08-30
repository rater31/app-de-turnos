import Link from "next/link";

const BENEFICIOS = [
  {
    titulo: "Reservas online 24/7",
    texto:
      "Tu página pública de reservas funciona sola: el cliente elige servicio, profesional y horario sin llamadas ni mensajes.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    titulo: "Menos no-shows",
    texto:
      "Recordatorios automáticos por WhatsApp y email 24 h antes. El dolor número uno del rubro se reduce drásticamente.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4Z" />
      </svg>
    ),
  },
  {
    titulo: "Cobro de señas online",
    texto:
      "Pedí una seña para reservar con Mercado Pago. El dinero va directo a la cuenta del negocio, la plata se queda tu comisión.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h2M16 12h2" />
      </svg>
    ),
  },
  {
    titulo: "Agenda clara y simple",
    texto:
      "Vista diaria y próximos turnos con confirmación, cancelación y estado de cada reserva. Se aprende en minutos.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    titulo: "Cada profesional con su agenda",
    texto:
      "Multi-negocio y multi-profesional: cada barbero o doctor tiene sus horarios y servicios asignados. Sin dobles reservas.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    titulo: "Sin instalaciones",
    texto:
      "Todo funciona en el navegador, con tu logo y tus colores. El cliente reserva desde su celular con un link.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
];

const PASOS = [
  { n: "01", t: "Creá tu cuenta", d: "Registrate con tu email y el nombre de tu negocio. Sin tarjeta." },
  { n: "02", t: "Cargá servicios y horarios", d: "Definí qué servicios ofrecés, cuánto duran, y el horario de cada profesional." },
  { n: "03", t: "Compartí tu link", d: "Mandá tu página de reservas por WhatsApp o Instagram y empezá a recibir turnos." },
];

const PLANES = [
  {
    nombre: "Gratis",
    precio: "$0",
    detalle: "Para arrancar y validar",
    featured: false,
    items: [
      "1 profesional",
      "Reservas online ilimitadas",
      "Agenda del panel",
      "Hasta 30 días de registro",
    ],
    cta: "Probar gratis",
  },
  {
    nombre: "Pro",
    precio: "$15.000",
    detalle: "/mes por negocio",
    featured: true,
    items: [
      "Profesionales ilimitados",
      "Recordatorios por WhatsApp y email",
      "Señas con Mercado Pago",
      "Página de reservas con tu marca",
      "Soporte prioritario",
    ],
    cta: "Empezar ahora",
  },
];

const PREGUNTAS = [
  {
    p: "¿Necesito saber de tecnología?",
    r: "No. Armar tu agenda y tu página de reservas toma menos de 10 minutos. No instalás nada.",
  },
  {
    p: "¿Cómo funciona el cobro de señas?",
    r: "El cliente paga cuando reserva y el dinero va directo a tu cuenta de Mercado Pago. La plataforma solo se queda un pequeño porcentaje.",
  },
  {
    p: "¿Puedo usarlo sin cobrar señas?",
    r: "Sí. Las señas son opcionales. Si no querés cobrar online, los turnos se reservan igual y el pago se hace en el local.",
  },
  {
    p: "¿Funciona para varios profesionales?",
    r: "Sí. Cada profesional tiene su propia agenda y sus servicios. Se evitan choques de horarios automáticamente.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            TurnoFácil
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#como-funciona" className="hover:text-slate-900">Cómo funciona</a>
            <a href="#beneficios" className="hover:text-slate-900">Beneficios</a>
            <a href="#planes" className="hover:text-slate-900">Planes</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Probar gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-white" />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                Agenda online para barberías, peluquerías, dentistas y más
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
                Tu agenda de turnos, <span className="text-indigo-600">trabajando sola</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
                Ofrecé reservas online 24/7, recordá tus turnos por WhatsApp y cobrá señas con
                Mercado Pago. Sin papel, sin instalaciones, sin perder clientes.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 sm:w-auto"
                >
                  Crear mi cuenta gratis
                </Link>
                <a
                  href="#como-funciona"
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-400 sm:w-auto"
                >
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Sin tarjeta de crédito · Listo en 10 minutos
              </p>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
              Empezar es así de simple
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {PASOS.map((paso) => (
                <div key={paso.n} className="relative rounded-2xl border border-slate-200 p-6">
                  <span className="text-sm font-bold text-indigo-600">{paso.n}</span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{paso.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{paso.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section id="beneficios" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Lo que tu negocio gana con TurnoFácil
              </h2>
              <p className="mt-3 text-slate-600">
                Pensado para el rubro de servicios por turno: simple de usar, directo a la venta.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFICIOS.map((b) => (
                <div
                  key={b.titulo}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    {b.icono}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{b.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANES */}
        <section id="planes" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Planes pensados para crecer con vos
              </h2>
              <p className="mt-3 text-slate-600">
                Empezá gratis. Cuando el sistema te rinda, pasás a Pro con más herramientas.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
              {PLANES.map((plan) => (
                <div
                  key={plan.nombre}
                  className={
                    plan.featured
                      ? "relative rounded-2xl border-2 border-indigo-600 bg-indigo-50/40 p-6 shadow-lg shadow-indigo-600/10"
                      : "rounded-2xl border border-slate-200 p-6"
                  }
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                      Recomendado
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">{plan.nombre}</h3>
                  <p className="mt-2 text-slate-600">{plan.detalle}</p>
                  <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                    {plan.precio}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-700">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/registro"
                    className={
                      plan.featured
                        ? "mt-8 block rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
                        : "mt-8 block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                    }
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIOS */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Negocios que ya no pierden turnos
              </h2>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                {
                  nombre: "Martín, Barbería Noble",
                  texto:
                    "Antes escribía por WhatsApp a cada cliente. Ahora la página me toma turnos sola y los recordatorios bajaron las ausencias casi a cero.",
                },
                {
                  nombre: "Dra. López, Consultorio dental",
                  texto:
                    "Los pacientes confirman su consulta desde el celular. Cobro señal online y se acabaron los que no aparecían.",
                },
                {
                  nombre: "Sofía, Salón de belleza",
                  texto:
                    "Cada estilista tiene su agenda. No se superponen horarios y el equipo lo usa desde el primer día.",
                },
              ].map((t) => (
                <figure key={t.nombre} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex gap-0.5 text-amber-400" aria-label="5 de 5 estrellas">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.3l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="mt-4 text-sm leading-relaxed text-slate-700">
                    “{t.texto}”
                  </blockquote>
                  <figcaption className="mt-4 text-sm font-semibold text-slate-900">
                    {t.nombre}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
              Preguntas frecuentes
            </h2>
            <div className="mt-10 space-y-4">
              {PREGUNTAS.map((q) => (
                <details
                  key={q.p}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                    {q.p}
                    <span className="text-slate-400 transition group-open:rotate-45">＋</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-gradient-to-br from-indigo-600 to-indigo-700">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Listo para no perder más turnos
            </h2>
            <p className="mt-4 text-lg text-indigo-100">
              Creá tu cuenta gratis y tené tu página de reservas funcionando hoy mismo.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
            >
              Crear mi cuenta gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            TurnoFácil
          </div>
          <p>© {new Date().getFullYear()} TurnoFácil. Todos los derechos reservados.</p>
          <nav className="flex gap-6">
            <a href="#como-funciona" className="hover:text-slate-900">Cómo funciona</a>
            <a href="#planes" className="hover:text-slate-900">Planes</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </nav>
        </div>
      </footer>
    </>
  );
}