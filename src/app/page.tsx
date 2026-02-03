import SimulatorForm from '@/components/SimulatorForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="pt-16 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Demo Gratuita - 50 mensajes incluidos
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Tu Vendedora IA
            <span className="text-blue-600"> en 60 segundos</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Genera un agente de ventas personalizado que conoce tu constructora,
            tus modelos y responde consultas 24/7 como si fuera parte de tu equipo.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
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
        </div>
      </section>

      {/* Form Section */}
      <section className="pb-16 px-4">
        <SimulatorForm />
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
            Como Funciona
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
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
                Subi tu Catalogo
              </h3>
              <p className="text-gray-600 text-sm">
                El PDF con tus modelos, precios y especificaciones
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

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
          <p>Demo del Simulador de Agente IA para Constructoras</p>
          <p className="mt-1">Las sesiones expiran a los 30 minutos de inactividad</p>
        </div>
      </footer>
    </main>
  );
}
