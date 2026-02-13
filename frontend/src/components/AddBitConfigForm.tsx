import React, { useState, useMemo } from 'react';
import { Cpu, X, Zap, Type, Palette, Eye, Code, MapPin, Layers, ToggleRight, Check } from 'lucide-react';
import { LEDPreview } from './LEDPreview';
import { TemplateEditor } from './TemplateEditor';
import type { BitConfig } from '../types';

interface AddBitConfigFormProps {
  onAdd: (bitConfig: {
    wordIndex: number; bitIndex: number; name: string; message: string; messageOff: string;
    enabled: boolean; priority: number; color: string; fontSize: number; position: string;
    fontFamily: string; fontWeight: string; textShadow: boolean; letterSpacing: number;
    useTemplate: boolean; messageTemplate: string;
  }) => Promise<void>;
  onCancel: () => void;
  plcData?: { variables: { [key: string]: number } } | null;
  existingConfigs?: BitConfig[];
}

const WORD_MAX = 64;
const BIT_MAX = 15;

export const AddBitConfigForm: React.FC<AddBitConfigFormProps> = ({ onAdd, onCancel, plcData, existingConfigs = [] }) => {
  const [formData, setFormData] = useState({
    wordIndex: -1, bitIndex: -1, name: '', message: '', messageOff: '',
    enabled: true, priority: 50, color: '#00ff00', fontSize: 200, position: 'center',
    fontFamily: 'Arial Black', fontWeight: 'bold', textShadow: true, letterSpacing: 5,
    useTemplate: false, messageTemplate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const usedSet = useMemo(() => {
    const s = new Set<string>();
    existingConfigs.forEach(c => s.add(`${c.word_index}.${c.bit_index}`));
    return s;
  }, [existingConfigs]);

  const bitsForWord = useMemo(() => {
    if (formData.wordIndex < 0) return [];
    return Array.from({ length: BIT_MAX + 1 }, (_, b) => {
      const cfg = existingConfigs.find(c => c.word_index === formData.wordIndex && c.bit_index === b);
      return { bit: b, used: !!cfg, name: cfg?.name };
    });
  }, [formData.wordIndex, existingConfigs]);

  const wordsInfo = useMemo(() => {
    return Array.from({ length: WORD_MAX + 1 }, (_, w) => {
      let used = 0;
      for (let b = 0; b <= BIT_MAX; b++) if (usedSet.has(`${w}.${b}`)) used++;
      return { word: w, used, free: BIT_MAX + 1 - used };
    });
  }, [usedSet]);

  const isReady = formData.wordIndex >= 0 && formData.bitIndex >= 0 && !usedSet.has(`${formData.wordIndex}.${formData.bitIndex}`);

  const bitValue = useMemo(() => {
    if (!plcData?.variables || formData.wordIndex < 0 || formData.bitIndex < 0) return false;
    return (((plcData.variables[`Word[${formData.wordIndex}]`] || 0) >> formData.bitIndex) & 1) === 1;
  }, [plcData, formData.wordIndex, formData.bitIndex]);

  const handleSubmit = async () => {
    if (!isReady || !formData.name.trim()) { if (!formData.name.trim()) setStep(2); return; }
    if (!formData.message.trim() && !formData.useTemplate) { setStep(2); return; }
    setIsSubmitting(true);
    try { await onAdd(formData); } catch {} finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">

        {/* HEADER */}
        <div className="bg-edp-marine px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Cpu size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Novo Controle</h2>
              {isReady ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-mono text-white/90">Word[{formData.wordIndex}].{formData.bitIndex}</span>
                  <span className={`w-2 h-2 rounded-full ${bitValue ? 'bg-green-400' : 'bg-white/30'}`} />
                </div>
              ) : (
                <p className="text-sm text-white/60 mt-0.5">Passo {step} de 3</p>
              )}
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* STEPS BAR */}
        <div className="px-6 py-3 bg-edp-neutral-white-wash border-b border-edp-neutral-lighter flex gap-2 flex-shrink-0">
          {[
            { n: 1 as const, label: 'Endereço PLC' },
            { n: 2 as const, label: 'Mensagem' },
            { n: 3 as const, label: 'Estilo' },
          ].map((s, i) => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                step === s.n
                  ? 'bg-edp-marine text-white'
                  : s.n < step || (s.n === 1 && isReady)
                    ? 'bg-edp-marine/10 text-edp-marine hover:bg-edp-marine/15 cursor-pointer'
                    : 'text-edp-slate hover:text-edp-marine cursor-pointer'
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                step === s.n ? 'bg-white/20 text-white'
                  : (s.n < step || (s.n === 1 && isReady)) ? 'bg-edp-marine text-white' : 'bg-edp-neutral-lighter text-edp-slate'
              }`}>
                {(s.n < step || (s.n === 1 && isReady)) && step !== s.n ? <Check size={10} /> : s.n}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto">

          {/* STEP 1: ENDEREÇO */}
          {step === 1 && (
            <div className="p-6 space-y-5">

              {/* WORD SELECT */}
              <div>
                <label className="text-sm font-medium text-edp-marine mb-2 block">
                  Qual o grupo (Word)?
                </label>
                <div className="grid grid-cols-5 gap-1.5 p-4 bg-edp-neutral-white-wash rounded-xl border border-edp-neutral-lighter max-h-[200px] overflow-y-auto">
                  {wordsInfo.map(w => {
                    const selected = formData.wordIndex === w.word;
                    const full = w.free === 0;
                    return (
                      <button
                        key={w.word}
                        type="button"
                        disabled={full}
                        onClick={() => setFormData({ ...formData, wordIndex: w.word, bitIndex: -1 })}
                        className={`relative h-10 rounded-lg text-xs font-mono font-semibold transition-all ${
                          selected
                            ? 'bg-edp-marine text-white shadow-md ring-2 ring-edp-marine ring-offset-1'
                            : full
                              ? 'bg-edp-neutral-lighter/50 text-edp-slate/30 cursor-not-allowed'
                              : 'bg-white text-edp-marine border border-edp-neutral-lighter hover:border-edp-marine hover:shadow-sm'
                        }`}
                      >
                        {w.word}
                        {w.used > 0 && !full && !selected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-edp-marine text-white text-[9px] font-bold rounded-full flex items-center justify-center">{w.used}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-edp-slate mt-2">
                  {existingConfigs.length} endereços configurados. Números com badge indicam bits já em uso nesse grupo.
                </p>
              </div>

              {/* BIT SELECT */}
              {formData.wordIndex >= 0 && (
                <div>
                  <label className="text-sm font-medium text-edp-marine mb-2 block">
                    Qual o bit no Word[{formData.wordIndex}]?
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {bitsForWord.map(b => {
                      const selected = formData.bitIndex === b.bit && !b.used;
                      return (
                        <button
                          key={b.bit}
                          type="button"
                          disabled={b.used}
                          onClick={() => { setFormData({ ...formData, bitIndex: b.bit }); }}
                          title={b.used ? `Ocupado: ${b.name}` : `Bit ${b.bit}`}
                          className={`flex flex-col items-center justify-center h-16 rounded-xl transition-all ${
                            selected
                              ? 'bg-edp-marine text-white shadow-md ring-2 ring-edp-marine ring-offset-1'
                              : b.used
                                ? 'bg-edp-neutral-lighter/40 cursor-not-allowed'
                                : 'bg-white border border-edp-neutral-lighter hover:border-edp-marine hover:shadow-sm'
                          }`}
                        >
                          <span className={`text-base font-mono font-bold ${selected ? 'text-white' : b.used ? 'text-edp-slate/30' : 'text-edp-marine'}`}>
                            {b.bit}
                          </span>
                          {b.used ? (
                            <span className="text-[8px] text-edp-slate/40 mt-0.5 truncate max-w-full px-1 leading-none">{b.name}</span>
                          ) : (
                            <span className={`text-[9px] mt-0.5 ${selected ? 'text-white/60' : 'text-edp-slate/50'}`}>livre</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirmação + Avançar */}
              {isReady && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-edp-marine text-white rounded-xl font-medium hover:bg-edp-marine-100 transition-colors shadow-sm"
                >
                  <span className="font-mono text-sm">Word[{formData.wordIndex}].{formData.bitIndex}</span>
                  <span className="text-white/40">|</span>
                  <span className="text-sm">Continuar para Mensagem</span>
                </button>
              )}
            </div>
          )}

          {/* STEP 2: MENSAGEM */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              {isReady && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-1 text-xs font-mono bg-edp-marine/10 text-edp-marine rounded-lg font-semibold">
                    Word[{formData.wordIndex}].{formData.bitIndex}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                    bitValue ? 'bg-edp-marine/10 text-edp-marine' : 'bg-edp-neutral-lighter text-edp-slate'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bitValue ? 'bg-edp-marine' : 'bg-edp-slate'}`} />
                    {bitValue ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-edp-marine mb-1.5">
                    <Layers size={14} />Nome do Controle
                  </label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine bg-edp-neutral-white-wash focus:bg-white transition-colors"
                    placeholder="Ex: Porta Montante Aberta" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-edp-marine mb-1.5">
                    <Zap size={14} />Prioridade
                  </label>
                  <input type="number" min="0" max="999" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine bg-edp-neutral-white-wash focus:bg-white font-tabular transition-colors" />
                  <p className="text-[11px] text-edp-slate mt-1">Maior = mais importante</p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-edp-marine mb-1.5">
                  <Type size={14} />Mensagem no Painel LED
                </label>
                <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine bg-edp-neutral-white-wash focus:bg-white resize-none transition-colors"
                  rows={2} placeholder="Ex: ATENÇÃO - ECLUSA EM OPERAÇÃO" />
              </div>

              <div className="border border-edp-marine/15 rounded-xl p-3 bg-edp-marine/5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.useTemplate} onChange={(e) => setFormData({ ...formData, useTemplate: e.target.checked })}
                    className="w-4 h-4 text-edp-marine rounded focus:ring-edp-marine" />
                  <Code size={14} className="text-edp-marine" />
                  <div>
                    <span className="text-sm font-medium text-edp-marine">Template Avançado</span>
                    <p className="text-[11px] text-edp-slate">Valores dinâmicos do PLC na mensagem</p>
                  </div>
                </label>
              </div>

              {formData.useTemplate && (
                <TemplateEditor value={formData.messageTemplate} onChange={(v) => setFormData({ ...formData, messageTemplate: v })}
                  color={formData.color} fontSize={formData.fontSize} fontFamily={formData.fontFamily}
                  fontWeight={formData.fontWeight} textShadow={formData.textShadow} letterSpacing={formData.letterSpacing} plcData={plcData} />
              )}

              {!formData.useTemplate && formData.message && (
                <div className="border border-edp-neutral-lighter rounded-xl overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-edp-neutral-white-wash border-b border-edp-neutral-lighter">
                    <Eye size={13} className="text-edp-marine" /><span className="text-xs font-medium text-edp-marine">Preview LED</span>
                  </div>
                  <div className="p-2">
                    <LEDPreview message={formData.message} color={formData.color} fontSize={Math.min(formData.fontSize, 40)}
                      fontFamily={formData.fontFamily} fontWeight={formData.fontWeight} textShadow={formData.textShadow} letterSpacing={formData.letterSpacing} />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 p-3 border border-edp-neutral-lighter rounded-xl cursor-pointer hover:bg-edp-neutral-white-wash transition-colors">
                <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-edp-marine rounded focus:ring-edp-marine" />
                <ToggleRight size={14} className="text-edp-marine" />
                <div>
                  <span className="text-sm font-medium text-edp-marine">Ativar imediatamente</span>
                  <p className="text-[11px] text-edp-slate">Exibir mensagem no painel quando o bit estiver ON</p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 3: ESTILO */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-edp-marine mb-1.5"><Palette size={14} />Cor do Texto</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-10 h-10 border border-edp-neutral-lighter rounded-xl cursor-pointer" />
                    <input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="flex-1 px-3 py-2 text-sm font-mono border border-edp-neutral-lighter rounded-xl focus:ring-1 focus:ring-edp-marine bg-edp-neutral-white-wash" />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {['#00ff00', '#ff0000', '#ffff00', '#ffffff', '#00bfff', '#ff6600'].map(c => (
                      <button key={c} type="button" onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${formData.color === c ? 'border-edp-marine scale-110 shadow' : 'border-white/50'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-edp-marine mb-1.5"><MapPin size={14} />Posição no Ecrã</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ v: 'top', l: 'Topo' }, { v: 'center', l: 'Centro' }, { v: 'bottom', l: 'Base' }].map(p => (
                      <button key={p.v} type="button" onClick={() => setFormData({ ...formData, position: p.v })}
                        className={`py-2.5 text-xs font-medium rounded-xl border transition-colors ${formData.position === p.v ? 'bg-edp-marine text-white border-edp-marine' : 'bg-white text-edp-slate border-edp-neutral-lighter hover:border-edp-marine hover:text-edp-marine'}`}>{p.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-edp-marine mb-1.5 block">Fonte</label>
                  <select value={formData.fontFamily} onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-1 focus:ring-edp-marine bg-edp-neutral-white-wash">
                    <option value="Arial Black">Arial Black</option><option value="Impact">Impact</option><option value="Tahoma">Tahoma</option><option value="Verdana">Verdana</option><option value="monospace">Monospace</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-edp-marine mb-1.5 block">Peso</label>
                  <select value={formData.fontWeight} onChange={(e) => setFormData({ ...formData, fontWeight: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-1 focus:ring-edp-marine bg-edp-neutral-white-wash">
                    <option value="normal">Normal</option><option value="bold">Negrito</option><option value="900">Extra Negrito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-edp-marine mb-1.5 block">Tamanho Outdoor (px)</label>
                  <select value={formData.fontSize} onChange={(e) => setFormData({ ...formData, fontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-1 focus:ring-edp-marine bg-edp-neutral-white-wash">
                    <option value="80">80px - Pequeno</option><option value="120">120px - Médio</option><option value="150">150px - Grande</option>
                    <option value="200">200px - Gigante</option><option value="250">250px - Colossal</option><option value="300">300px - Titânico</option>
                    <option value="400">400px - Mega</option><option value="500">500px - Ultra</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-edp-marine mb-1.5 block">Espaçamento (px)</label>
                  <input type="number" min="0" max="20" value={formData.letterSpacing} onChange={(e) => setFormData({ ...formData, letterSpacing: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-xl focus:ring-1 focus:ring-edp-marine bg-edp-neutral-white-wash font-tabular" />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 border border-edp-neutral-lighter rounded-xl cursor-pointer hover:bg-edp-neutral-white-wash transition-colors">
                <input type="checkbox" checked={formData.textShadow} onChange={(e) => setFormData({ ...formData, textShadow: e.target.checked })}
                  className="w-4 h-4 text-edp-marine rounded focus:ring-edp-marine" />
                <span className="text-sm font-medium text-edp-marine">Efeito LED (Glow / Brilho)</span>
              </label>

              <div className="border border-edp-neutral-lighter rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-edp-neutral-white-wash border-b border-edp-neutral-lighter">
                  <Eye size={13} className="text-edp-marine" /><span className="text-xs font-medium text-edp-marine">Preview LED</span>
                </div>
                <div className="p-2">
                  <LEDPreview message={formData.message || 'MENSAGEM DE EXEMPLO'} color={formData.color} fontSize={Math.min(formData.fontSize, 40)}
                    fontFamily={formData.fontFamily} fontWeight={formData.fontWeight} textShadow={formData.textShadow} letterSpacing={formData.letterSpacing} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-edp-neutral-lighter bg-edp-neutral-white-wash flex-shrink-0">
          <div className="text-xs text-edp-slate">
            {isReady
              ? <span className="font-mono text-edp-marine font-semibold">Word[{formData.wordIndex}].{formData.bitIndex}{formData.name ? ` — ${formData.name}` : ''}</span>
              : 'Selecione um endereço'}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button type="button" onClick={() => setStep((step - 1) as 1 | 2)}
                className="px-4 py-2 text-sm text-edp-marine bg-white border border-edp-neutral-lighter rounded-xl hover:bg-edp-neutral-white-tint transition-colors font-medium">
                Voltar
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => {
                if (step === 1 && !isReady) return;
                setStep((step + 1) as 2 | 3);
              }}
                disabled={step === 1 && !isReady}
                className="px-5 py-2 text-sm bg-edp-marine text-white rounded-xl hover:bg-edp-marine-100 transition-colors font-medium shadow-sm disabled:opacity-40">
                Continuar
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={isSubmitting || !isReady}
                className="px-5 py-2 text-sm bg-edp-marine text-white rounded-xl hover:bg-edp-marine-100 transition-colors font-medium shadow-sm disabled:opacity-40 flex items-center gap-2">
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
                {isSubmitting ? 'A criar...' : 'Criar Controle'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
