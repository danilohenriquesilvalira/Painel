/**
 * Componente: Header
 * 
 * Cabeçalho geral da aplicação com título e ícones de usuário
 */

import React from 'react';
import { Bell, User, Settings, LogOut, Monitor } from 'lucide-react';

export type PropsHeader = {
  titulo?: string;
  nomeUsuario?: string;
};

export const Header: React.FC<PropsHeader> = ({
  titulo = 'Dashboard',
  nomeUsuario = 'Usuário'
}) => {
  const abrirPainelVisualizacao = () => {
    window.open('/src/panel.html', '_blank');
  };

  return (
    <header className="bg-edp-neutral-white-wash border-b border-edp-marine border-opacity-20">
      <div className="px-8 h-[76px] flex items-center justify-between">
        {/* Título à esquerda */}
        <div>
          <h1 className="text-3xl font-bold text-edp-marine">
            {titulo}
          </h1>
        </div>

        {/* Ícones e usuário à direita */}
        <div className="flex items-center gap-4">
          {/* Botão Painel - sempre visível */}
          <button 
            onClick={abrirPainelVisualizacao}
            className="p-2 text-white bg-edp-cobalt hover:bg-edp-cobalt-100 rounded-lg transition-edp transform hover:scale-110 active:scale-95 shadow-sm hover:shadow"
            title="Abrir Painel de Visualização"
          >
            <Monitor size={20} />
          </button>

          {/* Notificações - sempre visível */}
          <button className="relative p-2 text-edp-slate hover:text-edp-marine rounded-lg transition-edp transform hover:scale-110 active:scale-95">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-edp-marine rounded-full animate-pulse"></span>
          </button>

          {/* Configurações - sempre visível */}
          <button className="p-2 text-edp-slate hover:text-edp-marine rounded-lg transition-edp transform hover:scale-110 active:scale-95">
            <Settings size={20} />
          </button>

          {/* Divisor */}
          <div className="h-8 w-px bg-edp-marine/30"></div>

          {/* Menu do usuário */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Nome do usuário */}
            <div className="text-right">
              <p className="text-sm font-semibold text-edp-marine">
                {nomeUsuario}
              </p>
              <p className="text-xs text-edp-slate">
                Administrador
              </p>
            </div>

            {/* Avatar do usuário */}
            <div className="relative group">
              <button className="w-10 h-10 bg-edp-marine text-headline-on-marine rounded-full flex items-center justify-center hover:bg-edp-marine-100 hover:text-white transition-edp transform hover:scale-110 active:scale-95 shadow-sm hover:shadow-md">
                <User size={20} />
              </button>

              {/* Menu dropdown */}
              <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-edp-marine/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-edp transform translate-y-2 group-hover:translate-y-0 z-50">
                <button className="w-full px-4 py-3 text-left text-sm text-edp-slate hover:bg-edp-neutral-white-wash flex items-center gap-2 rounded-t-lg transition-edp-fast hover:translate-x-1">
                  <User size={16} />
                  Meu Perfil
                </button>
                <button className="w-full px-4 py-3 text-left text-sm text-edp-slate hover:bg-edp-neutral-white-wash flex items-center gap-2 transition-edp-fast hover:translate-x-1">
                  <Settings size={16} />
                  Configurações
                </button>
                <hr className="border-edp-marine border-opacity-20" />
                <button className="w-full px-4 py-3 text-left text-sm text-edp-semantic-red hover:bg-edp-semantic-light-red flex items-center gap-2 rounded-b-lg transition-edp-fast hover:translate-x-1">
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
