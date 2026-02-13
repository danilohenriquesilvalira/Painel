import React from 'react';

interface LEDPreviewProps {
  message: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textShadow: boolean;
  letterSpacing: number;
}

export const LEDPreview: React.FC<LEDPreviewProps> = ({
  message,
  color,
  fontSize,
  fontFamily,
  fontWeight,
  textShadow,
  letterSpacing
}) => {
  // Calcular escala para preview (fontes gigantes não cabem)
  const maxPreviewSize = 120;
  const previewFontSize = fontSize > maxPreviewSize ? maxPreviewSize : fontSize;
  const isScaled = fontSize > maxPreviewSize;

  return (
    <div className="w-full bg-black rounded-lg p-6 border-4 border-gray-800">
      <div className="text-center">
        <p className="text-xs text-edp-semantic-yellow mb-2 font-bold uppercase">
          {isScaled ? `⚠️ PREVIEW REDUZIDO (Real: ${fontSize}px - Outdoor Gigante!)` : 'PREVIEW DO PAINEL LED'}
        </p>
        <div
          className="flex flex-col items-center justify-center min-h-[150px] overflow-hidden"
          style={{
            fontFamily: fontFamily,
            fontSize: `${previewFontSize}px`,
            fontWeight: fontWeight,
            color: color,
            letterSpacing: `${letterSpacing}px`,
            textShadow: textShadow ? `0 0 30px ${color}, 0 0 60px ${color}, 0 0 100px ${color}` : 'none',
            textTransform: 'uppercase',
            lineHeight: 1.2,
            wordWrap: 'break-word',
            maxWidth: '100%',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
          }}
        >
          {(message || 'Digite uma mensagem...').split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-400 flex justify-around flex-wrap gap-2">
          <span>🎨 {fontFamily}</span>
          <span className={fontSize > 250 ? 'text-orange-500 font-bold' : ''}>
            📏 {fontSize}px {fontSize > 250 ? '🔥' : ''}
          </span>
          <span>💪 {fontWeight}</span>
          <span>↔️ {letterSpacing}px</span>
        </div>
      </div>
    </div>
  );
};
