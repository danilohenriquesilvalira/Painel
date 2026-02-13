/**
 * Template Parser Avançado - RLS Industrial
 *
 * Estrutura do Backend:
 *   Array[0..64] of Word   → unsigned 16-bit (0 a 65535)
 *   Array[0..64] of Int    → signed 16-bit (-32768 a 32767)
 *   Array[0..256] of Real  → float 32-bit IEEE 754
 *
 * O bit de controle é o gatilho para exibir a mensagem.
 * O template permite enriquecer a mensagem com valores dinâmicos:
 *
 *   {Int[N]}               → valor signed do endereço N (-32768 a 32767)
 *   {Int[N]/D}             → valor signed dividido por D
 *   {Int[N]*M}             → valor signed multiplicado por M
 *   {Real[N]}              → float IEEE 754 (Word[N] hi + Word[N+1] lo)
 *   {Real[N]:D}            → float com D casas decimais
 *   {Word[N]}              → valor unsigned do endereço N (retrocompatível)
 *   {Word[N]/D}            → valor unsigned dividido por D
 */

export interface PlcVariables {
  [key: string]: number;
}

// Regex patterns
const INT_RE = /\{Int\[(\d+)\](?:\/([.\d]+)|\*([.\d]+))?\}/g;
const REAL_RE = /\{Real\[(\d+)\](?::(\d+))?\}/g;
const WORD_RE = /\{Word\[(\d+)\](?:\/([.\d]+)|\*([.\d]+))?\}/g;

/**
 * Converte 2 Words (hi + lo) em float IEEE 754
 */
function wordsToFloat(hi: number, lo: number): number {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, hi & 0xFFFF);
  view.setUint16(2, lo & 0xFFFF);
  return view.getFloat32(0);
}

/**
 * Converte unsigned 16-bit para signed 16-bit
 */
function toSigned16(val: number): number {
  val = val & 0xFFFF;
  return val >= 0x8000 ? val - 0x10000 : val;
}

/**
 * Formata número dividido
 */
function formatDivided(val: number, divStr: string): string {
  const d = parseFloat(divStr);
  if (d === 0) return '---';
  const result = val / d;
  // Se o divisor tem ponto decimal, usar 2 casas; senão, 1 casa
  return result.toFixed(divStr.includes('.') ? 2 : 1);
}

/**
 * Substitui todas as tags do template pelos valores reais do PLC
 */
export function parseTemplate(template: string, variables: PlcVariables): string {
  if (!template) return '';

  let result = template;

  // Real[N] primeiro (usa 2 words consecutivos)
  result = result.replace(REAL_RE, (_m, idx, decimals) => {
    const n = parseInt(idx);
    const hi = variables[`Word[${n}]`];
    const lo = variables[`Word[${n + 1}]`];
    if (hi === undefined || lo === undefined) return '{...}';
    const val = wordsToFloat(hi, lo);
    const d = decimals ? parseInt(decimals) : 2;
    return isNaN(val) || !isFinite(val) ? '---' : val.toFixed(d);
  });

  // Int[N] (signed)
  result = result.replace(INT_RE, (_m, idx, div, mul) => {
    const raw = variables[`Word[${idx}]`];
    if (raw === undefined) return '{...}';
    const val = toSigned16(raw);
    if (div) return formatDivided(val, div);
    if (mul) return String(Math.round(val * parseFloat(mul)));
    return String(val);
  });

  // Word[N] (unsigned, retrocompatível)
  result = result.replace(WORD_RE, (_m, idx, div, mul) => {
    const val = variables[`Word[${idx}]`];
    if (val === undefined) return '{...}';
    if (div) return formatDivided(val, div);
    if (mul) return String(Math.round(val * parseFloat(mul)));
    return String(val);
  });

  return result;
}

/**
 * Extrai todos os índices de Words monitorizados no template
 */
export function extractWordIndices(template: string): number[] {
  if (!template) return [];
  const indices = new Set<number>();

  let m;

  const i = new RegExp(INT_RE.source, 'g');
  while ((m = i.exec(template))) indices.add(parseInt(m[1]));

  const w = new RegExp(WORD_RE.source, 'g');
  while ((m = w.exec(template))) indices.add(parseInt(m[1]));

  const r = new RegExp(REAL_RE.source, 'g');
  while ((m = r.exec(template))) {
    const n = parseInt(m[1]);
    indices.add(n);
    indices.add(n + 1);
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Valida sintaxe do template
 */
export function validateTemplate(template: string): string[] {
  if (!template) return [];
  const errors: string[] = [];

  // Chaves balanceadas
  const open = (template.match(/\{/g) || []).length;
  const close = (template.match(/\}/g) || []).length;
  if (open !== close) errors.push('Chaves { } desbalanceadas');

  let m;

  // Int range (0-64)
  const i2 = new RegExp(INT_RE.source, 'g');
  while ((m = i2.exec(template))) {
    const idx = parseInt(m[1]);
    if (idx > 64) errors.push(`Int[${idx}] inválido (máx 64)`);
  }

  // Word range (0-64)
  const w2 = new RegExp(WORD_RE.source, 'g');
  while ((m = w2.exec(template))) {
    const idx = parseInt(m[1]);
    if (idx > 64) errors.push(`Word[${idx}] inválido (máx 64)`);
  }

  // Real range (0-255, pois usa word N e N+1)
  const r2 = new RegExp(REAL_RE.source, 'g');
  while ((m = r2.exec(template))) {
    const idx = parseInt(m[1]);
    if (idx > 255) errors.push(`Real[${idx}] inválido (máx 255)`);
  }

  return errors;
}

/**
 * Gera preview com dados simulados
 */
export function previewTemplate(template: string): string {
  if (!template) return '';
  const fake: PlcVariables = {};
  for (let i = 0; i <= 256; i++) {
    fake[`Word[${i}]`] = Math.floor(Math.random() * 500);
  }
  return parseTemplate(template, fake);
}
