import React from 'react';
import { SpiralStair } from '../types';
import { getStepsPerTurn } from '../utils/stepsPerTurn';

interface Spiral2DVisualizerProps {
  stair: SpiralStair;
  startAngleIndex: number;
  D: number;
  landingQuadrant: number;
  isValidConnection: boolean;
  onStartAngleChange?: (index: number) => void;
  interactive?: boolean;
}

export const Spiral2DVisualizer: React.FC<Spiral2DVisualizerProps> = ({
  stair,
  startAngleIndex,
  D,
  landingQuadrant,
  isValidConnection,
  onStartAngleChange,
  interactive = false,
}) => {
  const diameter = Math.max(1100, D); // Default D if not provided
  const stepsPerTurn = getStepsPerTurn(diameter);
  const allSteps = stair.quadrants.flatMap(q => q.steps);
  
  const center = 100;
  const maxRadius = 90;
  const tubeR = 10; // Fixed inner radius for 2D visualizer
  
  const landingStartAngle = landingQuadrant * 90 - 90;
  const landingEndAngle = landingStartAngle + 90;
  
  return (
    <div className="w-full h-80 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-4">
      <svg viewBox="0 0 200 200" className="w-64 h-64">
        {/* Central Tube */}
        <circle cx={center} cy={center} r={tubeR} fill="#475569" />
        
        {/* 0. Draw all possible slices (background) to allow clicking anywhere */}
        {Array.from({ length: stepsPerTurn }).map((_, index) => {
          const startAngle = index * (360 / stepsPerTurn) - 90;
          const endAngle = startAngle + (360 / stepsPerTurn);
          
          return (
            <path
              key={`bg-${index}`}
              onClick={() => interactive && onStartAngleChange?.(index)}
              d={`M ${center + tubeR * Math.cos(startAngle * Math.PI / 180)} ${center + tubeR * Math.sin(startAngle * Math.PI / 180)} 
                  L ${center + maxRadius * Math.cos(startAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(startAngle * Math.PI / 180)}
                  A ${maxRadius} ${maxRadius} 0 0 1 ${center + maxRadius * Math.cos(endAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(endAngle * Math.PI / 180)}
                  L ${center + tubeR * Math.cos(endAngle * Math.PI / 180)} ${center + tubeR * Math.sin(endAngle * Math.PI / 180)}
                  A ${tubeR} ${tubeR} 0 0 0 ${center + tubeR * Math.cos(startAngle * Math.PI / 180)} ${center + tubeR * Math.sin(startAngle * Math.PI / 180)} Z`}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="0.5"
              className={interactive ? "cursor-pointer hover:fill-slate-100 transition-colors" : ""}
            />
          );
        })}

        {/* 1. Draw landing quadrant as a square */}
        <path
          d={`M ${center + tubeR * Math.cos(landingStartAngle * Math.PI / 180)} ${center + tubeR * Math.sin(landingStartAngle * Math.PI / 180)} 
              L ${center + maxRadius * Math.cos(landingStartAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(landingStartAngle * Math.PI / 180)}
              L ${center + maxRadius * (Math.cos(landingStartAngle * Math.PI / 180) + Math.cos(landingEndAngle * Math.PI / 180))} ${center + maxRadius * (Math.sin(landingStartAngle * Math.PI / 180) + Math.sin(landingEndAngle * Math.PI / 180))}
              L ${center + maxRadius * Math.cos(landingEndAngle * Math.PI / 180)} ${center + maxRadius * Math.sin(landingEndAngle * Math.PI / 180)}
              L ${center + tubeR * Math.cos(landingEndAngle * Math.PI / 180)} ${center + tubeR * Math.sin(landingEndAngle * Math.PI / 180)}
              A ${tubeR} ${tubeR} 0 0 0 ${center + tubeR * Math.cos(landingStartAngle * Math.PI / 180)} ${center + tubeR * Math.sin(landingStartAngle * Math.PI / 180)} Z`}
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
                if (!interactive) return;
                // Determine which slice this step corresponds to
                const sliceIndex = Math.round(((step.angle % 360) + 360) % 360 / angleStep);
                onStartAngleChange?.(sliceIndex % stepsPerTurn);
              }}
              d={`M ${center + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(startAngle * Math.PI / 180)} 
                  L ${center + outerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + outerRadius * Math.sin(startAngle * Math.PI / 180)}
                  A ${outerRadius} ${outerRadius} 0 0 ${sweepFlagOuter} ${center + outerRadius * Math.cos(endAngle * Math.PI / 180)} ${center + outerRadius * Math.sin(endAngle * Math.PI / 180)}
                  L ${center + innerRadius * Math.cos(endAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(endAngle * Math.PI / 180)}
                  A ${innerRadius} ${innerRadius} 0 0 ${sweepFlagInner} ${center + innerRadius * Math.cos(startAngle * Math.PI / 180)} ${center + innerRadius * Math.sin(startAngle * Math.PI / 180)} Z`}
              fill={isSelected ? '#3b82f6' : (turn === 0 ? '#e2e8f0' : '#cbd5e1')}
              stroke="white"
              strokeWidth="1"
              className={interactive ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
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
