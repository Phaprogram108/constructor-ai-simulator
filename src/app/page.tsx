import SimulatorForm from '@/components/SimulatorForm';
import QualificationForm from '@/components/QualificationForm';
import NavBar from '@/components/NavBar';
import { ReelCard } from '@/components/ReelCard';
import FAQ from '@/components/FAQ';
import AnimatedCounter from '@/components/AnimatedCounter';
import Image from 'next/image';
import {
  AlertCircle,
  Megaphone,
  Bot,
  LayoutDashboard,
  Shield,
} from 'lucide-react';


export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Section 1 - NavBar */}
      <NavBar />

      {/* Section 2 - Hero */}
      <section className="bg-white pt-24 pb-12 md:pt-32 md:pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Convertimos <span className="gradient-text">consultas en ventas</span> para tu constructora
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Nuestro sistema responde en menos de 60 segundos, califica leads, hace seguimiento y agenda reuniones 24/7 en automático.
          </p>

          <div className="mt-12 md:mt-16 max-w-2xl mx-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-5">
              <p className="text-gray-700 text-base leading-relaxed">
                <span className="font-semibold">¿Sabías?</span> Si respondés en menos de 5 minutos, tenés{' '}
                <span className="font-bold text-blue-600">21x más chances</span>{' '}
                de calificar un lead que si tardás más de 30 minutos.{' '}
                <span className="text-gray-400 text-sm">— Harvard Business Review</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2.5 - Pre-Simulator VSL */}
      <section id="caso" className="py-14 md:py-20 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-blue-600 mb-4">
            Caso real · 7.500% de retorno publicitario
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
            Antes de probar tu agente gratis, mirá cómo una constructora modular genera un retorno publicitario del 7.500% con IA
          </h2>
          <p className="text-gray-600 text-lg mb-10 max-w-2xl mx-auto">
            En pocos minutos te muestro el caso real: cómo funciona el sistema, los números del embudo y por qué funciona tan bien en construcción.
          </p>

          {/* VSL Placeholder */}
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-900" />
            <div className="relative text-white text-center p-8">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-lg font-semibold mb-2">Video en edición</p>
              <p className="text-slate-400 text-sm">Disponible próximamente</p>
            </div>
          </div>

          <p className="text-gray-500 text-sm mt-6">
            Después de verlo, probá vos mismo el agente gratis acá abajo ↓
          </p>
        </div>
      </section>

      {/* Section 3 - Simulator (moved up) */}
      <section id="simulador" className="py-12 md:py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Probalo vos mismo en 60 segundos
          </h2>
          <p className="text-gray-600 text-center mb-10 text-lg">
            Ingresá el sitio web de tu constructora y generá tu agente IA al instante
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Ingresá tu Web</h3>
              <p className="text-gray-600 text-sm">Extraemos la info de tu constructora</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Agregá tu Catálogo <span className="text-xs text-green-600 ml-1">(Opcional)</span>
              </h3>
              <p className="text-gray-600 text-sm">Link a tu catálogo online o PDF</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Chateá con Sofía</h3>
              <p className="text-gray-600 text-sm">Tu asesora IA lista para responder</p>
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center mb-4 max-w-2xl mx-auto">
            🚀 Versión Piloto — Este es un demo para mostrar el potencial de la tecnología. Los resultados pueden variar según el sitio web analizado.
          </p>

          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
            <SimulatorForm />
          </div>

        </div>
      </section>

      {/* Section 3.5 - Trust Row */}
      <section className="py-14 md:py-20 px-4 bg-slate-900 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.4), transparent 40%), radial-gradient(circle at 80% 60%, rgba(59,130,246,0.3), transparent 45%)',
          }}
          aria-hidden
        />
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            <AnimatedCounter
              end={10}
              prefix="$"
              suffix="M+"
              label="USD generados en ventas"
              className="text-4xl md:text-6xl font-bold text-white tracking-tight"
              labelClassName="text-xs md:text-sm text-slate-400 mt-2 uppercase tracking-widest"
            />
            <AnimatedCounter
              end={7500}
              suffix="%"
              label="ROAS en caso real"
              className="text-4xl md:text-6xl font-bold text-amber-300 tracking-tight"
              labelClassName="text-xs md:text-sm text-slate-400 mt-2 uppercase tracking-widest"
            />
            <AnimatedCounter
              end={9}
              suffix="+"
              label="Años en Meta Ads"
              className="text-4xl md:text-6xl font-bold text-white tracking-tight"
              labelClassName="text-xs md:text-sm text-slate-400 mt-2 uppercase tracking-widest"
            />
            <AnimatedCounter
              end={60}
              prefix="<"
              suffix="s"
              label="Tiempo de respuesta"
              className="text-4xl md:text-6xl font-bold text-white tracking-tight"
              labelClassName="text-xs md:text-sm text-slate-400 mt-2 uppercase tracking-widest"
            />
          </div>
        </div>
      </section>

      {/* Section 4 - Pain Points */}
      <section id="problema" className="py-14 md:py-24 px-4 bg-slate-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
            Si vendés construcción, seguro te pasa esto
          </h2>
          <div className="space-y-4">
            {[
              'Tu equipo tarda horas en responder consultas y los leads se enfrían',
              'Te llegan leads de todos lados (publicidad, redes, etc) pero no medís conversiones omnicanal',
              'Tu CRM nunca está 100% actualizado y requiere tiempo y energía de tu equipo',
              'Tu equipo pierde tiempo y energía atendiendo a curiosos que nunca van a comprar',
              'Sabés que la IA puede mejorar tus ventas y productividad, pero no sabés cómo sacarle el jugo',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-white text-lg">{item}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <p className="text-blue-300 text-xl font-medium">
              Si te identificás con alguno de estos puntos, podemos ayudarte.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5 - Esto NO es para vos si... (callout compacto) */}
      <section className="py-8 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg shrink-0 mt-0.5">⚠</span>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  Esto NO es para vos si recibís menos de 20 consultas por semana, no invertís en publicidad digital, o estás buscando un chatbot barato autogestionable.
                </p>
                <p className="text-sm text-gray-600">
                  Si es tu caso, te conviene escalar la demanda primero antes de automatizar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 - Nuestro Programa PHA */}
      <section id="solucion" className="py-0">
        {/* Intro - dark bg */}
        <div className="py-14 md:py-20 px-4 bg-slate-800">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              Nuestro Programa PHA
            </h2>
            <div className="text-slate-300 text-lg leading-relaxed space-y-4">
              <p>
                La mayoría de las soluciones IA son un dolor de cabeza. Prometen configurarse rápido y fácil, pero luego te das cuenta que necesitás integrar todas las partes, y eso te sale más caro.
              </p>
              <p>
                Luego tenés que pagar tokens de IA por cada mensaje que responde el agente, tenés que configurar y pagar templates de Meta y revisar los seguimientos y cómo se integra al CRM, entre muchas otras cosas.
              </p>
              <p>
                Ni hablar que la IA puede fallar y es difícil monitorizar, optimizar, y asegurarte que el agente no responda cualquier cosa.
              </p>
              <p>
                Por eso decidimos armar un programa integral que te resuelve la publicidad (demanda de leads), IA (gestión de consultas y seguimiento) y CRM (administración y reportes del sistema) para que vos solo te ocupes de cerrar ventas con leads calificados y listos para comprar.
              </p>
            </div>
          </div>
        </div>
        {/* Pillars - white bg */}
        <div className="py-14 md:py-20 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Publicidad que trae compradores</h3>
                  <p className="text-gray-500 text-sm">Meta Ads optimizados para tu zona, audiencia y objetivo. Gestionados por tu equipo.</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Agente IA que vende por vos 24/7</h3>
                  <p className="text-gray-500 text-sm">Conversa naturalmente, conoce tu constructora, cotiza y agenda reuniones. En menos de 60 segundos.</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">CRM con actualización automática</h3>
                  <p className="text-gray-500 text-sm">Cada lead registrado con conversación, etapa de compra y seguimiento. Sin carga manual.</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 flex gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Equipo dedicado de 4 personas</h3>
                  <p className="text-gray-500 text-sm">Account manager, media buyer, diseñadora y AI manager. Trabajando para tu constructora.</p>
                </div>
              </div>
            </div>

            <p className="text-gray-400 text-sm mt-8 text-center">
              Incluye todos los recursos: tokens de IA, creatividades, monitoreo y optimización continua.
            </p>
          </div>
        </div>
      </section>

      {/* Section 7 - HOY vs CON PHA */}
      <section className="py-14 md:py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Lo que cambia cuando implementás el Programa PHA
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 text-center mb-6">HOY (Sin PHA)</h3>
              <div className="space-y-3">
                {[
                  'Respuesta: 2-6 horas (horario laboral)',
                  '100 consultas → 3-4 reuniones (3-4%)',
                  'Asesores gastando 60-70% en soporte',
                  'Se pierden 50-60% de leads',
                  'Sin visibilidad del pipeline',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-red-400 shrink-0 mt-0.5">●</span>
                    <p className="text-gray-700 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-emerald-400 rounded-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 text-center mb-6">CON PHA</h3>
              <div className="space-y-3">
                {[
                  'Respuesta: menos de 60 segundos (24/7)',
                  '100 consultas → 7-9 reuniones (7-9%)',
                  'Asesores dedicados 100% a reuniones',
                  '0 leads perdidos, seguimiento 3-6 meses',
                  'Dashboard en tiempo real',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 mt-0.5">●</span>
                    <p className="text-gray-700 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 8.5 - Sobre mí (Joaquín) */}
      <section id="sobre-mi" className="py-14 md:py-24 px-4 bg-[#fdf6e3]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
            {/* Texto */}
            <div>
              <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-blue-600 mb-4">
                ¿Por qué escucharme a mí?
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-3 tracking-tight">
                Joaquín González
              </h2>
              <p className="text-lg md:text-xl font-semibold text-slate-700 mb-8">
                Founder de PHA · Publicista · Meta Business Partner
              </p>

              <div className="space-y-3 mb-8">
                {[
                  '9 años invirtiendo en publicidad digital',
                  'Founder de South Media LLC (USA, 2020 - hoy)',
                  '+$10M USD generados en ventas para clientes',
                  'Lic. en Administración (UNICEN) — egresado con honores y mejor GPA en 2017',
                  'Manager global publicitario en Sumeru (USA, 2018-2020)',
                  'Formación en Ingeniería en Sistemas y ex-docente de Marketing',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-blue-600" />
                    <p className="text-slate-700 text-base md:text-lg leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

              <a
                href="https://www.linkedin.com/in/joaquingb/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Ver perfil en LinkedIn →
              </a>
            </div>

            {/* Foto */}
            <div className="flex justify-center md:justify-end">
              <div className="relative w-64 h-80 md:w-80 md:h-96 bg-blue-600 rounded-[160px_160px_20px_20px] md:rounded-[200px_200px_24px_24px] shadow-2xl p-1.5">
                <div className="relative w-full h-full rounded-[152px_152px_14px_14px] md:rounded-[192px_192px_18px_18px] overflow-hidden">
                  <Image
                    src="/team/joaquin.png"
                    alt="Joaquín González - Founder de PHA"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 256px, 320px"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 9 - Equipo */}
      <section id="equipo" className="py-14 md:py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Tu equipo dedicado
          </h2>
          <p className="text-gray-600 text-center mb-12 text-lg max-w-2xl mx-auto">
            No comprás un software. Sumás un equipo de 4 personas que implementa el sistema publicitario, monitoriza la IA y crea automatizaciones para tu constructora.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Joaquín González',
                role: 'Account Manager',
                desc: 'Especialista en automatización de ventas con IA. Partner Oficial de Meta, con experiencia en escalar negocios de alto volumen.',
                photo: '/team/joaquin.png',
                linkedin: 'https://www.linkedin.com/in/joaquingb/',
              },
              {
                name: 'Brenda Pastorino',
                role: 'AI Agent Manager',
                desc: 'Especialista en automatización de procesos y workflows con IA. Diseña sistemas escalables que integran agentes, CRM y operaciones.',
                photo: '/team/brenda.png',
                linkedin: 'https://www.linkedin.com/in/brenda-pastorino-quaglia/',
              },
              {
                name: 'Diego Cortes',
                role: 'Media Buyer',
                desc: 'Lidera la gestión publicitaria en Meta Ads, integrando estrategia, ejecución y reporting en un sistema escalable.',
                photo: '/team/diego.png',
                linkedin: 'https://www.linkedin.com/in/diego-cortes-6b24083a9/',
              },
              {
                name: 'Antonela Baleirón',
                role: 'Designer',
                desc: 'Creativa data-driven especializada en Meta Ads. Convierte datos e insights en piezas visuales que venden y escalan.',
                photo: '/team/antonela.png',
                linkedin: 'https://www.linkedin.com/in/antonelabaleironfucci/',
              },
            ].map((member) => (
              <div key={member.name} className="bg-white border border-gray-200 rounded-xl p-6 text-center flex flex-col">
                <Image
                  src={member.photo}
                  alt={member.name}
                  width={80}
                  height={80}
                  className="mx-auto mb-4 w-20 h-20 rounded-full object-cover"
                />
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-sm text-blue-600 mb-2">{member.role}</p>
                <p className="text-sm text-gray-600 flex-1">{member.desc}</p>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  aria-label={`LinkedIn de ${member.name}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  LinkedIn
                </a>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-12 max-w-4xl mx-auto">
            {[
              '+9 años en publicidad digital',
              '+$10M USD en ventas generadas',
              'Partners de Meta',
              'Expertos en automatización con IA',
              'Low fee + comisión',
            ].map((item) => (
              <span key={item} className="bg-gray-50 border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-full">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Section 10 - Qualification Form */}
      <section id="califica" className="py-14 md:py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Verificá si tu constructora califica
          </h2>
          <p className="text-gray-600 text-center mb-10 text-lg">
            Respondé 3 preguntas para saber si el Programa PHA es para tu empresa
          </p>
          <QualificationForm />
        </div>
      </section>

      {/* Section 10.5 - FAQ */}
      <section id="faq" className="py-14 md:py-24 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Preguntas frecuentes
          </h2>
          <p className="text-gray-600 text-center mb-10 text-lg">
            Respondemos las dudas más comunes antes de la sesión estratégica
          </p>
          <FAQ />
        </div>
      </section>

      {/* Section 11 - CTA Final */}
      <section className="py-14 md:py-24 px-4 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Listo para dejar de perder leads?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Tomamos hasta 2 nuevas constructoras por mes
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#califica"
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-full font-bold text-lg transition-colors shadow-lg"
            >
              Verificá si tu constructora califica
            </a>
            <a
              href="#simulador"
              className="border-2 border-white/50 hover:border-white text-white px-8 py-4 rounded-full font-semibold text-lg transition-colors"
            >
              Probar simulador
            </a>
          </div>
          <p className="text-blue-200 mt-8 text-sm">
            Sin compromiso. Riesgo compartido: low fee + comisión.
          </p>
        </div>
      </section>

      {/* Section - Instagram Reels */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Conocé más sobre lo que hacemos
            </h2>
            <p className="text-gray-600 text-lg">
              Mirá nuestros últimos videos en Instagram
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
            {[
              'DWCPoC2Doxq',
              'DWCPbO-jjZt',
              'DWCPL_ODnWC',
              'DVx7n17iF8g',
              'DVwf8GlCBQ_',
              'DVuT5AdkXMI',
              'DVs94XaAtSg',
              'DVrZWWUFU11',
              'DVrB4j8jo_o',
            ].map((id) => (
              <ReelCard key={id} id={id} />
            ))}
          </div>
          <div className="text-center mt-6">
            <a
              href="https://www.instagram.com/construyeconia.ok/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-pink-600 hover:text-pink-700 font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              @construyeconia.ok
            </a>
          </div>
        </div>
      </section>

      {/* Section 12 - Footer */}
      <footer className="py-8 px-4 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            PHA - Sistemas de IA para la industria de la construcción
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <a
              href="https://www.facebook.com/construyeconia/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-600 transition-colors"
              aria-label="Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/construyeconia.ok"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-500 transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            © 2026 PHA. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
