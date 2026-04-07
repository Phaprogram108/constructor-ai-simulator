'use client';

import { useEffect, useState } from 'react';

interface ScrapingMetadata {
  method: string;
  duration: number;
  modelsFound: number;
  whatsappFound: boolean;
  instagramFound: boolean;
  linktreeExplored: boolean;
  pdfAnalyzed: boolean;
}

interface ConversationAnalysis {
  conversationQuality: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  noInfoResponses: number;
  possibleHallucinations: number;
  issues: string[];
}

interface EnhancedConversationLog {
  sessionId: string;
  companyName: string;
  companyUrl: string;
  constructoraType: string;
  scraping: ScrapingMetadata;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    flags?: {
      saidNoInfo: boolean;
      possibleHallucination: boolean;
      validationConfidence?: number;
    };
  }>;
  analysis: ConversationAnalysis;
  createdAt: string;
  lastMessageAt: string;
}

interface AggregatedMetrics {
  totalSessions: number;
  avgQuality: number;
  whatsappRate: number;
  noInfoRate: number;
  hallucinationRate: number;
  avgScrapingTime: number;
  byType: Record<string, number>;
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<EnhancedConversationLog[]>([]);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<EnhancedConversationLog | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const response = await fetch('/api/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      const data = await response.json();
      setLogs(data.logs);
      setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.constructoraType !== filterType) {
      return false;
    }
    if (log.analysis.conversationQuality < minScore) {
      return false;
    }
    return true;
  });

  function getQualityColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Cargando analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics Dashboard</h1>

        {/* Metricas agregadas */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Sesiones</div>
              <div className="text-2xl font-bold">{metrics.totalSessions}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Calidad Promedio</div>
              <div className={`text-2xl font-bold ${metrics.avgQuality >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                {metrics.avgQuality.toFixed(0)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Tasa WhatsApp</div>
              <div className="text-2xl font-bold">{(metrics.whatsappRate * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Tasa No Info</div>
              <div className={`text-2xl font-bold ${metrics.noInfoRate > 0.2 ? 'text-red-600' : 'text-gray-700'}`}>
                {(metrics.noInfoRate * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Alucinaciones</div>
              <div className={`text-2xl font-bold ${metrics.hallucinationRate > 0.1 ? 'text-red-600' : 'text-gray-700'}`}>
                {(metrics.hallucinationRate * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Tiempo Scraping</div>
              <div className="text-2xl font-bold">{formatDuration(metrics.avgScrapingTime)}</div>
            </div>
          </div>
        )}

        {/* Distribucion por tipo */}
        {metrics && Object.keys(metrics.byType).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-8">
            <h2 className="text-lg font-semibold mb-4">Distribucion por Tipo</h2>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(metrics.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {type}: {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Tipo</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">Todos</option>
                <option value="modular">Modular</option>
                <option value="tradicional">Tradicional</option>
                <option value="mixta">Mixta</option>
                <option value="unknown">Desconocido</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Score minimo</label>
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-32"
              />
              <span className="ml-2">{minScore}%</span>
            </div>
            <div className="text-sm text-gray-500">
              Mostrando {filteredLogs.length} de {logs.length} sesiones
            </div>
          </div>
        </div>

        {/* Tabla de empresas */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mensajes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modelos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr
                  key={log.sessionId}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.companyName}</div>
                    <div className="text-sm text-gray-500 truncate max-w-[200px]">{log.companyUrl}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100">
                      {log.constructoraType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-sm font-semibold rounded ${getQualityColor(log.analysis.conversationQuality)}`}>
                      {log.analysis.conversationQuality}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.analysis.totalMessages}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.scraping.modelsFound}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.scraping.whatsappFound ? (
                      <span className="text-green-600">Si</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.analysis.issues.length > 0 ? (
                      <span className="text-red-600">{log.analysis.issues.length}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal de detalle */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{selectedLog.companyName}</h2>
                  <a href={selectedLog.companyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">
                    {selectedLog.companyUrl}
                  </a>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  x
                </button>
              </div>

              {/* Metricas del log */}
              <div className="p-6 border-b grid grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Score</div>
                  <div className={`text-xl font-bold ${selectedLog.analysis.conversationQuality >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedLog.analysis.conversationQuality}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Modelos</div>
                  <div className="text-xl font-bold">{selectedLog.scraping.modelsFound}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Scraping</div>
                  <div className="text-xl font-bold">{formatDuration(selectedLog.scraping.duration)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Tipo</div>
                  <div className="text-xl font-bold">{selectedLog.constructoraType}</div>
                </div>
              </div>

              {/* Issues */}
              {selectedLog.analysis.issues.length > 0 && (
                <div className="p-4 bg-red-50 border-b">
                  <div className="text-sm font-medium text-red-800 mb-2">Issues detectados:</div>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {selectedLog.analysis.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conversacion */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                <h3 className="font-semibold mb-4">Conversacion ({selectedLog.messages.length} mensajes)</h3>
                <div className="space-y-4">
                  {selectedLog.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-100 ml-8'
                          : 'bg-gray-100 mr-8'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {msg.role === 'user' ? 'Usuario' : 'Sofia'}
                        </span>
                        {msg.flags && (
                          <div className="flex gap-1">
                            {msg.flags.saidNoInfo && (
                              <span className="px-1 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">
                                No info
                              </span>
                            )}
                            {msg.flags.possibleHallucination && (
                              <span className="px-1 py-0.5 bg-red-200 text-red-800 text-xs rounded">
                                Alucinacion?
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
