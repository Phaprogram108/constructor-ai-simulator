'use client';

import { useState } from 'react';

const WHATSAPP_NUMBER = '5492235238176';

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
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tu constructora califica</h3>
                <p className="text-gray-600">
                  El Programa PHA puede funcionar para tu empresa. El siguiente paso es una llamada de 60 minutos con Joaquín para evaluar tu caso.
                </p>
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-colors shadow-lg"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Coordiná una llamada con Joaquín
              </a>
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
