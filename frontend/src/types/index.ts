export interface PlcData {
  timestamp: string;
  variables: Record<string, number>;
}

export interface EclusaStatus {
  velocidadeMontante: number;
  velocidadeCaldeira: number;
  distanciaMontante: number;
  distanciaCaldeira: number;
  distanciaJusante: number;
  faseAtual: number;
  eclusaAtiva: boolean;
  excessoVelocidade: boolean;
  semaforoStatus: 'vermelho' | 'verde' | 'amarelo';
}

export interface TextConfig {
  id: number;
  key: string;
  text: string;
  enabled: boolean;
}

export interface PhaseConfig {
  id: number;
  phase_number: number;
  title: string;
  description: string;
  color: string;
  enabled: boolean;
}

export interface BitConfig {
  id: number;
  word_index: number;      // 0-63 (qual WORD)
  bit_index: number;       // 0-15 (qual bit na WORD)
  name: string;            // Nome descritivo do bit
  message: string;         // Mensagem a exibir quando bit = 1
  message_off: string;     // Mensagem a exibir quando bit = 0
  enabled: boolean;        // Se o bit está ativo para monitoramento
  priority: number;        // Prioridade de exibição (maior = mais importante)
  color: string;           // Cor para exibir (#hex)
  font_size: number;       // Tamanho da fonte (em px)
  position: string;        // Posição na tela: 'center', 'top', 'bottom'
  font_family: string;     // Família da fonte para painel LED
  font_weight: string;     // Peso da fonte: 'normal', 'bold', 'black'
  text_shadow: boolean;    // Ativar sombra no texto
  letter_spacing: number;  // Espaçamento entre letras (px)
  use_template: boolean;   // Se true, usa message_template com variáveis
  message_template: string; // Template com tags {Word[N]}, ex: "Velocidade: {Word[10]} km/h"
  action_type: 'text' | 'video'; // Tipo de ação: exibir texto ou vídeo
  video_id: number | null;  // ID do vídeo associado (quando action_type = "video")
}

export interface BitStatus {
  config: BitConfig;
  value: boolean;          // Estado atual do bit (true/false)
  active_message: string;  // Mensagem ativa baseada no estado
}

export interface VideoConfig {
  id: number;
  name: string;            // Nome do vídeo
  file_path: string;       // Caminho do arquivo
  duration: number;        // Duração em segundos
  enabled: boolean;        // Se está ativo para exibição
  priority: number;        // Prioridade de exibição
  description: string;     // Descrição do vídeo
  display_order: number;   // Ordem de exibição
}

export interface SystemLog {
  id: number;
  timestamp: string;       // Data/hora do evento
  level: string;           // "info", "warning", "error", "critical"
  category: string;        // "plc", "tcp", "database", "ui"
  message: string;         // Mensagem de log
  details: string;         // Detalhes adicionais
}