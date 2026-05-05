'use client';

import { useState } from 'react';
import CalendarEmbed from './CalendarEmbed';

const WHATSAPP_NUMBER = '5492235407633';

type Answer = string | null;

export default function QualificationForm() {
  const [q1, setQ1] = useState<Answer>(null);
  const [q2, setQ2] = useState<Answer>(null);
  const [q3, setQ3] = useState<Answer>(null);
  const [submitted, setSubmitted] = useState(false);

  const q1Options = [
    'Sí, ya invierto',
    'No, pero quiero empezar',
    'No, por ahora no',
  ];

  const q2Options = [
    'Menos de 10',
    '10-50',
    '50-100',
    'Más de 100',
  ];

  const q3Options = [
    'Menos de 100.000',
    'Entre 100.000 y 500.000',
    'Entre 500.000 y 3.000.000',
    'Más de 3.000.000',
  ];

  const q1Pass = q1 === 'Sí, ya invierto' || q1 === 'No, pero quiero empezar';
  const q2Pass = q2 !== null && q2 !== 'Menos de 10';
  const q3Pass = q3 !== null && q3 !== 'Menos de 100.000';
  const qualifies = q1Pass && q2Pass && q3Pass;

  const handleSubmit = () => {
    if (q1 && q2 && q3) {
      setSubmitted(true);
      // Fire Meta Pixel Lead event
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        window.fbq('track', 'Lead', {
          content_name: 'Qualification Form',
          publicidad: q1,
          consultas_mes: q2,
          facturacion_anual: q3,
        });
      }
      // Fire-and-forget: save qualification data
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'qualification',
          publicidad: q1,
          consultasMes: q2,
          facturacionAnual: q3,
          qualifies: (q1 === 'Sí, ya invierto' || q1 === 'No, pero quiero empezar') && q2 !== 'Menos de 10' && q3 !== 'Menos de 100.000',
          createdAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hola! Completé el formulario en agenteiagratis.com. Me interesa el Programa PHA.\n\nPublicidad digital: ${q1}\nConsultas por mes: ${q2}\nFacturación anual: ${q3}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${whatsappMessage}`;

  return (
    <div className="max-w-2xl mx-auto">
      {!submitted ? (
        <div className="space-y-10">
          {/* Question 1 */}
          <div>
            <p className="text-lg font-semibold text-gray-900 mb-4">
              1. ¿Invertís actualmente en publicidad digital o tenés intención de hacerlo en los próximos 3 meses?
            </p>
            <div className="grid gap-3">
              {q1Options.map((option) => (
                <button
                  key={option}
                  onClick={() => setQ1(option)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                    q1 === option
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div>
            <p className="text-lg font-semibold text-gray-900 mb-4">
              2. ¿Cuántas consultas nuevas recibís por mes?
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {q2Options.map((option) => (
                <button
                  key={option}
                  onClick={() => setQ2(option)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                    q2 === option
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Question 3 */}
          <div>
            <p className="text-lg font-semibold text-gray-900 mb-4">
              3. ¿Cuánto factura tu constructora por año en USD?
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {q3Options.map((option) => (
                <button
                  key={option}
                  onClick={() => setQ3(option)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                    q3 === option
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={!q1 || !q2 || !q3}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition-all ${
                q1 && q2 && q3
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Ver resultado
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {qualifies ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-4 text-left">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Tu constructora califica</h3>
                  <p className="text-gray-600">
                    Reservá una llamada de 60 minutos con Joaquín para evaluar tu caso.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <CalendarEmbed />
                </div>

                <p className="text-sm text-gray-500 text-center">
                  ¿Preferís coordinar por WhatsApp?{' '}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Escribime acá
                  </a>.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Por ahora no es el mejor fit</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Por ahora el Programa PHA no es el mejor fit para tu empresa. Seguí usando la herramienta gratis de arriba — es tuya sin costo. Cuando tu volumen de consultas crezca, volvé a aplicar.
                </p>
              </div>
              <a
                href="#simulador"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-colors"
              >
                Ir al simulador gratis
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
