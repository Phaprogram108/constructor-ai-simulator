'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const PROGRESS_STEPS = [
  { id: 'validate', label: 'Verificando URL...' },
  { id: 'upload', label: 'Subiendo catalogo PDF...' },
  { id: 'map', label: 'Mapeando sitio web...' },
  { id: 'scrape', label: 'Extrayendo contenido...' },
  { id: 'generate', label: 'Generando agente IA...' },
];

export default function SimulatorForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTab, setPdfTab] = useState('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    websiteUrl?: string;
    pdfUrl?: string;
    pdfFile?: string;
  }>({});
  const [currentStep, setCurrentStep] = useState(-1);
  const [hasPdf, setHasPdf] = useState(false);

  // Simular progreso durante la carga
  useEffect(() => {
    if (!loading) {
      setCurrentStep(-1);
      return;
    }

    // Tiempos aproximados para cada paso (acumulativos)
    const stepTimings = hasPdf
      ? [0, 1500, 4000, 7000, 12000] // Con PDF
      : [0, -1, 2500, 5500, 10000];  // Sin PDF (-1 = skip)

    const timeouts: NodeJS.Timeout[] = [];

    stepTimings.forEach((time, index) => {
      if (time < 0) return; // Skip this step
      const timeout = setTimeout(() => {
        setCurrentStep(index);
      }, time);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [loading, hasPdf]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFieldErrors(prev => ({ ...prev, pdfFile: undefined }));

    if (file) {
      if (file.type !== 'application/pdf') {
        setFieldErrors(prev => ({ ...prev, pdfFile: 'Solo se permiten archivos PDF' }));
        return;
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        setFieldErrors(prev => ({
          ...prev,
          pdfFile: `Tu PDF excede el peso maximo de ${MAX_PDF_SIZE_MB}MB`
        }));
        return;
      }
      setPdfFile(file);
      setError('');
    }
  };

  const validateUrl = async (url: string, fieldName: 'websiteUrl' | 'pdfUrl'): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors',
      });

      clearTimeout(timeoutId);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setFieldErrors(prev => ({
          ...prev,
          [fieldName]: 'La URL tardo demasiado en responder. Verifica que sea correcta.'
        }));
      } else {
        // With no-cors mode, we can't check response status, so we assume it's ok
        // if we get here without an abort error
        return true;
      }
      return false;
    }
  };

  const uploadPdf = async (file: File): Promise<string> => {
    // Client-side upload directly to Vercel Blob
    const blob = await upload(`catalogs/${Date.now()}-${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
    });

    return blob.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Determinar si hay PDF para mostrar ese paso
    const willHavePdf = (pdfTab === 'url' && pdfUrl) || (pdfTab === 'upload' && pdfFile);
    setHasPdf(!!willHavePdf);

    setLoading(true);

    try {
      // Validate website URL is provided
      if (!websiteUrl) {
        setFieldErrors(prev => ({ ...prev, websiteUrl: 'Ingresa la URL de tu sitio web' }));
        setLoading(false);
        return;
      }

      let url = websiteUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Validate website URL format
      try {
        new URL(url);
      } catch {
        setFieldErrors(prev => ({ ...prev, websiteUrl: 'URL invalida. Verifica el formato.' }));
        setLoading(false);
        return;
      }

      // Validate website URL is accessible
      const websiteValid = await validateUrl(url, 'websiteUrl');
      if (!websiteValid) {
        setLoading(false);
        return;
      }

      // Validate catalog URL if provided
      if (pdfTab === 'url' && pdfUrl) {
        let catalogUrl = pdfUrl;
        if (!catalogUrl.startsWith('http://') && !catalogUrl.startsWith('https://')) {
          catalogUrl = 'https://' + catalogUrl;
        }

        try {
          new URL(catalogUrl);
        } catch {
          setFieldErrors(prev => ({ ...prev, pdfUrl: 'URL del catalogo invalida.' }));
          setLoading(false);
          return;
        }

        const catalogValid = await validateUrl(catalogUrl, 'pdfUrl');
        if (!catalogValid) {
          setLoading(false);
          return;
        }
      }

      // Prepare request body
      const body: {
        websiteUrl: string;
        pdfUrl?: string;
      } = { websiteUrl: url };

      // Handle PDF - URL only for now (upload has issues with large files)
      if (pdfTab === 'url' && pdfUrl) {
        body.pdfUrl = pdfUrl;
      } else if (pdfTab === 'upload' && pdfFile) {
        try {
          const uploadedUrl = await uploadPdf(pdfFile);
          body.pdfUrl = uploadedUrl;
        } catch (uploadError) {
          console.error('PDF upload error:', uploadError);
          // Continue without PDF - show warning but don't fail
          setError('No se pudo subir el PDF. Continuando sin catálogo...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Show warning briefly
          setError('');
        }
      }

      // Create session
      const response = await fetch('/api/simulator/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Error del servidor. Intentá de nuevo.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la sesión');
      }

      // Store session data in localStorage for the demo page
      const sessionData = {
        session: {
          id: data.sessionId,
          companyName: data.companyName || 'Constructora',
          websiteUrl: data.websiteUrl || url,
          messagesRemaining: data.messagesRemaining || 50,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        messages: data.welcomeMessage ? [{
          id: 'welcome',
          role: 'assistant',
          content: data.welcomeMessage,
          timestamp: new Date(),
        }] : [],
      };

      console.log('[SimulatorForm] Saving session data:', {
        sessionId: data.sessionId,
        companyName: data.companyName,
        messagesRemaining: data.messagesRemaining,
        welcomeMessage: data.welcomeMessage?.slice(0, 100),
      });

      localStorage.setItem(`session-${data.sessionId}`, JSON.stringify(sessionData));

      // Redirect to chat
      router.push(`/demo/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurar tu Agente IA</h2>
        <p className="text-gray-600">
          Ingresa los datos de tu constructora para generar un agente personalizado
        </p>
      </div>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl" className="text-base font-medium">URL de tu Sitio Web *</Label>
            <Input
              id="websiteUrl"
              type="text"
              placeholder="www.tuconstructor.com"
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                setFieldErrors(prev => ({ ...prev, websiteUrl: undefined }));
              }}
              disabled={loading}
              className={`h-12 text-base ${fieldErrors.websiteUrl ? 'border-red-500' : ''}`}
            />
            {fieldErrors.websiteUrl ? (
              <p className="text-sm text-red-500">{fieldErrors.websiteUrl}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Extraeremos informacion de tu empresa automaticamente
              </p>
            )}
          </div>

          {/* PDF Input */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Link del Catalogo (Opcional)</Label>
            <Tabs value={pdfTab} onValueChange={setPdfTab}>
              <TabsList className="grid w-full grid-cols-2 h-11">
                <TabsTrigger value="url" className="text-sm">Link del Catalogo</TabsTrigger>
                <TabsTrigger value="upload" className="text-sm">Subir PDF</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-4">
                <Input
                  type="url"
                  placeholder="https://ejemplo.com/catalogo"
                  value={pdfUrl}
                  onChange={(e) => {
                    setPdfUrl(e.target.value);
                    setFieldErrors(prev => ({ ...prev, pdfUrl: undefined }));
                  }}
                  disabled={loading}
                  className={`h-12 text-base ${fieldErrors.pdfUrl ? 'border-red-500' : ''}`}
                />
                {fieldErrors.pdfUrl ? (
                  <p className="text-sm text-red-500 mt-2">{fieldErrors.pdfUrl}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    URL de tu catalogo online o PDF
                  </p>
                )}
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                  {pdfFile ? (
                    <div className="text-sm">
                      <p className="font-medium text-green-600">{pdfFile.name}</p>
                      <p className="text-muted-foreground">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfFile(null);
                          setFieldErrors(prev => ({ ...prev, pdfFile: undefined }));
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  ) : fieldErrors.pdfFile ? (
                    <div className="text-sm text-red-500">
                      <p>{fieldErrors.pdfFile}</p>
                      <p className="text-xs text-muted-foreground mt-1">Maximo {MAX_PDF_SIZE_MB}MB</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p>O subi tu catalogo en PDF</p>
                      <p className="text-xs">Maximo {MAX_PDF_SIZE_MB}MB</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creando tu agente...
              </span>
            ) : (
              'Generar Mi Agente IA'
            )}
          </Button>

          {/* Progress Steps */}
          {loading && (
            <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Creando tu agente IA...</p>
              {PROGRESS_STEPS.map((step, index) => {
                // Skip PDF step if no PDF
                if (step.id === 'upload' && !hasPdf) return null;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 transition-all duration-300 ${
                      currentStep >= index
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="text-base w-5 text-center">
                      {currentStep > index ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : currentStep === index ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />
                      )}
                    </span>
                    <span className={`text-sm ${currentStep === index ? 'font-medium' : ''}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
                Esto puede tomar entre 10 segundos y 2 minutos según el tamaño del sitio...
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
