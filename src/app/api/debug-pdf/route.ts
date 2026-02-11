import { NextRequest, NextResponse } from 'next/server';
import { extractPdfFromUrl, analyzePdfWithAI, analyzePdfWithVision } from '@/lib/pdf-extractor';

// Debug endpoint to test PDF extraction - compares text vs vision methods
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && request.headers.get('x-debug-secret') !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { pdfUrl } = body;

    if (!pdfUrl) {
      return NextResponse.json({ error: 'pdfUrl required' }, { status: 400 });
    }

    console.log('[Debug PDF] Starting extraction for:', pdfUrl);

    // Method 1: Text-based extraction (old method)
    console.log('[Debug PDF] Trying text-based extraction...');
    const rawText = await extractPdfFromUrl(pdfUrl);
    console.log('[Debug PDF] Raw text length:', rawText.length);

    let textBasedAnalysis = null;
    if (rawText.length > 50) {
      textBasedAnalysis = await analyzePdfWithAI(rawText);
      console.log('[Debug PDF] Text-based models found:', textBasedAnalysis.models.length);
    }

    // Method 2: Vision-based extraction (NEW method)
    console.log('[Debug PDF] Trying vision-based extraction...');
    const visionAnalysis = await analyzePdfWithVision(pdfUrl);
    console.log('[Debug PDF] Vision-based models found:', visionAnalysis.models.length);

    return NextResponse.json({
      success: true,
      comparison: {
        textMethod: {
          rawTextLength: rawText.length,
          rawTextPreview: rawText.slice(0, 500),
          modelsFound: textBasedAnalysis?.models.length || 0,
          models: textBasedAnalysis?.models || [],
        },
        visionMethod: {
          modelsFound: visionAnalysis.models.length,
          models: visionAnalysis.models,
          prices: visionAnalysis.prices,
          features: visionAnalysis.features,
          specifications: visionAnalysis.specifications,
          rawTextExtracted: visionAnalysis.rawText?.slice(0, 500),
        },
      },
      recommendation: visionAnalysis.models.length > (textBasedAnalysis?.models.length || 0)
        ? 'Vision method is better for this PDF'
        : rawText.length > 100
          ? 'Text method works for this PDF'
          : 'PDF appears to be image-based, vision method required',
    });
  } catch (error) {
    console.error('[Debug PDF] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
