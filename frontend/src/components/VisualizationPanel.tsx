import React, { useState, useEffect, useMemo, useRef } from 'react';
import { listen, invoke, getVideoUrl } from '../services/api';
import type { PlcData, VideoConfig, BitConfig } from '../types';
import { parseTemplate } from '../utils/templateParser';

/**
 * VisualizationPanel - Painel de exibição full-screen para LED outdoor
 * 
 * Lógica simples:
 * - Carrega o bit de controle de vídeos via get_video_control_config (configurável na página Publicidade)
 * - Se esse bit estiver 1 no PLC -> mostra vídeos em sequência (rotação)
 * - Se esse bit estiver 0 -> mostra textos dos bits configurados (por prioridade)
 */
export const VisualizationPanel: React.FC = () => {
  const [plcData, setPlcData] = useState<PlcData | null>(null);
  const [, setIsConnected] = useState(false);
  const [videos, setVideos] = useState<VideoConfig[]>([]);
  const [bitConfigs, setBitConfigs] = useState<BitConfig[]>([]);
  const [currentView, setCurrentView] = useState<'plc' | 'video'>('plc');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [viewStartTime, setViewStartTime] = useState(Date.now());
  const [videoControlConfig, setVideoControlConfig] = useState<{ wordIndex: number; bitIndex: number }>({ wordIndex: 5, bitIndex: 3 });
  const [videoKey, setVideoKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Refs para valores atualizados no intervalo (stale closure fix)
  const currentViewRef = useRef(currentView);
  const videosRef = useRef(videos);
  const plcDataRef = useRef(plcData);
  const videoControlConfigRef = useRef(videoControlConfig);
  const currentVideoIndexRef = useRef(currentVideoIndex);
  const viewStartTimeRef = useRef(viewStartTime);

  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { videosRef.current = videos; }, [videos]);
  useEffect(() => { plcDataRef.current = plcData; }, [plcData]);
  useEffect(() => { videoControlConfigRef.current = videoControlConfig; }, [videoControlConfig]);
  useEffect(() => { currentVideoIndexRef.current = currentVideoIndex; }, [currentVideoIndex]);
  useEffect(() => { viewStartTimeRef.current = viewStartTime; }, [viewStartTime]);

  // Listener PLC - executado uma vez
  useEffect(() => {
    const setupListener = async () => {
      try {
        const unlisten = await listen<{ message: PlcData }>('plc-data', (event) => {
          setPlcData(event.payload.message);
          setIsConnected(true);
        });
        return unlisten;
      } catch (error) {
        console.error('[Panel] Erro ao configurar listener:', error);
      }
    };

    let unlistenFn: any;
    setupListener().then(fn => { unlistenFn = fn; });
    return () => { if (unlistenFn) unlistenFn(); };
  }, []);

  // Carregar configurações - executado uma vez + reload a cada 30s
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const [videosData, bitConfigsData, videoControlData] = await Promise.all([
          invoke<VideoConfig[]>('get_enabled_videos'),
          invoke<BitConfig[]>('get_all_bit_configs'),
          invoke<[number, number]>('get_video_control_config')
        ]);

        setVideos(videosData);
        setBitConfigs(bitConfigsData);
        setVideoControlConfig({ wordIndex: videoControlData[0], bitIndex: videoControlData[1] });
      } catch (error) {
        console.error('[Panel] Erro ao carregar configurações:', error);
      }
    };

    loadConfigs();
    const reloadInterval = setInterval(loadConfigs, 30000);
    return () => clearInterval(reloadInterval);
  }, []);

  // URL do vídeo atual via servidor HTTP
  const currentVideo = videos[currentVideoIndex];
  const videoSrc = currentView === 'video' && currentVideo
    ? getVideoUrl(currentVideo.file_path)
    : '';

  // Incrementar videoKey quando muda de vídeo para forçar remount
  const prevVideoIndexRef = useRef(currentVideoIndex);
  useEffect(() => {
    if (currentVideoIndex !== prevVideoIndexRef.current) {
      setVideoKey(prev => prev + 1);
      prevVideoIndexRef.current = currentVideoIndex;
    }
  }, [currentVideoIndex]);

  // Verificar bit de controle e alternar entre vídeo e PLC - intervalo de 1s
  useEffect(() => {
    const viewInterval = setInterval(() => {
      const cv = currentViewRef.current;
      const vids = videosRef.current;
      const pd = plcDataRef.current;
      const vcc = videoControlConfigRef.current;
      const cvi = currentVideoIndexRef.current;
      const vst = viewStartTimeRef.current;

      // Checar se bit de vídeo está ativo
      let shouldShowVideos = false;
      if (pd?.variables) {
        const wordKey = `Word[${vcc.wordIndex}]`;
        const wordValue = pd.variables[wordKey] || 0;
        shouldShowVideos = ((wordValue >> vcc.bitIndex) & 1) === 1;
      }

      const now = Date.now();

      if (shouldShowVideos && vids.length > 0) {
        // BIT ATIVO - Mostrar vídeos
        if (cv === 'plc') {
          setCurrentView('video');
          setCurrentVideoIndex(0);
          setViewStartTime(now);
        } else if (cv === 'video') {
          // Rotacionar vídeos por duração
          const currentVideo = vids[cvi];
          if (currentVideo) {
            const elapsed = (now - vst) / 1000;
            if (elapsed >= currentVideo.duration) {
              const nextIdx = (cvi + 1) % vids.length;
              setCurrentVideoIndex(nextIdx);
              setViewStartTime(now);
            }
          }
        }
      } else {
        // BIT INATIVO - Mostrar textos PLC
        if (cv === 'video') {
          setCurrentView('plc');
          setCurrentVideoIndex(0);
          setViewStartTime(now);
        }
      }
    }, 1000);

    return () => clearInterval(viewInterval);
  }, []); // SEM dependências - usa refs

  // Mensagens de texto ativas baseadas nos bits do PLC
  const activeMessages = useMemo(() => {
    if (!plcData?.variables || bitConfigs.length === 0) return [];

    const messages: Array<{
      message: string;
      color: string;
      priority: number;
      fontSize: number;
      position: string;
      fontFamily: string;
      fontWeight: string;
      textShadow: boolean;
      letterSpacing: number;
    }> = [];

    bitConfigs.forEach(bitConfig => {
      if (!bitConfig.enabled) return;

      const wordKey = `Word[${bitConfig.word_index}]`;
      const wordValue = plcData.variables[wordKey] || 0;
      const bitValue = ((wordValue >> bitConfig.bit_index) & 1) === 1;

      if (bitValue) {
        let finalMessage: string;
        if (bitConfig.use_template && bitConfig.message_template) {
          finalMessage = parseTemplate(bitConfig.message_template, plcData.variables);
        } else {
          finalMessage = bitConfig.message;
        }

        if (finalMessage.trim()) {
          messages.push({
            message: finalMessage,
            color: bitConfig.color,
            priority: bitConfig.priority,
            fontSize: bitConfig.font_size,
            position: bitConfig.position,
            fontFamily: bitConfig.font_family || 'Arial Black',
            fontWeight: bitConfig.font_weight || 'bold',
            textShadow: bitConfig.text_shadow !== undefined ? bitConfig.text_shadow : true,
            letterSpacing: bitConfig.letter_spacing || 2,
          });
        }
      }
    });

    // Ordenar por prioridade (maior primeiro)
    return messages.sort((a, b) => b.priority - a.priority);
  }, [plcData, bitConfigs]);

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden text-white">
      {currentView === 'video' && currentVideo && videoSrc ? (
        // MODO VÍDEO - Full Screen - Vídeos em sequência
        <div className="w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            key={videoKey}
            src={videoSrc}
            autoPlay
            playsInline
            muted
            preload="auto"
            className="w-full h-full object-cover"
            onError={() => {
              console.error('[Panel] Erro ao carregar vídeo:', currentVideo.file_path);
            }}
            onLoadedData={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error('[Panel] Erro ao dar play:', err);
                });
              }
            }}
          >
            Seu navegador não suporta vídeo.
          </video>
        </div>
      ) : currentView === 'plc' ? (
        // MODO PLC - Mensagens dos Bits Ativos
        <div className="w-full h-full flex flex-col justify-center items-center p-8">
          {activeMessages.length > 0 ? (
            (() => {
              // Apenas a mensagem de maior prioridade (índice 0, já ordenado)
              const msg = activeMessages[0];
              return (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    justifyContent: msg.position === 'top' ? 'flex-start' : msg.position === 'bottom' ? 'flex-end' : 'center',
                    paddingTop: msg.position === 'top' ? '5%' : undefined,
                    paddingBottom: msg.position === 'bottom' ? '5%' : undefined,
                  }}
                >
                  <p
                    style={{
                      color: msg.color,
                      fontSize: `${msg.fontSize}px`,
                      fontFamily: msg.fontFamily,
                      fontWeight: msg.fontWeight,
                      letterSpacing: `${msg.letterSpacing}px`,
                      textShadow: msg.textShadow
                        ? `0 0 50px ${msg.color}, 0 0 100px ${msg.color}, 0 0 150px ${msg.color}, 0 0 200px ${msg.color}`
                        : 'none',
                      textTransform: 'uppercase',
                      lineHeight: 1.2,
                      textAlign: 'center',
                      width: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                      hyphens: 'auto',
                      WebkitFontSmoothing: 'antialiased',
                    }}
                  >
                    {msg.message}
                  </p>
                </div>
              );
            })()
          ) : null}
        </div>
      ) : null}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default VisualizationPanel;
