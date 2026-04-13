import SimulatorForm from '@/components/SimulatorForm';
import QualificationForm from '@/components/QualificationForm';
import NavBar from '@/components/NavBar';
import { ReelCard } from '@/components/ReelCard';
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

      {/* Section 5 - Esto NO es para vos si... */}
      <section className="py-14 md:py-20 px-4 bg-red-950/90">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-red-300 text-sm font-semibold tracking-widest uppercase mb-4">
            Pero
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-10">
            Esto NO es para vos si...
          </h2>
          <div className="space-y-4">
            {[
              'Recibís menos de 20 consultas por semana',
              'No invertís en publicidad digital por falta de presupuesto',
              'Tu constructora es muy chica y estás buscando un chatbot barato que puedas autogestionar',
            ].map((item) => (
              <div key={item} className="bg-red-900/40 border border-red-800/50 rounded-xl px-5 py-4 flex items-start gap-3">
                <span className="text-red-400 text-xl shrink-0">&#10060;</span>
                <p className="text-red-100 text-lg">{item}</p>
              </div>
            ))}
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

      {/* Section 8 - Results */}
      <section id="resultados" className="py-14 md:py-24 px-4 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            Como una constructora consigue un ROI bruto del 7500% y neto del 1000%
          </h2>

          {/* Imagen caso de estudio */}
          <div className="max-w-3xl mx-auto mb-8">
            <img
              src="/caso-exito-constructora.png"
              alt="Caso de estudio: Constructora Modular Argentina - Análisis de conversión y ROI"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>

          {/* Video */}
          <div className="max-w-3xl mx-auto">
            <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="https://www.loom.com/embed/0b288021895f49338328c6258299068f"
                className="absolute top-0 left-0 w-full h-full border-0"
                allowFullScreen
                allow="fullscreen"
              />
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
                name: 'Joaquín',
                role: 'Founder & Account Manager',
                desc: 'Lidera la estrategia comercial y la implementación del Programa PHA. Partner Oficial de Meta.',
                photo: '/team/joaquin.png',
              },
              {
                name: 'Brenda',
                role: 'AI Agent Manager',
                desc: 'Diseña sistemas escalables que integran agentes, CRM y operaciones.',
                photo: '/team/brenda.png',
              },
              {
                name: 'Diego',
                role: 'Media Buyer',
                desc: 'Lidera la gestión publicitaria en Meta Ads con estrategia y ejecución.',
                photo: '/team/diego.png',
              },
              {
                name: 'Antonela',
                role: 'Designer',
                desc: 'Creativa data-driven especializada en Meta Ads.',
                photo: '/team/antonela.png',
              },
            ].map((member) => (
              <div key={member.name} className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <Image
                  src={member.photo}
                  alt={member.name}
                  width={80}
                  height={80}
                  className="mx-auto mb-4 w-20 h-20 rounded-full object-cover"
                />
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-sm text-blue-600 mb-2">{member.role}</p>
                <p className="text-sm text-gray-600">{member.desc}</p>
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
