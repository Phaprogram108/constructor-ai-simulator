'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: '¿Cuánto sale el servicio?',
    a: 'Trabajamos con dos planes: uno clásico (fee mensual con trial durante los primeros 3 meses) y uno partner (fee más bajo + comisión sobre ventas generadas). El pricing exacto depende del volumen de consultas y del tipo de constructora. Te damos los números concretos en la sesión estratégica después del quiz de calificación.',
  },
  {
    q: '¿Cuánto tarda en estar operativo?',
    a: 'Cuatro semanas desde la firma del contrato. Semana 1: setup técnico (CRM, WhatsApp Business API, accesos Meta). Semanas 2-3: entrenamiento del agente y producción de primeros creativos en paralelo. Semana 4: soft launch con casos reales y activación de campañas Meta.',
  },
  {
    q: 'Ya tengo un chatbot, ¿qué diferencia tiene el agente de PHA?',
    a: 'Los chatbots tradicionales siguen árboles de decisión y se frustran con preguntas fuera del guión. El agente de PHA usa IA conversacional entrenada con el catálogo, precios y tono de tu constructora. Califica leads, cotiza, agenda reuniones y hace seguimiento automático. Podés probarlo gratis arriba en el simulador.',
  },
  {
    q: '¿Tengo que dejar de trabajar con mi agencia actual?',
    a: 'No necesariamente. El plan clásico se enfoca en automatización, agente IA y CRM, y puede convivir con tu agencia actual de publicidad. El plan partner sí incluye gestión completa de Meta Ads y producción de creativos desde PHA.',
  },
  {
    q: '¿Qué necesito proveer yo?',
    a: 'Acceso a tu Meta Business Manager, WhatsApp, Instagram, manual de marca, catálogo de productos y conversaciones históricas exitosas para entrenar al agente. El compromiso estimado es ~9 horas el primer mes y ~2 horas por mes a partir del segundo.',
  },
  {
    q: '¿Hay garantía si no funciona?',
    a: 'El plan clásico incluye un trial de 3 meses a precio reducido, diseñado específicamente para que puedas validar resultados antes de comprometerte al pricing completo. Si en 90 días no ves impacto concreto, recalibramos la estrategia o cerramos el servicio sin fricciones.',
  },
  {
    q: '¿El agente respeta el tono de mi constructora o suena a robot?',
    a: 'Entrenamos al agente con tu catálogo, zonas de trabajo, precios y tono (formal/informal, tuteo o usted, vocabulario técnico). Iteramos semanalmente en base a conversaciones reales. No es un chatbot genérico: es un vendedor virtual a medida de tu constructora.',
  },
  {
    q: '¿Qué pasa con los leads que quiere atender un humano?',
    a: 'El agente califica y agenda, pero identifica cuándo escalar. Leads calientes, decisores finales o situaciones complejas se derivan a tu equipo comercial con todo el contexto cargado en el CRM. Tu equipo humano se dedica a cerrar ventas, no a filtrar curiosos.',
  },
  {
    q: '¿Funciona para constructoras fuera de Argentina?',
    a: 'Sí. Operamos en LATAM y USA. El agente maneja tuteo argentino por defecto pero se adapta al mercado de cada cliente (español neutro, "usted" formal, etc.). Los casos de éxito actuales están en Argentina.',
  },
  {
    q: '¿Por qué solo toman 2 constructoras nuevas por mes?',
    a: 'Porque el setup es personalizado: 4 semanas de entrenamiento del agente, producción de creativos, configuración de CRM y calibración semanal. Si tomamos más, la calidad cae. Por eso calificamos antes en una sesión estratégica.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.q}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 md:px-6 md:py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-gray-900 text-base md:text-lg">
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 md:px-6 md:pb-6 text-gray-600 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
