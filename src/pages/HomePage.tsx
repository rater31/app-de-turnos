import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FadeIn } from "@/components/motion";
import { env } from "@/lib/env";
import { usePlanPrice } from "@/lib/planPrice";

const CURRENT_YEAR = new Date().getFullYear();

const SUPPORT_EMAIL = env.supportEmail;
const SUPPORT_WHATSAPP = env.supportWhatsapp;
const SUPPORT_HREF = SUPPORT_EMAIL
  ? `mailto:${SUPPORT_EMAIL}`
  : SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}`
    : null;

const BENEFICIOS = [
  {
    titulo: "Reservas online 24/7",
    texto:
      "Tu página pública de reservas funciona sola: el cliente elige servicio, profesional y horario sin llamadas ni mensajes.",
    tono: "indigo",
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
      "Recordatorios automáticos por email 24 h antes del turno. El dolor número uno del rubro se reduce drásticamente.",
    tono: "violet",
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
      "Pedí una seña al reservar: el cliente te transfiere directo y adjunta el comprobante. Sin comisiones.",
    tono: "sky",
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
      "Una lista de turnos con confirmación, cancelación y estado de cada reserva. Se aprende en minutos.",
    tono: "blue",
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
      "Multi-profesional: cada barbero o doctor tiene sus horarios y servicios asignados. Sin dobles reservas.",
    tono: "emerald",
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
    tono: "amber",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
];

// Fondo de cada tarjeta de beneficio. Todos son pasteles fríos de la misma
// familia salvo el ámbar, que aporta el contraste de acento.
const TONES: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  sky: "bg-sky-100 text-sky-600",
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
};

const PASOS = [
  { n: "01", t: "Creá tu cuenta", d: "Registrate con tu email y el nombre de tu negocio. Sin tarjeta." },
  { n: "02", t: "Cargá servicios y horarios", d: "Definí qué servicios ofrecés, cuánto duran, y el horario de cada profesional." },
  { n: "03", t: "Compartí tu link", d: "Mandá tu página de reservas por WhatsApp o Instagram y empezá a recibir turnos." },
];

// Cifras del hero. Salen de las mismas promesas que ya estaban en la landing:
// reservas 24/7, 10 minutos para arrancar, sin instalaciones y un link para compartir.
const CIFRAS = [
  { valor: "24/7", texto: "Reservas online" },
  { valor: "10 min", texto: "Para empezar" },
  { valor: "0", texto: "Instalaciones" },
  { valor: "1 link", texto: "Para compartir" },
];

const RUBROS = [
  "Barberías",
  "Consultorios dentales",
  "Salones de belleza",
  "Masajes",
  "Gimnasios",
  "Manicuras",
  "Podología",
  "Fisioterapia",
  "Veterinarias",
  "Tatuajes",
];

const TESTIMONIOS = [
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
];

const PREGUNTAS = [
  {
    p: "¿Necesito saber de tecnología?",
    r: "No. Armar tu agenda y tu página de reservas toma menos de 10 minutos. No instalás nada.",
  },
  {
    p: "¿Cómo funciona el cobro de señas?",
    r: "El cliente te transfiere la seña al reservar y adjunta el comprobante. Vos lo confirmás y queda registrado en tu panel.",
  },
  {
    p: "¿Puedo usarlo sin cobrar señas?",
    r: "Sí. Las señas son opcionales. Si no querés pedir señas, los turnos se reservan igual y el pago se hace en el local.",
  },
  {
    p: "¿Funciona para varios profesionales?",
    r: "Sí. Cada profesional tiene su propia agenda y sus servicios. Se evitan choques de horarios automáticamente.",
  },
];

// El precio de Pro sale de `platform_settings` (usePlanPrice), no de un string
// fijo: antes estaba escrito acá y se desincronizaba del resto de la app.
function buildPlanes(planPrice: string) {
  return [
    {
      slug: "gratis",
      nombre: "Gratis",
      precio: "$0",
      detalle: "Para arrancar y validar",
      featured: false,
      items: [
        "1 profesional",
        "Reservas online ilimitadas",
        "Agenda del panel",
        "Hasta 10 señas/mes",
        "7 días de prueba Pro completa",
      ],
      cta: "Probar gratis",
    },
    {
      slug: "pro",
      nombre: "Pro",
      precio: planPrice,
      detalle: "/mes por negocio",
      featured: true,
      items: [
        "Profesionales ilimitados",
        "Recordatorios por email",
        "Señas online ilimitadas",
        "Página de reservas con tu marca",
        "Soporte prioritario",
      ],
      cta: "Empezar ahora",
    },
  ];
}

const NAVEGACION = [
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#beneficios", texto: "Beneficios" },
  { href: "#planes", texto: "Planes" },
  { href: "#faq", texto: "FAQ" },
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/25">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">TurnoFácil</span>
    </span>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const alDesplazar = () => setScrolled(window.scrollY > 24);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  // Sobre el hero (oscuro) el header va transparente con texto claro; al
  // scrollear pasa a fondo blanco translúcido con la tipografía de siempre.
  const sobreOscuro = !scrolled && !menuAbierto;

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        sobreOscuro
          ? "border-transparent bg-transparent text-white"
          : "border-borde bg-white/85 text-tinta backdrop-blur-md",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[72px]">
        <Link to="/" onClick={() => setMenuAbierto(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {NAVEGACION.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={[
                "transition-colors",
                sobreOscuro ? "text-white/70 hover:text-white" : "text-tinta-suave hover:text-tinta",
              ].join(" ")}
            >
              {item.texto}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className={[
              "text-sm font-semibold transition-colors",
              sobreOscuro ? "text-white/80 hover:text-white" : "text-tinta-suave hover:text-tinta",
            ].join(" ")}
          >
            Ingresar
          </Link>
          <Link
            to="/registro"
            className="rounded-xl bg-marca px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-marca-oscuro"
          >
            Probar gratis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-label="Abrir menú"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/20 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            {menuAbierto ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuAbierto && (
        <div className="border-b border-borde bg-white px-4 pb-4 pt-2 text-tinta md:hidden">
          <nav className="flex flex-col text-sm font-medium">
            {NAVEGACION.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuAbierto(false)}
                className="rounded-lg px-2 py-3 text-tinta-suave transition-colors hover:bg-fondo hover:text-tinta"
              >
                {item.texto}
              </a>
            ))}
          </nav>
          <div className="mt-2 flex items-center gap-2 border-t border-borde pt-4">
            <Link
              to="/login"
              onClick={() => setMenuAbierto(false)}
              className="flex-1 rounded-xl border border-borde px-4 py-2.5 text-center text-sm font-semibold text-tinta transition hover:bg-fondo"
            >
              Ingresar
            </Link>
            <Link
              to="/registro"
              onClick={() => setMenuAbierto(false)}
              className="flex-1 rounded-xl bg-marca px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-marca-oscuro"
            >
              Probar gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* Maqueta decorativa de la agenda. No son datos reales: es la ilustración
   del producto que acompaña al hero. */
function AgendaPreview() {
  const filas = [
    { hora: "09:00", servicio: "Corte + barba", estado: "Confirmado", tono: "bg-emerald-400/15 text-emerald-300" },
    { hora: "10:30", servicio: "Coloración", estado: "Seña pagada", tono: "bg-indigo-400/15 text-indigo-300" },
    { hora: "12:00", servicio: "Manicura", estado: "Pendiente", tono: "bg-amber-400/15 text-amber-300" },
    { hora: "16:15", servicio: "Masaje descontracturante", estado: "Confirmado", tono: "bg-emerald-400/15 text-emerald-300" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="absolute -inset-6 -z-10 rounded-[44px] bg-indigo-500/20 blur-[60px]" />

      <div className="rounded-[34px] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="rounded-[26px] border border-white/10 bg-noche/90 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Agenda de hoy
              </p>
              <p className="mt-1 text-lg font-semibold text-white">4 turnos</p>
            </div>
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-latido" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          </div>

          <div className="mt-5 space-y-2">
            {filas.map((fila) => (
              <div
                key={fila.hora}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] px-3.5 py-3 transition-colors hover:bg-white/[0.08]"
              >
                <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-white/50">
                  {fila.hora}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                  {fila.servicio}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${fila.tono}`}>
                  {fila.estado}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-indigo-500/15 px-3.5 py-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 shrink-0 text-indigo-300"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4Z" />
            </svg>
            <p className="text-xs text-indigo-100/80">
              Recordatorio enviado 24 h antes. Sin que tengas que hacerlo.
            </p>
          </div>
        </div>
      </div>

      {/* Chips flotantes alrededor de la maqueta */}
      <div className="absolute -left-4 top-16 hidden animate-flotar items-center gap-2 rounded-2xl border border-borde bg-white px-3 py-2 shadow-xl shadow-black/20 sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="text-xs font-semibold text-tinta">Turno confirmado</span>
      </div>

      <div className="absolute -right-6 bottom-20 hidden animate-flotar items-center gap-2 rounded-2xl border border-borde bg-white px-3 py-2 shadow-xl shadow-black/20 sm:flex [animation-delay:-2.5s]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span className="text-xs font-semibold text-tinta">Seña cobrada</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-noche">
      {/* Luces y grilla de fondo */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-indigo-600/25 blur-[110px]" />
      <div className="pointer-events-none absolute -right-20 top-10 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[80px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:grid-cols-2 lg:gap-10">
        <div>
          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 animate-latido" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
              </span>
              Agenda online ideal para tu local
            </span>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Tu agenda de turnos,{" "}
              <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                trabajando sola
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              Ofrecé reservas online 24/7, recordá tus turnos por email y cobrá señas. Sin papel,
              sin instalaciones, sin perder clientes.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-marca px-7 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-marca-oscuro"
              >
                Crear mi cuenta gratis
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.04] px-7 py-4 text-base font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
              >
                Ver cómo funciona
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-indigo-300">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-indigo-300">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Listo en 10 minutos
              </span>
            </p>
          </FadeIn>
        </div>

        <FadeIn delay={0.15} y={30}>
          <AgendaPreview />
        </FadeIn>
      </div>

      {/* Cifras */}
      <div className="relative border-t border-white/[0.07]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {CIFRAS.map((cifra) => (
            <div key={cifra.texto} className="text-center">
              <p className="text-3xl font-bold text-white sm:text-4xl">{cifra.valor}</p>
              <p className="mt-1 text-sm text-white/45">{cifra.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cinta() {
  return (
    <div className="relative overflow-hidden border-b border-borde bg-white py-6">
      <p className="mb-5 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-tinta-suave/70">
        Para negocios que atienden por turno
      </p>
      <div className="relative flex overflow-hidden">
        {/* w-max: la cinta mide lo que su contenido, así el -50% de la
            animación cae justo en el corte entre una copia y la otra. */}
        <div className="flex w-max shrink-0 animate-cinta items-center">
          {[...RUBROS, ...RUBROS].map((rubro, i) => (
            <span
              key={`${rubro}-${i}`}
              className="mx-6 flex items-center gap-6 whitespace-nowrap text-lg font-semibold text-tinta/25 sm:mx-10 sm:text-xl"
            >
              {rubro}
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent" />
      </div>
    </div>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-fondo py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-marca">
            Cómo funciona
          </span>
          <h2 className="mt-3 text-3xl font-bold text-tinta sm:text-4xl">Empezar es así de simple</h2>
          <p className="mt-4 text-lg text-tinta-suave">
            Tres pasos y ya tenés tu página de reservas funcionando.
          </p>
        </FadeIn>

        <div className="relative mt-14">
          {/* Línea que une los tres pasos en desktop */}
          <div className="absolute left-0 right-0 top-9 hidden h-px border-t border-dashed border-borde lg:block" />
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {PASOS.map((paso, i) => (
              <FadeIn key={paso.n} delay={i * 0.12}>
                <div className="group relative h-full rounded-[22px] border border-borde bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/[0.07]">
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-claro text-lg font-bold text-marca transition-colors group-hover:bg-marca group-hover:text-white">
                    {paso.n}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-tinta">{paso.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{paso.d}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Beneficios() {
  return (
    <section id="beneficios" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="max-w-2xl">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-marca">
            Beneficios
          </span>
          <h2 className="mt-3 text-3xl font-bold text-tinta sm:text-4xl">
            Lo que tu negocio gana con TurnoFácil
          </h2>
          <p className="mt-4 text-lg text-tinta-suave">
            Pensado para el rubro de servicios por turno: simple de usar, directo a la venta.
          </p>
        </FadeIn>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map((b, i) => (
            <FadeIn key={b.titulo} delay={(i % 3) * 0.1}>
              <div className="group h-full rounded-[22px] border border-borde bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/[0.07]">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TONES[b.tono]} transition-transform duration-300 group-hover:scale-110`}
                >
                  {b.icono}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-tinta">{b.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{b.texto}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function Planes({ planPrice }: { planPrice: string }) {
  const planes = buildPlanes(planPrice);

  return (
    // overflow-x-clip: la luz difusa de la tarjeta Pro sobresale a la derecha y
    // en celular estiraba la página (scroll horizontal). La tarjeta no puede
    // recortarse sola porque el sello "Recomendado" asoma por arriba.
    <section id="planes" className="overflow-x-clip bg-fondo py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-marca">
            Planes
          </span>
          <h2 className="mt-3 text-3xl font-bold text-tinta sm:text-4xl">
            Planes pensados para crecer con vos
          </h2>
          <p className="mt-4 text-lg text-tinta-suave">
            Empezá gratis. Cuando el sistema te rinda, pasás a Pro con más herramientas.
          </p>
        </FadeIn>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {planes.map((plan, i) => (
            <FadeIn key={plan.nombre} delay={i * 0.12}>
              <div
                className={[
                  "relative flex h-full flex-col rounded-[28px] p-6 transition-all duration-300 sm:p-8",
                  plan.featured
                    ? "border border-indigo-400/25 bg-noche text-white shadow-2xl shadow-indigo-900/20"
                    : "border border-borde bg-white shadow-sm",
                ].join(" ")}
              >
                {plan.featured && (
                  <>
                    <span className="absolute -top-3 left-8 rounded-full bg-marca px-3.5 py-1 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30">
                      Recomendado
                    </span>
                    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/25 blur-[60px]" />
                  </>
                )}

                <div className="relative">
                  <h3 className="text-lg font-semibold">{plan.nombre}</h3>
                  <p className={plan.featured ? "mt-1 text-sm text-white/50" : "mt-1 text-sm text-tinta-suave"}>
                    {plan.detalle}
                  </p>
                  <p className="mt-6 text-5xl font-bold tracking-tight">{plan.precio}</p>

                  <ul className="mt-8 space-y-3.5 text-sm">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span
                          className={[
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                            plan.featured ? "bg-indigo-500/25 text-indigo-200" : "bg-marca-claro text-marca",
                          ].join(" ")}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                        <span className={plan.featured ? "text-white/75" : "text-tinta-suave"}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/registro?plan=${plan.slug}`}
                  className={[
                    "mt-8 block rounded-2xl px-5 py-3.5 text-center text-sm font-semibold transition-all duration-300",
                    plan.featured
                      ? "bg-marca text-white shadow-lg shadow-indigo-600/25 hover:bg-marca-oscuro"
                      : "border border-borde text-tinta transition hover:border-marca hover:bg-marca-claro hover:text-marca",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonios() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-marca">
            Testimonios
          </span>
          <h2 className="mt-3 text-3xl font-bold text-tinta sm:text-4xl">
            Negocios que ya no pierden turnos
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIOS.map((t, i) => (
            <FadeIn key={t.nombre} delay={i * 0.12}>
              <figure className="flex h-full flex-col rounded-[22px] border border-borde bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-600/[0.07]">
                <div className="flex gap-0.5 text-amber-400" aria-label="5 de 5 estrellas">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.3l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-sm leading-relaxed text-tinta-suave">
                  “{t.texto}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-borde pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marca-claro text-sm font-bold text-marca">
                    {t.nombre.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-tinta">{t.nombre}</span>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-fondo py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <FadeIn>
          <div className="lg:sticky lg:top-28">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-marca">FAQ</span>
            <h2 className="mt-3 text-3xl font-bold text-tinta sm:text-4xl">Preguntas frecuentes</h2>
            <p className="mt-4 text-lg text-tinta-suave">
              Lo que todos preguntan antes de empezar. Si te falta algo, escribinos.
            </p>
            {SUPPORT_HREF && (
              <a
                href={SUPPORT_HREF}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-borde bg-white px-5 py-3 text-sm font-semibold text-tinta transition hover:border-marca hover:text-marca"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Hablar con soporte
              </a>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-4">
            {PREGUNTAS.map((q) => (
              <details
                key={q.p}
                className="group rounded-[22px] border border-borde bg-white p-6 transition-colors open:border-indigo-200 open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-tinta [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fondo text-tinta-suave transition-all duration-300 group-open:rotate-45 group-open:bg-marca group-open:text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-4 pr-10 text-sm leading-relaxed text-tinta-suave">{q.r}</p>
              </details>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="bg-white px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20">
      <FadeIn className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[34px] bg-noche px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-indigo-600/25 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-violet-600/20 blur-[100px]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Listo para no perder más turnos</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
              Creá tu cuenta gratis y tené tu página de reservas funcionando hoy mismo.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/registro"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-marca px-8 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-marca-oscuro sm:w-auto"
              >
                Crear mi cuenta gratis
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/[0.04] px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/10 sm:w-auto"
              >
                Ya tengo cuenta
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/40">Sin tarjeta de crédito · Listo en 10 minutos</p>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-noche pb-28 pt-16 text-white sm:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8">
          <div>
            <Link to="/" className="inline-flex">
              <Logo className="text-white" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              Reservas online para negocios que atienden por turno. Tu agenda, tus servicios y tu
              página de reservas en un solo link.
            </p>
          </div>

          <div>
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Producto
            </h3>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              {NAVEGACION.map((item) => (
                <a key={item.href} href={item.href} className="text-white/60 transition-colors hover:text-white">
                  {item.texto}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Cuenta
            </h3>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              <Link to="/login" className="text-white/60 transition-colors hover:text-white">
                Ingresar
              </Link>
              <Link to="/registro" className="text-white/60 transition-colors hover:text-white">
                Crear cuenta
              </Link>
              {SUPPORT_HREF && (
                <a href={SUPPORT_HREF} className="text-white/60 transition-colors hover:text-white">
                  Soporte
                </a>
              )}
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/35 sm:flex-row">
          <p>© {CURRENT_YEAR} TurnoFácil. Todos los derechos reservados.</p>
          <p>Hecho para negocios que atienden por turno.</p>
        </div>
      </div>
    </footer>
  );
}

/* Barra de acción fija en mobile: el header de la landing es alto y los
   anchors llevan a secciones largas, así siempre queda a mano el alta. */
function BarraMobile() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-white/95 px-4 py-3 backdrop-blur-md sm:hidden">
      <div className="flex items-center gap-2">
        <Link
          to="/registro"
          className="flex-1 rounded-xl bg-marca px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/25"
        >
          Crear mi cuenta gratis
        </Link>
        <Link
          to="/login"
          className="rounded-xl border border-borde px-4 py-3 text-center text-sm font-semibold text-tinta"
        >
          Ingresar
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const planPrice = usePlanPrice();

  return (
    <div className="landing flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Hero />
        <Cinta />
        <ComoFunciona />
        <Beneficios />
        <Planes planPrice={planPrice} />
        <Testimonios />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
      <BarraMobile />
    </div>
  );
}
