import { Check } from 'lucide-react';

type Msg = { from: 'lead' | 'bot'; text: string; time: string };

const CONVERSATION: Msg[] = [
  { from: 'lead', text: 'Hola quería saber modelos y precios.', time: '17:04' },
  {
    from: 'bot',
    text: 'Hola! Soy Sofi. Te acabo de enviar nuestro catálogo 2026 con todos los modelos de casas modulares de hormigón.',
    time: '17:04',
  },
  {
    from: 'bot',
    text: 'Tenemos opciones de 1, 2 y 3 dormitorios, casas más amplias y también quinchos y dúplex. Contame qué superficie estás buscando y en qué ciudad estaría el terreno y te digo qué modelos te convienen.',
    time: '17:05',
  },
  {
    from: 'lead',
    text: 'Estoy buscando 2 dormitorios, casa de fin de semana en Potrero de Garay, Córdoba.',
    time: '17:08',
  },
  {
    from: 'bot',
    text: 'Perfecto, para 2 dormitorios tenés varias opciones: CARMELA 52 m², MICAELA 60 m², DANIELA 61 m², JUSTINA 59 m² y ESTEFANÍA 69 m². Todas con estar-comedor, cocina, 2 dormitorios, baño y galería.',
    time: '17:08',
  },
  {
    from: 'bot',
    text: '¿Te interesa alguna en particular para avanzar con el valor exacto para tu zona?',
    time: '17:09',
  },
];

export default function WhatsAppMockup() {
  return (
    <div className="w-full max-w-sm mx-auto bg-[#0c1f15] rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
      {/* Header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          S
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">Sofi</p>
          <p className="text-emerald-400 text-xs">en línea</p>
        </div>
      </div>

      {/* Chat body */}
      <div
        className="px-3 py-4 space-y-2 max-h-[440px] overflow-hidden"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 6px)',
        }}
      >
        {CONVERSATION.map((msg, i) => {
          const isBot = msg.from === 'bot';
          return (
            <div
              key={i}
              className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`relative max-w-[85%] px-3 py-2 rounded-lg text-sm leading-snug shadow ${
                  isBot
                    ? 'bg-[#202c33] text-slate-100 rounded-tl-sm'
                    : 'bg-[#005c4b] text-white rounded-tr-sm'
                }`}
              >
                <p>{msg.text}</p>
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isBot ? 'text-slate-400' : 'text-emerald-200/80'
                  }`}
                >
                  <span>{msg.time}</span>
                  {!isBot && (
                    <span className="flex -space-x-1.5" aria-hidden>
                      <Check className="w-3 h-3" strokeWidth={3} />
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="bg-[#202c33] px-3 py-2.5 rounded-lg rounded-tl-sm flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
