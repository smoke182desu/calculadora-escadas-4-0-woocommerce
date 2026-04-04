import React from 'react';
import { SpiralStair } from '../types';

interface SpiralPizzaVisualizerProps {
  stair: SpiralStair;
  onDirectionChange: (direction: 'clockwise' | 'counter-clockwise') => void;
  startAngleIndex: number;
  onStartAngleChange: (index: number) => void;
  landingQuadrant: number;
  onLandingQuadrantChange: (quadrant: number) => void;
  isValidConnection: boolean;
  tubeD: number;
  D: number;
}

export const SpiralPizzaVisualizer: React.FC<SpiralPizzaVisualizerProps> = ({ 
  stair, onDirectionChange, startAngleIndex, onStartAngleChange, 
  landingQuadrant, onLandingQuadrantChange, isValidConnection, tubeD, D 
}) => {
  const [clickMode, setClickMode] = React.useState<'start' | 'landing'>('landing');

  const allSteps = stair.quadrants.flatMap(q => q.steps);
  const diameter = Math.max(1100, D);
  const stepsPerTurn = Math.max(12, Math.ceil(diameter / 100 / 4) * 4); 
  const center = 100;
  const maxRadius = 90;
  
  const tubeR = isNaN((tubeD * 25.4) / D * maxRadius) ? 0 : (tubeD * 25.4) / D * maxRadius; // Scale tube radius to SVG

  const landingStartAngle = landingQuadrant * 90;
  const landingEndAngle = landingStartAngle + 90;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button 
            onClick={() => onDirectionChange('clockwise')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${stair.direction === 'clockwise' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Horário
          </button>
          <button 
            onClick={() => onDirectionChange('counter-clockwise')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${stair.direction === 'counter-clockwise' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Anti-horário
          </button>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button 
            onClick={() => setClickMode('start')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${clickMode === 'start' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Definir Início
          </button>
          <button 
            onClick={() => setClickMode('landing')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${clickMode === 'landing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Definir Patamar
          </button>
        </div>
      </div>
      <p className="text-xs text-center text-slate-500">
        Toque em uma fatia para definir {clickMode === 'start' ? 'o início da escada' : 'a posição do patamar de saída'}
      </p>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Central Tube */}
        <circle cx={center} cy={center} r={tubeR} fill="#475569" />
        
        {/* 0. Draw all possible slices (background) to allow clicking anywhere */}
        {Array.from({ length: stepsPerTurn }).map((_, index) => {
          const startAngle = index * (360 / stepsPerTurn) - 90;
          const endAngle = startAngle + (360 / stepsPerTurn);
          
          return (
            <path
              key={`bg-${index}`}
              onClick={() => {
                if (clickMode === 'start') {
                  onStartAngleChange(index);
                } else {
                  const quadrant = Math.floor(index / (stepsPerTurn / 4));
                  onLandingQuadrantChange(quadrant);
                }
              }}
              d={`M ${center + tubeR * Math.cos(startAngle * Math.PI / 180)} ${center + tubeR * Math.sin(startAngle * Math.PI / 180)} 
                  L ${center + maxRadius * Math.cos(startAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(startAngle * Math.PI / 180)}
                  A ${maxRadius} ${maxRadius} 0 0 1 ${center + maxRadius * Math.cos(endAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(endAngle * Math.PI / 180)}
                  L ${center + tubeR * Math.cos(endAngle * Math.PI / 180)} ${center + tubeR * Math.sin(endAngle * Math.PI / 180)}
                  A ${tubeR} ${tubeR} 0 0 0 ${center + tubeR * Math.cos(startAngle * Math.PI / 180)} ${center + tubeR * Math.sin(startAngle * Math.PI / 180)} Z`}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="0.5"
              className="cursor-pointer hover:fill-slate-100 transition-colors"
            />
          );
        })}

        {/* 1. Draw landing quadrant as a square */}
        <path
          d={`M ${center + tubeR * Math.cos((landingStartAngle - 90) * Math.PI / 180)} ${center + tubeR * Math.sin((landingStartAngle - 90) * Math.PI / 180)} 
              L ${center + maxRadius * Math.cos((landingStartAngle - 90) * Math.PI / 180)} ${center + maxRadius * Math.sin((landingStartAngle - 90) * Math.PI / 180)}
              L ${center + maxRadius * (Math.cos((landingStartAngle - 90) * Math.PI / 180) + Math.cos((landingEndAngle - 90) * Math.PI / 180))} ${center + maxRadius * (Math.sin((landingStartAngle - 90) * Math.PI / 180) + Math.sin((landingEndAngle - 90) * Math.PI / 180))}
              L ${center + maxRadius * Math.cos((landingEndAngle - 90) * Math.PI / 180)} ${center + maxRadius * Math.sin((landingEndAngle - 90) * Math.PI / 180)}
              L ${center + tubeR * Math.cos((landingEndAngle - 90) * Math.PI / 180)} ${center + tubeR * Math.sin((landingEndAngle - 90) * Math.PI / 180)}
              A ${tubeR} ${tubeR} 0 0 0 ${center + tubeR * Math.cos((landingStartAngle - 90) * Math.PI / 180)} ${center + tubeR * Math.sin((landingStartAngle - 90) * Math.PI / 180)} Z`}
          fill={isValidConnection ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.3)"}
          stroke={isValidConnection ? "white" : "#ef4444"}
          strokeWidth="1"
          pointerEvents="none"
        />

        {/* 2. Draw all step paths */}
        {allSteps.map((step, index) => {
          const turn = Math.floor(index / stepsPerTurn);
          const startAngle = step.angle - 90;
          
          const angleStep = 360 / stepsPerTurn;
          const endAngle = startAngle + angleStep;
          
          const innerRadius = tubeR;
          const outerRadius = maxRadius;
          
          const sweepFlagOuter = 1;
          const sweepFlagInner = 0;
          
          const isSelected = index === 0; // First step is always index 0
          
          return (
            <path
              key={`path-${index}`}
              onClick={() => {
                const sliceIndex = Math.round(((step.angle % 360) + 360) % 360 / angleStep) % stepsPerTurn;
                if (clickMode === 'start') {
                  onStartAngleChange(sliceIndex);
                } else {
                  const quadrant = Math.floor(sliceIndex / (stepsPerTurn / 4));
                  onLandingQuadrantChange(quadrant);
                }
              }}
              d={`M ${center + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(startAngle * Math.PI / 180)} 
                  L ${center + outerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + outerRadius * Math.sin(startAngle * Math.PI / 180)}
                  A ${outerRadius} ${outerRadius} 0 0 ${sweepFlagOuter} ${center + outerRadius * Math.cos(endAngle * Math.PI / 180)} ${center + outerRadius * Math.sin(endAngle * Math.PI / 180)}
                  L ${center + innerRadius * Math.cos(endAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(endAngle * Math.PI / 180)}
                  A ${innerRadius} ${innerRadius} 0 0 ${sweepFlagInner} ${center + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(startAngle * Math.PI / 180)} Z`}
              fill={isSelected ? '#3b82f6' : (turn === 0 ? '#e2e8f0' : '#cbd5e1')}
              stroke="white"
              strokeWidth="1"
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          );
        })}

        {/* 3. Draw all texts on top */}
        {allSteps.map((step, index) => {
          const turn = Math.floor(index / stepsPerTurn);
          const startAngle = step.angle - 90;
          const angleStep = 360 / stepsPerTurn;
          const midAngle = startAngle + angleStep / 2;
          
          const innerRadius = tubeR;
          const outerRadius = maxRadius;
          
          const stepNumber = index + 1;
          const isSelected = index === 0;
          
          // A step is overlapped if there is another step exactly one turn above it
          const isOverlapped = (index + stepsPerTurn < allSteps.length);
          
          // If a step is overlapped, move its text closer to the center so both numbers are visible
          const labelRadius = isOverlapped 
            ? innerRadius + (outerRadius - innerRadius) * 0.35 
            : innerRadius + (outerRadius - innerRadius) * 0.75;
          
          return (
            <text
              key={`text-${index}`}
              x={center + labelRadius * Math.cos(midAngle * Math.PI / 180)}
              y={center + labelRadius * Math.sin(midAngle * Math.PI / 180)}
              fontSize={isOverlapped ? "8" : "10"}
              fontWeight={isOverlapped ? "normal" : "bold"}
              textAnchor="middle"
              alignmentBaseline="middle"
              fill={isSelected ? 'white' : (turn === 0 ? '#475569' : '#1e293b')}
              className="select-none pointer-events-none"
            >
              {stepNumber}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
