import SimulatorForm from '@/components/SimulatorForm';
import NavBar from '@/components/NavBar';
import AnimatedCounter from '@/components/AnimatedCounter';
import Image from 'next/image';
import {
  AlertCircle,
  Megaphone,
  Bot,
  LayoutDashboard,
  ArrowRight,
  Zap,
  Shield,
  MessageSquare,
} from 'lucide-react';

const WHATSAPP_NUMBER = '5492235238176';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hola! Me interesa implementar el agente IA en mi empresa. ¿Podemos agendar una llamada?'
);
const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${WHATSAPP_MESSAGE}`;

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
            IA + Publicidad + CRM. Un equipo dedicado de 4 personas + tecnología que responde en menos de 60 segundos, califica leads y agenda reuniones. 24/7.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#simulador"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-colors"
            >
              Probalo gratis
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-4 rounded-full font-semibold text-lg transition-colors"
            >
              Quiero implementarlo
            </a>
          </div>

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

      {/* Section 3 - Simulator */}
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

          <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-4 mt-10">
            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Instantáneo</p>
                <p className="text-sm text-gray-500">Listo en segundos</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Personalizado</p>
                <p className="text-sm text-gray-500">Conoce tu empresa</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Califica Leads</p>
                <p className="text-sm text-gray-500">Automáticamente</p>
              </div>
            </div>
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
              'Tardás en responder y lo sabés',
              'Te llegan consultas fuera de horario comercial que quedan sin atender',
              'Te llegan muchos leads pero pocos compran',
              'Querés invertir más en publicidad pero no das abasto con las consultas',
              'Tus asesores gastan 60-70% del tiempo en preguntas repetitivas',
              'Tu chatbot genera rechazo',
              'No tenés sistema de seguimiento real',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-white text-lg">{item}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <p className="text-blue-300 text-xl font-medium">
              No es tu culpa. Pero tiene solución.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5 - Solution */}
      <section id="solucion" className="py-14 md:py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Así lo resolvemos
          </h2>
          <p className="text-gray-600 text-center mb-12 text-lg">
            IA + Publicidad + CRM, todo conectado
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Megaphone className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Publicidad que trae compradores
              </h3>
              <p className="text-gray-600">
                Meta Ads optimizados para tu zona. El sistema aprende y trae gente que realmente quiere comprar.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Agente IA que vende por vos 24/7
              </h3>
              <p className="text-gray-600">
                No es un chatbot con menú de opciones. Es una IA que conversa naturalmente, conoce tu constructora, cotiza y agenda reuniones.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <LayoutDashboard className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                CRM donde ves todo sin esfuerzo
              </h3>
              <p className="text-gray-600">
                Cada lead registrado con conversación completa, etiquetas y etapa de compra. El CRM se actualiza automáticamente con IA — sin carga manual, sin Excel.
              </p>
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <p className="text-blue-900 text-lg">
              PHA es tu socio estratégico, no un proveedor de software. Tenés un equipo dedicado de 4 personas trabajando para tu constructora.
            </p>
          </div>

          <div className="max-w-3xl mx-auto mt-4 bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-center">
            <p className="text-slate-700 text-sm leading-relaxed">
              Según{' '}
              <a href="https://www.anthropic.com/research/labor-market-impacts" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900">
                investigación de Anthropic (2026)
              </a>
              , solo el 33% de las tareas automatizables con IA se están implementando hoy.{' '}
              <span className="font-semibold text-slate-900">Las constructoras que adoptan primero capturan clientes que su competencia pierde.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Section 6 - HOY vs CON PHA */}
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
                  'Meta cobra por todos los leads',
                  'Equipo estresado',
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
                  'Meta aprende y trae mejores leads',
                  'Equipo enfocado y motivado',
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

      {/* What the program includes - subtle value communication */}
      <section className="py-14 md:py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Todo lo que incluye el Programa PHA
          </h2>
          <p className="text-gray-600 mb-10 text-lg">
            No es solo un agente IA. Es un sistema completo para generar y cerrar ventas.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-900 mb-1">Sistema publicitario en Meta Ads</p>
              <p className="text-gray-500 text-sm">Campañas optimizadas por zona, audiencia y objetivo. Gestionadas por tu equipo.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-900 mb-1">Agente IA entrenado en tu constructora</p>
              <p className="text-gray-500 text-sm">Responde, cotiza, califica y agenda reuniones. 24/7, en menos de 60 segundos.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-900 mb-1">CRM con actualización automática</p>
              <p className="text-gray-500 text-sm">Cada lead registrado con conversación, etapa de compra y seguimiento. Sin carga manual.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-900 mb-1">Equipo dedicado de 4 personas</p>
              <p className="text-gray-500 text-sm">Account manager, media buyer, diseñadora y AI manager. Trabajando para tu constructora.</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-8">
            Incluye todos los recursos: tokens de IA, creatividades, monitoreo y optimización continua.
          </p>
        </div>
      </section>

      {/* Section 7 - Results */}
      <section id="resultados" className="py-14 md:py-24 px-4 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Resultados reales con números reales
          </h2>
          <p className="text-blue-300 text-center mb-12 text-lg">
            Caso de éxito: Constructora modular en Argentina
          </p>

          {/* Video */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="https://www.loom.com/embed/0b288021895f49338328c6258299068f"
                className="absolute top-0 left-0 w-full h-full border-0"
                allowFullScreen
                allow="fullscreen"
              />
            </div>
          </div>

          {/* Key metrics - animated counters */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto">
            <AnimatedCounter
              end={1139}
              prefix="$"
              className="text-3xl md:text-4xl font-bold text-white"
              labelClassName="text-blue-300 text-sm mt-1"
              label="USD invertidos en Meta Ads"
            />
            <AnimatedCounter
              end={2129}
              className="text-3xl md:text-4xl font-bold text-white"
              labelClassName="text-blue-300 text-sm mt-1"
              label="conversaciones generadas"
            />
            <AnimatedCounter
              end={271}
              className="text-3xl md:text-4xl font-bold text-white"
              labelClassName="text-blue-300 text-sm mt-1"
              label="leads calificados"
            />
            <AnimatedCounter
              end={127}
              className="text-3xl md:text-4xl font-bold text-white"
              labelClassName="text-blue-300 text-sm mt-1"
              label="entrevistas agendadas"
            />
            <AnimatedCounter
              end={8.97}
              prefix="$"
              decimals={2}
              className="text-3xl md:text-4xl font-bold text-emerald-400"
              labelClassName="text-blue-300 text-sm mt-1"
              label="costo por entrevista"
            />
            <AnimatedCounter
              end={0.54}
              prefix="$"
              decimals={2}
              className="text-3xl md:text-4xl font-bold text-emerald-400"
              labelClassName="text-blue-300 text-sm mt-1"
              label="costo por conversación"
            />
          </div>
        </div>
      </section>

      {/* Section 8 - Equipo */}
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
                  width={64}
                  height={64}
                  className="mx-auto mb-4 w-16 h-16 rounded-full object-cover"
                />
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-sm text-blue-600 mb-2">{member.role}</p>
                <p className="text-sm text-gray-600">{member.desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto mt-16 space-y-4">
            {[
              '+9 años en publicidad digital, +$10M USD en ventas generadas',
              '+$50K USD invertidos en educación (tendencias USA/Europa)',
              'Software + CRM especializado en la industria de la construcción',
              'Low fee + comisión: crecemos juntos, a tu ritmo',
              'Partners de Meta, expertos en automatización con IA',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <ArrowRight className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-gray-800 text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 9 - CTA Final */}
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
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-full font-bold text-lg transition-colors shadow-lg"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Quiero implementarlo
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

      {/* Section 10 - Footer */}
      <footer className="py-8 px-4 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            PHA - Sistemas de IA para la industria de la construcción
          </p>
          <p className="text-gray-400 text-xs mt-2">
            © 2026 PHA. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
