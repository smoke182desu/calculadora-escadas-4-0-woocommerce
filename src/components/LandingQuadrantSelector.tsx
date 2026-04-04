import React from 'react';

interface LandingQuadrantSelectorProps {
  selectedQuadrant: number;
  onQuadrantChange: (quadrant: number) => void;
}

export const LandingQuadrantSelector: React.FC<LandingQuadrantSelectorProps> = ({ selectedQuadrant, onQuadrantChange }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Patamar</span>
      <div className="w-32 h-32 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-2">
        <svg viewBox="0 0 200 200" className="w-24 h-24">
          {[0, 1, 2, 3].map((qi) => {
            const startAngle = (qi * 90) - 90;
            const endAngle = startAngle + 90;
            const isSelected = selectedQuadrant === qi;
            
            return (
              <g key={qi} onClick={() => onQuadrantChange(qi)} className="cursor-pointer">
                <path
                    d={`M 100 100 L ${100 + 90 * Math.cos(startAngle * Math.PI / 180)} ${100 + 90 * Math.sin(startAngle * Math.PI / 180)} A 90 90 0 0 1 ${100 + 90 * Math.cos(endAngle * Math.PI / 180)} ${100 + 90 * Math.sin(endAngle * Math.PI / 180)} Z`}
                    fill={isSelected ? '#3b82f6' : '#e2e8f0'}
                    stroke="white"
                    strokeWidth="2"
                />
                <text 
                  x={100 + 50 * Math.cos((startAngle + 45) * Math.PI / 180)} 
                  y={100 + 50 * Math.sin((startAngle + 45) * Math.PI / 180) + 5}
                  fontSize="20"
                  textAnchor="middle"
                  fill={isSelected ? 'white' : '#64748b'}
                  className="pointer-events-none font-bold"
                >
                  {qi + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
