/**
 * App Principal
 * 
 * Ponto de entrada da aplicação com layout EDP
 */

import { useState, useEffect, useRef } from 'react';
import { listen } from './services/api';
import './styles/globals.css';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PaginaVisaoGeral } from './pages/PaginaVisaoGeral';
import { PaginaBits } from './pages/PaginaBits';
import { PaginaPublicidade } from './pages/PaginaPublicidade';
import { ToastProvider } from './components/Toast';
import type { PlcData } from './types';

function App() {
  const [plcData, setPlcData] = useState<PlcData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const [paginaAtiva, setPaginaAtiva] = useState(() => {
    return localStorage.getItem('paginaAtiva') || 'visao-geral';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarRecolhido, setSidebarRecolhido] = useState(() => {
    const saved = localStorage.getItem('sidebarRecolhido');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return false;
  });

  // Sistema de reconexão automática e detecção de falhas
  useEffect(() => {
    let unlistenFunc: (() => void) | null = null;
    let isListenerActive = false;
    let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    let healthCheckInterval: ReturnType<typeof setTimeout> | null = null;
    
    const setupListener = async () => {
      try {
        console.log('🔄 Configurando listener PLC...');
        
        // Limpa listener anterior se existir
        if (unlistenFunc) {
          unlistenFunc();
          unlistenFunc = null;
        }
        
        const unlisten = await listen<{ message: PlcData }>('plc-data', (event) => {
          console.log('📡 Dados PLC recebidos:', event.payload.message);
          setPlcData(event.payload.message);
          setIsConnected(true);
          setLastUpdate(new Date());
          isListenerActive = true;
          
          // Reset timeout de conexão
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }
          connectionTimeout = setTimeout(() => {
            console.warn('⚠️ Timeout de conexão - sem dados do PLC há 10 segundos');
            setIsConnected(false);
            isListenerActive = false;
          }, 10000); // 10 segundos sem dados = desconectado
        });
        
        unlistenFunc = unlisten;
        console.log('✅ Listener PLC configurado com sucesso');
        
        return unlisten;
      } catch (error) {
        console.error('❌ Erro ao configurar listener:', error);
        
        // Tenta reconectar em 2 segundos
        setTimeout(() => {
          console.log('🔄 Tentando reconectar listener...');
          setupListener();
        }, 2000);
      }
    };
    
    // Health check a cada 30 segundos
    const startHealthCheck = () => {
      healthCheckInterval = setInterval(() => {
        console.log('💓 Health check - Listener ativo:', isListenerActive);
        
        // Se não recebeu dados nos últimos 30 segundos, reconecta
        if (!isListenerActive) {
          console.log('🔄 Health check failed - reconectando listener...');
          setupListener();
        }
        isListenerActive = false; // Reset para próxima verificação
      }, 30000); // 30 segundos
    };

    // Inicializa
    setupListener();
    startHealthCheck();
    
    // Cleanup
    return () => {
      if (unlistenFunc) {
        unlistenFunc();
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      console.log('🧹 Listener PLC limpo');
    };
  }, []);

  const handleItemClick = (id: string) => {
    if (id === paginaAtiva || isTransitioning) return;
    
    setIsTransitioning(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Immediate page change with quick fade
    timeoutRef.current = setTimeout(() => {
      setPaginaAtiva(id);
      localStorage.setItem('paginaAtiva', id);
      setIsTransitioning(false);
    }, 100);
  };

  const handleToggleSidebar = () => {
    const novoEstado = !sidebarRecolhido;
    setSidebarRecolhido(novoEstado);
    localStorage.setItem('sidebarRecolhido', JSON.stringify(novoEstado));
  };

  // Mapear páginas para títulos
  const getTitulo = (): string => {
    const titulos: Record<string, string> = {
      'visao-geral': 'Visão Geral',
      'bits': 'Configurações de Bits',
      'publicidade': 'Publicidade'
    };
    return titulos[paginaAtiva] || 'Dashboard';
  };

  // Renderizar conteúdo com transições nativas suaves
  const renderConteudo = () => {
    const baseClasses = `
      p-6 
      transition-all duration-150 ease-out
      ${isTransitioning ? 'opacity-0' : 'opacity-100'}
    `;
    
    switch (paginaAtiva) {
      case 'visao-geral':
        return (
          <div className={baseClasses}>
            <PaginaVisaoGeral 
              isConnected={isConnected}
              lastUpdate={lastUpdate}
              plcData={plcData}
            />
          </div>
        );
      case 'bits':
        return (
          <div className={baseClasses}>
            <PaginaBits 
              isConnected={isConnected}
              lastUpdate={lastUpdate}
              plcData={plcData}
            />
          </div>
        );
      case 'publicidade':
        return (
          <div className={baseClasses}>
            <PaginaPublicidade />
          </div>
        );
      default:
        return (
          <div className={baseClasses}>
            <div className="bg-white rounded-lg shadow-sm p-6 transition-all duration-200 hover:shadow-md">
              <p className="text-edp-slate">
                Sistema de Gerenciamento PLC EDP
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen bg-edp-neutral-white-wash overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          itemAtivo={paginaAtiva}
          aoClicarItem={handleItemClick}
          recolhido={sidebarRecolhido}
          aoRecolher={handleToggleSidebar}
        />

        {/* Área de Conteúdo */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header
            titulo={getTitulo()}
            nomeUsuario="Operador EDP"
          />

          {/* Conteúdo Principal */}
          <div className="flex-1 overflow-auto">
            <div className="min-h-full">
              {renderConteudo()}
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;