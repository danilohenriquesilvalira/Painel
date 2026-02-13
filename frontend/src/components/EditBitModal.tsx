import React, { useState } from 'react';
import { Settings, X, Palette, Eye, Code } from 'lucide-react';
import type { PlcData, BitConfig } from '../types';
import { LEDPreview } from './LEDPreview';
import { TemplateEditor } from './TemplateEditor';

interface EditBitModalProps {
    bitConfig: BitConfig;
    onSave: (data: {
        name: string;
        message: string;
        enabled: boolean;
        priority: number;
        color: string;
        fontSize: number;
        position: string;
        fontFamily: string;
        fontWeight: string;
        textShadow: boolean;
        letterSpacing: number;
        useTemplate: boolean;
        messageTemplate: string;
    }) => void;
    onClose: () => void;
    plcData?: PlcData | null;
}

export const EditBitModal: React.FC<EditBitModalProps> = ({ bitConfig, onSave, onClose, plcData }) => {
    const [formData, setFormData] = useState({
        name: bitConfig.name,
        message: bitConfig.message,
        enabled: bitConfig.enabled,
        priority: bitConfig.priority,
        color: bitConfig.color,
        fontSize: bitConfig.font_size,
        position: bitConfig.position,
        fontFamily: bitConfig.font_family || 'Arial Black',
        fontWeight: bitConfig.font_weight || 'bold',
        textShadow: bitConfig.text_shadow !== undefined ? bitConfig.text_shadow : true,
        letterSpacing: bitConfig.letter_spacing || 3,
        useTemplate: bitConfig.use_template || false,
        messageTemplate: bitConfig.message_template || '',
    });

    // Calculate current bit status
    const getCurrentBitValue = (): boolean => {
        if (!plcData?.variables) return false;
        const wordKey = `Word[${bitConfig.word_index}]`;
        const wordValue = plcData.variables[wordKey] || 0;
        return ((wordValue >> bitConfig.bit_index) & 1) === 1;
    };

    const bitValue = getCurrentBitValue();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] transition-all duration-300 ease-out p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 ease-out animate-scale-in border border-edp-neutral-lighter/60">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-edp-neutral-lighter bg-edp-neutral-white-wash/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-edp-marine/10 shadow-sm border border-edp-marine/10">
                            <Settings size={18} className="text-edp-marine" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-edp-marine tracking-tight">Editar Bit</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-edp-neutral-white-tint text-edp-slate border border-edp-neutral-lighter/50">
                                    W[{bitConfig.word_index}].{bitConfig.bit_index}
                                </span>
                                {bitValue && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-edp-electric/10 text-edp-electric-700 border border-edp-electric/20 animate-pulse-subtle">
                                        <div className="w-1.5 h-1.5 rounded-full bg-edp-electric mr-1 shadow-[0_0_4px_rgba(40,255,82,0.6)]"></div>
                                        ON
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-lighter/40 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    <form onSubmit={handleSubmit} className="p-5 space-y-5">
                        {/* Grid Principal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Nome */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-edp-marine uppercase tracking-wider pl-1">
                                    Nome do Controle
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-lg focus:ring-2 focus:ring-edp-marine/20 focus:border-edp-marine transition-all bg-edp-neutral-white-wash/30 focus:bg-white placeholder:text-edp-neutral-medium"
                                    placeholder="Ex: ALARME_PRINCIPAL"
                                    required
                                />
                            </div>

                            {/* Status Toggle */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-edp-marine uppercase tracking-wider pl-1">
                                    Estado Inicial
                                </label>
                                <label className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-all ${formData.enabled
                                        ? 'border-edp-marine/30 bg-edp-marine/5'
                                        : 'border-edp-neutral-lighter bg-white hover:bg-edp-neutral-white-wash'
                                    }`}>
                                    <span className={`text-sm font-medium ${formData.enabled ? 'text-edp-marine' : 'text-edp-slate'}`}>
                                        {formData.enabled ? 'Habilitado' : 'Desabilitado'}
                                    </span>
                                    <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            checked={formData.enabled}
                                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                            className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out focus:outline-none shadow-sm translate-x-0 checked:translate-x-full checked:border-edp-marine"
                                        />
                                        <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-200 ${formData.enabled ? 'bg-edp-marine' : 'bg-edp-neutral-light'}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Mensagem Area */}
                        <div className="space-y-1.5 bg-edp-neutral-white-wash/30 p-4 rounded-xl border border-edp-neutral-lighter/40">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-edp-marine uppercase tracking-wider">
                                    Conteúdo da Mensagem
                                </label>

                                {/* Template Toggle Mini */}
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <span className="text-[10px] font-bold text-edp-violet uppercase tracking-wider group-hover:text-edp-violet-100 transition-colors">
                                        Modo Avançado
                                    </span>
                                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${formData.useTemplate ? 'bg-edp-violet' : 'bg-edp-neutral-lighter'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${formData.useTemplate ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <Code size={12} className={`text-edp-violet ${formData.useTemplate ? 'opacity-100' : 'opacity-40'}`} />
                                    <input
                                        type="checkbox"
                                        checked={formData.useTemplate}
                                        onChange={(e) => setFormData({ ...formData, useTemplate: e.target.checked })}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {formData.useTemplate ? (
                                <div className="animate-fade-in">
                                    <TemplateEditor
                                        value={formData.messageTemplate}
                                        onChange={(value) => setFormData({ ...formData, messageTemplate: value })}
                                        color={formData.color}
                                        fontSize={formData.fontSize}
                                        fontFamily={formData.fontFamily}
                                        fontWeight={formData.fontWeight}
                                        textShadow={formData.textShadow}
                                        letterSpacing={formData.letterSpacing}
                                        plcData={plcData}
                                    />
                                </div>
                            ) : (
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-edp-neutral-lighter rounded-lg focus:ring-2 focus:ring-edp-marine/20 focus:border-edp-marine transition-all bg-white resize-none shadow-sm min-h-[80px]"
                                    placeholder="Digite a mensagem que aparecerá no painel..."
                                    required={!formData.useTemplate}
                                />
                            )}
                        </div>

                        {/* Preview Section */}
                        {!formData.useTemplate && formData.message && (
                            <div className="border border-edp-neutral-lighter/60 bg-white rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-edp-neutral-white-wash px-3 py-2 border-b border-edp-neutral-lighter flex items-center gap-2">
                                    <Eye size={14} className="text-edp-marine opacity-60" />
                                    <span className="text-xs font-bold text-edp-marine uppercase tracking-wider opacity-80">Pré-visualização Painel</span>
                                </div>
                                <div className="p-4 flex items-center justify-center bg-black min-h-[100px]">
                                    <LEDPreview
                                        message={formData.message}
                                        color={formData.color}
                                        fontSize={Math.min(formData.fontSize, 40)} // Scaled down for preview
                                        fontFamily={formData.fontFamily}
                                        fontWeight={formData.fontWeight}
                                        textShadow={formData.textShadow}
                                        letterSpacing={formData.letterSpacing}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Styling Controls */}
                        <div className="border border-edp-marine/10 rounded-xl p-4 bg-edp-marine/5 animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-edp-marine/10">
                                <div className="p-1 rounded bg-white shadow-sm">
                                    <Palette size={14} className="text-edp-marine" />
                                </div>
                                <h4 className="text-sm font-bold text-edp-marine">Customização Visual</h4>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {/* Font Family */}
                                <div className="col-span-2 sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-edp-marine/70 uppercase mb-1">Tipografia</label>
                                    <select
                                        value={formData.fontFamily}
                                        onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs font-medium border border-edp-marine/20 rounded-lg bg-white focus:border-edp-marine focus:ring-1 focus:ring-edp-marine outline-none shadow-sm"
                                    >
                                        <option value="Arial Black">Arial Black (Padrão)</option>
                                        <option value="Impact">Impact (Bold)</option>
                                        <option value="Tahoma">Tahoma (Clean)</option>
                                        <option value="monospace">Monospace (Code)</option>
                                    </select>
                                </div>

                                {/* Font Size */}
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-edp-marine/70 uppercase mb-1">Tamanho</label>
                                    <select
                                        value={formData.fontSize}
                                        onChange={(e) => setFormData({ ...formData, fontSize: parseInt(e.target.value) })}
                                        className="w-full px-2 py-1.5 text-xs font-medium border border-edp-marine/20 rounded-lg bg-white focus:border-edp-marine outline-none shadow-sm"
                                    >
                                        {[80, 100, 120, 150, 200, 300, 400].map(size => (
                                            <option key={size} value={size}>{size}px</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Priority */}
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-edp-marine/70 uppercase mb-1">Prioridade</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                        className="w-full px-2 py-1.5 text-xs font-bold text-center border border-edp-marine/20 rounded-lg bg-white focus:border-edp-marine outline-none shadow-sm"
                                    />
                                </div>

                                {/* Color Picker (Custom) */}
                                <div className="col-span-2 sm:col-span-4 mt-2">
                                    <label className="block text-[10px] font-bold text-edp-marine/70 uppercase mb-2">Cor do Texto</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500', '#FFFFFF', '#00FFFF', '#FF00FF'].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: c })}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${formData.color === c ? 'border-edp-marine scale-110 ring-2 ring-edp-marine/20' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                                title={c}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="w-8 h-8 rounded-full overflow-hidden border-2 border-edp-neutral-lighter cursor-pointer p-0"
                                            title="Cor personalizada"
                                        />
                                    </div>
                                </div>

                                {/* Effect Toggles */}
                                <div className="col-span-2 sm:col-span-4 mt-2 pt-2 border-t border-edp-marine/10">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.textShadow}
                                            onChange={(e) => setFormData({ ...formData, textShadow: e.target.checked })}
                                            className="w-4 h-4 text-edp-marine border-edp-marine/30 rounded focus:ring-edp-marine"
                                        />
                                        <span className="text-xs font-bold text-edp-marine">Ativar Efeito Neon (Glow)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-edp-neutral-lighter bg-edp-neutral-white-wash/50 backdrop-blur-md flex justify-end gap-3 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-edp-slate hover:text-edp-marine hover:bg-white border border-transparent hover:border-edp-neutral-lighter rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 text-sm font-bold text-white bg-edp-marine hover:bg-edp-marine-100 active:scale-95 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};
