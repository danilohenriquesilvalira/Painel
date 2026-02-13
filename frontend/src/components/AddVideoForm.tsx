import React, { useState } from 'react';
import { Upload, X, Film, CheckCircle } from 'lucide-react';
import { useToast } from './Toast';

interface AddVideoFormProps {
  onAdd: (videoData: {
    name: string;
    filePath: string;
    duration: number;
    enabled: boolean;
    priority: number;
    description: string;
  }) => void;
  onCancel: () => void;
}

export const AddVideoForm: React.FC<AddVideoFormProps> = ({ onAdd, onCancel }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    filePath: '',
    duration: 30,
    enabled: true,
    priority: 10,
    description: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processVideoFile = async (filePath: string) => {
    setUploadStatus('uploading');
    try {
      // Extrai nome do arquivo
      const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || '';
      
      console.log('📁 Arquivo selecionado:', filePath);
      console.log('📝 Nome extraído:', fileName);
      
      setFormData(prev => ({ 
        ...prev, 
        name: fileName, 
        filePath: filePath,
        duration: 30
      }));
      
      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 2000);
    } catch (error) {
      console.error('❌ Erro ao processar vídeo:', error);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    try {
      // Tenta obter o caminho do arquivo via dataTransfer
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const item = items[0];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            // Verifica se é um vídeo
            if (!file.type.startsWith('video/')) {
              toast('warning', 'Por favor, arraste apenas arquivos de vídeo!');
              return;
            }

            toast('info', 'Arquivo detectado! Use o botão "Selecionar Arquivo" para escolher o vídeo.');
            await selectVideoFile();
          }
        }
      }
    } catch (error) {
      console.error('Erro no drag & drop:', error);
      // Fallback: abre o dialog
      await selectVideoFile();
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.filePath.trim()) {
      toast('warning', 'Nome e caminho do arquivo são obrigatórios!');
      return;
    }
    
    console.log('✅ Enviando vídeo para adicionar:', formData);
    onAdd(formData);
    setFormData({
      name: '',
      filePath: '',
      duration: 30,
      enabled: true,
      priority: 10,
      description: ''
    });
  };

  const selectVideoFile = async () => {
    const path = prompt('Introduza o caminho completo do vídeo no servidor:\n(ex: /home/rls/videos/publicidade.mp4)');
    if (path) {
      await processVideoFile(path);
    }
  };

  return (
    <div className="w-full bg-white border-2 border-blue-200 rounded-lg p-6 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-edp-marine">Adicionar Novo Vídeo de Publicidade</h4>
        <button
          onClick={onCancel}
          className="text-edp-slate hover:text-edp-marine p-1 rounded hover:bg-gray-100"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${isDragging 
              ? 'border-edp-marine bg-edp-marine bg-opacity-10 scale-105' 
              : formData.filePath 
                ? 'border-edp-electric bg-edp-electric bg-opacity-10'
                : 'border-edp-neutral-light bg-edp-neutral-white-wash hover:border-edp-marine hover:bg-edp-marine hover:bg-opacity-5'
            }
          `}
        >
          {uploadStatus === 'uploading' && (
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-sm text-gray-600">Processando vídeo...</p>
            </div>
          )}
          
          {uploadStatus === 'success' && (
            <div className="flex flex-col items-center space-y-3">
              <CheckCircle size={48} className="text-edp-electric" />
              <p className="text-sm text-edp-electric font-medium">Vídeo adicionado com sucesso!</p>
            </div>
          )}
          
          {uploadStatus === 'error' && (
            <div className="flex flex-col items-center space-y-3">
              <X size={48} className="text-edp-semantic-red" />
              <p className="text-sm text-edp-semantic-red font-medium">Erro ao processar vídeo</p>
            </div>
          )}
          
          {uploadStatus === 'idle' && (
            <>
              {!formData.filePath ? (
                <div className="flex flex-col items-center space-y-3">
                  <Upload size={48} className={isDragging ? 'text-edp-marine' : 'text-edp-slate'} />
                  <div>
                    <p className="text-base font-medium text-edp-marine">
                      {isDragging ? 'Solte o vídeo aqui!' : 'Arraste e solte o vídeo aqui'}
                    </p>
                    <p className="text-sm text-edp-slate mt-1">ou</p>
                  </div>
                  <button
                    type="button"
                    onClick={selectVideoFile}
                    className="px-4 py-2 bg-edp-marine text-white rounded-lg hover:bg-edp-marine-100 transition-colors flex items-center space-x-2"
                  >
                    <Upload size={16} />
                    <span>Selecionar Arquivo</span>
                  </button>
                  <p className="text-xs text-edp-slate mt-2">
                    Formatos: MP4, AVI, MOV, MKV, WEBM, FLV
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <Film size={48} className="text-edp-electric" />
                  <div className="text-left w-full bg-white rounded p-3">
                    <p className="text-sm font-medium text-edp-marine">Arquivo selecionado:</p>
                    <p className="text-xs text-gray-600 break-all mt-1">{formData.filePath}</p>
                  </div>
                  <button
                    type="button"
                    onClick={selectVideoFile}
                    className="text-sm text-edp-marine hover:text-edp-marine-100 underline"
                  >
                    Escolher outro arquivo
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Formulário */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-edp-marine mb-1">Nome do Vídeo *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-md text-sm"
              placeholder="ex: Publicidade EDP Verde 2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-edp-marine mb-1">Arquivo de Vídeo *</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={formData.filePath}
                onChange={(e) => setFormData({ ...formData, filePath: e.target.value })}
                className="flex-1 p-3 border border-gray-300 rounded-md text-sm"
                placeholder="Caminho completo do arquivo ou URL"
              />
              <button
                onClick={selectVideoFile}
                className="px-4 py-3 bg-gray-200 text-edp-marine rounded-md hover:bg-gray-300 text-sm font-medium"
              >
                Procurar
              </button>
            </div>
            <p className="text-xs text-edp-slate mt-1">
              Formatos suportados: MP4, AVI, MOV, MKV, WEBM, FLV
            </p>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-edp-marine mb-1">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md text-sm"
            rows={3}
            placeholder="Descrição detalhada do vídeo de publicidade..."
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-edp-marine mb-1">
              Duração (segundos)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
              className="w-full p-3 border border-gray-300 rounded-md text-sm"
              min="5"
              max="300"
            />
            <p className="text-xs text-edp-slate mt-1">5 a 300 segundos</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-edp-marine mb-1">
              Prioridade de Exibição
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })}
              className="w-full p-3 border border-gray-300 rounded-md text-sm"
              min="0"
              max="100"
            />
            <p className="text-xs text-edp-slate mt-1">0 = baixa, 100 = alta</p>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm font-medium text-edp-marine">Ativar Imediatamente</span>
            </label>
          </div>
        </div>
        
        <div className="flex space-x-4 pt-4 border-t">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-edp-marine text-white py-3 px-4 rounded-md hover:bg-edp-marine-100 transition-colors font-medium"
          >
            ✓ Adicionar Vídeo
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-edp-marine py-3 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};