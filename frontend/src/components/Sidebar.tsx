import React from 'react';
import {
  Home,
  Cpu,
  Video,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { Tooltip } from "@heroui/react";
import logoEDP from '../assets/Logo_EDP.svg';

type ItemMenu = {
  id: string;
  label: string;
  icone: React.ReactNode;
  rota: string;
};

export type PropsSidebar = {
  itemAtivo?: string;
  aoClicarItem?: (id: string) => void;
  aoRecolher?: () => void;
  recolhido?: boolean;
};

const itensMenu: ItemMenu[] = [
  { id: 'visao-geral', label: 'Visão Geral', icone: <Home size={20} />, rota: '/' },
  { id: 'bits', label: 'Configurações de Bits', icone: <Cpu size={20} />, rota: '/bits' },
  { id: 'publicidade', label: 'Publicidade', icone: <Video size={20} />, rota: '/publicidade' },
];

export const Sidebar: React.FC<PropsSidebar> = ({
  itemAtivo = 'inicio',
  aoClicarItem,
  aoRecolher,
  recolhido = false
}) => {
  const handleItemClick = (id: string) => {
    if (aoClicarItem) {
      aoClicarItem(id);
    }
  };

  return (
    <>
      <aside className={`flex bg-edp-marine h-screen ${recolhido ? 'w-20' : 'w-64'} transition-[width] duration-300 ease-in-out flex-col shadow-xl flex-shrink-0 relative z-50`}>
        {/* Logo EDP com botão recolher */}
        <div className={`h-[76px] flex items-center ${recolhido ? 'justify-center' : 'justify-between'} border-b border-white/10 flex-shrink-0 px-4 backdrop-blur-sm bg-white/5`}>
          <div className={`transition-all duration-300 ${recolhido ? 'opacity-0 w-0 overflow-hidden absolute' : 'opacity-100 flex-1'}`}>
            {/* Margem de segurança EDP: altura "x" da espiral ao redor do logo */}
            <div className="p-2">
              <img
                src={logoEDP}
                alt="Logo EDP"
                className="h-10 w-auto object-contain filter drop-shadow-lg"
              />
            </div>
          </div>
          <button
            onClick={aoRecolher}
            className="text-white hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/10 active:scale-95 border border-transparent hover:border-white/20"
            title={recolhido ? 'Expandir' : 'Recolher'}
          >
            {recolhido ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 overflow-y-auto py-6 flex flex-col items-center">
          <ul className={`space-y-2 w-full ${recolhido ? 'px-2' : 'px-3'}`}>
            {itensMenu.map((item) => {
              const isAtivo = itemAtivo === item.id;

              const ButtonContent = (
                <button
                  onClick={() => handleItemClick(item.id)}
                  className={`
                    w-full
                    flex
                    items-center
                    ${recolhido ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'}
                    rounded-lg
                    transition-all
                    duration-200
                    border
                    group
                    relative
                    ${isAtivo
                      ? 'bg-white/10 border-white/20 text-white font-semibold shadow-inner backdrop-blur-md'
                      : 'border-transparent text-edp-slate hover:bg-white/5 hover:text-white hover:border-white/10 active:scale-95'
                    }
                  `}
                >
                  <span className={`flex-shrink-0 transition-transform duration-200 ${isAtivo ? 'scale-110 text-edp-electric' : 'group-hover:scale-110'}`}>
                    {item.icone}
                  </span>
                  {!recolhido && (
                    <>
                      <span className={`text-sm font-medium transition-all duration-300 whitespace-nowrap overflow-hidden flex-1 text-left`}>
                        {item.label}
                      </span>
                      {isAtivo && (
                        <div className="w-1.5 h-1.5 rounded-full bg-edp-electric shadow-[0_0_8px_rgba(40,255,82,0.6)] animate-pulse ml-2" />
                      )}
                    </>
                  )}
                </button>
              );

              return (
                <li key={item.id} className="w-full">
                  {recolhido ? (
                    <Tooltip
                      content={item.label}
                      placement="right"
                      className="bg-edp-marine-100 text-white text-xs font-medium border border-white/10 shadow-xl"
                      offset={15}
                    >
                      <div className="w-full">{ButtonContent}</div>
                    </Tooltip>
                  ) : (
                    ButtonContent
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Rodapé Moderno do Sidebar */}
        <div className={`border-t border-white/10 flex-shrink-0 transition-all duration-300 bg-black/20 overflow-hidden ${recolhido ? 'h-0 opacity-0' : 'h-auto p-4 opacity-100'}`}>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] uppercase tracking-widest text-edp-slate/60 font-bold">
              Sistema PLC
            </p>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-edp-electric animate-pulse"></span>
              <p className="text-[10px] text-white/80 font-mono">
                v1.0.0
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
