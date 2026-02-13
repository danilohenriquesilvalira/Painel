/**
 * Componente: CardModerno
 * 
 * Card EDP com retângulo marine blue e fundo branco
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PropsCardModerno {
  titulo: string;
  valor: string | number;
  descricao?: string;
  icone: LucideIcon;
  cor?: 'azul' | 'verde' | 'vermelho' | 'amarelo' | 'neutro';
  aoClicar?: () => void;
}

const obterCorIcone = (cor: PropsCardModerno['cor']) => {
  const cores = {
    azul: 'text-edp-marine',
    verde: 'text-edp-marine',
    vermelho: 'text-edp-semantic-red',
    amarelo: 'text-edp-semantic-yellow',
    neutro: 'text-edp-marine'
  };
  return cores[cor || 'neutro'];
};

export const CardModerno: React.FC<PropsCardModerno> = ({
  titulo,
  valor,
  descricao,
  icone: Icone,
  cor = 'neutro',
  aoClicar
}) => {
  const corIcone = obterCorIcone(cor);
  
  return (
    <div 
      className={`
        bg-white
        border border-edp-neutral-lighter
        rounded-lg
        p-4
        hover:border-edp-marine
        transition-colors
        ${aoClicar ? 'cursor-pointer' : ''}
      `}
      onClick={aoClicar}
    >
      <div className="text-sm text-edp-slate mb-1">{titulo}</div>
      <div className="text-2xl font-bold text-edp-marine font-tabular">{valor}</div>
      {descricao && (
        <p className="text-xs text-edp-slate mt-1">{descricao}</p>
      )}
    </div>
  );
};

export default CardModerno;
