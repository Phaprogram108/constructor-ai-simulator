import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs/conversations');
const OUTPUT_FILE = path.join(process.cwd(), 'docs/ANALISIS-CONVERSACIONES.txt');

// Lista de empresas a buscar (nombres que pueden aparecer en los archivos)
const EMPRESAS = [
  { id: 'ecomod', name: 'Ecomod', keywords: ['ecomod'] },
  { id: 'lista', name: 'Lista', keywords: ['lista'] },
  { id: 'movilhauss', name: 'Movilhauss', keywords: ['movilhauss'] },
  { id: 'plugarq', name: 'PlugArq', keywords: ['plugarq', 'plug'] },
  { id: 'habika', name: 'Habika', keywords: ['habika'] },
  { id: 'arcohouse', name: 'Arcohouse', keywords: ['arcohouse', 'arco'] },
  { id: 'atlas', name: 'Atlas Housing', keywords: ['atlas'] },
  { id: 'lucys', name: 'Lucys House', keywords: ['lucy', 'lucys'] },
  { id: 'sienna', name: 'Sienna Modular', keywords: ['sienna'] },
  { id: 'offis', name: 'Offis', keywords: ['offis'] },
  { id: 'efede', name: 'Efede', keywords: ['efede'] },
  { id: 'minicasas', name: 'Mini Casas', keywords: ['minicasas', 'mini'] },
  { id: 'wellmod', name: 'Wellmod', keywords: ['wellmod'] },
  { id: 'steimberg', name: 'Grupo Steimberg', keywords: ['steimberg'] },
  { id: 'aftamantes', name: 'Aftamantes', keywords: ['aftamantes', 'aft'] },
  { id: 'arqtainer', name: 'Arqtainer', keywords: ['arqtainer'] },
];

function findConversationFile(empresa: typeof EMPRESAS[0], files: string[]): string | null {
  // Buscar archivo que contenga alguna keyword de la empresa
  for (const keyword of empresa.keywords) {
    const match = files.find(f =>
      f.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) return match;
  }
  return null;
}

function analyzeConversation(content: string): {
  hasModels: boolean;
  hasPrice: boolean;
  messageCount: number;
  quality: 'Excelente' | 'Buena' | 'Regular' | 'Mala';
} {
  const hasModels = /\d+\s*m[²2]/i.test(content);
  const hasPrice = /\$|USD|usd|pesos|\d+\.?\d*\s*(mil|k)/i.test(content);
  const messageCount = (content.match(/\[USUARIO\]/g) || []).length;

  let quality: 'Excelente' | 'Buena' | 'Regular' | 'Mala' = 'Mala';
  if (hasModels && hasPrice) quality = 'Excelente';
  else if (hasModels) quality = 'Buena';
  else if (messageCount > 2) quality = 'Regular';

  return { hasModels, hasPrice, messageCount, quality };
}

function main() {
  console.log('Consolidando conversaciones...\n');

  // Verificar que existe el directorio de logs
  if (!fs.existsSync(LOGS_DIR)) {
    console.error('ERROR: No existe el directorio de logs:', LOGS_DIR);
    process.exit(1);
  }

  // Crear directorio docs si no existe
  const docsDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Leer todos los archivos de conversaciones
  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('.txt'))
    .sort();

  console.log(`Encontrados ${files.length} archivos de conversacion\n`);

  let output = '';
  output += '='.repeat(80) + '\n';
  output += 'ANALISIS DE CONVERSACIONES - 16 EMPRESAS CONSTRUCTORAS\n';
  output += '='.repeat(80) + '\n';
  output += `Fecha de generacion: ${new Date().toISOString()}\n`;
  output += `Total archivos encontrados: ${files.length}\n`;
  output += '='.repeat(80) + '\n\n';

  // Estadisticas
  let totalEmpresas = 0;
  let empresasConModelos = 0;
  let empresasConPrecios = 0;
  const resultados: Array<{name: string; quality: string; found: boolean}> = [];

  // Procesar cada empresa
  for (const empresa of EMPRESAS) {
    const file = findConversationFile(empresa, files);

    if (file) {
      totalEmpresas++;
      const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf-8');
      const analysis = analyzeConversation(content);

      if (analysis.hasModels) empresasConModelos++;
      if (analysis.hasPrice) empresasConPrecios++;

      resultados.push({ name: empresa.name, quality: analysis.quality, found: true });

      output += '-'.repeat(80) + '\n';
      output += `EMPRESA: ${empresa.name.toUpperCase()}\n`;
      output += `-`.repeat(80) + '\n';
      output += `Archivo: ${file}\n`;
      output += `Calidad: ${analysis.quality}\n`;
      output += `Modelos detectados: ${analysis.hasModels ? 'SI' : 'NO'}\n`;
      output += `Precios detectados: ${analysis.hasPrice ? 'SI' : 'NO'}\n`;
      output += `Mensajes: ${analysis.messageCount}\n`;
      output += '-'.repeat(40) + '\n';
      output += 'CONVERSACION:\n';
      output += '-'.repeat(40) + '\n';
      output += content + '\n\n';

      console.log(`[OK] ${empresa.name}: ${analysis.quality}`);
    } else {
      resultados.push({ name: empresa.name, quality: 'No encontrada', found: false });
      console.log(`[X] ${empresa.name}: No encontrada`);
    }
  }

  // Agregar resumen al inicio
  const resumen = `
RESUMEN EJECUTIVO
${'='.repeat(40)}
- Empresas testeadas: ${totalEmpresas}/16
- Empresas con modelos especificos: ${empresasConModelos}
- Empresas con precios: ${empresasConPrecios}
- Tasa de exito (modelos): ${totalEmpresas > 0 ? Math.round(empresasConModelos/totalEmpresas*100) : 0}%

TABLA DE RESULTADOS
${'='.repeat(40)}
${resultados.map(r => `${r.found ? '[OK]' : '[X]'} ${r.name.padEnd(25)} ${r.quality}`).join('\n')}

`;

  output = output.replace('='.repeat(80) + '\n\n', '='.repeat(80) + '\n\n' + resumen);

  // Escribir archivo
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log('\n' + '='.repeat(40));
  console.log(`Documento generado: ${OUTPUT_FILE}`);
  console.log(`Empresas encontradas: ${totalEmpresas}/16`);
  console.log(`Con modelos especificos: ${empresasConModelos}`);
  console.log('='.repeat(40));
}

main();
