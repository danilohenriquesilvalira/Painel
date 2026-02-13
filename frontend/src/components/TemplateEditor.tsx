import React, { useState, useRef } from 'react';
import { Plus, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { LEDPreview } from './LEDPreview';
import { parseTemplate, validateTemplate, extractWordIndices, previewTemplate } from '../utils/templateParser';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textShadow: boolean;
  letterSpacing: number;
  plcData?: { variables: { [key: string]: number } } | null;
}

type VarType = 'int' | 'real';

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  value, onChange, color, fontSize, fontFamily, fontWeight, textShadow, letterSpacing, plcData,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [varType, setVarType] = useState<VarType>('int');
  const [varIndex, setVarIndex] = useState('0');
  const [realDecimals, setRealDecimals] = useState('2');

  const insertAtCursor = (tag: string) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(value + tag); return; }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    onChange(value.substring(0, s) + tag + value.substring(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + tag.length, s + tag.length); }, 0);
  };

  const safeIndex = Math.max(0, parseInt(varIndex) || 0);
  const safeDec = Math.max(0, Math.min(6, parseInt(realDecimals) || 0));

  const handleInsert = () => {
    if (varType === 'int') {
      insertAtCursor(`{Int[${safeIndex}]}`);
    } else {
      insertAtCursor(safeDec !== 2 ? `{Real[${safeIndex}]:${safeDec}}` : `{Real[${safeIndex}]}`);
    }
  };

  const errors = validateTemplate(value);
  const wordIndices = extractWordIndices(value);
  const hasRealData = plcData && plcData.variables;
  const previewText = value
    ? (hasRealData ? parseTemplate(value, plcData.variables) : previewTemplate(value))
    : '';

  const tagPreview = varType === 'int'
    ? `{Int[${safeIndex}]}`
    : safeDec !== 2 ? `{Real[${safeIndex}]:${safeDec}}` : `{Real[${safeIndex}]}`;

  const examples = [
    { label: 'Nível', tpl: 'NIVEL: {Int[0]} cm' },
    { label: 'Temperatura', tpl: 'TEMP: {Real[10]} °C' },
    { label: 'Caudal', tpl: 'CAUDAL: {Real[20]:1} m³/s' },
    { label: 'Duas linhas', tpl: 'NIVEL: {Int[0]} cm\nTEMP: {Real[10]} °C' },
  ];

  return (
    <div className="space-y-4">

      {/* === INSERIR VARIÁVEL === */}
      <div className="rounded-xl border border-edp-neutral-lighter bg-white shadow-sm overflow-hidden">

        {/* Tabs: Int / Real */}
        <div className="grid grid-cols-2">
          {([
            { id: 'int' as VarType, label: 'Inteiro', sub: 'Int · -32768 a 32767' },
            { id: 'real' as VarType, label: 'Real', sub: 'Float · IEEE 754' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setVarType(t.id)}
              className={`py-3 text-center transition-all border-b-2 ${varType === t.id
                  ? 'border-edp-marine bg-white'
                  : 'border-transparent bg-edp-neutral-white-wash hover:bg-white'
                }`}
            >
              <div className={`text-sm font-semibold ${varType === t.id ? 'text-edp-marine' : 'text-edp-slate'}`}>
                {t.label}
              </div>
              <div className={`text-[10px] mt-0.5 ${varType === t.id ? 'text-edp-marine/60' : 'text-edp-slate/40'}`}>
                {t.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Campos + botão */}
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Índice */}
            <div className="w-24">
              <label className="block text-[11px] font-medium text-edp-slate mb-1.5">
                {varType === 'int' ? 'Nº Int' : 'Nº Real'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={varIndex}
                onChange={(e) => setVarIndex(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-9 px-3 text-sm text-center font-mono font-semibold text-edp-marine border border-edp-neutral-lighter rounded-lg bg-edp-neutral-white-wash focus:bg-white focus:border-edp-marine focus:ring-1 focus:ring-edp-marine/30 transition-all outline-none"
                placeholder="0"
              />
            </div>

            {/* Decimais (só real) */}
            {varType === 'real' && (
              <div className="w-20">
                <label className="block text-[11px] font-medium text-edp-slate mb-1.5">Decimais</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={realDecimals}
                  onChange={(e) => setRealDecimals(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full h-9 px-3 text-sm text-center font-mono font-semibold text-edp-marine border border-edp-neutral-lighter rounded-lg bg-edp-neutral-white-wash focus:bg-white focus:border-edp-marine focus:ring-1 focus:ring-edp-marine/30 transition-all outline-none"
                  placeholder="2"
                />
              </div>
            )}

            {/* Tag preview */}
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-edp-slate mb-1.5">Tag gerada</label>
              <div className="h-9 flex items-center px-3 bg-edp-neutral-white-wash border border-edp-neutral-lighter rounded-lg">
                <code className="text-xs font-mono text-edp-marine truncate">{tagPreview}</code>
              </div>
            </div>

            {/* Inserir */}
            <div>
              <label className="block text-[11px] font-medium text-transparent mb-1.5 select-none">.</label>
              <button
                type="button"
                onClick={handleInsert}
                className="h-9 flex items-center gap-1.5 px-4 text-sm font-semibold text-white bg-edp-marine rounded-lg hover:bg-edp-marine-100 active:scale-[0.97] transition-all shadow-sm"
              >
                <Plus size={14} />
                Inserir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === TEXTAREA === */}
      <div className="rounded-xl border border-edp-neutral-lighter bg-white shadow-sm overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 text-sm font-mono text-edp-marine/90 bg-white focus:ring-0 focus:outline-none resize-none placeholder-edp-slate/30 leading-relaxed"
          rows={3}
          placeholder="Escreva o texto + variáveis. Ex: NIVEL ECLUSA: {Int[0]} cm"
        />

        {/* Exemplos */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-edp-neutral-white-wash border-t border-edp-neutral-lighter">
          <span className="text-[10px] text-edp-slate/50 font-medium">Exemplos:</span>
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(ex.tpl)}
              className="px-2 py-0.5 text-[10px] font-medium text-edp-marine/70 bg-white border border-edp-neutral-lighter rounded-md hover:border-edp-marine/30 hover:text-edp-marine transition-all"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* === ERROS === */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 bg-edp-semantic-light-red border border-edp-semantic-red/15 rounded-xl">
          <AlertCircle size={14} className="text-edp-semantic-red mt-0.5 flex-shrink-0" />
          <div className="text-xs text-edp-semantic-red space-y-0.5">
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        </div>
      )}

      {/* === WORDS MONITORIZADOS === */}
      {wordIndices.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-edp-marine/5 border border-edp-marine/10 rounded-xl">
          <CheckCircle size={12} className="text-edp-marine flex-shrink-0" />
          <span className="text-[10px] font-semibold text-edp-marine uppercase tracking-wide mr-1">Words:</span>
          <div className="flex flex-wrap gap-1">
            {wordIndices.map(idx => {
              const v = hasRealData ? plcData.variables[`Word[${idx}]`] : undefined;
              return (
                <span key={idx} className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-edp-marine/15 rounded text-edp-slate">
                  {idx}{v !== undefined && <span className="text-edp-marine font-bold ml-0.5">={v}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* === PREVIEW === */}
      {value && (
        <div className="rounded-xl border border-edp-neutral-lighter shadow-sm overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2 bg-edp-neutral-white-wash border-b border-edp-neutral-lighter">
            <Eye size={12} className="text-edp-marine" />
            <span className="text-[10px] font-semibold text-edp-marine uppercase tracking-wide">Preview</span>
            {!hasRealData && (
              <span className="ml-auto text-[9px] text-edp-slate/40">simulado</span>
            )}
          </div>
          <div className="p-2">
            <LEDPreview
              message={previewText || '...'}
              color={color}
              fontSize={Math.min(fontSize, 40)}
              fontFamily={fontFamily}
              fontWeight={fontWeight}
              textShadow={textShadow}
              letterSpacing={letterSpacing}
            />
          </div>
        </div>
      )}
    </div>
  );
};
