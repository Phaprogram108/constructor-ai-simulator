'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SimulatorForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTab, setPdfTab] = useState('url');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF');
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        setError('El archivo no puede superar 30MB');
        return;
      }
      setPdfFile(file);
      setError('');
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
    setLoading(true);

    try {
      // Validate URL
      if (!websiteUrl) {
        throw new Error('Ingresá la URL de tu sitio web');
      }

      let url = websiteUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
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
        setLoadingMessage('Subiendo catálogo...');
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
      setLoadingMessage('Analizando sitio web...');
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
          messagesRemaining: data.messagesRemaining || 50,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        messages: data.welcomeMessage ? [{
          id: 'welcome',
          role: 'assistant',
          content: data.welcomeMessage,
          timestamp: new Date(),
        }] : [],
        systemPrompt: data.systemPrompt,
      };

      console.log('[SimulatorForm] Saving session data:', {
        sessionId: data.sessionId,
        companyName: data.companyName,
        messagesRemaining: data.messagesRemaining,
        welcomeMessage: data.welcomeMessage?.slice(0, 100),
        systemPromptLength: data.systemPrompt?.length,
      });

      localStorage.setItem(`session-${data.sessionId}`, JSON.stringify(sessionData));

      // Redirect to chat
      router.push(`/demo/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
      setLoadingMessage('');
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
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={loading}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Extraeremos informacion de tu empresa automaticamente
            </p>
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
                  onChange={(e) => setPdfUrl(e.target.value)}
                  disabled={loading}
                  className="h-12 text-base"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  URL de tu catalogo online o PDF
                </p>
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
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p>O subi tu catalogo en PDF</p>
                      <p className="text-xs">Maximo 30MB</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
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
                {loadingMessage || 'Generando agente...'}
              </span>
            ) : (
              'Generar Mi Agente IA'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
