import { NextResponse } from 'next/server';
import { listEnhancedLogs, EnhancedConversationLog } from '@/lib/conversation-logger';

interface AggregatedMetrics {
  totalSessions: number;
  avgQuality: number;
  whatsappRate: number;
  noInfoRate: number;
  hallucinationRate: number;
  avgScrapingTime: number;
  byType: Record<string, number>;
}

function calculateMetrics(logs: EnhancedConversationLog[]): AggregatedMetrics {
  if (logs.length === 0) {
    return {
      totalSessions: 0,
      avgQuality: 0,
      whatsappRate: 0,
      noInfoRate: 0,
      hallucinationRate: 0,
      avgScrapingTime: 0,
      byType: {},
    };
  }

  const totalSessions = logs.length;

  // Calidad promedio
  const avgQuality = logs.reduce((sum, log) => sum + log.analysis.conversationQuality, 0) / totalSessions;

  // Tasa de WhatsApp encontrado
  const whatsappCount = logs.filter(log => log.scraping.whatsappFound).length;
  const whatsappRate = whatsappCount / totalSessions;

  // Tasa de respuestas "no tengo info"
  const totalAssistantMessages = logs.reduce((sum, log) => sum + log.analysis.assistantMessages, 0);
  const totalNoInfo = logs.reduce((sum, log) => sum + log.analysis.noInfoResponses, 0);
  const noInfoRate = totalAssistantMessages > 0 ? totalNoInfo / totalAssistantMessages : 0;

  // Tasa de alucinaciones
  const totalHallucinations = logs.reduce((sum, log) => sum + log.analysis.possibleHallucinations, 0);
  const hallucinationRate = totalAssistantMessages > 0 ? totalHallucinations / totalAssistantMessages : 0;

  // Tiempo promedio de scraping
  const avgScrapingTime = logs.reduce((sum, log) => sum + log.scraping.duration, 0) / totalSessions;

  // Distribucion por tipo
  const byType: Record<string, number> = {};
  for (const log of logs) {
    const type = log.constructoraType || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    totalSessions,
    avgQuality,
    whatsappRate,
    noInfoRate,
    hallucinationRate,
    avgScrapingTime,
    byType,
  };
}

export async function GET() {
  try {
    const logs = listEnhancedLogs();
    const metrics = calculateMetrics(logs);

    return NextResponse.json({
      logs,
      metrics,
    });
  } catch (error) {
    console.error('[Analytics] Error loading logs:', error);
    return NextResponse.json(
      { error: 'Error loading analytics data' },
      { status: 500 }
    );
  }
}
