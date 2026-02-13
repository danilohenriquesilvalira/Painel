import { useState, useEffect } from 'react';
import { listen } from '../services/api';
import type { PlcData, EclusaStatus } from '../types';

export const usePlcData = () => {
  const [rawData, setRawData] = useState<PlcData | null>(null);
  const [eclusaStatus, setEclusaStatus] = useState<EclusaStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<{ message: PlcData }>('plc-data', (event) => {
          const data = event.payload.message;
          setRawData(data);
          
          const vars = data.variables;
          const status: EclusaStatus = {
            velocidadeMontante: vars.velocidade_montante || 0,
            velocidadeCaldeira: vars.velocidade_caldeira || 0,
            distanciaMontante: vars.distancia_montante || 0,
            distanciaCaldeira: vars.distancia_caldeira || 0,
            distanciaJusante: vars.distancia_jusante || 0,
            faseAtual: vars.fase_eclusa || 1,
            eclusaAtiva: ((vars['Word[0]'] || 0) & 1) !== 0,
            excessoVelocidade: ((vars['Word[0]'] || 0) & 2) !== 0,
            semaforoStatus: vars['Word[10]'] === 1 ? 'verde' : vars['Word[10]'] === 2 ? 'amarelo' : 'vermelho',
          };
          
          setEclusaStatus(status);
          setIsConnected(true);
          setLastUpdate(new Date());
        });
      } catch (error) {
        console.error('Erro ao configurar listener PLC:', error);
        setIsConnected(false);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return { rawData, eclusaStatus, isConnected, lastUpdate };
};