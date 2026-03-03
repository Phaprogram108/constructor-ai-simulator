import SimulatorForm from '@/components/SimulatorForm';
import Image from 'next/image';
import {
  AlertCircle,
  Megaphone,
  Bot,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';

const WHATSAPP_NUMBER = '5492235238176';
const WHATSAPP_MESSAGE = encodeURIComponent('Hola! Me interesa implementar el agente IA en mi empresa. ¿Podemos agendar una llamada?');
const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${WHATSAPP_MESSAGE}`;

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 1. Banner de Piloto */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-4xl mx-auto px-4 py-2 text-center">
          <p className="text-amber-800 text-sm">
            <span className="font-semibold">🚀 Versión Piloto</span>
            {' — '}
            Este es un demo para mostrar el potencial de la tecnología.
            Los resultados pueden variar según el sitio web analizado.
          </p>
        </div>
      </div>

      {/* 2. Hero Section */}
      <section className="pt-12 pb-4 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Tu Vendedora IA
            <span className="text-blue-600"> en 60 segundos</span>
          </h1>

          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Genera un agente de ventas personalizado que conoce tu constructora,
            tus modelos y responde consultas 24/7.
          </p>
        </div>
      </section>

      {/* 3. How it works - 3-step */}
      <section className="pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Como Funciona
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Ingresa tu Web
              </h3>
              <p className="text-gray-600 text-sm">
                Extraemos automaticamente la informacion de tu constructora
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Agrega tu Catalogo
                <span className="text-xs text-green-600 ml-1">(Opcional)</span>
              </h3>
              <p className="text-gray-600 text-sm">
                Opcional pero recomendado: link a tu catalogo online o PDF con tus modelos
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Chatea con Sofia
              </h3>
              <p className="text-gray-600 text-sm">
                Tu asesora IA lista para responder consultas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SimulatorForm card */}
      <section className="pb-8 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-100">
          <SimulatorForm />
        </div>
      </section>

      {/* 5. Feature strip (3 cards) */}
      <section className="pb-12 px-4">
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Instantaneo</p>
              <p className="text-sm text-gray-500">Listo en segundos</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Personalizado</p>
              <p className="text-sm text-gray-500">Conoce tu empresa</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Califica Leads</p>
              <p className="text-sm text-gray-500">Automaticamente</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Pain Points */}
      <section className="py-16 px-4 bg-blue-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            ¿Te pasa alguna de estas cosas?
          </h2>
          <div className="space-y-4">
            {[
              'Elegís entre trabajo y vida personal',
              'Te llegan muchos leads pero pocos compran',
              'Tardás en responder y lo sabés',
              'Tu chatbot genera rechazo',
              'No tenés sistema de seguimiento real',
              'El proceso de venta es largo y se te escapan',
              'Los márgenes son ajustados',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-white text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Loom Video Section (moved up) */}
      <section id="caso-exito-video" className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                Caso de exito real
              </h2>
            </div>
            <p className="text-gray-600">
              Constructora en Argentina que consigue llamadas calificadas a $20 USD c/u
            </p>
          </div>
          <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src="https://www.loom.com/embed/0b288021895f49338328c6258299068f"
              className="absolute top-0 left-0 w-full h-full border-0"
              allowFullScreen
              allow="fullscreen"
            />
          </div>
        </div>
      </section>

      {/* 8. How It Works in Detail */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Publicidad que trae compradores (no curiosos)
                </h3>
                <p className="text-gray-600">
                  Meta Ads en tu zona → el sistema aprende y trae más gente parecida
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Un agente IA que responde por vos (24/7)
                </h3>
                <p className="text-gray-600">
                  Sabe todo de tu constructora, cotiza, califica y agenda llamadas/visitas al showroom o unidad
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Un CRM donde ves todo sin esfuerzo
                </h3>
                <p className="text-gray-600">
                  Cada lead registrado con conversación, etiquetas y etapa de compra
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Results */}
      <section className="py-16 px-4 bg-blue-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            ¿Esto realmente funciona?
          </h2>
          <div className="grid md:grid-cols-2 gap-10">
            {/* Left: Benefits */}
            <div className="space-y-4">
              {[
                'Respondés en segundos, no en horas',
                'Filtrás curiosos antes de que te hagan perder tiempo',
                'Mantenés el contacto con leads que tardan meses',
                'Sabés exactamente qué funciona en tu publicidad',
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-white text-lg">{benefit}</p>
                </div>
              ))}
            </div>

            {/* Right: Funnel bars */}
            <div className="space-y-3">
              <div className="bg-blue-600 rounded-lg px-4 py-2.5 w-full">
                <span className="text-white font-bold">Conversaciones</span>
                <span className="text-white/90 text-sm ml-2">1,542 | $0.5</span>
              </div>
              <div className="bg-blue-500 rounded-lg px-4 py-2.5" style={{ width: '72%' }}>
                <span className="text-white font-bold">Presupuestos</span>
                <span className="text-white/90 text-sm ml-2">235 | $3</span>
              </div>
              <div className="bg-teal-500 rounded-lg px-4 py-2.5" style={{ width: '50%' }}>
                <span className="text-white font-bold">Leads Calificados</span>
                <span className="text-white/90 text-sm ml-2">101 | $7</span>
              </div>
              <div className="bg-emerald-500 rounded-lg px-4 py-2.5" style={{ width: '35%' }}>
                <span className="text-white font-bold">Entrevistas</span>
                <span className="text-white/90 text-sm ml-2">42 | $18</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Why Us + Team */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          {/* 10a. Why Us */}
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-10">
            ¿Por qué nosotros?
          </h2>
          <div className="space-y-4 mb-16">
            {[
              '+9 años en publicidad digital, +$10M USD en ventas generadas',
              '+$50K USD invertidos en educación (tendencias USA/Europa)',
              'Software + CRM especializado en construcción modular',
              'Low fee + comisión: crecemos juntos, a tu ritmo',
              'Partners de Meta, expertos en automatización con IA',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <ArrowRight className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-gray-800 text-lg">{item}</p>
              </div>
            ))}
          </div>

          {/* 10b. Team */}
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-10">
            Nuestro Equipo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                name: 'Joaquín',
                role: 'Account Manager',
                desc: 'Especialista en automatización de ventas con IA. Partner Oficial de Meta.',
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
              <div key={member.name} className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4">
                <Image
                  src={member.photo}
                  alt={member.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-gray-900">{member.name}</p>
                  <p className="text-sm text-blue-600 mb-1">{member.role}</p>
                  <p className="text-sm text-gray-600">{member.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. HOY vs CON PHA */}
      <section className="py-16 px-4 bg-blue-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-4">
            HABLEMOS PARA VER CÓMO IMPLEMENTARLO EN TU CONSTRUCTORA
          </h2>
          <p className="text-center text-blue-200 mb-10">
            Tomamos hasta 2 nuevas constructoras por mes. No te quedes sin cupo!
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* HOY */}
            <div className="bg-white/10 rounded-xl p-5">
              <h3 className="text-xl font-bold text-white text-center mb-4">HOY (Sin PHA) ❌</h3>
              <div className="space-y-3">
                {[
                  'Respuesta: 2-6 horas (horario laboral)',
                  '100 consultas → 3-4 reuniones (3-4%)',
                  'Asesores gastando 60-70% en soporte',
                  'Se pierden 50-60% de leads',
                  'Sin visibilidad del pipeline',
                  'Meta cobra por todos los leads',
                  'Equipo estresado',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-red-400 shrink-0 mt-0.5">●</span>
                    <p className="text-white/90 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CON PHA */}
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-5">
              <h3 className="text-xl font-bold text-white text-center mb-4">CON PHA ✔</h3>
              <div className="space-y-3">
                {[
                  'Respuesta: menos de 60 segundos (24/7)',
                  '100 consultas → 7-9 reuniones (7-9%)',
                  'Asesores dedicados 100% a reuniones',
                  '0 leads perdidos, seguimiento 3-6 meses',
                  'Dashboard en tiempo real',
                  'Meta aprende y trae mejores leads',
                  'Equipo enfocado y motivado',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0 mt-0.5">●</span>
                    <p className="text-white/90 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* WhatsApp CTA */}
          <div className="text-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-colors shadow-lg"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Escribile a mi agente IA para agendar
            </a>
          </div>
        </div>
      </section>

      {/* 12. Final CTA */}
      <section className="py-16 px-4 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para automatizar tus ventas?
          </h2>
          <p className="text-blue-100 mb-8">
            Agenda una llamada con nuestro equipo y te ayudamos a implementar tu agente IA
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-full font-bold text-lg transition-colors shadow-lg"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Agendar llamada de implementacion
          </a>
        </div>
      </section>

      {/* 13. Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
          <p>Demo del Simulador de Agente IA para Constructoras</p>
        </div>
      </footer>
    </main>
  );
}
