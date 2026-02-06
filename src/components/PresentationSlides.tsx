"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Megaphone,
  Bot,
  LayoutDashboard,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

const TOTAL_SLIDES = 8;
const SWIPE_THRESHOLD = 50;

const LOOM_URL =
  "https://www.loom.com/share/0b288021895f49338328c6258299068f";
const WHATSAPP_URL =
  "https://wa.me/5492235238176?text=Hola!%20Me%20interesa%20implementar%20el%20agente%20IA%20en%20mi%20empresa.%20%C2%BFPodemos%20agendar%20una%20llamada%3F";

// ── Slide Components ──────────────────────────────────────────────

function Slide1() {
  const bullets = [
    "Elegís entre trabajo y vida personal",
    "Te llegan muchos leads pero pocos compran",
    "Tardás en responder y lo sabés",
    "Tu chatbot genera rechazo",
    "No tenés sistema de seguimiento real",
    "El proceso de venta es largo y se te escapan",
    "Los márgenes son ajustados",
  ];

  return (
    <div className="bg-blue-900 text-white px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
        ¿Te pasa alguna de estas cosas?
      </h2>
      <ul className="space-y-4 max-w-xl mx-auto w-full">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
            <span className="text-base md:text-lg font-medium">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Slide2() {
  return (
    <div className="bg-white text-blue-900 px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col items-center justify-center text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        El Programa PHA fue diseñado para resolverlos
      </h2>
      <p className="text-base md:text-lg text-gray-600 mb-8 max-w-lg">
        Publicidad + IA + CRM integrados para que vos cierres ventas, no
        respondas mensajes.
      </p>
      <a
        href={LOOM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        VIDEO DE 5 MIN DONDE EXPLICO TODO
      </a>
    </div>
  );
}

function Slide3() {
  const steps = [
    {
      icon: <Megaphone className="w-6 h-6" />,
      title: "Publicidad que trae compradores (no curiosos)",
      desc: "Meta Ads en tu zona → el sistema aprende y trae más gente parecida",
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Un agente IA que responde por vos (24/7)",
      desc: "Sabe todo de tu constructora, cotiza, califica y agenda llamadas",
    },
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      title: "Un CRM donde ves todo sin esfuerzo",
      desc: "Cada lead registrado con conversación, etiquetas y etapa de compra",
    },
  ];

  return (
    <div className="bg-white text-gray-900 px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center text-blue-900">
        ¿Cómo funciona?
      </h2>
      <div className="space-y-8 max-w-xl mx-auto w-full">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="font-bold text-base md:text-lg">
                {i + 1}. {s.title}
              </p>
              <p className="text-gray-600 text-sm md:text-base">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide4() {
  const bullets = [
    "Respondés en segundos, no en horas",
    "Filtrás curiosos antes de que te hagan perder tiempo",
    "Mantenés el contacto con leads que tardan meses",
    "Sabés exactamente qué funciona en tu publicidad",
  ];

  const funnel = [
    { label: "Conversaciones", count: "1,542", cost: "$0.5", width: "100%", color: "bg-blue-600" },
    { label: "Presupuestos", count: "235", cost: "$3", width: "72%", color: "bg-blue-500" },
    { label: "Leads Calificados", count: "101", cost: "$7", width: "50%", color: "bg-teal-500" },
    { label: "Entrevistas", count: "42", cost: "$18", width: "35%", color: "bg-emerald-500" },
  ];

  return (
    <div className="bg-blue-900 text-white px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
        ¿Esto realmente funciona?
      </h2>
      <div className="flex flex-col md:flex-row gap-8 max-w-4xl mx-auto w-full">
        {/* Bullets */}
        <div className="flex-1 space-y-3">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-400" />
              <span className="text-sm md:text-base">{b}</span>
            </div>
          ))}
        </div>
        {/* Funnel */}
        <div className="flex-1 space-y-3">
          {funnel.map((f, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`${f.color} rounded-lg px-4 py-2.5 text-center transition-all`}
                style={{ width: f.width }}
              >
                <p className="font-bold text-sm md:text-base">{f.label}</p>
                <p className="text-xs opacity-90">
                  {f.count} | {f.cost}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide5() {
  return (
    <div className="bg-white text-gray-900 px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col items-center justify-center text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 text-blue-900">
        Caso Real
      </h2>
      <p className="text-base md:text-lg text-gray-600 mb-8 max-w-lg">
        Tomate 5 minutos para ver este video donde te explico todo aplicado a
        un caso real.
      </p>
      <a
        href={LOOM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        HACÉ CLICK ACÁ
      </a>
    </div>
  );
}

function Slide6() {
  const bullets = [
    "+9 años en publicidad digital, +$10M USD en ventas generadas",
    "+$50K USD invertidos en educación (tendencias USA/Europa)",
    "Software + CRM especializado en construcción modular",
    "Low fee + comisión: crecemos juntos, a tu ritmo",
    "Partners de Meta, expertos en automatización con IA",
  ];

  return (
    <div className="bg-blue-900 text-white px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
        ¿Por qué nosotros?
      </h2>
      <ul className="space-y-4 max-w-xl mx-auto w-full">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-400" />
            <span className="text-base md:text-lg">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Slide7() {
  const team = [
    {
      name: "Joaquin",
      role: "Account Manager",
      desc: "Especialista en automatización de ventas con IA. Partner Oficial de Meta.",
      color: "bg-blue-600",
    },
    {
      name: "Brenda",
      role: "AI Agent Manager",
      desc: "Diseña sistemas escalables que integran agentes, CRM y operaciones.",
      color: "bg-purple-600",
    },
    {
      name: "Diego",
      role: "Media Buyer",
      desc: "Lidera la gestión publicitaria en Meta Ads con estrategia y ejecución.",
      color: "bg-teal-600",
    },
    {
      name: "Antonela",
      role: "Designer",
      desc: "Creativa data-driven especializada en Meta Ads.",
      color: "bg-rose-500",
    },
  ];

  return (
    <div className="bg-white text-gray-900 px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center text-blue-900">
        Nuestro Equipo
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
        {team.map((t, i) => (
          <div
            key={i}
            className="flex items-start gap-4 bg-gray-50 rounded-xl p-4"
          >
            <div
              className={`w-12 h-12 ${t.color} text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0`}
            >
              {t.name[0]}
            </div>
            <div>
              <p className="font-bold">{t.name}</p>
              <p className="text-blue-600 text-sm font-medium">{t.role}</p>
              <p className="text-gray-500 text-xs mt-1">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide8() {
  const hoy = [
    "Respuesta: 2-6 horas (horario laboral)",
    "100 consultas → 3-4 reuniones (3-4%)",
    "Asesores gastando 60-70% en soporte",
    "Se pierden 50-60% de leads",
    "Sin visibilidad del pipeline",
    "Meta cobra por todos los leads",
    "Equipo estresado",
  ];
  const conPHA = [
    "Respuesta: menos de 60 segundos (24/7)",
    "100 consultas → 7-9 reuniones (7-9%)",
    "Asesores dedicados 100% a reuniones",
    "0 leads perdidos, seguimiento 3-6 meses",
    "Dashboard en tiempo real",
    "Meta aprende y trae mejores leads",
    "Equipo enfocado y motivado",
  ];

  return (
    <div className="bg-blue-900 text-white px-6 py-10 md:px-12 md:py-14 min-h-[400px] md:min-h-[500px] flex flex-col justify-center">
      <h2 className="text-xl md:text-2xl font-bold mb-2 text-center leading-tight">
        HABLEMOS PARA VER CÓMO IMPLEMENTARLO EN TU CONSTRUCTORA
      </h2>
      <p className="text-blue-200 text-sm md:text-base text-center mb-8">
        Tomamos hasta 2 nuevas constructoras por mes. No te quedes sin cupo!
      </p>

      <div className="flex flex-col md:flex-row gap-4 max-w-3xl mx-auto w-full mb-8">
        {/* HOY */}
        <div className="flex-1 bg-white/10 rounded-xl p-5">
          <h3 className="font-bold text-lg mb-3 text-center">
            HOY (Sin PHA) <span className="text-red-400">&#10060;</span>
          </h3>
          <ul className="space-y-2">
            {hoy.map((h, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-red-400 flex-shrink-0">&#8226;</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        {/* CON PHA */}
        <div className="flex-1 bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-5">
          <h3 className="font-bold text-lg mb-3 text-center">
            CON PHA <span className="text-emerald-400">&#10004;</span>
          </h3>
          <ul className="space-y-2">
            {conPHA.map((c, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">&#8226;</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-center">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Escribile a mi agente IA para agendar
        </a>
      </div>
    </div>
  );
}

// ── Slides array ──────────────────────────────────────────────────

const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8];

// ── Main Component ────────────────────────────────────────────────

export default function PresentationSlides() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      const target = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
      if (target === current) return;
      setIsTransitioning(true);
      setCurrent(target);
      setTimeout(() => setIsTransitioning(false), 400);
    },
    [current, isTransitioning]
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) next();
      else prev();
    }
  };

  const SlideComponent = SLIDES[current];

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden shadow-lg select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slide content */}
      <div
        className="transition-opacity duration-300 ease-in-out"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <SlideComponent />
      </div>

      {/* Desktop arrows */}
      {current > 0 && (
        <button
          onClick={prev}
          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full items-center justify-center transition-colors z-10"
          aria-label="Slide anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {current < TOTAL_SLIDES - 1 && (
        <button
          onClick={next}
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full items-center justify-center transition-colors z-10"
          aria-label="Siguiente slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === current
                ? "bg-white scale-125 shadow-md"
                : "bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Ir a slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Slide counter (mobile) */}
      <div className="absolute top-3 right-3 md:hidden bg-black/40 text-white text-xs px-2.5 py-1 rounded-full z-10">
        {current + 1}/{TOTAL_SLIDES}
      </div>
    </div>
  );
}
