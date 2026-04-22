'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, MoveHorizontal } from 'lucide-react';

const BEFORE = [
  'Tu equipo tarda 2 a 6 horas en responder consultas',
  '100 consultas generan apenas 3 a 4 reuniones (3-4%)',
  'Los asesores pierden tiempo atendiendo a curiosos',
  'Se pierden entre 50% y 60% de los leads por falta de seguimiento',
  'CRM desactualizado, cero visibilidad del pipeline',
];

const AFTER = [
  'Respuesta en menos de 60 segundos, 24/7, todos los días',
  '100 consultas generan 7 a 9 reuniones (hasta 3x más)',
  'Los asesores se dedican solo a cerrar leads calificados',
  'Cero leads olvidados: seguimiento automático 3 a 6 meses',
  'Dashboard en tiempo real con todo el pipeline al día',
];

export default function BeforeAfterSlider() {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => updatePosition(e.clientX);
    const handleTouch = (e: TouchEvent) => {
      // Prevent the browser from scrolling / rubber-banding while the
      // user is dragging the divider. Requires a non-passive listener.
      if (e.cancelable) e.preventDefault();
      if (e.touches[0]) updatePosition(e.touches[0].clientX);
    };
    const stop = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [isDragging, updatePosition]);

  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-center text-gray-500 text-sm mb-4 flex items-center justify-center gap-2">
        <MoveHorizontal className="w-4 h-4" />
        Arrastrá el divisor para comparar
      </p>

      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden shadow-2xl select-none touch-none"
        style={{ aspectRatio: '16/10', minHeight: 480 }}
        onMouseDown={(e) => {
          setIsDragging(true);
          updatePosition(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches[0]) updatePosition(e.touches[0].clientX);
        }}
      >
        {/* AFTER layer (full width, bottom) */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 p-6 md:p-12 flex flex-col justify-center">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-widest uppercase text-blue-200 mb-3">
              Con PHA
            </p>
            <h3 className="text-2xl md:text-4xl font-bold text-white mb-6 md:mb-8 tracking-tight">
              Cada consulta se convierte en oportunidad
            </h3>
            <div className="space-y-3 md:space-y-4">
              {AFTER.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-blue-900" strokeWidth={3} />
                  </div>
                  <p className="text-white text-sm md:text-base leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BEFORE layer (clipped by position) */}
        <div
          className="absolute inset-0 bg-slate-900 p-6 md:p-12 flex flex-col justify-center"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-widest uppercase text-red-300 mb-3">
              Hoy sin PHA
            </p>
            <h3 className="text-2xl md:text-4xl font-bold text-white mb-6 md:mb-8 tracking-tight">
              Cada consulta es una oportunidad perdida
            </h3>
            <div className="space-y-3 md:space-y-4">
              {BEFORE.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-white text-sm md:text-base leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
          style={{ left: `${position}%` }}
        />

        {/* Handle */}
        <button
          type="button"
          aria-label="Arrastrar para comparar"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform z-10 touch-none"
          style={{ left: `${position}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        >
          <MoveHorizontal className="w-6 h-6 text-slate-700" />
        </button>
      </div>
    </div>
  );
}
