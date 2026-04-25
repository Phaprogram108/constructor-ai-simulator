'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MAX_PDF_SIZE_MB = 10;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

export default function SimulatorForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [whatsapp, setWhatsapp] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTab, setPdfTab] = useState('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    whatsapp?: string;
    websiteUrl?: string;
    pdfUrl?: string;
    pdfFile?: string;
  }>({});
  const [progressMessage, setProgressMessage] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

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
    setProgressMessage('Validando tus datos...');
    setElapsedSec(0);

    setLoading(true);

    try {
      // Validate WhatsApp
      const digitsOnly = whatsapp.replace(/\D/g, '');
      if (!whatsapp.trim()) {
        setFieldErrors(prev => ({ ...prev, whatsapp: 'Ingresa tu numero de WhatsApp' }));
        setLoading(false);
        return;
      }
      if (digitsOnly.length < 8) {
        setFieldErrors(prev => ({ ...prev, whatsapp: 'El numero debe tener al menos 8 digitos' }));
        setLoading(false);
        return;
      }

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

      // Fire-and-forget: send lead data
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, websiteUrl: url, createdAt: new Date().toISOString() }),
      }).catch(() => {}); // silently ignore errors

      setProgressMessage('Conectando con tu sitio web...');

      // Elapsed-seconds counter while the stream is live.
      const startedAt = Date.now();
      const elapsedTimer = setInterval(() => {
        setElapsedSec(Math.round((Date.now() - startedAt) / 1000));
      }, 1000);

      // Consume the SSE stream from /api/simulator/create-stream
      const response = await fetch('/api/simulator/create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        clearInterval(elapsedTimer);
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Error al crear la sesión');
        }
        throw new Error('Error del servidor. Intentá de nuevo.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneEvent: {
        sessionId: string;
        companyName: string;
        websiteUrl: string;
        welcomeMessage: string;
        messagesRemaining: number;
      } | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by a blank line
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const event = JSON.parse(line.replace(/^data: /, ''));
            if (event.type === 'status') {
              setProgressMessage(event.message);
            } else if (event.type === 'error') {
              clearInterval(elapsedTimer);
              throw new Error(event.error || 'Error al crear la sesión');
            } else if (event.type === 'done') {
              doneEvent = event;
            }
          } catch (parseErr) {
            console.warn('[SimulatorForm] SSE parse error:', parseErr);
          }
        }
      }

      clearInterval(elapsedTimer);

      if (!doneEvent) {
        throw new Error('La generación terminó sin respuesta. Intentá de nuevo.');
      }

      // Store session data in localStorage for the demo page
      const sessionData = {
        session: {
          id: doneEvent.sessionId,
          companyName: doneEvent.companyName || 'Constructora',
          websiteUrl: doneEvent.websiteUrl || url,
          messagesRemaining: doneEvent.messagesRemaining || 50,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        messages: doneEvent.welcomeMessage
          ? [
              {
                id: 'welcome',
                role: 'assistant',
                content: doneEvent.welcomeMessage,
                timestamp: new Date(),
              },
            ]
          : [],
      };

      localStorage.setItem(`session-${doneEvent.sessionId}`, JSON.stringify(sessionData));

      router.push(`/demo/${doneEvent.sessionId}`);
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
          {/* WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="text-base font-medium">Tu WhatsApp *</Label>
            <Input
              id="whatsapp"
              type="tel"
              placeholder="+54 9 11 1234-5678"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setFieldErrors(prev => ({ ...prev, whatsapp: undefined }));
              }}
              disabled={loading}
              className={`h-12 text-base ${fieldErrors.whatsapp ? 'border-red-500' : ''}`}
            />
            {fieldErrors.whatsapp && (
              <p className="text-sm text-red-500">{fieldErrors.whatsapp}</p>
            )}
          </div>

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

          {/* Progress (live from server) */}
          {loading && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-blue-600 animate-spin shrink-0" viewBox="0 0 24 24">
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
                <p className="text-sm font-medium text-gray-800 flex-1">
                  {progressMessage || 'Preparando tu agente...'}
                </p>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                  {elapsedSec}s
                </span>
              </div>

              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 bg-[length:200%_100%] animate-[progressSlide_2s_linear_infinite]"
                  style={{ width: '100%' }}
                />
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Puede tardar hasta 2 minutos según el tamaño del sitio.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
