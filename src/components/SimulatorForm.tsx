'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al subir el PDF');
    }

    const data = await response.json();
    return data.url;
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

      // Handle PDF upload if file selected
      if (pdfTab === 'url' && pdfUrl) {
        body.pdfUrl = pdfUrl;
      } else if (pdfTab === 'upload' && pdfFile) {
        setLoadingMessage('Subiendo catálogo...');
        const uploadedUrl = await uploadPdf(pdfFile);
        body.pdfUrl = uploadedUrl;
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
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Configurar tu Agente IA</CardTitle>
        <CardDescription>
          Ingresá los datos de tu constructora para generar un agente personalizado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">URL de tu Sitio Web *</Label>
            <Input
              id="websiteUrl"
              type="text"
              placeholder="www.tuconstructor.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Extraeremos información de tu empresa automáticamente
            </p>
          </div>

          {/* PDF Input */}
          <div className="space-y-2">
            <Label>Catálogo de Productos (Opcional)</Label>
            <Tabs value={pdfTab} onValueChange={setPdfTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Link PDF</TabsTrigger>
                <TabsTrigger value="upload">Subir PDF</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-3">
                <Input
                  type="url"
                  placeholder="https://ejemplo.com/catalogo.pdf"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  disabled={loading}
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-3">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
                      <p>Hacé clic para subir un PDF</p>
                      <p className="text-xs">Máximo 30MB</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              El PDF ayuda al agente a conocer tus productos y precios
            </p>
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
      </CardContent>
    </Card>
  );
}
