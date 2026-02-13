import React, { useState, useEffect } from 'react';
import { invoke, getVideoUrl } from '../services/api';
import { Video, Upload, Trash2, Play, Edit, X, Check, Clock, RefreshCw, Folder, Zap, AlertCircle, Settings, MemoryStick, ChevronUp, ChevronDown } from 'lucide-react';
import type { VideoConfig } from '../types';
import { AddVideoForm } from '../components/AddVideoForm';
import { useToast } from '../components/Toast';

export const PaginaPublicidade: React.FC = () => {
  const [videos, setVideos] = useState<VideoConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [filtroTexto, setFiltroTexto] = useState('');
  
  // Estado para configuração do bit de controle
  const [showControlConfig, setShowControlConfig] = useState(false);
  const [videoControlConfig, setVideoControlConfig] = useState({ wordIndex: 5, bitIndex: 3 });
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;
  const { toast, confirm } = useToast();

  useEffect(() => {
    loadVideos();
    loadVideoControlConfig();
  }, []);

  const loadVideoControlConfig = async () => {
    try {
      const [wordIndex, bitIndex] = await invoke<[number, number]>('get_video_control_config');
      setVideoControlConfig({ wordIndex, bitIndex });
    } catch (error) {
      console.error('Erro ao carregar configuração do controle de vídeos:', error);
    }
  };

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const videosData = await invoke<VideoConfig[]>('get_all_videos');
      setVideos(videosData);
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideos = async () => {
    const filePath = window.prompt('Introduza o caminho completo do vídeo no servidor:\n(ex: /home/rls/videos/publicidade.mp4)');
    if (!filePath) return;

    try {
      const fileName = filePath.split('/').pop() || 'video';
      await invoke('add_video', {
        name: fileName,
        filePath: filePath,
        duration: 30,
        enabled: true,
        priority: 50,
        description: ''
      });
      await loadVideos();
      toast('success', 'Vídeo adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
      toast('error', `Erro ao adicionar vídeo: ${error}`);
    }
  };

  const addNewVideo = async (videoData: {
    name: string;
    filePath: string;
    duration: number;
    enabled: boolean;
    priority: number;
    description: string;
  }) => {
    try {
      await invoke('add_video', videoData);
      setShowAddVideoForm(false);
      await loadVideos();
      toast('success', 'Vídeo adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar vídeo:', error);
      toast('error', `Erro ao adicionar vídeo: ${error}`);
    }
  };

  const clearAllVideos = async () => {
    const confirmed = await confirm({
      title: 'Apagar Todos os Vídeos',
      message: 'ATENÇÃO: Isso vai APAGAR TODOS OS VÍDEOS. Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar Tudo',
      danger: true,
    });
    if (confirmed) {
      try {
        await invoke('clear_all_videos');
        await loadVideos();
        toast('success', 'Todos os vídeos foram removidos!');
      } catch (error) {
        toast('error', `Erro: ${error}`);
      }
    }
  };

  const moveVideoUp = async (video: VideoConfig) => {
    try {
      const newOrder = Math.max(0, video.display_order - 1);
      await invoke('reorder_video', {
        id: video.id,
        newOrder: newOrder
      });
      await loadVideos();
    } catch (error) {
      console.error('Erro ao mover vídeo para cima:', error);
      toast('error', `Erro ao mover vídeo: ${error}`);
    }
  };

  const moveVideoDown = async (video: VideoConfig) => {
    try {
      const newOrder = video.display_order + 1;
      await invoke('reorder_video', {
        id: video.id,
        newOrder: newOrder
      });
      await loadVideos();
    } catch (error) {
      console.error('Erro ao mover vídeo para baixo:', error);
      toast('error', `Erro ao mover vídeo: ${error}`);
    }
  };

  const handleMoveVideo = async (videoId: number, direction: 'up' | 'down') => {
    try {
      const video = videos.find(v => v.id === videoId);
      if (!video) return;

      if (direction === 'up') {
        await moveVideoUp(video);
      } else {
        await moveVideoDown(video);
      }
    } catch (error) {
      console.error('Erro ao mover vídeo:', error);
    }
  };

  const handleUpdateControlConfig = async () => {
    setIsUpdatingConfig(true);
    try {
      await invoke('set_video_control_config', {
        wordIndex: videoControlConfig.wordIndex,
        bitIndex: videoControlConfig.bitIndex
      });
      setShowControlConfig(false);
      toast('success', 'Configuração do controle de vídeos atualizada!');
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      toast('error', `Erro ao atualizar configuração: ${error}`);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Filtrar e paginar vídeos
  const videosFiltrados = videos.filter(video => {
    const matchTexto = video.name.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                       video.description.toLowerCase().includes(filtroTexto.toLowerCase());
    
    const matchStatus = filtroStatus === 'todos' || 
                        (filtroStatus === 'ativos' && video.enabled) ||
                        (filtroStatus === 'inativos' && !video.enabled);
    
    return matchTexto && matchStatus;
  });

  // Paginação
  const totalPaginas = Math.ceil(videosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const videosPaginados = videosFiltrados.slice(indiceInicio, indiceFim);

  // Reset página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroTexto, filtroStatus]);

  return (
    <div className="space-y-6">

      {/* Stats Cards - Design Minimalista EDP */}
      {videos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card Total de Vídeos */}
          <div className="bg-white border border-edp-neutral-lighter rounded-lg p-4 hover:border-edp-marine transition-colors">
            <div className="text-sm text-edp-slate mb-1">Total de Vídeos</div>
            <div className="text-2xl font-bold text-edp-marine font-tabular">{videos.length}</div>
          </div>
          
          {/* Card Vídeos Ativos */}
          <div className="bg-white border border-edp-neutral-lighter rounded-lg p-4 hover:border-edp-marine transition-colors">
            <div className="text-sm text-edp-slate mb-1">Vídeos Ativos</div>
            <div className="text-2xl font-bold text-edp-marine font-tabular">{videos.filter(v => v.enabled).length}</div>
          </div>
          
          {/* Card Vídeos Inativos */}
          <div className="bg-white border border-edp-neutral-lighter rounded-lg p-4 hover:border-edp-slate transition-colors">
            <div className="text-sm text-edp-slate mb-1">Vídeos Inativos</div>
            <div className="text-2xl font-bold text-edp-slate font-tabular">{videos.filter(v => !v.enabled).length}</div>
          </div>
          
          {/* Card Duração Total */}
          <div className="bg-white border border-edp-neutral-lighter rounded-lg p-4 hover:border-edp-marine transition-colors">
            <div className="text-sm text-edp-slate mb-1">Duração Total</div>
            <div className="text-2xl font-bold text-edp-marine font-tabular">{videos.reduce((acc, v) => acc + v.duration, 0)}s</div>
          </div>
        </div>
      )}

      {/* Tabela com Controles Integrados - Design EDP */}
      <div className="bg-white rounded-lg shadow-sm border border-edp-neutral-lighter overflow-hidden">
        {/* Header da Tabela com Controles */}
        <div className="px-6 py-4 border-b border-edp-neutral-lighter bg-edp-neutral-white-wash">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Contador compacto */}
              <div className="px-3 py-1.5 bg-edp-marine bg-opacity-10 rounded-lg">
                <span className="text-sm font-medium text-edp-marine font-tabular">
                  {videosFiltrados.length} {videosFiltrados.length === 1 ? 'vídeo' : 'vídeos'}
                </span>
              </div>
            </div>
            
            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro de Status */}
              <div className="relative">
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'ativos' | 'inativos')}
                  className="px-3 py-2.5 text-sm border border-edp-neutral-lighter rounded-lg focus:border-edp-marine focus:ring-1 focus:ring-edp-marine transition-colors bg-white appearance-none pr-8 cursor-pointer"
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-edp-slate pointer-events-none" />
              </div>

              {/* Campo de Busca */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar vídeos..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="w-64 pl-9 pr-8 py-2.5 text-sm border border-edp-neutral-lighter rounded-lg bg-white focus:border-edp-marine focus:ring-1 focus:ring-edp-marine transition-colors placeholder-edp-slate"
                />
                <svg className="h-4 w-4 text-edp-slate absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {filtroTexto && (
                  <button
                    onClick={() => setFiltroTexto('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-edp-slate hover:text-edp-marine transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Botão PLC */}
              <button
                onClick={() => setShowControlConfig(!showControlConfig)}
                className="p-2.5 text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-tint rounded-lg transition-colors border border-edp-neutral-lighter hover:border-edp-marine"
                title={`Controle PLC: Word[${videoControlConfig.wordIndex}].${videoControlConfig.bitIndex}`}
              >
                <MemoryStick size={16} />
              </button>

              {/* Botão Recarregar */}
              <button
                onClick={loadVideos}
                disabled={isLoading}
                className="p-2.5 text-edp-slate hover:text-edp-marine hover:bg-edp-neutral-white-tint rounded-lg transition-colors border border-edp-neutral-lighter hover:border-edp-marine disabled:opacity-50"
                title="Recarregar vídeos"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </button>

              {/* Botão Selecionar */}
              <button
                onClick={handleSelectVideos}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-edp-marine text-white rounded-lg hover:bg-edp-marine-100 transition-colors"
              >
                <Upload size={16} />
                Selecionar
              </button>

              {/* Botão Manual */}
              <button
                onClick={() => setShowAddVideoForm(!showAddVideoForm)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  showAddVideoForm 
                    ? 'bg-edp-semantic-red text-white hover:bg-opacity-90'
                    : 'bg-edp-marine text-white hover:bg-edp-marine-100'
                }`}
              >
                <Video size={16} className={showAddVideoForm ? 'rotate-45' : ''} />
                {showAddVideoForm ? 'Cancelar' : 'Manual'}
              </button>

              {/* Botão Limpar */}
              {videos.length > 0 && (
                <button
                  onClick={clearAllVideos}
                  className="p-2.5 text-edp-semantic-red hover:bg-edp-semantic-light-red rounded-lg transition-colors border border-edp-semantic-red border-opacity-30 hover:border-edp-semantic-red"
                  title="Limpar todos os vídeos"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          
          {/* Indicador de Busca */}
          {(filtroTexto || filtroStatus !== 'todos') && (
            <div className="mt-3 pt-3 border-t border-edp-neutral-lighter">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-edp-slate">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>
                    {videosFiltrados.length} resultado{videosFiltrados.length !== 1 ? 's' : ''} {filtroTexto && `para "${filtroTexto}"`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFiltroTexto('');
                    setFiltroStatus('todos');
                  }}
                  className="text-xs text-edp-marine hover:underline transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )}
          
          {/* Configuração PLC */}
          {showControlConfig && (
            <div className="mt-3 pt-3 border-t border-edp-neutral-lighter bg-edp-marine bg-opacity-5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-edp-marine">Bit PLC:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="63"
                      value={videoControlConfig.wordIndex}
                      onChange={(e) => setVideoControlConfig({ 
                        ...videoControlConfig, 
                        wordIndex: parseInt(e.target.value) || 0 
                      })}
                      className="w-16 px-2 py-1 text-xs border border-edp-neutral-lighter rounded focus:ring-1 focus:ring-edp-marine bg-white font-tabular"
                      placeholder="Word"
                    />
                    <span className="text-edp-marine">.</span>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={videoControlConfig.bitIndex}
                      onChange={(e) => setVideoControlConfig({ 
                        ...videoControlConfig, 
                        bitIndex: parseInt(e.target.value) || 0 
                      })}
                      className="w-12 px-2 py-1 text-xs border border-edp-neutral-lighter rounded focus:ring-1 focus:ring-edp-marine bg-white font-tabular"
                      placeholder="Bit"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateControlConfig}
                    disabled={isUpdatingConfig}
                    className="px-3 py-1 text-xs bg-edp-marine text-white rounded hover:bg-edp-marine-100 disabled:opacity-50 transition-colors"
                  >
                    {isUpdatingConfig ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setShowControlConfig(false)}
                    className="px-3 py-1 text-xs bg-edp-slate text-white rounded hover:bg-edp-slate-100 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Video Form Integrado */}
        {showAddVideoForm && (
          <div className="px-6 py-4 border-b border-edp-neutral-lighter bg-edp-marine bg-opacity-5">
            <AddVideoForm 
              onAdd={addNewVideo} 
              onCancel={() => setShowAddVideoForm(false)} 
            />
          </div>
        )}


        {/* Conteúdo da Tabela */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-edp-marine border-t-transparent mx-auto mb-4"></div>
            <p className="text-edp-slate">Carregando vídeos...</p>
          </div>
        ) : videosFiltrados.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-edp-neutral-white-wash border-b border-edp-neutral-lighter">
                  <tr>
                    <th className="text-center py-4 px-3 font-semibold text-edp-marine w-16">Ordem</th>
                    <th className="text-left py-4 px-6 font-semibold text-edp-marine">Vídeo</th>
                    <th className="text-center py-4 px-4 font-semibold text-edp-marine">Status</th>
                    <th className="text-center py-4 px-4 font-semibold text-edp-marine">Prioridade</th>
                    <th className="text-center py-4 px-4 font-semibold text-edp-marine">Duração</th>
                    <th className="text-center py-4 px-4 font-semibold text-edp-marine">Arquivo</th>
                    <th className="text-center py-4 px-4 font-semibold text-edp-marine">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edp-neutral-lighter">
                  {videosPaginados.map((video, index) => (
                    <VideoTableRow
                      key={video.id}
                      video={video}
                      onUpdate={loadVideos}
                      ordem={indiceInicio + index + 1}
                      canMoveUp={index > 0 || paginaAtual > 1}
                      canMoveDown={index < videosPaginados.length - 1 || paginaAtual < totalPaginas}
                      onMoveUp={() => handleMoveVideo(video.id, 'up')}
                      onMoveDown={() => handleMoveVideo(video.id, 'down')}
                      toast={toast}
                      confirm={confirm}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginação EDP */}
            {totalPaginas > 1 && (
              <div className="px-6 py-4 border-t border-edp-neutral-lighter bg-edp-neutral-white-wash">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-edp-slate">
                    Mostrando <span className="font-semibold font-tabular text-edp-marine">{indiceInicio + 1}</span> a{' '}
                    <span className="font-semibold font-tabular text-edp-marine">{Math.min(indiceFim, videosFiltrados.length)}</span> de{' '}
                    <span className="font-semibold font-tabular text-edp-marine">{videosFiltrados.length}</span> vídeos
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1.5 text-sm border border-edp-neutral-lighter rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-edp-marine font-medium"
                    >
                      Anterior
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numeroPage) => (
                        <button
                          key={numeroPage}
                          onClick={() => setPaginaAtual(numeroPage)}
                          className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                            numeroPage === paginaAtual
                              ? 'bg-edp-marine text-white'
                              : 'text-edp-marine hover:bg-edp-neutral-white-tint'
                          }`}
                        >
                          {numeroPage}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1.5 text-sm border border-edp-neutral-lighter rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-edp-marine font-medium"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : videos.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-edp-neutral-white-wash rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={32} className="text-edp-slate" />
            </div>
            <h3 className="text-lg font-semibold text-edp-marine mb-2">Nenhum vídeo configurado</h3>
            <p className="text-edp-slate mb-6">
              Adicione vídeos de publicidade para exibir no painel LED
            </p>
            <button
              onClick={handleSelectVideos}
              className="flex items-center gap-2 px-6 py-3 bg-edp-marine text-white rounded-lg hover:bg-edp-marine-100 transition-colors font-medium mx-auto"
            >
              <Upload size={18} />
              Selecionar Vídeos
            </button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-edp-slate">Nenhum vídeo encontrado com os filtros aplicados.</p>
            <button
              onClick={() => {
                setFiltroTexto('');
                setFiltroStatus('todos');
              }}
              className="mt-3 text-edp-marine hover:text-edp-marine-100 underline transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Video Table Row Component
const VideoTableRow: React.FC<{
  video: VideoConfig;
  onUpdate: () => void;
  ordem: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  toast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  confirm: (options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
}> = ({ video, onUpdate, ordem, canMoveUp, canMoveDown, onMoveUp, onMoveDown, toast, confirm }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    name: video.name,
    file_path: video.file_path,
    duration: video.duration,
    enabled: video.enabled,
    priority: video.priority,
    description: video.description
  });

  // URL do vídeo via servidor HTTP
  const videoSrc = showPreview ? getVideoUrl(video.file_path) : '';

  const handleSave = async () => {
    try {
      await invoke('update_video', {
        id: video.id,
        name: formData.name,
        filePath: formData.file_path,
        duration: formData.duration,
        enabled: formData.enabled,
        priority: formData.priority,
        description: formData.description,
        displayOrder: video.display_order
      });
      setIsEditing(false);
      onUpdate();
      toast('success', 'Vídeo atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar vídeo:', error);
      toast('error', `Erro ao atualizar vídeo: ${error}`);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Deletar Vídeo',
      message: `Tem certeza que deseja deletar "${video.name}"?`,
      confirmLabel: 'Deletar',
      danger: true,
    });
    if (confirmed) {
      try {
        await invoke('delete_video', { id: video.id });
        onUpdate();
        toast('success', 'Vídeo deletado com sucesso!');
      } catch (error) {
        console.error('Erro ao deletar vídeo:', error);
        toast('error', `Erro ao deletar vídeo: ${error}`);
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      name: video.name,
      file_path: video.file_path,
      duration: video.duration,
      enabled: video.enabled,
      priority: video.priority,
      description: video.description
    });
    setIsEditing(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isEditing) {
    return (
      <>
        {/* Modal de Edição - Padrão EDP */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-edp-marine rounded-lg flex items-center justify-center">
                  <Video size={24} className="text-headline-on-marine" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Editar Vídeo</h3>
                  <p className="text-sm text-gray-500 mt-1">Configurações de publicidade</p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-80 rounded-lg transition-edp"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Nome do Vídeo */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Nome do Vídeo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine transition-edp bg-gray-50 focus:bg-white"
                  placeholder="Ex: Publicidade EDP Verde 2024"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine transition-edp bg-gray-50 focus:bg-white resize-none"
                  rows={3}
                  placeholder="Descrição ou observações sobre o vídeo"
                />
              </div>

              {/* Caminho do Arquivo */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Caminho do Arquivo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.file_path}
                    onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine transition-edp bg-gray-50 focus:bg-white text-sm font-mono"
                    placeholder="C:\\Videos\\publicidade.mp4"
                  />
                  <Folder size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Grid de Configurações */}
              <div className="grid grid-cols-2 gap-6">
                {/* Duração */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Duração (segundos)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine transition-edp bg-gray-50 focus:bg-white font-tabular"
                      min="1"
                      max="300"
                    />
                    <Clock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500">Tempo de exibição no painel</p>
                </div>

                {/* Prioridade */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Prioridade
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-edp-marine focus:border-edp-marine transition-edp bg-gray-50 focus:bg-white font-tabular"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-500">0 (baixa) a 100 (alta)</p>
                </div>
              </div>

              {/* Toggle Ativo */}
              <div className="border-2 border-edp-electric rounded-lg p-4 bg-green-50">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 text-edp-marine border-gray-300 rounded focus:ring-edp-marine"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-bold text-gray-900 block">
                      Vídeo Ativo
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      Quando ativo, o vídeo será exibido na rotação de publicidade
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancel}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-edp"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 text-sm font-medium bg-edp-marine text-headline-on-marine rounded-lg hover:bg-edp-marine-100 transition-edp shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <Check size={18} />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>

        {/* Linha da tabela normal enquanto modal está aberto */}
        <tr className="hover:bg-gray-50 transition-colors">
          <td className="py-4 px-3 text-center">
            <span className="text-sm font-medium text-gray-700">#{ordem}</span>
          </td>
          <td className="py-4 px-6">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-12 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                <video 
                  src={videoSrc}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{video.name}</p>
              </div>
            </div>
          </td>
          <td className="py-4 px-6 text-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              video.enabled 
                ? 'bg-edp-marine bg-opacity-20 text-edp-marine' 
                : 'bg-edp-semantic-light-red text-edp-semantic-red'
            }`}>
              {video.enabled ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td className="py-4 px-6 text-center">
            <span className="text-sm text-gray-900 font-tabular">{video.priority}</span>
          </td>
          <td className="py-4 px-6 text-center">
            <span className="text-sm text-gray-900 font-medium">{formatDuration(video.duration)}</span>
          </td>
          <td className="py-4 px-6 text-center">
            <span className="text-sm text-gray-500 truncate">{video.file_path.split(/[/\\]/).pop()}</span>
          </td>
          <td className="py-4 px-6 text-center">
            <div className="flex items-center justify-center opacity-50">
              <span className="text-xs text-gray-500">Editando...</span>
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="py-4 px-3 text-center">
          <div className="flex flex-col items-center space-y-1">
            <span className="text-sm font-medium text-gray-700">#{ordem}</span>
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className={`p-1 rounded transition-colors ${
                  canMoveUp 
                    ? 'text-edp-slate hover:text-edp-marine hover:bg-edp-marine hover:bg-opacity-5' 
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Mover para cima"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className={`p-1 rounded transition-colors ${
                  canMoveDown 
                    ? 'text-edp-slate hover:text-edp-marine hover:bg-edp-marine hover:bg-opacity-5' 
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Mover para baixo"
              >
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-16 h-12 bg-gray-900 rounded-lg overflow-hidden hover:opacity-80 transition-opacity relative group flex-shrink-0"
              title="Clique para visualizar o vídeo"
            >
              <video 
                src={videoSrc}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-opacity">
                <Play size={16} className="text-white" />
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{video.name}</p>
              {video.description && (
                <p className="text-sm text-gray-500 truncate">{video.description}</p>
              )}
            </div>
          </div>
        </td>
        <td className="py-4 px-6 text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            video.enabled 
              ? 'bg-edp-marine bg-opacity-20 text-edp-marine' 
              : 'bg-edp-semantic-light-red text-edp-semantic-red'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              video.enabled ? 'bg-edp-marine' : 'bg-edp-semantic-red'
            }`}></div>
            {video.enabled ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td className="py-4 px-6 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-edp-marine bg-opacity-10 text-edp-marine">
            {video.priority}
          </span>
        </td>
        <td className="py-4 px-6 text-center">
          <span className="text-sm text-edp-marine font-medium">{formatDuration(video.duration)}</span>
        </td>
        <td className="py-4 px-6 text-center">
          <span 
            className="text-sm text-edp-slate truncate max-w-xs inline-block" 
            title={video.file_path}
          >
            {video.file_path.split(/[/\\]/).pop()}
          </span>
        </td>
        <td className="py-4 px-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-edp-marine hover:bg-edp-marine hover:bg-opacity-10 rounded-lg transition-colors"
              title="Visualizar vídeo"
            >
              <Play size={16} />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Editar vídeo"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-edp-semantic-red hover:bg-edp-semantic-light-red rounded-lg transition-colors"
              title="Deletar vídeo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
      
      {/* Video Preview Row */}
      {showPreview && (
        <tr>
          <td colSpan={6} className="py-0">
            <div className="bg-black relative">
              {videoSrc ? (
                <video 
                  src={videoSrc}
                  controls 
                  autoPlay
                  className="w-full max-h-96 object-contain"
                  onError={(e) => {
                    const mediaErr = (e.target as HTMLVideoElement).error;
                    console.error('❌ Vídeo erro code:', mediaErr?.code, 'msg:', mediaErr?.message);
                  }}
                >
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              ) : (
                <div className="flex items-center justify-center h-48 text-white">
                  <span>A iniciar servidor de vídeo...</span>
                </div>
              )}
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 flex items-center space-x-2"
              >
                <X size={16} />
                <span>Fechar Preview</span>
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};


export default PaginaPublicidade;
