export default function HbrChart() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest uppercase text-blue-600 mb-5 text-center">
        Harvard Business Review · Estudio de conversión de leads
      </p>

      {/* Chart */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 md:gap-x-6 gap-y-3 items-center mb-6">
        {/* Fila 1: menos de 5 min */}
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">&lt; 5 min</p>
          <p className="text-[11px] text-gray-500">respuesta</p>
        </div>
        <div className="relative h-10 md:h-12">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-3 shadow-lg shadow-blue-500/30"
            style={{ width: '100%' }}
          >
            <span className="text-white text-base md:text-lg font-bold whitespace-nowrap">
              21×
            </span>
          </div>
        </div>

        {/* Fila 2: más de 30 min */}
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">&gt; 30 min</p>
          <p className="text-[11px] text-gray-500">respuesta</p>
        </div>
        <div className="relative h-10 md:h-12">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-gray-200 flex items-center justify-end pr-3"
            style={{ width: '4.76%' }}
          >
            <span className="text-gray-600 text-base md:text-lg font-bold whitespace-nowrap absolute -right-8 md:-right-10">
              1×
            </span>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-gray-700 text-sm md:text-base text-center leading-relaxed">
        <span className="font-semibold">¿Sabías?</span> Si respondés en menos de 5 minutos, tenés{' '}
        <span className="font-bold text-blue-600">21× más chances</span> de calificar un lead que si tardás más de 30 minutos.
      </p>
    </div>
  );
}
