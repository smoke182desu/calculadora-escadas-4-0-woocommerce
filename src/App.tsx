import React, { useState, useMemo, useCallback } from 'react';
import html2pdf from 'html2pdf.js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Edges, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Calculator, Info, Layers, ArrowUpDown, ArrowRightLeft, CheckCircle2, 
  AlertTriangle, XCircle, Printer, Minus, Plus, Box as BoxIcon, Image as ImageIcon, 
  ArrowLeft, TrendingUp, SplitSquareHorizontal, CornerUpRight, RotateCcw, Download,
  Package, Layers as LayersIcon, Eye as EyeIcon, EyeOff as EyeOffIcon
} from 'lucide-react';

const getDiamondPlateTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#444444'; // Base height
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#ffffff'; // Raised bumps
  const drawDiamond = (cx: number, cy: number, angle: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-4, -16, 8, 32, 4);
    ctx.fill();
    ctx.restore();
  };

  drawDiamond(32, 32, Math.PI / 4);
  drawDiamond(96, 96, Math.PI / 4);
  drawDiamond(32, 96, -Math.PI / 4);
  drawDiamond(96, 32, -Math.PI / 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

const globalDiamondBumpMap = getDiamondPlateTexture();

const createStringerShape = (flightP: number, flightH: number, p: number, h: number, bottomCut: 'horizontal' | 'vertical' = 'horizontal') => {
  const shape = new THREE.Shape();
  const slope = h / p;
  
  const yInterceptTop = h + 20; // 20mm above the top-left corner of the steps
  const yInterceptBot = -100;   // 100mm below the top-left corner (50mm below the bottom-right corner)

  const xTopEdgeFloor = -yInterceptTop / slope;
  const yTopEdgeWall = flightP * slope + yInterceptTop;
  const yBotEdgeWall = flightP * slope + yInterceptBot;
  const xBotEdgeFloor = -yInterceptBot / slope;

  if (bottomCut === 'horizontal') {
    // Start at bottom-left (front tip on the floor)
    shape.moveTo(xTopEdgeFloor, 0);
    // Go up the top edge to the wall
    shape.lineTo(flightP, yTopEdgeWall);
    
    if (yBotEdgeWall > 0) {
      // Go down the wall to the bottom edge
      shape.lineTo(flightP, yBotEdgeWall);
      // Go down the bottom edge to the floor
      shape.lineTo(xBotEdgeFloor, 0);
    } else {
      // Go down the wall to the floor
      shape.lineTo(flightP, 0);
    }
    
    // Go horizontally along the floor back to the start
    shape.lineTo(xTopEdgeFloor, 0);
  } else {
    // Vertical cut at x = 0
    shape.moveTo(0, yInterceptBot);
    shape.lineTo(0, yInterceptTop);
    shape.lineTo(flightP, yTopEdgeWall);
    shape.lineTo(flightP, yBotEdgeWall);
    shape.lineTo(0, yInterceptBot);
  }
  
  return shape;
};

const DiamondPlateMaterial = ({ width, depth, color = "#cbd5e1" }: { width: number, depth: number, color?: string }) => {
  const bumpMap = useMemo(() => {
    const tex = globalDiamondBumpMap?.clone();
    if (tex) {
      tex.repeat.set(width / 100, depth / 100);
      tex.needsUpdate = true;
    }
    return tex;
  }, [width, depth]);

  return (
    <meshStandardMaterial 
      color={color} 
      metalness={0.6} 
      roughness={0.5} 
      bumpMap={bumpMap} 
      bumpScale={2} 
    />
  );
};
import { generateSpiralStair } from './services/stairService';
import { SpiralStair } from './types';
import { Spiral2DVisualizer } from './components/Spiral2DVisualizer';
import { SpiralPizzaVisualizer } from './components/SpiralPizzaVisualizer';
import { LandingQuadrantSelector } from './components/LandingQuadrantSelector';

// --- Core Logic & Calculations ---

function getSpiralComfort(h: number, D: number, type?: 'height' | 'diameter') {
  // Spiral stairs have different ergonomic standards. 
  // Comfort is heavily dictated by the overall diameter (passing space) and step height.
  
  if (h < 130 || h > 240) {
    return { label: 'Impossível', hex: '#ef4444', text: 'text-red-600', bg: 'bg-red-500', icon: XCircle, desc: 'Altura do degrau perigosa ou fora da norma.' };
  }
  
  let hScore = 0; // 0: Vermelho, 1: Laranja, 2: Amarelo, 3: Verde
  if (h >= 170 && h <= 200) hScore = 3;
  else if (h >= 160 && h <= 215) hScore = 2;
  else if (h >= 140 && h <= 230) hScore = 1;
  else hScore = 0;

  let dScore = 0;
  if (D >= 1700) dScore = 3; // Verde
  else if (D >= 1500) dScore = 2; // Amarelo
  else if (D >= 1300) dScore = 1; // Laranja
  else if (D >= 1100) dScore = 1; // Laranja
  else dScore = 0; // Vermelho

  let finalScore = Math.min(hScore, dScore);
  if (type === 'height') finalScore = hScore;
  if (type === 'diameter') finalScore = dScore;

  if (finalScore === 3) {
    return { label: 'Bom', hex: '#22c55e', text: 'text-green-600', bg: 'bg-green-500', icon: CheckCircle2, desc: 'Proporção ideal e confortável para escada caracol.' };
  }
  if (finalScore === 2) {
    return { label: 'Aceitável', hex: '#eab308', text: 'text-yellow-600', bg: 'bg-yellow-400', icon: AlertTriangle, desc: 'Medidas aceitáveis, comuns em espaços reduzidos.' };
  }
  if (finalScore === 1) {
    return { label: 'Ruim', hex: '#f97316', text: 'text-orange-600', bg: 'bg-orange-500', icon: AlertTriangle, desc: 'Escada apertada ou cansativa. Use apenas se não houver espaço.' };
  }
  
  return { label: 'Impossível', hex: '#ef4444', text: 'text-red-600', bg: 'bg-red-500', icon: XCircle, desc: 'Muito fora do padrão ou extremamente apertada.' };
}

function getComfort(h: number, p: number) {
  const blondel = 2 * h + p;
  const blondelDiff = Math.abs(blondel - 640);
  
  if (h < 130 || h > 220 || p < 200 || p > 450) {
    return { label: 'Impossível', hex: '#ef4444', text: 'text-red-600', bg: 'bg-red-500', icon: XCircle, desc: 'Medidas perigosas ou fora da norma. Risco de acidentes.' };
  }
  
  if (blondelDiff <= 20 && h >= 160 && h <= 180 && p >= 280 && p <= 320) {
    return { label: 'Bom', hex: '#22c55e', text: 'text-green-600', bg: 'bg-green-500', icon: CheckCircle2, desc: 'Proporção ideal e muito confortável.' };
  }
  
  if (blondelDiff <= 45 && h >= 150 && h <= 190 && p >= 250 && p <= 350) {
    return { label: 'Ruim', hex: '#eab308', text: 'text-yellow-600', bg: 'bg-yellow-400', icon: AlertTriangle, desc: 'Aceitável, mas pode ser um pouco desconfortável.' };
  }
  
  if (blondelDiff <= 70 && h >= 140 && h <= 200 && p >= 220 && p <= 380) {
    return { label: 'Péssimo', hex: '#f97316', text: 'text-orange-600', bg: 'bg-orange-500', icon: AlertTriangle, desc: 'Escada muito cansativa e fora do padrão ergonômico.' };
  }
  
  return { label: 'Impossível', hex: '#ef4444', text: 'text-red-600', bg: 'bg-red-500', icon: XCircle, desc: 'Muito fora do padrão. Reveja as medidas totais.' };
}

function getBestConfiguration(H: number, L: number, topStepFlush: boolean = false) {
  if (H <= 0 || L <= 0) return null;
  let bestN = 2; 
  let bestScore = Infinity;
  
  const minSteps = Math.max(2, Math.floor(H / 300)); 
  const maxSteps = Math.ceil(H / 100); 
  
  for (let n = minSteps; n <= maxSteps; n++) {
    const h = H / n;
    const numTreads = topStepFlush ? n : n - 1;
    const p = L / numTreads;
    const blondel = 2 * h + p;
    
    let score = Math.abs(blondel - 640);
    
    if (h < 160) score += (160 - h) * 3;
    if (h > 180) score += (h - 180) * 3;
    if (p < 280) score += (280 - p) * 3;
    if (p > 320) score += (p - 320) * 3;
    
    if (score < bestScore) {
      bestScore = score;
      bestN = n;
    }
  }
  
  const h = H / bestN;
  const numTreads = topStepFlush ? bestN : bestN - 1;
  const p = L / numTreads;
  return { steps: bestN, treads: numTreads, h, p, comfort: getComfort(h, p), blondel: 2 * h + p, topStepFlush };
}

function getGradient(type: 'height' | 'length', fixedValue: number, topStepFlush: boolean = false) {
  const stops = [];
  const steps = 40;
  const min = type === 'height' ? 1000 : 1000;
  const max = type === 'height' ? 5000 : 8000;
  
  for (let i = 0; i <= steps; i++) {
    const val = min + (max - min) * (i / steps);
    const H = type === 'height' ? val : fixedValue;
    const L = type === 'length' ? val : fixedValue;
    const config = getBestConfiguration(H, L, topStepFlush);
    stops.push(`${config ? config.comfort.hex : '#cbd5e1'} ${i * (100/steps)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function getSpiralGradient(type: 'height' | 'diameter', fixedValue: number, topStepFlush: boolean = false) {
  const stops = [];
  const steps = 40;
  const min = type === 'height' ? 1000 : 1100;
  const max = type === 'height' ? 5000 : 3000;
  
  for (let i = 0; i <= steps; i++) {
    const val = min + (max - min) * (i / steps);
    const H = type === 'height' ? val : fixedValue;
    const D = type === 'diameter' ? val : fixedValue;
    
    const diameter = Math.max(1100, D);
    const stepsPerTurn = Math.max(12, Math.ceil(diameter / 100 / 4) * 4);
    const idealStepHeight = 180;
    const totalSteps = Math.round(H / idealStepHeight);
    const h = H / totalSteps;
    
    const R = diameter / 2;
    const tubeD = 4; // Default to 4 inches for gradient calculation
    const tubeR = (tubeD * 25.4) / 2;
    const lineOfTravelR = tubeR + (R - tubeR) * 0.6;
    const circumference = 2 * Math.PI * lineOfTravelR;
    const p = circumference / stepsPerTurn;
    
    let comfort = getSpiralComfort(h, D, type);
    const hasHeadClearance = totalSteps <= stepsPerTurn || (h * stepsPerTurn) >= 2000;
    if (!hasHeadClearance) {
      comfort = { label: 'Impossível', hex: '#ef4444', text: 'text-red-600', bg: 'bg-red-500', icon: XCircle, desc: 'Sem altura livre (bate a cabeça).' };
    }
    
    stops.push(`${comfort.hex} ${i * (100/steps)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

const ColorLegend = () => (
  <div className="flex flex-wrap gap-4 justify-center mt-4 mb-6 text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div> Ideal</div>
    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Aceitável</div>
    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500"></div> Desconfortável</div>
    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> Fora de Norma</div>
  </div>
);

// --- Shared UI Components ---

const ThermometerSlider = ({ label, value, min, max, step = 10, onChange, gradient, unit, tooltip }: any) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="mb-8">
      <div className="flex justify-between items-end mb-2">
        <label className="font-semibold text-slate-700 flex items-center gap-2">
          {label}
          {tooltip && (
            <div className="group relative cursor-help flex items-center">
              <Info size={18} className="text-blue-500 hover:text-blue-700 transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 text-center leading-relaxed">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          )}
        </label>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          <button onClick={() => onChange(Math.max(min, value - step))} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
            <Minus size={14} />
          </button>
          <input 
            type="number" 
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 text-center text-lg font-bold text-slate-900 bg-transparent border-none focus:ring-0 outline-none p-0"
          />
          <button onClick={() => onChange(Math.min(max, value + step))} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
            <Plus size={14} />
          </button>
          <span className="text-sm font-medium text-slate-500 pr-2 pl-1">{unit}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onChange(Math.max(min, value - step))} 
          className="p-2 bg-white text-slate-600 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors flex-shrink-0"
        >
          <Minus size={18}/>
        </button>
        
        <div className="relative flex-1 h-10 rounded-full shadow-inner border-4 border-white ring-1 ring-slate-200" style={{ background: gradient }}>
          <div className="absolute inset-0 flex justify-between px-4 items-center pointer-events-none opacity-40">
            {[...Array(21)].map((_, i) => (
              <div key={i} className={`w-0.5 bg-slate-900 ${i % 5 === 0 ? 'h-4' : 'h-2'}`}></div>
            ))}
          </div>
          <input 
            type="range" min={min} max={max} step={step} value={value} 
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-7 h-12 bg-white border-2 border-slate-300 rounded-md shadow-lg pointer-events-none z-10 flex flex-col items-center justify-center transition-transform"
            style={{ left: `calc(${percentage}% - 14px)` }}
          >
            <div className="w-1 h-6 bg-slate-400 rounded-full"></div>
          </div>
        </div>

        <button 
          onClick={() => onChange(Math.min(max, value + step))} 
          className="p-2 bg-white text-slate-600 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors flex-shrink-0"
        >
          <Plus size={18}/>
        </button>
      </div>
      
      <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium px-10">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
};

function ResultCard({ title, value, unit, icon, color }: { title: string, value: string, unit: string, icon: React.ReactNode, color: 'indigo' | 'emerald' | 'blue' | 'violet' }) {
  const bgColors = {
    indigo: 'bg-indigo-50 border-indigo-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    blue: 'bg-blue-50 border-blue-100',
    violet: 'bg-violet-50 border-violet-100',
  };

  return (
    <div className={`p-4 rounded-xl border ${bgColors[color]} flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-white rounded-md shadow-sm">{icon}</div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</p>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-black text-slate-900">{value}</span>
        <span className="text-sm font-bold text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

// --- Visualizers (Perfect Framing with viewBox) ---

const getBounds = (points: {x: number, y: number}[]) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  return { minX, maxX, minY, maxY };
};

const SvgContainer = ({ children, bounds, padding = 0.15 }: any) => {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padX = Math.max(width * padding, 40);
  const padY = Math.max(height * padding, 40);
  const viewBox = `${bounds.minX - padX} ${bounds.minY - padY} ${width + padX*2} ${height + padY*2}`;
  
  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 flex justify-center items-center relative overflow-hidden h-80">
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5 }}></div>
      <svg viewBox={viewBox} className="w-full h-full drop-shadow-sm relative z-10">
        {children}
      </svg>
    </div>
  );
};

const StepVisualizer = ({ h, p }: { h: number, p: number }) => {
  const bounds = { minX: -p, maxX: p * 2, minY: -h, maxY: h };
  return (
    <SvgContainer bounds={bounds} padding={0.3}>
      <path 
        d={`M ${-p} ${h} L ${-p} 0 L 0 0 L 0 ${-h} L ${p} ${-h} L ${p} ${-h*2} L ${p*2} ${-h*2} L ${p*2} ${h} Z`} 
        fill="#ffffff" stroke="#94a3b8" strokeWidth="1"
      />
      <path 
        d={`M ${-p} 0 L 0 0 L 0 ${-h} L ${p} ${-h} L ${p} ${-h*2} L ${p*2} ${-h*2}`} 
        fill="none" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round" 
      />
      
      {/* Riser (Espelho) */}
      <g stroke="#ef4444" fill="#ef4444">
        <line x1={-50} y1={-h} x2={-50} y2={0} strokeWidth="2" />
        <polygon points={`${-50},${-h} ${-54},${-h+6} ${-46},${-h+6}`} />
        <polygon points={`${-50},0 ${-54},${-6} ${-46},${-6}`} />
        <line x1={-60} y1={-h} x2={-40} y2={-h} strokeWidth="2" />
        <line x1={-60} y1={0} x2={-40} y2={0} strokeWidth="2" />
        <text x={-70} y={-h/2} textAnchor="end" alignmentBaseline="middle" className="font-bold" style={{ fill: '#ef4444', fontSize: '40px' }}>
          {h.toFixed(1)} mm
        </text>
      </g>
      
      {/* Tread (Pisada) */}
      <g stroke="#3b82f6" fill="#3b82f6">
        <line x1={0} y1={-h-50} x2={p} y2={-h-50} strokeWidth="2" />
        <polygon points={`${0},${-h-50} ${6},${-h-54} ${6},${-h-46}`} />
        <polygon points={`${p},${-h-50} ${p-6},${-h-54} ${p-6},${-h-46}`} />
        <line x1={0} y1={-h-60} x2={0} y2={-h-40} strokeWidth="2" />
        <line x1={p} y1={-h-60} x2={p} y2={-h-40} strokeWidth="2" />
        <text x={p/2} y={-h-70} textAnchor="middle" className="font-bold" style={{ fill: '#3b82f6', fontSize: '40px' }}>
          {p.toFixed(1)} mm
        </text>
      </g>
    </SvgContainer>
  );
};

const StraightVisualizer = ({ H, L, h, p, steps, topStepFlush }: any) => {
  const pts = [{x: 0, y: 0}];
  let cx = 0, cy = 0;
  for (let i = 0; i < steps; i++) {
    cy -= h; pts.push({x: cx, y: cy});
    if (i < steps - 1 || topStepFlush) { cx += p; pts.push({x: cx, y: cy}); }
  }
  const lastX = cx;
  const lastY = cy;
  pts.push({x: lastX, y: 0});
  
  const bounds = getBounds(pts);
  const pathD = `M 0 0 ` + pts.map(pt => `L ${pt.x} ${pt.y}`).join(' ') + ` L ${lastX} 0 Z`;
  const stairLine = `M 0 0 ` + pts.slice(1, -1).map(pt => `L ${pt.x} ${pt.y}`).join(' ');

  return (
    <SvgContainer bounds={bounds}>
      <path d={pathD} fill="#cbd5e1" opacity="0.3" />
      <path d={stairLine} fill="none" stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
      <line x1={-30} y1={0} x2={0} y2={0} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      <line x1={lastX} y1={lastY} x2={lastX + 30} y2={lastY} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      
      {/* Dimensions */}
      <g stroke="#ef4444" fill="#ef4444">
        <line x1={-150} y1={0} x2={-150} y2={lastY} strokeWidth="6" strokeDasharray="12" />
        <line x1={-180} y1={0} x2={-120} y2={0} strokeWidth="6" />
        <line x1={-180} y1={lastY} x2={-120} y2={lastY} strokeWidth="6" />
        <text x={-200} y={lastY/2} textAnchor="end" alignmentBaseline="middle" className="font-bold" style={{ fill: '#ef4444', fontSize: Math.max(120, H * 0.06) }}>
          {H.toFixed(0)} mm
        </text>
      </g>
      <g stroke="#3b82f6" fill="#3b82f6">
        <line x1={0} y1={150} x2={lastX} y2={150} strokeWidth="6" strokeDasharray="12" />
        <line x1={0} y1={120} x2={0} y2={180} strokeWidth="6" />
        <line x1={lastX} y1={120} x2={lastX} y2={180} strokeWidth="6" />
        <text x={lastX/2} y={240} textAnchor="middle" className="font-bold" style={{ fill: '#3b82f6', fontSize: Math.max(120, H * 0.06) }}>
          {L.toFixed(0)} mm
        </text>
      </g>
    </SvgContainer>
  );
};

const LandingVisualizer = ({ H, L, landingL, h, p, steps, landingStepPos, topStepFlush }: any) => {
  const pts = [{x: 0, y: 0}];
  let cx = 0, cy = 0;
  const steps1 = landingStepPos || Math.floor(steps / 2);
  
  for (let i = 0; i < steps; i++) {
    cy -= h; pts.push({x: cx, y: cy});
    if (i === steps1 - 1) {
      cx += landingL; pts.push({x: cx, y: cy});
    } else if (i < steps - 1 || topStepFlush) { 
      cx += p; pts.push({x: cx, y: cy}); 
    }
  }
  const lastX = cx;
  const lastY = cy;
  pts.push({x: lastX, y: 0});
  
  const bounds = getBounds(pts);
  const pathD = `M 0 0 ` + pts.map(pt => `L ${pt.x} ${pt.y}`).join(' ') + ` L ${lastX} 0 Z`;
  const stairLine = `M 0 0 ` + pts.slice(1, -1).map(pt => `L ${pt.x} ${pt.y}`).join(' ');

  return (
    <SvgContainer bounds={bounds}>
      <path d={pathD} fill="#cbd5e1" opacity="0.3" />
      <path d={stairLine} fill="none" stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
      <line x1={-30} y1={0} x2={0} y2={0} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      <line x1={lastX} y1={lastY} x2={lastX + 30} y2={lastY} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      
      {/* Landing Dimension */}
      <g stroke="#f59e0b" fill="#f59e0b">
        <line x1={p * (steps1 - 1)} y1={-(h * steps1) - 150} x2={p * (steps1 - 1) + landingL} y2={-(h * steps1) - 150} strokeWidth="6" strokeDasharray="12" />
        <line x1={p * (steps1 - 1)} y1={-(h * steps1) - 120} x2={p * (steps1 - 1)} y2={-(h * steps1) - 180} strokeWidth="6" />
        <line x1={p * (steps1 - 1) + landingL} y1={-(h * steps1) - 120} x2={p * (steps1 - 1) + landingL} y2={-(h * steps1) - 180} strokeWidth="6" />
        <text x={p * (steps1 - 1) + landingL/2} y={-(h * steps1) - 220} textAnchor="middle" className="font-bold" style={{ fill: '#f59e0b', fontSize: Math.max(120, H * 0.06) }}>
          Patamar: {landingL.toFixed(0)} mm
        </text>
      </g>
    </SvgContainer>
  );
};

const LShapeVisualizer = ({ L1, L2, W, p, steps, topStepFlush }: any) => {
  const treads = topStepFlush ? steps : steps - 1;
  const steps1 = Math.max(0, Math.min(treads - 1, Math.round(L1 / p)));
  const steps2 = treads - 1 - steps1;
  const pts = [
    {x: 0, y: 0},
    {x: W, y: 0},
    {x: W, y: -(L1 + W)},
    {x: W + L2, y: -(L1 + W)},
    {x: W + L2, y: -L1},
    {x: 0, y: -L1}
  ];
  const bounds = getBounds(pts);

  return (
    <SvgContainer bounds={bounds} padding={0.2}>
      {/* Flight 1 */}
      <rect x={0} y={-L1} width={W} height={L1} fill="#e2e8f0" stroke="#94a3b8" />
      {[...Array(steps1)].map((_, i) => (
        <line key={`f1-${i}`} x1={0} y1={-i*p} x2={W} y2={-i*p} stroke="#94a3b8" strokeWidth="1" />
      ))}
      
      {/* Landing */}
      <rect x={0} y={-(L1 + W)} width={W} height={W} fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
      
      {/* Flight 2 */}
      <rect x={W} y={-(L1 + W)} width={L2} height={W} fill="#e2e8f0" stroke="#94a3b8" />
      {[...Array(steps2)].map((_, i) => (
        <line key={`f2-${i}`} x1={W + i*p} y1={-(L1 + W)} x2={W + i*p} y2={-L1} stroke="#94a3b8" strokeWidth="1" />
      ))}
      
      {/* Path Line */}
      <path d={`M ${W/2} 0 L ${W/2} ${-(L1 + W/2)} L ${W + L2} ${-(L1 + W/2)}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4" />
      <circle cx={W/2} cy={0} r={4} fill="#ef4444" />
      <polygon points={`${W + L2},${-(L1 + W/2)} ${W + L2 - 8},${-(L1 + W/2) - 4} ${W + L2 - 8},${-(L1 + W/2) + 4}`} fill="#ef4444" />
    </SvgContainer>
  );
};

const SpiralVisualizer = ({ D, steps }: any) => {
  const R = D / 2;
  const innerR = 100; // Pole radius
  const pts = [{x: -R, y: -R}, {x: R, y: R}];
  const bounds = getBounds(pts);

  return (
    <SvgContainer bounds={bounds} padding={0.2}>
      <circle cx={0} cy={0} r={R} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
      <circle cx={0} cy={0} r={innerR} fill="#64748b" stroke="#334155" strokeWidth="2" />
      
      {[...Array(steps)].map((_, i) => {
        const angle = (i * 360 / steps) * (Math.PI / 180);
        const x1 = Math.cos(angle) * innerR;
        const y1 = Math.sin(angle) * innerR;
        const x2 = Math.cos(angle) * R;
        const y2 = Math.sin(angle) * R;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" />;
      })}
      
      {/* Path Line */}
      <circle cx={0} cy={0} r={R * 0.6} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4" />
    </SvgContainer>
  );
};

const HandrailTube = ({ points, radius = 15, color = "#94a3b8" }: { points: THREE.Vector3[], radius?: number, color?: string }) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0), [points]);
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, radius, 8, false]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* End caps (Colete Belser style) */}
      <mesh position={startPoint}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={endPoint}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

const Stair3DVisualizer = ({ steps, h, p, w, topStepFlush, exploded, showHandrail = true, showGuardrail = true }: { steps: number, h: number, p: number, w: number, topStepFlush?: boolean, exploded?: boolean, showHandrail?: boolean, showGuardrail?: boolean }) => {
  const numTreads = topStepFlush ? steps : steps - 1;
  const totalP = numTreads * p;
  const totalH = steps * h;
  
  const ex = exploded ? 1 : 0;
  
  // Center the stairs
  const cx = totalP / 2;
  const cy = totalH / 2;
  const cz = w / 2;

  // Scale down to fit in view
  const maxDim = Math.max(totalP + p * 3, totalH + h * 2, w);
  const scale = 10 / maxDim;

  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center relative overflow-hidden h-80 cursor-move">
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-xs font-medium text-slate-500 pointer-events-none shadow-sm print:hidden">
        Arraste para girar
      </div>
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 6, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        
        <group scale={[scale, scale, scale]} position={[-cx * scale, -cy * scale, -cz * scale]}>
          {/* Lower Floor Representation */}
          <Box args={[p * 5, h * 2, w]} position={[-p * 2.5, -h, w/2]}>
            <meshStandardMaterial color="#475569" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#1e293b" />
          </Box>

          {/* Steps */}
          {Array.from({ length: steps }).map((_, i) => {
            if (!topStepFlush && i === steps - 1) return null; // Skip last step if not flush
            
            const stepThickness = 50;
            const stepP = p;
            const stepW = w;
            
            const x = i * p + p / 2;
            const y = (i + 1) * h - stepThickness / 2;
            const z = w / 2;
            
            return (
              <Box key={i} args={[stepP, stepThickness, stepW]} position={[x, y + ex * 200, z]}>
                <DiamondPlateMaterial width={stepP} depth={stepW} />
                <Edges scale={1} threshold={15} color="#94a3b8" />
              </Box>
            );
          })}

          {/* Stringers (Longarinas) */}
          {(() => {
            const stringerThickness = 50;
            const shape = createStringerShape(totalP, totalH, p, h);
            const extrudeSettings = { depth: stringerThickness, bevelEnabled: false };
            
            return (
              <>
                {/* Left Stringer */}
                <mesh position={[0, 0, -ex * 300]}>
                  <extrudeGeometry args={[shape, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
                {/* Right Stringer */}
                <mesh position={[0, 0, w - stringerThickness + ex * 300]}>
                  <extrudeGeometry args={[shape, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
              </>
            );
          })()}

          {/* Handrails and Balusters */}
          {(() => {
            const handrailHeight = 900;
            const postSize = 40;
            const tubeRadius = 15;
            
            const leftPoints: THREE.Vector3[] = [];
            const rightPoints: THREE.Vector3[] = [];

            for (let i = 0; i < steps; i++) {
              if (!topStepFlush && i === steps - 1) break;
              [1/6, 1/2, 5/6].forEach((fraction) => {
                const x = i * p + p * fraction;
                const y = (i + 1) * h + handrailHeight;
                leftPoints.push(new THREE.Vector3(x, y, postSize/2));
                rightPoints.push(new THREE.Vector3(x, y, w - postSize/2));
              });
            }

            return (
              <>
                {/* Left Handrail Group */}
                <group position={[0, ex * 200, -ex * 300]}>
                  {showHandrail && (
                    <>
                      {Array.from({ length: steps }).flatMap((_, i) => {
                        if (!topStepFlush && i === steps - 1) return [];
                        return [1/6, 1/2, 5/6].map((fraction, j) => {
                          const x = i * p + p * fraction;
                          const stepTopY = (i + 1) * h;
                          const balusterHeight = handrailHeight;
                          return (
                            <Box key={`lbal-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, postSize/2]}>
                              <meshStandardMaterial color="#334155" />
                              <Edges scale={1} threshold={15} color="#1e293b" />
                            </Box>
                          );
                        });
                      })}
                      <HandrailTube points={leftPoints} radius={tubeRadius} color="#334155" />
                    </>
                  )}
                </group>

                {/* Right Handrail Group */}
                <group position={[0, ex * 200, ex * 300]}>
                  {showHandrail && (
                    <>
                      {Array.from({ length: steps }).flatMap((_, i) => {
                        if (!topStepFlush && i === steps - 1) return [];
                        return [1/6, 1/2, 5/6].map((fraction, j) => {
                          const x = i * p + p * fraction;
                          const stepTopY = (i + 1) * h;
                          const balusterHeight = handrailHeight;
                          return (
                            <Box key={`rbal-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, w - postSize/2]}>
                              <meshStandardMaterial color="#334155" />
                              <Edges scale={1} threshold={15} color="#1e293b" />
                            </Box>
                          );
                        });
                      })}
                      <HandrailTube points={rightPoints} radius={tubeRadius} color="#334155" />
                    </>
                  )}
                </group>

                {/* Top Guardrail (if not flush) */}
                {showGuardrail && !topStepFlush && (
                  <group position={[totalP, totalH + ex * 200, 0]}>
                    {/* Balusters at the top floor edge */}
                    {Array.from({ length: 3 }).map((_, i) => {
                      const z = postSize/2 + (i / 2) * (w - postSize);
                      return (
                        <Box key={`top-guard-${i}`} args={[16, handrailHeight, 16]} position={[0, handrailHeight/2, z]}>
                          <meshStandardMaterial color="#334155" />
                          <Edges scale={1} threshold={15} color="#1e293b" />
                        </Box>
                      );
                    })}
                    {/* Top rail */}
                    <mesh position={[0, handrailHeight, w/2]} rotation={[Math.PI/2, 0, 0]}>
                      <cylinderGeometry args={[tubeRadius, tubeRadius, w, 16]} />
                      <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
                    </mesh>
                  </group>
                )}
              </>
            );
          })()}

          {/* Upper Floor Representation */}
          <Box args={[p * 3, h * 2, w]} position={[totalP + p * 1.5, totalH - h, w/2]}>
            <meshStandardMaterial color="#b45309" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#78350f" />
          </Box>

          {/* Dimensions */}
          <group position={[totalP + 100, totalH / 2, w + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[20, totalH, 20]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            <Billboard>
              <Text position={[200, 0, 0]} fontSize={200} color="#ef4444" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                H: {Math.round(totalH)}mm
              </Text>
            </Billboard>
          </group>

          <group position={[totalP / 2, -h - 100, w + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[totalP, 20, 20]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
            <Billboard>
              <Text position={[0, -200, 0]} fontSize={200} color="#3b82f6" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                L: {Math.round(totalP)}mm
              </Text>
            </Billboard>
          </group>
        </group>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  );
};

// --- Calculators ---

const TopStepToggle = ({ value, onChange }: { value: boolean, onChange: (val: boolean) => void }) => (
  <div className="mb-8">
    <label className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
      Chegada da Escada no Piso Superior
      <div className="group relative cursor-help flex items-center">
        <Info size={18} className="text-blue-500 hover:text-blue-700 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 text-center leading-relaxed">
          Define se o último degrau fica um nível abaixo do piso superior (Padrão) ou se o último degrau fica no mesmo nível do piso (Nivelado).
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      </div>
    </label>
    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
      <button 
        onClick={() => onChange(false)}
        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${!value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        Abaixo do piso (Padrão)
      </button>
      <button 
        onClick={() => onChange(true)}
        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        Nivelado com o piso
      </button>
    </div>
    <p className="text-xs text-slate-500 mt-2 px-1">
      {!value 
        ? "O último degrau fica um espelho abaixo do piso superior. O piso superior atua como a última pisada." 
        : "O último degrau fica exatamente no mesmo nível do piso superior, estendendo o piso."}
    </p>
  </div>
);

const CalculatorLayout = ({ title, onBack, config, inputs, visualizer, headerActions, details, extraSection, materialsSection, salesKit }: any) => {
  const handleSavePDF = () => {
    const element = document.getElementById('calculator-content');
    const opt = {
      margin: 10,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
  <div id="calculator-content" className="max-w-6xl mx-auto space-y-6">
    <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-4 print:shadow-none print:border-none print:p-0 print:mb-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors print:hidden">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-slate-500 text-sm print:hidden">Ajuste as medidas para calcular o conforto.</p>
          <p className="hidden print:block text-slate-500 text-sm mt-1">
            Relatório gerado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">
          <Printer size={18} />
          <span className="hidden sm:inline">Imprimir</span>
        </button>
        <button onClick={handleSavePDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Download size={18} />
          <span className="hidden sm:inline">Salvar PDF</span>
        </button>
      </div>
    </header>

    <div className="grid lg:grid-cols-12 gap-6 print:block">
      <div className="lg:col-span-6 space-y-6 print:mb-6">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
          <div>
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2 border-b pb-4">Medidas do Vão</h2>
            {inputs}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 print:mt-6 print:pt-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Detalhe do Degrau</h3>
            {details || <StepVisualizer h={config.h} p={config.p} />}
          </div>
        </div>
        {extraSection && (
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
            {extraSection}
          </div>
        )}
        {materialsSection && (
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
            {materialsSection}
          </div>
        )}
      </div>

      <div className="lg:col-span-6 space-y-6 print:w-full">
        <div className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-colors duration-500 ${config.comfort.bg} bg-opacity-5 border-opacity-30`} style={{ borderColor: config.comfort.hex }}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full text-white shadow-sm flex-shrink-0`} style={{ backgroundColor: config.comfort.hex }}>
              <config.comfort.icon size={32} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Nível de Conforto</h3>
              <div className={`text-3xl font-black tracking-tight mb-2`} style={{ color: config.comfort.hex }}>{config.comfort.label}</div>
              <p className="text-slate-700 font-medium leading-relaxed">{config.comfort.desc}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-4">Resultado</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <ResultCard title="Espelhos / Pisadas" value={`${config.steps} / ${config.treads}`} unit="un" icon={<Layers className="text-indigo-500" size={20} />} color="indigo" />
            <ResultCard title="Fórmula Blondel" value={config.blondel.toFixed(1)} unit="mm" icon={<Calculator className="text-violet-500" size={20} />} color="violet" />
            <ResultCard title="Altura (Espelho)" value={config.h.toFixed(1)} unit="mm" icon={<ArrowUpDown className="text-emerald-500" size={20} />} color="emerald" />
            <ResultCard title="Compr. (Pisada)" value={config.p.toFixed(1)} unit="mm" icon={<ArrowRightLeft className="text-blue-500" size={20} />} color="blue" />
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Visualização Geral</h3>
              {headerActions}
            </div>
            {visualizer}
          </div>
        </div>
      </div>
    </div>

    {salesKit}
  </div>
  );
};

// ============================================================
// CONFIGURAÇÃO DE PREÇO E INTEGRAÇÃO CDS INDÚSTRIA
// ============================================================
const PRECO_POR_KG = 70.00;
const SITE_URL = 'https://www.cdsind.com.br';
const WOOCOMMERCE_CART_URL = `${SITE_URL}/carrinho/`;

// Densidades dos materiais (uso interno — não exibir ao cliente)
const PESO_CHAPA11 = 25.0;   // kg/m² — chapa 11 antiderrapante (3,048 mm)
const PESO_CHAPA316 = 37.4;  // kg/m² — chapa 3/16" (4,762 mm)
const PESO_CORRIMAO = 1.0;   // kg/m  — tubo 1¼" chapa 18
const MARGEM_MONTAGEM = 1.15; // +15% conexões, solda, fixações

function calcWeightStraight(H: number, L: number, W: number, treads: number, ph: number, pp: number): number {
  if (ph <= 0 || pp <= 0) return 0;
  const flightLen = Math.sqrt(H * H + L * L) / 1000;
  const theta = Math.atan2(ph, pp);
  const profileH = (ph + 120) * Math.cos(theta);
  const stepArea = treads * (pp / 1000) * (W / 1000);
  const stepWeight = stepArea * PESO_CHAPA11;
  const stringerArea = 2 * flightLen * (profileH / 1000) * 0.75;
  const stringerWeight = stringerArea * PESO_CHAPA316;
  const handrailWeight = 2 * flightLen * PESO_CORRIMAO;
  return (stepWeight + stringerWeight + handrailWeight) * MARGEM_MONTAGEM;
}

function calcWeightLanding(H: number, L: number, W: number, landingLength: number, treads: number, ph: number, pp: number): number {
  const base = calcWeightStraight(H, L, W, treads, ph, pp);
  const landingPlateWeight = (landingLength / 1000) * (W / 1000) * PESO_CHAPA11;
  return base + landingPlateWeight * MARGEM_MONTAGEM;
}

function calcWeightLShape(H: number, L1: number, L2: number, W: number, treads: number, ph: number, pp: number): number {
  if (ph <= 0 || pp <= 0) return 0;
  const f1Len = Math.sqrt((H / 2) * (H / 2) + L1 * L1) / 1000;
  const f2Len = Math.sqrt((H / 2) * (H / 2) + L2 * L2) / 1000;
  const theta = Math.atan2(ph, pp);
  const profileH = (ph + 120) * Math.cos(theta);
  const stepArea = treads * (pp / 1000) * (W / 1000);
  const stepWeight = stepArea * PESO_CHAPA11;
  const landingPlateWeight = (W / 1000) * (W / 1000) * PESO_CHAPA11;
  const stringerArea = 2 * (f1Len + f2Len) * (profileH / 1000) * 0.75;
  const stringerWeight = stringerArea * PESO_CHAPA316;
  const handrailWeight = 2 * (f1Len + f2Len) * PESO_CORRIMAO;
  return (stepWeight + landingPlateWeight + stringerWeight + handrailWeight) * MARGEM_MONTAGEM;
}

function calcWeightSpiral(H: number, D: number, nSteps: number, tubeD_in: number): number {
  const R = D / 2;
  const tubeR = (tubeD_in * 25.4) / 2;
  const stepsPerTurn = Math.max(12, Math.ceil(D / 100 / 4) * 4);
  const stepAreaPerStep = Math.PI * (R * R - tubeR * tubeR) / stepsPerTurn / 1_000_000;
  const stepWeight = nSteps * stepAreaPerStep * PESO_CHAPA11;
  const centralColWeight = (H / 1000 + 0.5) * 4.5;
  const lineOfTravelR = tubeR + (R - tubeR) * 0.7;
  const turns = nSteps / stepsPerTurn;
  const handrailWeight = 2 * Math.PI * lineOfTravelR / 1000 * turns * PESO_CORRIMAO;
  const supportWeight = nSteps * (R - tubeR) / 1000 * 1.5;
  return (stepWeight + centralColWeight + handrailWeight + supportWeight) * MARGEM_MONTAGEM;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ============================================================
// WIZARD — TIPOS E CONSTANTES
// ============================================================
interface LeadData { nome: string; email: string; telefone: string; }
type StairType = 'straight' | 'landing' | 'lshape' | 'spiral';

const WIZARD_LABELS = ['Modelo', 'Medidas', 'Seus Dados', 'Orçamento'];

// ============================================================
// BARRA DE PROGRESSO DO WIZARD
// ============================================================
const WizardProgressBar = ({ step }: { step: number }) => (
  <div className="bg-white border-b border-slate-100 px-4 py-3 print:hidden sticky top-0 z-40 shadow-sm">
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-1 sm:gap-2">
        {WIZARD_LABELS.map((label, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isDone = n < step;
          return (
            <React.Fragment key={n}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone ? 'bg-blue-600 text-white' :
                  isActive ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? '✓' : n}
                </div>
                <span className={`text-xs sm:text-sm font-medium hidden sm:block ${isActive ? 'text-blue-700' : isDone ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < WIZARD_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i + 1 < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  </div>
);

// Botão "Próximo Passo" usado como salesKit nos calcs
const WizardNextButton = ({ onNext }: { onNext: () => void }) => (
  <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
    <div className="text-center sm:text-left">
      <p className="text-white/80 text-sm">Medidas configuradas?</p>
      <p className="text-white font-bold text-lg">Prosseguir e solicitar orçamento</p>
    </div>
    <button
      onClick={onNext}
      className="px-8 py-3 bg-white text-blue-700 font-bold rounded-xl shadow-md hover:bg-blue-50 transition-all hover:shadow-xl active:scale-95 whitespace-nowrap"
    >
      Próximo Passo →
    </button>
  </div>
);

// ============================================================
// PASSO 3 — DADOS DO CLIENTE
// ============================================================
const StepDados = ({ onBack, onSubmit, isSubmitting }: {
  onBack: () => void;
  onSubmit: (data: LeadData) => void;
  isSubmitting: boolean;
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fmtPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = 'Nome é obrigatório';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido';
    if (telefone.replace(/\D/g, '').length < 10) e.telefone = 'Telefone inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ nome: nome.trim(), email: email.trim(), telefone });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm font-medium">
          <ArrowLeft size={16} /> Voltar e ajustar as medidas
        </button>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-3">
              <Calculator className="text-white w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-white">Quase lá!</h2>
            <p className="text-blue-100 mt-1 text-sm">Preencha seus dados para receber o orçamento da sua escada.</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome completo *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-colors focus:outline-none focus:border-blue-500 ${errors.nome ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                />
                {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-colors focus:outline-none focus:border-blue-500 ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(fmtPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm transition-colors focus:outline-none focus:border-blue-500 ${errors.telefone ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                />
                {errors.telefone && <p className="text-red-500 text-xs mt-1">{errors.telefone}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 hover:shadow-lg disabled:opacity-60 text-base mt-2"
              >
                {isSubmitting ? 'Calculando orçamento...' : 'Ver Meu Orçamento →'}
              </button>
            </form>
            <p className="text-xs text-slate-400 text-center mt-4">🔒 Seus dados estão seguros e não serão compartilhados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PASSO 4 — ORÇAMENTO + CARRINHO
// ============================================================
const StepOrcamento = ({ stairType, price, leadData, savedDims, savedConfig, onBack, onRestart }: {
  stairType: StairType;
  price: number;
  leadData: LeadData;
  savedDims: any;
  savedConfig: any;
  onBack: () => void;
  onRestart: () => void;
}) => {
  const typeLabel: Record<StairType, string> = {
    straight: 'Escada Reta',
    landing: 'Escada com Patamar',
    lshape: 'Escada em L',
    spiral: 'Escada Caracol',
  };

  const modelo = typeLabel[stairType] || 'Escada Personalizada';
  const desc = stairType === 'spiral'
    ? `Caracol · H${savedDims.H}mm · Ø${savedDims.D}mm · ${savedConfig?.steps || ''}°`
    : `${modelo} · H${savedDims.H}mm · L${savedDims.L || (savedDims.L1 ? `${savedDims.L1}+${savedDims.L2}` : 0)}mm · W${savedDims.W}mm`;

  const handleAddToCart = () => {
    const params = new URLSearchParams({
      cds_escada: '1',
      modelo,
      valor: price.toFixed(2),
      desc,
      nome: leadData.nome,
      email: leadData.email,
      tel: leadData.telefone,
    });
    const url = `${WOOCOMMERCE_CART_URL}?${params.toString()}`;
    if (window.top) window.top.location.href = url;
    else window.location.href = url;
  };

  const specs = [
    { label: 'Altura total', value: `${savedDims.H} mm` },
    savedDims.L > 0 && { label: 'Comprimento', value: `${savedDims.L} mm` },
    savedDims.L1 > 0 && { label: 'Lance 1 / Lance 2', value: `${savedDims.L1} mm / ${savedDims.L2} mm` },
    savedDims.D > 0 && { label: 'Diâmetro', value: `${savedDims.D} mm` },
    savedDims.W > 0 && { label: 'Largura', value: `${savedDims.W} mm` },
    savedConfig?.steps > 0 && { label: 'Nº de degraus', value: `${savedConfig.steps}` },
    savedConfig?.h > 0 && { label: 'Altura do espelho', value: `${savedConfig.h.toFixed(0)} mm` },
    savedConfig?.p > 0 && { label: 'Profundidade da pisada', value: `${savedConfig.p.toFixed(0)} mm` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Sucesso */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-3xl mb-4 shadow-2xl shadow-green-500/40">
            <CheckCircle2 className="text-white w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white">Seu Orçamento</h2>
          <p className="text-slate-300 mt-2">
            Olá, <strong className="text-white">{leadData.nome.split(' ')[0]}</strong>! Calculamos o valor da sua escada personalizada.
          </p>
        </div>

        {/* Card de preço */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-5">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-5">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">{modelo}</p>
            <p className="text-white/80 text-sm mt-0.5">{desc}</p>
          </div>

          <div className="px-8 py-6 text-center border-b border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Valor estimado para fabricação e instalação</p>
            <div className="text-5xl font-black text-slate-900">{formatBRL(price)}</div>
            <p className="text-slate-400 text-xs mt-2">* Sujeito a confirmação técnica · Inclui fabricação, pintura e montagem</p>
          </div>

          {/* Especificações */}
          <div className="px-8 py-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Especificações do Projeto</p>
            <div className="grid grid-cols-2 gap-2">
              {specs.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 text-xs">{s.label}</p>
                  <p className="font-bold text-slate-800 text-sm">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="space-y-3">
          <button
            onClick={handleAddToCart}
            className="w-full py-5 bg-green-500 hover:bg-green-400 text-white font-black text-xl rounded-2xl transition-all shadow-xl shadow-green-500/30 hover:shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3"
          >
            🛒 Finalizar Pedido no Carrinho
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onBack}
              className="py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all text-sm border border-white/10"
            >
              ← Voltar
            </button>
            <button
              onClick={onRestart}
              className="py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all text-sm border border-white/10"
            >
              ↺ Nova Escada
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6 leading-relaxed">
          Ao finalizar, você será direcionado ao checkout. Nossa equipe técnica entrará em contato
          para confirmar detalhes e agendar a instalação.
        </p>
      </div>
    </div>
  );
};

const LeadModal = ({ onClose, onSubmit, isSubmitting }: {
  onClose: () => void;
  onSubmit: (data: LeadData) => void;
  isSubmitting: boolean;
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !telefone) return;
    onSubmit({ nome, email, telefone });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
          <XCircle size={24} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-md">
            <Calculator size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Quase lá!</h2>
            <p className="text-slate-500 text-sm">Preencha seus dados para ver o orçamento</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-800"
              placeholder="Seu nome completo" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-800"
              placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp / Telefone *</label>
            <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-800"
              placeholder="(00) 00000-0000" />
          </div>
          <p className="text-xs text-slate-400">Seus dados são usados apenas para envio do orçamento e contato comercial.</p>
          <button type="submit" disabled={isSubmitting || !nome || !email || !telefone}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg">
            {isSubmitting ? 'Enviando…' : 'Ver Orçamento →'}
          </button>
        </form>
      </div>
    </div>
  );
};

const KitDePecas = ({ p, h, w, steps, flights, landingSupports, type, landingW, landingL }: any) => {
  const theta = Math.atan2(h, p);
  const profileHeight = (h + 120) * Math.cos(theta);
  const profileWidth = 50;

  const getFlightLength = (flightP: number, bottomCut: 'horizontal' | 'vertical' = 'horizontal') => {
    let dx = flightP;
    if (bottomCut === 'horizontal') {
      dx += p * (h + 20) / h;
    }
    return dx / Math.cos(theta);
  };

  const totalStringerLength = flights.reduce((acc: number, f: any) => acc + (getFlightLength(f.flightP, f.bottomCut) * f.count), 0);
  const totalSupportLength = landingSupports ? landingSupports.reduce((acc: number, ls: any) => acc + (ls.length * ls.count), 0) : 0;
  const totalMetalProfile = (totalStringerLength + totalSupportLength) / 1000; // in meters

  const handrailLength = flights.reduce((acc: number, f: any) => acc + (Math.sqrt(Math.pow(f.flightP, 2) + Math.pow(f.flightP * (h/p), 2)) * 2), 0) / 1000;
  const landingHandrailLength = landingL ? ((landingL + (landingW || w)) * 2) / 1000 : 0;
  const totalHandrail = handrailLength + landingHandrailLength;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-4">
        <Package className="w-6 h-6 text-blue-600" /> Kit de Peças para Fabricação
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Degraus */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <LayersIcon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800">Degraus (Chapa Xadrez)</h3>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{steps} <span className="text-lg font-medium text-slate-500">unidades</span></div>
          <p className="text-slate-600">Medida de corte: <strong>{Math.round(p)}mm x {Math.round(w)}mm</strong></p>
          <p className="text-xs text-slate-400 mt-2">Dobra recomendada de 50mm nas bordas para rigidez.</p>
        </div>

        {/* Patamar */}
        {type !== 'straight' && type !== 'spiral' && (
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <SplitSquareHorizontal className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-800">Patamar (Chapa Xadrez)</h3>
            </div>
            <div className="text-3xl font-black text-slate-800 mb-1">1 <span className="text-lg font-medium text-slate-500">unidade</span></div>
            <p className="text-slate-600">Medida de corte: <strong>{Math.round(landingL || 0)}mm x {Math.round(landingW || w)}mm</strong></p>
          </div>
        )}

        {/* Longarinas */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800">Estrutura Metálica (Longarinas e Suportes)</h3>
          </div>
          <p className="text-slate-600 mb-4">Perfil sugerido: <strong>Tubo Retangular {Math.round(profileHeight)}x{profileWidth}mm</strong></p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {flights.map((f: any, i: number) => (
              <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-sm font-bold text-slate-700">{f.name}</div>
                <div className="text-lg font-bold text-blue-600">{f.count}x {Math.round(getFlightLength(f.flightP, f.bottomCut))} mm</div>
                <div className="text-xs text-slate-500">{f.bottomCut === 'vertical' ? 'Corte bisel topo, reto base' : 'Corte bisel nas pontas'}</div>
              </div>
            ))}
            {landingSupports && landingSupports.map((ls: any, i: number) => (
              <div key={`ls-${i}`} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-sm font-bold text-slate-700">{ls.name}</div>
                <div className="text-lg font-bold text-blue-600">{ls.count}x {Math.round(ls.length)} mm</div>
                <div className="text-xs text-slate-500">Corte reto (90º)</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-500">Total estimado de tubo:</span>
            <span className="font-bold text-slate-800">{totalMetalProfile.toFixed(1)} metros</span>
          </div>
        </div>

        {/* Corrimão */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Minus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800">Kit Corrimão e Guarda-corpo</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <p className="text-slate-600 text-sm mb-1">Tubos para corrimão (aprox.)</p>
              <div className="text-2xl font-black text-slate-800">{totalHandrail.toFixed(1)} <span className="text-lg font-medium text-slate-500">metros</span></div>
            </div>
            <div>
              <p className="text-slate-600 text-sm mb-1">Colunas de fixação (estimativa)</p>
              <div className="text-2xl font-black text-slate-800">{Math.ceil(steps / 3) * 2 + (landingL ? 4 : 0)} <span className="text-lg font-medium text-slate-500">unidades</span></div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Sugerido tubo redondo de 1 1/2" ou retangular 40x40mm. Altura padrão de 900mm.</p>
        </div>
      </div>
    </div>
  );
};

const StraightCalc = ({ onBack, onNext }: any) => {
  const [H, setH] = useState(2800);
  const [L, setL] = useState(3000);
  const [W, setW] = useState(1000);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [topStepFlush, setTopStepFlush] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [showHandrail, setShowHandrail] = useState(true);
  const [showGuardrail, setShowGuardrail] = useState(true);
  
  const config = useMemo(() => getBestConfiguration(H, L, topStepFlush), [H, L, topStepFlush]);
  if (!config) return null;

  return (
    <CalculatorLayout 
      title="Escada Reta (Sem Patamar)" onBack={onBack} config={config}
      salesKit={
        <WizardNextButton onNext={() => onNext(config, { H, L, W, L1: 0, L2: 0, D: 0 })} />
      }
      inputs={
        <>
          <TopStepToggle value={topStepFlush} onChange={setTopStepFlush} />
          <ColorLegend />
          <ThermometerSlider 
            label="Altura Total" 
            value={H} 
            min={1000} 
            max={5000} 
            onChange={setH} 
            gradient={getGradient('height', L, topStepFlush)} 
            unit="mm" 
            tooltip="Altura total do piso inferior ao piso superior. O termômetro indica se a altura é confortável para o comprimento atual."
          />
          <ThermometerSlider 
            label="Comprimento Total" 
            value={L} 
            min={1000} 
            max={8000} 
            onChange={setL} 
            gradient={getGradient('length', H, topStepFlush)} 
            unit="mm" 
            tooltip="Espaço horizontal disponível para a escada. O termômetro indica se o comprimento é suficiente para uma subida suave."
          />
          <ThermometerSlider 
            label="Largura da Escada" 
            value={W} 
            min={600} 
            max={3000} 
            onChange={setW} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Largura dos degraus. Recomendado mínimo de 800mm para residências e 1200mm para locais públicos."
          />
        </>
      }
      headerActions={
        <div className="flex items-center gap-3 print:hidden">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Modo:</span>
          <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('2d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <ImageIcon size={16} /> 2D
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <BoxIcon size={16} /> 3D
            </button>
          </div>
          {viewMode === '3d' && (
            <>
              <button
                onClick={() => setShowHandrail(!showHandrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showHandrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showHandrail ? 'Ocultar Corrimão' : 'Mostrar Corrimão'}
              >
                {showHandrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Corrimão
              </button>
              <button
                onClick={() => setShowGuardrail(!showGuardrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showGuardrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showGuardrail ? 'Ocultar Guarda-corpo' : 'Mostrar Guarda-corpo'}
              >
                {showGuardrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Guarda-corpo
              </button>
              <button
                onClick={() => setExploded(!exploded)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${exploded ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <LayersIcon size={16} /> {exploded ? 'Montar' : 'Explodir'}
              </button>
            </>
          )}
        </div>
      }
      visualizer={
        viewMode === '2d' ? 
          <StraightVisualizer H={H} L={L} h={config.h} p={config.p} steps={config.steps} topStepFlush={topStepFlush} /> :
          <Stair3DVisualizer steps={config.steps} h={config.h} p={config.p} w={W} topStepFlush={topStepFlush} exploded={exploded} showHandrail={showHandrail} showGuardrail={showGuardrail} />
      }
    />
  );
};

const Landing3DVisualizer = ({ steps, h, p, w, landingL, landingStepPos, topStepFlush, exploded, showHandrail = true, showGuardrail = true }: any) => {
  const steps1 = landingStepPos || Math.floor(steps / 2);
  const numTreads = topStepFlush ? steps : steps - 1;
  const totalH = steps * h;
  
  const ex = exploded ? 1 : 0;
  
  let totalP = 0;
  for (let i = 0; i < numTreads; i++) {
    if (i === steps1 - 1) {
      totalP += landingL;
    } else {
      totalP += p;
    }
  }

  const cx = totalP / 2;
  const cy = totalH / 2;
  const cz = w / 2;

  const maxDim = Math.max(totalP + p * 3, totalH + h * 2, w);
  const scale = 10 / maxDim;

  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center relative overflow-hidden h-80 cursor-move">
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-xs font-medium text-slate-500 pointer-events-none shadow-sm print:hidden">
        Arraste para girar
      </div>
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 6, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        
        <group scale={[scale, scale, scale]} position={[-cx * scale, -cy * scale, -cz * scale]}>
          {/* Lower Floor */}
          <Box args={[p * 5, h * 2, w]} position={[-p * 2.5, -h, w/2]}>
            <meshStandardMaterial color="#475569" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#1e293b" />
          </Box>

          {/* Steps */}
          {(() => {
            const boxes = [];
            let currentX = 0;
            
            for (let i = 0; i < steps; i++) {
              if (!topStepFlush && i === steps - 1) break;
              
              const stepThickness = 50;
              let stepP = p;
              
              if (i === steps1 - 1) {
                stepP = landingL;
              }
              
              const x = currentX + stepP / 2;
              const y = (i + 1) * h - stepThickness / 2;
              const z = w / 2;
              
              boxes.push(
                <Box key={i} args={[stepP, stepThickness, w]} position={[x, y + ex * 200, z]}>
                  <DiamondPlateMaterial width={stepP} depth={w} color={i === steps1 - 1 ? "#fde68a" : "#cbd5e1"} />
                  <Edges scale={1} threshold={15} color={i === steps1 - 1 ? "#f59e0b" : "#94a3b8"} />
                </Box>
              );
              
              currentX += stepP;
            }
            return boxes;
          })()}

          {/* Stringers (Longarinas) */}
          {(() => {
            const stringerThickness = 50;
            const extrudeSettings = { depth: stringerThickness, bevelEnabled: false };

            const f1P = steps1 * p;
            const f1H = steps1 * h;
            const shape1 = createStringerShape(f1P, f1H, p, h, 'horizontal');

            const f2P = totalP - (f1P + landingL);
            const f2H = totalH - f1H;
            const shape2 = createStringerShape(f2P, f2H, p, h, 'vertical');

            return (
              <>
                {/* Flight 1 Stringers */}
                <mesh position={[0, 0, -ex * 300]}>
                  <extrudeGeometry args={[shape1, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
                <mesh position={[0, 0, w - stringerThickness + ex * 300]}>
                  <extrudeGeometry args={[shape1, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>

                {/* Landing Support */}
                <Box args={[landingL, h + 120, stringerThickness]} position={[f1P + landingL / 2, f1H + h / 2 - 40, stringerThickness / 2 - ex * 300]}>
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </Box>
                <Box args={[landingL, h + 120, stringerThickness]} position={[f1P + landingL / 2, f1H + h / 2 - 40, w - stringerThickness / 2 + ex * 300]}>
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </Box>

                {/* Flight 2 Stringers */}
                <mesh position={[f1P + landingL, f1H + h, -ex * 300]}>
                  <extrudeGeometry args={[shape2, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
                <mesh position={[f1P + landingL, f1H + h, w - stringerThickness + ex * 300]}>
                  <extrudeGeometry args={[shape2, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
              </>
            );
          })()}

          {/* Handrails and Balusters */}
          {(() => {
            const handrailHeight = 900;
            const postSize = 40;
            const tubeRadius = 15;
            
            const f1P = steps1 * p;
            const f1H = steps1 * h;
            
            const leftPoints: THREE.Vector3[] = [];
            const rightPoints: THREE.Vector3[] = [];

            // Flight 1 points
            for (let i = 0; i < steps1; i++) {
              [1/6, 1/2, 5/6].forEach((fraction) => {
                const x = i * p + p * fraction;
                const y = (i + 1) * h + handrailHeight;
                leftPoints.push(new THREE.Vector3(x, y, postSize/2));
                rightPoints.push(new THREE.Vector3(x, y, w - postSize/2));
              });
            }

            // Landing points
            const landingY = f1H + handrailHeight;
            for (let i = 0; i < 4; i++) {
              const x = f1P + (i / 3) * landingL;
              leftPoints.push(new THREE.Vector3(x, landingY, postSize/2));
              rightPoints.push(new THREE.Vector3(x, landingY, w - postSize/2));
            }

            // Flight 2 points
            let currentX = f1P + landingL;
            for (let i = 0; i < (steps - steps1); i++) {
              const stepIdx = i + steps1;
              if (!topStepFlush && stepIdx === steps - 1) break;
              [1/6, 1/2, 5/6].forEach((fraction) => {
                const x = currentX + p * fraction;
                const y = (stepIdx + 1) * h + handrailHeight;
                leftPoints.push(new THREE.Vector3(x, y, postSize/2));
                rightPoints.push(new THREE.Vector3(x, y, w - postSize/2));
              });
              currentX += p;
            }

            return (
              <>
                {/* Left Handrail Group */}
                <group position={[0, ex * 200, -ex * 300]}>
                  {showHandrail && (
                    <>
                      {/* Flight 1 Balusters */}
                      {Array.from({ length: steps1 }).flatMap((_, i) => {
                        return [1/6, 1/2, 5/6].map((fraction, j) => {
                          const x = i * p + p * fraction;
                          const stepTopY = (i + 1) * h;
                          const balusterHeight = handrailHeight;
                          return (
                            <Box key={`lbal1-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, postSize/2]}>
                              <meshStandardMaterial color="#334155" />
                              <Edges scale={1} threshold={15} color="#1e293b" />
                            </Box>
                          );
                        });
                      })}
                      
                      {/* Flight 2 Balusters */}
                      {(() => {
                        let cX = f1P + landingL;
                        return Array.from({ length: steps - steps1 }).flatMap((_, i) => {
                          const stepIdx = i + steps1;
                          if (!topStepFlush && stepIdx === steps - 1) return [];
                          const res = [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = cX + p * fraction;
                            const stepTopY = (stepIdx + 1) * h;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`lbal2-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, postSize/2]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                          cX += p;
                          return res;
                        });
                      })()}
                      <HandrailTube points={leftPoints} radius={tubeRadius} color="#334155" />
                    </>
                  )}
                  
                  {/* Landing Guardrail (Left) */}
                  {showGuardrail && Array.from({ length: 4 }).map((_, i) => {
                    const x = f1P + (i / 3) * landingL;
                    const balusterHeight = handrailHeight;
                    return (
                      <Box key={`lguard-${i}`} args={[16, balusterHeight, 16]} position={[x, f1H + balusterHeight/2, postSize/2]}>
                        <meshStandardMaterial color="#334155" />
                        <Edges scale={1} threshold={15} color="#1e293b" />
                      </Box>
                    );
                  })}
                </group>

                {/* Right Handrail Group */}
                <group position={[0, ex * 200, ex * 300]}>
                  {showHandrail && (
                    <>
                      {/* Flight 1 Balusters */}
                      {Array.from({ length: steps1 }).flatMap((_, i) => {
                        return [1/6, 1/2, 5/6].map((fraction, j) => {
                          const x = i * p + p * fraction;
                          const stepTopY = (i + 1) * h;
                          const balusterHeight = handrailHeight;
                          return (
                            <Box key={`rbal1-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, w - postSize/2]}>
                              <meshStandardMaterial color="#334155" />
                              <Edges scale={1} threshold={15} color="#1e293b" />
                            </Box>
                          );
                        });
                      })}

                      {/* Flight 2 Balusters */}
                      {(() => {
                        let cX = f1P + landingL;
                        return Array.from({ length: steps - steps1 }).flatMap((_, i) => {
                          const stepIdx = i + steps1;
                          if (!topStepFlush && stepIdx === steps - 1) return [];
                          const res = [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = cX + p * fraction;
                            const stepTopY = (stepIdx + 1) * h;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`rbal2-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, w - postSize/2]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                          cX += p;
                          return res;
                        });
                      })()}
                      <HandrailTube points={rightPoints} radius={tubeRadius} color="#334155" />
                    </>
                  )}

                  {/* Landing Guardrail (Right) */}
                  {showGuardrail && Array.from({ length: 4 }).map((_, i) => {
                    const x = f1P + (i / 3) * landingL;
                    const balusterHeight = handrailHeight;
                    return (
                      <Box key={`rguard-${i}`} args={[16, balusterHeight, 16]} position={[x, f1H + balusterHeight/2, w - postSize/2]}>
                        <meshStandardMaterial color="#334155" />
                        <Edges scale={1} threshold={15} color="#1e293b" />
                      </Box>
                    );
                  })}
                </group>
              </>
            );
          })()}

          {/* Upper Floor */}
          <Box args={[p * 3, h * 2, w]} position={[totalP + p * 1.5, totalH - h, w/2]}>
            <meshStandardMaterial color="#b45309" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#78350f" />
          </Box>

          {/* Dimensions */}
          <group position={[totalP + 100, totalH / 2, w + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[20, totalH, 20]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            <Billboard>
              <Text position={[200, 0, 0]} fontSize={200} color="#ef4444" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                H: {Math.round(totalH)}mm
              </Text>
            </Billboard>
          </group>

          <group position={[totalP / 2, -h - 100, w + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[totalP, 20, 20]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
            <Billboard>
              <Text position={[0, -200, 0]} fontSize={200} color="#3b82f6" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                L: {Math.round(totalP)}mm
              </Text>
            </Billboard>
          </group>
        </group>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  );
};

const LShape3DVisualizer = ({ L1, L2, W, p, h, steps, topStepFlush, exploded, showHandrail = true, showGuardrail = true }: any) => {
  const treads = topStepFlush ? steps : steps - 1;
  const steps1 = Math.max(0, Math.min(treads - 1, Math.round(L1 / p)));
  const steps2 = treads - 1 - steps1;
  
  const totalH = steps * h;
  const ex = exploded ? 1 : 0;
  
  const cx = L1 / 2;
  const cy = totalH / 2;
  const cz = L2 / 2;

  const maxDim = Math.max(L1 + W * 2, L2 + W * 2, totalH + h * 2);
  const scale = 10 / maxDim;

  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center relative overflow-hidden h-80 cursor-move">
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-xs font-medium text-slate-500 pointer-events-none shadow-sm print:hidden">
        Arraste para girar
      </div>
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 8, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        
        <group scale={[scale, scale, scale]} position={[-cx * scale, -cy * scale, -cz * scale]}>
          {/* Lower Floor */}
          <Box args={[p * 5, h * 2, W]} position={[-p * 2.5, -h, W/2]}>
            <meshStandardMaterial color="#475569" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#1e293b" />
          </Box>

          {/* Flight 1 */}
          {Array.from({ length: steps1 }).map((_, i) => {
            const stepThickness = 50;
            const x = i * p + p / 2;
            const y = (i + 1) * h - stepThickness / 2;
            const z = W / 2;
            
            return (
              <Box key={`f1-${i}`} args={[p, stepThickness, W]} position={[x, y + ex * 200, z]}>
                <DiamondPlateMaterial width={p} depth={W} />
                <Edges scale={1} threshold={15} color="#94a3b8" />
              </Box>
            );
          })}

          {/* Landing (L-shape corner) */}
          <Box args={[W, 50, W]} position={[steps1 * p + W / 2, (steps1 + 1) * h - 25 + ex * 200, W / 2]}>
            <DiamondPlateMaterial width={W} depth={W} color="#fde68a" />
            <Edges scale={1} threshold={15} color="#f59e0b" />
          </Box>

          {/* Flight 2 */}
          {Array.from({ length: steps2 }).map((_, i) => {
            const stepThickness = 50;
            const x = steps1 * p + W / 2;
            const y = (steps1 + 2 + i) * h - stepThickness / 2;
            const z = W + i * p + p / 2;
            
            return (
              <Box key={`f2-${i}`} args={[W, stepThickness, p]} position={[x, y + ex * 200, z]}>
                <DiamondPlateMaterial width={W} depth={p} />
                <Edges scale={1} threshold={15} color="#94a3b8" />
              </Box>
            );
          })}

          {/* Stringers (Longarinas) */}
          {(() => {
            const stringerThickness = 50;
            const botOffset = 230;
            const extrudeSettings = { depth: stringerThickness, bevelEnabled: false };

            const f1P = steps1 * p;
            const f1H = steps1 * h;
            const shape1 = createStringerShape(f1P, f1H, p, h, 'horizontal');

            const f2P = steps2 * p;
            const f2H = steps2 * h;
            const shape2 = createStringerShape(f2P, f2H, p, h, 'vertical');

            return (
              <>
                {/* Flight 1 Stringers */}
                <mesh position={[0, 0, -ex * 300]}>
                  <extrudeGeometry args={[shape1, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
                <mesh position={[0, 0, W - stringerThickness + ex * 300]}>
                  <extrudeGeometry args={[shape1, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>

                {/* Landing Support */}
                <Box args={[W, h + 120, stringerThickness]} position={[f1P + W / 2, f1H + h / 2 - 40, stringerThickness / 2 - ex * 300]}>
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </Box>
                <Box args={[W, h + 120, stringerThickness]} position={[f1P + W / 2, f1H + h / 2 - 40, W - stringerThickness / 2 + ex * 300]}>
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </Box>

                {/* Flight 2 Stringers */}
                <mesh position={[f1P + stringerThickness - ex * 300, f1H + h, W]} rotation={[0, -Math.PI / 2, 0]}>
                  <extrudeGeometry args={[shape2, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
                <mesh position={[f1P + W + ex * 300, f1H + h, W]} rotation={[0, -Math.PI / 2, 0]}>
                  <extrudeGeometry args={[shape2, extrudeSettings]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                  <Edges scale={1} threshold={15} color="#1e293b" />
                </mesh>
              </>
            );
          })()}

          {/* Handrails and Balusters */}
          {(() => {
            const handrailHeight = 900;
            const postSize = 40;
            const tubeRadius = 15;
            
            const f1P = steps1 * p;
            const f1H = steps1 * h;
            const f2P = steps2 * p;
            const f2H = steps2 * h;

            const outerPoints: THREE.Vector3[] = [];
            const innerPoints: THREE.Vector3[] = [];

            // Flight 1 points
            for (let i = 0; i < steps1; i++) {
              [1/6, 1/2, 5/6].forEach((fraction) => {
                const x = i * p + p * fraction;
                const y = (i + 1) * h + handrailHeight;
                outerPoints.push(new THREE.Vector3(x, y, postSize/2));
                innerPoints.push(new THREE.Vector3(x, y, W - postSize/2));
              });
            }

            // Landing points
            const landingY = f1H + h + handrailHeight;
            // Outer corner
            for (let i = 0; i < 4; i++) {
              const z = postSize/2 + (i / 3) * (W - postSize);
              outerPoints.push(new THREE.Vector3(f1P + W - postSize/2, landingY, z));
            }
            // Inner corner
            innerPoints.push(new THREE.Vector3(f1P + postSize/2, landingY, W - postSize/2));

            // Flight 2 points
            for (let i = 0; i < steps2; i++) {
              const stepIdx = i + steps1 + 1;
              if (!topStepFlush && stepIdx === steps - 1) break;
              [1/6, 1/2, 5/6].forEach((fraction) => {
                const x_outer = f1P + W - postSize/2;
                const x_inner = f1P + postSize/2;
                const y = (stepIdx + 1) * h + handrailHeight;
                const z = W + i * p + p * fraction;
                outerPoints.push(new THREE.Vector3(x_outer, y, z));
                innerPoints.push(new THREE.Vector3(x_inner, y, z));
              });
            }

            return (
              <>
                {/* Outer Handrail Group */}
                <group position={[0, ex * 200, 0]}>
                  {showHandrail && (
                    <>
                      {/* Flight 1 Balusters */}
                      <group position={[0, 0, -ex * 300]}>
                        {Array.from({ length: steps1 }).flatMap((_, i) => {
                          return [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = i * p + p * fraction;
                            const stepTopY = (i + 1) * h;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`obal1-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, postSize/2]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                        })}
                      </group>
                      
                      {/* Flight 2 Balusters */}
                      <group position={[0, 0, 0]}>
                        {Array.from({ length: steps2 }).flatMap((_, i) => {
                          const stepIdx = i + steps1 + 1;
                          if (!topStepFlush && stepIdx === steps - 1) return [];
                          return [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = f1P + W - postSize/2;
                            const stepTopY = (stepIdx + 1) * h;
                            const z = W + i * p + p * fraction;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`obal2-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x - ex * 300, stepTopY + balusterHeight/2, z]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                        })}
                      </group>
                      <HandrailTube points={outerPoints.map(p => new THREE.Vector3(p.x - (p.z > W ? ex * 300 : 0), p.y, p.z - (p.z <= W ? ex * 300 : 0)))} radius={tubeRadius} color="#334155" />
                    </>
                  )}
                  
                  {/* Outer Landing Guardrail */}
                  {showGuardrail && (
                    <group position={[0, 0, 0]}>
                      {Array.from({ length: 4 }).map((_, i) => {
                        const z = postSize/2 + (i / 3) * (W - postSize);
                        const balusterHeight = handrailHeight;
                        return (
                          <Box key={`oguard-${i}`} args={[16, balusterHeight, 16]} position={[f1P + W - postSize/2, f1H + h + balusterHeight/2, z - ex * 300]}>
                            <meshStandardMaterial color="#334155" />
                            <Edges scale={1} threshold={15} color="#1e293b" />
                          </Box>
                        );
                      })}
                    </group>
                  )}
                </group>

                {/* Inner Handrail Group */}
                <group position={[0, ex * 200, 0]}>
                  {showHandrail && (
                    <>
                      {/* Flight 1 Balusters */}
                      <group position={[0, 0, ex * 300]}>
                        {Array.from({ length: steps1 }).flatMap((_, i) => {
                          return [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = i * p + p * fraction;
                            const stepTopY = (i + 1) * h;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`ibal1-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x, stepTopY + balusterHeight/2, W - postSize/2]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                        })}
                      </group>

                      {/* Flight 2 Balusters */}
                      <group position={[0, 0, 0]}>
                        {Array.from({ length: steps2 }).flatMap((_, i) => {
                          const stepIdx = i + steps1 + 1;
                          if (!topStepFlush && stepIdx === steps - 1) return [];
                          return [1/6, 1/2, 5/6].map((fraction, j) => {
                            const x = f1P + postSize/2;
                            const stepTopY = (stepIdx + 1) * h;
                            const z = W + i * p + p * fraction;
                            const balusterHeight = handrailHeight;
                            return (
                              <Box key={`ibal2-${i}-${j}`} args={[16, balusterHeight, 16]} position={[x + ex * 300, stepTopY + balusterHeight/2, z]}>
                                <meshStandardMaterial color="#334155" />
                                <Edges scale={1} threshold={15} color="#1e293b" />
                              </Box>
                            );
                          });
                        })}
                      </group>
                      <HandrailTube points={innerPoints.map(p => new THREE.Vector3(p.x + (p.z > W ? ex * 300 : 0), p.y, p.z + (p.z <= W ? ex * 300 : 0)))} radius={tubeRadius} color="#334155" />
                    </>
                  )}

                  {/* Inner Landing Guardrail */}
                  {showGuardrail && (
                    <group position={[0, 0, 0]}>
                      <Box args={[16, handrailHeight, 16]} position={[f1P + postSize/2, f1H + h + handrailHeight/2, W - postSize/2 + ex * 300]}>
                        <meshStandardMaterial color="#334155" />
                        <Edges scale={1} threshold={15} color="#1e293b" />
                      </Box>
                    </group>
                  )}
                </group>
              </>
            );
          })()}

          {/* Upper Floor */}
          <Box args={[W, h * 2, p * 3]} position={[steps1 * p + W / 2, totalH - h, W + steps2 * p + p * 1.5]}>
            <meshStandardMaterial color="#b45309" roughness={0.8} />
            <Edges scale={1} threshold={15} color="#78350f" />
          </Box>

          {/* Dimensions */}
          <group position={[L1 + W + 100, totalH / 2, W + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[20, totalH, 20]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            <Billboard>
              <Text position={[200, 0, 0]} fontSize={200} color="#ef4444" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                H: {Math.round(totalH)}mm
              </Text>
            </Billboard>
          </group>

          <group position={[L1 / 2, -h - 100, W + 100]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[L1, 20, 20]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
            <Billboard>
              <Text position={[0, -200, 0]} fontSize={200} color="#3b82f6" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                L1: {Math.round(L1)}mm
              </Text>
            </Billboard>
          </group>

          <group position={[steps1 * p + W + 100, -h - 100, W + L2 / 2]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[20, 20, L2]} />
              <meshBasicMaterial color="#10b981" />
            </mesh>
            <Billboard>
              <Text position={[0, -200, 0]} fontSize={200} color="#10b981" outlineWidth={10} outlineColor="#ffffff" fontWeight="bold">
                L2: {Math.round(L2)}mm
              </Text>
            </Billboard>
          </group>
        </group>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  );
};

const Spiral3DVisualizer = ({ steps, h, H, D, topStepFlush, stair, tubeD, landingQuadrant, isValidConnection, showHandrail, showGuardrail, isExploded, setIsExploded }: any) => {
  const R = D / 2;
  const tubeRadius = (tubeD * 25.4) / 2; // Convert inches to mm
  const totalSteps = stair.quadrants.reduce((acc: number, q: any) => acc + q.steps.length, 0);
  const totalH = H;
  
  const stepsPerTurn = Math.max(12, Math.ceil(D / 100 / 4) * 4);
  const angleStep = (360 / stepsPerTurn) * (Math.PI / 180);

  // Calculate landing rotation to match 2D SVG
  const landingStartAngleSVG = landingQuadrant * 90 - 90;
  const landingRotation = -landingStartAngleSVG * (Math.PI / 180);
  
  const landingConnectionAngleSVG = stair.direction === 'clockwise' 
    ? landingQuadrant * 90 - 90 
    : (landingQuadrant + 1) * 90 - 90;
  const landingConnectionRotation = -landingConnectionAngleSVG * (Math.PI / 180);

  const handrailR = R - 40;
  
  const R0 = stair.quadrants.length > 0 && stair.quadrants[0].steps.length > 0 
    ? -(stair.quadrants[0].steps[0].angle - 90) * (Math.PI / 180) 
    : 0;

  const getHandrailY = useCallback((stepIndex: number, localAngle: number) => {
    let y;
    if (stair.direction === 'clockwise') {
      y = (stepIndex + 1 + localAngle / angleStep) * h + 1000;
    } else {
      y = (stepIndex + 2 - localAngle / angleStep) * h + 1000;
    }
    return Math.min(y, H + 1000);
  }, [stair.direction, angleStep, h, H]);

  const handrailCurve = useMemo(() => {
    const points = [];
    const steps = stair.quadrants.flatMap((q: any) => q.steps);
    
    if (steps.length === 0) {
      return new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0)]);
    }

    const isClockwise = stair.direction === 'clockwise';

    // Start point
    const firstStep = steps[0];
    const firstRotation = -(firstStep.angle - 90) * (Math.PI / 180);
    const t0_localAngle = isClockwise ? 0 : angleStep;
    const t0_globalAngle = firstRotation - t0_localAngle;
    points.push(new THREE.Vector3(
      handrailR * Math.cos(t0_globalAngle), 
      getHandrailY(0, t0_localAngle), 
      -handrailR * Math.sin(t0_globalAngle)
    ));

    // Points for each step
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const rotation = -(step.angle - 90) * (Math.PI / 180);
      
      const fractions = [1/6, 1/2, 5/6];
      
      for (const fraction of fractions) {
        const localAngle = angleStep * fraction;
        const globalAngle = rotation + localAngle;
        points.push(new THREE.Vector3(
          handrailR * Math.cos(globalAngle), 
          getHandrailY(stepIndex, localAngle), 
          -handrailR * Math.sin(globalAngle)
        ));
      }
    }

    // End point connects exactly to the landing
    const lastStepIndex = steps.length - 1;
    const lastLocalAngle = angleStep;
    const endY = getHandrailY(lastStepIndex, lastLocalAngle);
    points.push(new THREE.Vector3(
      handrailR * Math.cos(landingConnectionRotation), 
      endY, 
      -handrailR * Math.sin(landingConnectionRotation)
    ));

    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  }, [stair, handrailR, angleStep, getHandrailY, landingConnectionRotation]);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(tubeRadius, 0);
    s.lineTo(R, 0);
    s.absarc(0, 0, R, 0, angleStep, false);
    s.lineTo(tubeRadius * Math.cos(angleStep), tubeRadius * Math.sin(angleStep));
    s.absarc(0, 0, tubeRadius, angleStep, 0, true);
    return s;
  }, [R, tubeRadius, angleStep]);

  const landingShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(tubeRadius, 0);
    s.lineTo(R, 0);
    s.lineTo(R, R);
    s.lineTo(0, R);
    s.lineTo(0, tubeRadius);
    s.absarc(0, 0, tubeRadius, Math.PI / 2, 0, true);
    return s;
  }, [R, tubeRadius]);

  const extrudeSettings = useMemo(() => ({
    depth: 50,
    bevelEnabled: false
  }), []);
  
  const explodeOffsets = {
    sapata: isExploded ? -1000 : 0,
    tube: 0,
    stepBase: isExploded ? 1000 : 0,
    stepGap: isExploded ? 200 : 0,
    baluster: isExploded ? 2000 : 0,
    landing: isExploded ? 1000 + totalSteps * 200 + 1000 : 0,
    guardrail: isExploded ? 1000 : 0,
    handrail: isExploded ? 1000 + totalSteps * 200 + 3000 : 0,
    plate: isExploded ? 300 : 0,
  };

  const explodedExtraHeight = isExploded ? 1000 + totalSteps * 200 + 3000 : 0;
  
  const cx = 0;
  const cy = (totalH + explodedExtraHeight) / 2;
  const cz = 0;

  const maxDim = Math.max(D, totalH + h * 2 + explodedExtraHeight);
  const scale = 10 / maxDim;
  const isClockwise = stair.direction === 'clockwise';

  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 flex justify-center items-center relative overflow-hidden h-[500px] cursor-move">
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-xs font-medium text-slate-500 pointer-events-none shadow-sm print:hidden">
        Arraste para girar
      </div>
      <div className="absolute bottom-4 left-4 z-10 print:hidden">
        <label className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors shadow-sm">
          <input type="checkbox" checked={isExploded} onChange={(e) => setIsExploded(e.target.checked)} className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm text-slate-700">Vista Explodida</span>
        </label>
      </div>
      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 8, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        
        <group scale={[scale, scale, scale]} position={[-cx * scale, -cy * scale, -cz * scale]}>
            {/* Sapata (Base plate) */}
            <mesh position={[0, explodeOffsets.sapata + 10, 0]}>
              <cylinderGeometry args={[tubeRadius + 50, tubeRadius + 50, 20, 32]} />
              <meshStandardMaterial color="#334155" roughness={0.6} />
            </mesh>

            {/* Central Pole */}
            <mesh position={[0, (totalH + 1000) / 2 + explodeOffsets.tube, 0]}>
              <cylinderGeometry args={[tubeRadius, tubeRadius, totalH + 1000, 32]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} />
            </mesh>

            {/* Landing */}
            <group position={[0, totalH + explodeOffsets.landing, 0]} rotation={[0, landingRotation, 0]}>
              <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <extrudeGeometry args={[landingShape, extrudeSettings]} />
                <DiamondPlateMaterial width={D/2} depth={D/2} color={isValidConnection ? "#60a5fa" : "#ef4444"} />
                <Edges scale={1} threshold={15} color="#94a3b8" />
              </mesh>
              {showGuardrail && (
                <group position={[0, explodeOffsets.guardrail, 0]}>
                  {isClockwise ? (
                    <>
                      {/* Right side (x = R - 40) */}
                      {Array.from({ length: 4 }).map((_, i) => {
                        const z = 40 + (i / 3) * (R - 80);
                        return (
                          <mesh key={`right-${i}`} position={[R - 40, 500, z]}>
                            <boxGeometry args={[16, 1000, 16]} />
                            <meshStandardMaterial color="#334155" />
                          </mesh>
                        );
                      })}
                      <mesh position={[R - 40, 1000, R / 2]} rotation={[Math.PI / 2, 0, 0]}>
                        <boxGeometry args={[24, R, 24]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>

                      {/* Left side (x = 40) */}
                      {Array.from({ length: 4 }).map((_, i) => {
                        const z = tubeRadius + 40 + (i / 3) * (R - tubeRadius - 80);
                        return (
                          <mesh key={`left-${i}`} position={[40, 500, z]}>
                            <boxGeometry args={[16, 1000, 16]} />
                            <meshStandardMaterial color="#334155" />
                          </mesh>
                        );
                      })}
                      <mesh position={[40, 1000, tubeRadius + (R - tubeRadius) / 2]} rotation={[Math.PI / 2, 0, 0]}>
                        <boxGeometry args={[24, R - tubeRadius, 24]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>
                    </>
                  ) : (
                    <>
                      {/* Right side (z = 40) */}
                      {Array.from({ length: 4 }).map((_, i) => {
                        const x = tubeRadius + 40 + (i / 3) * (R - tubeRadius - 80);
                        return (
                          <mesh key={`right-${i}`} position={[x, 500, 40]}>
                            <boxGeometry args={[16, 1000, 16]} />
                            <meshStandardMaterial color="#334155" />
                          </mesh>
                        );
                      })}
                      <mesh position={[tubeRadius + (R - tubeRadius) / 2, 1000, 40]} rotation={[0, 0, Math.PI / 2]}>
                        <boxGeometry args={[24, R - tubeRadius, 24]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>

                      {/* Left side (z = R - 40) */}
                      {Array.from({ length: 4 }).map((_, i) => {
                        const x = 40 + (i / 3) * (R - 80);
                        return (
                          <mesh key={`left-${i}`} position={[x, 500, R - 40]}>
                            <boxGeometry args={[16, 1000, 16]} />
                            <meshStandardMaterial color="#334155" />
                          </mesh>
                        );
                      })}
                      <mesh position={[R / 2, 1000, R - 40]} rotation={[0, 0, Math.PI / 2]}>
                        <boxGeometry args={[24, R, 24]} />
                        <meshStandardMaterial color="#334155" />
                      </mesh>
                    </>
                  )}
                </group>
              )}
            </group>

            {/* Steps */}
            {stair.quadrants.flatMap((q: any) => q.steps).map((step: any, stepIndex: number) => {
              const y = (stepIndex + 1) * h + explodeOffsets.stepBase + stepIndex * explodeOffsets.stepGap;
              const rotation = -(step.angle - 90) * (Math.PI / 180);
              
              return (
                <group key={`step-${stepIndex}`}>
                  <group position={[0, y, 0]} rotation={[0, rotation, 0]}>
                    {/* Connecting Plate */}
                    {stepIndex > 0 && (
                      <mesh 
                        position={[
                          (R - 25 + explodeOffsets.plate) * Math.cos(isClockwise ? 0 : angleStep), 
                          -h / 2 - 25, 
                          (R - 25 + explodeOffsets.plate) * Math.sin(isClockwise ? 0 : angleStep)
                        ]} 
                        rotation={[0, -(isClockwise ? 0 : angleStep), 0]}
                      >
                        <boxGeometry args={[50, h - 50, 10]} />
                        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
                      </mesh>
                    )}
                    <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                      <extrudeGeometry args={[shape, extrudeSettings]} />
                      <DiamondPlateMaterial width={D/2} depth={D/2} color="#1a1a1a" />
                      <Edges scale={1} threshold={15} color="#94a3b8" />
                    </mesh>
                    {showHandrail && (
                      <group position={[0, explodeOffsets.baluster, 0]}>
                        {[1/6, 1/2, 5/6].map((fraction, i) => {
                          const localAngle = angleStep * fraction;
                          const globalAngle = rotation + localAngle;
                          const handrailY = getHandrailY(stepIndex, localAngle);
                          const stepY = (stepIndex + 1) * h;
                          const balusterHeight = handrailY - stepY;
                          return (
                            <mesh key={`baluster-${i}`} position={[
                              handrailR * Math.cos(localAngle), 
                              balusterHeight / 2,
                              -handrailR * Math.sin(localAngle)
                            ]}>
                              <boxGeometry args={[16, balusterHeight, 16]} />
                              <meshStandardMaterial color="#334155" />
                            </mesh>
                          );
                        })}
                      </group>
                    )}
                  </group>
                </group>
              );
            })}
          {showHandrail && (
            <group position={[0, explodeOffsets.handrail, 0]}>
              <mesh>
                <extrudeGeometry args={[
                  new THREE.Shape().moveTo(-12, -12).lineTo(12, -12).lineTo(12, 12).lineTo(-12, 12).lineTo(-12, -12),
                  { steps: 128, bevelEnabled: false, extrudePath: handrailCurve }
                ]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* End caps (Colete Belser style) */}
              <mesh position={handrailCurve.points[0]}>
                <sphereGeometry args={[15, 16, 16]} />
                <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={handrailCurve.points[handrailCurve.points.length - 1]}>
                <sphereGeometry args={[15, 16, 16]} />
                <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}
        </group>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  );
};

const HeadroomWarning = ({ stepsUnderLanding }: { stepsUnderLanding: { step: number, headroom: number }[] }) => {
  const hasUnsafe = stepsUnderLanding.some(s => s.headroom < 2000);
  return (
    <div className={`mb-6 p-4 border rounded-lg text-sm font-medium ${hasUnsafe ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
      <h4 className="font-bold mb-2 flex items-center gap-2">
        <AlertTriangle size={20} />
        {hasUnsafe ? 'Atenção: Risco de bater a cabeça!' : 'Pé-direito sob o patamar:'}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stepsUnderLanding.map(({ step, headroom }) => (
          <div key={step} className={`p-2 rounded border ${headroom < 2000 ? 'bg-red-100 border-red-200 text-red-800' : 'bg-white border-slate-200'}`}>
            Degrau {step}: {headroom.toFixed(0)}mm
          </div>
        ))}
      </div>
    </div>
  );
};

const LandingCalc = ({ onBack, onNext }: any) => {
  const [H, setH] = useState(2800);
  const [L, setL] = useState(4000);
  const [W, setW] = useState(1000);
  const [landingL, setLandingL] = useState(1000);
  const [landingStep, setLandingStep] = useState<number>(0);
  const [topStepFlush, setTopStepFlush] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [exploded, setExploded] = useState(false);
  const [showHandrail, setShowHandrail] = useState(true);
  const [showGuardrail, setShowGuardrail] = useState(true);
  
  const effectiveL = Math.max(100, L - landingL);
  const config = useMemo(() => getBestConfiguration(H, effectiveL, topStepFlush), [H, effectiveL, topStepFlush]);
  if (!config) return null;

  const actualLandingStep = landingStep === 0 
    ? config.steps - 1 // Default to the top
    : Math.min(Math.max(1, landingStep), config.steps - 1);

  const stepsUnderLanding = [];
  for (let i = 1; i < actualLandingStep; i++) {
    const headroomStep = (actualLandingStep * config.h) - (i * config.h) - 200;
    stepsUnderLanding.push({ step: i, headroom: headroomStep });
  }

  const steps1 = actualLandingStep || Math.floor(config.steps / 2);
  const f1P = steps1 * config.p;
  const numTreads = topStepFlush ? config.steps : config.steps - 1;
  let totalP = 0;
  for (let i = 0; i < numTreads; i++) {
    if (i === steps1 - 1) totalP += landingL;
    else totalP += config.p;
  }
  const f2P = totalP - (f1P + landingL);

  return (
    <CalculatorLayout 
      title="Escada Reta (Com Patamar)" onBack={onBack} config={config}
      salesKit={
        <WizardNextButton onNext={() => onNext(config, { H, L: effectiveL, W, landingL, L1: 0, L2: 0, D: 0 })} />
      }
      extraSection={
        <div className="space-y-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-4">Configuração do Patamar</h2>
          <ThermometerSlider 
            label="Posição do Patamar (Degrau)" 
            value={actualLandingStep} 
            min={1} 
            max={config.steps - 1} 
            step={1}
            onChange={(val: number) => setLandingStep(val)} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="º degrau" 
            tooltip="Escolha em qual degrau o patamar será posicionado. Para colocar no final (próximo à porta de cima), arraste para o valor máximo."
          />
          {stepsUnderLanding.length > 0 && <HeadroomWarning stepsUnderLanding={stepsUnderLanding} />}
        </div>
      }
      inputs={
        <>
          <TopStepToggle value={topStepFlush} onChange={setTopStepFlush} />
          <ColorLegend />
          <ThermometerSlider 
            label="Altura Total" 
            value={H} 
            min={1000} 
            max={5000} 
            onChange={setH} 
            gradient={getGradient('height', effectiveL, topStepFlush)} 
            unit="mm" 
            tooltip="Altura total do piso inferior ao piso superior. O termômetro indica se a altura é confortável para o comprimento atual."
          />
          <ThermometerSlider 
            label="Comprimento Total" 
            value={L} 
            min={2000} 
            max={8000} 
            onChange={setL} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Espaço horizontal total disponível para a escada, incluindo o patamar."
          />
          <ThermometerSlider 
            label="Largura da Escada" 
            value={W} 
            min={600} 
            max={3000} 
            onChange={setW} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Largura dos degraus e do patamar. Recomendado mínimo de 800mm."
          />
          <ThermometerSlider 
            label="Comprimento do Patamar" 
            value={landingL} 
            min={800} 
            max={2000} 
            onChange={setLandingL} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Tamanho do patamar de descanso. Idealmente deve ser igual ou maior que a largura da escada."
          />
        </>
      }
      headerActions={
        <div className="flex items-center gap-3 print:hidden">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Modo:</span>
          <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('2d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <ImageIcon size={16} /> 2D
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <BoxIcon size={16} /> 3D
            </button>
          </div>
          {viewMode === '3d' && (
            <>
              <button
                onClick={() => setShowHandrail(!showHandrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showHandrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showHandrail ? 'Ocultar Corrimão' : 'Mostrar Corrimão'}
              >
                {showHandrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Corrimão
              </button>
              <button
                onClick={() => setShowGuardrail(!showGuardrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showGuardrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showGuardrail ? 'Ocultar Guarda-corpo' : 'Mostrar Guarda-corpo'}
              >
                {showGuardrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Guarda-corpo
              </button>
              <button
                onClick={() => setExploded(!exploded)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${exploded ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <LayersIcon size={16} /> {exploded ? 'Montar' : 'Explodir'}
              </button>
            </>
          )}
        </div>
      }
      visualizer={
        viewMode === '2d' ?
          <LandingVisualizer H={H} L={L} landingL={landingL} h={config.h} p={config.p} steps={config.steps} landingStepPos={actualLandingStep} topStepFlush={topStepFlush} /> :
          <Landing3DVisualizer steps={config.steps} h={config.h} p={config.p} w={W} landingL={landingL} landingStepPos={actualLandingStep} topStepFlush={topStepFlush} exploded={exploded} showHandrail={showHandrail} showGuardrail={showGuardrail} />
      }
    />
  );
};

const LShapeCalc = ({ onBack, onNext }: any) => {
  const [H, setH] = useState(2800);
  const [L1, setL1] = useState(2000);
  const [L2, setL2] = useState(2000);
  const [W, setW] = useState(1000);
  const [topStepFlush, setTopStepFlush] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [exploded, setExploded] = useState(false);
  const [showHandrail, setShowHandrail] = useState(true);
  const [showGuardrail, setShowGuardrail] = useState(true);
  
  const effectiveL = L1 + L2;
  const config = useMemo(() => getBestConfiguration(H, effectiveL, topStepFlush), [H, effectiveL, topStepFlush]);
  if (!config) return null;

  const treads = topStepFlush ? config.steps : config.steps - 1;
  const steps1 = Math.max(0, Math.min(treads - 1, Math.round(L1 / config.p)));
  
  const stepsUnderLanding = [];
  for (let i = 1; i <= steps1; i++) {
    const headroomStep = (steps1 * config.h) - (i * config.h) - 200;
    stepsUnderLanding.push({ step: i, headroom: headroomStep });
  }

  const steps2 = treads - 1 - steps1;
  const f1P = steps1 * config.p;
  const f2P = steps2 * config.p;

  return (
    <CalculatorLayout 
      title="Escada em L (Com Patamar)" onBack={onBack} config={config}
      salesKit={
        <WizardNextButton onNext={() => onNext(config, { H, L: 0, W, L1, L2, D: 0, landingL: W })} />
      }
      extraSection={
        <div className="space-y-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-4">Configuração do Patamar</h2>
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg mb-6">
            <p className="text-slate-600">Patamar posicionado no <strong>{steps1 + 1}º degrau</strong> (após o Lance 1).</p>
          </div>
          {stepsUnderLanding.length > 0 && <HeadroomWarning stepsUnderLanding={stepsUnderLanding} />}
        </div>
      }
      inputs={
        <>
          <TopStepToggle value={topStepFlush} onChange={setTopStepFlush} />
          <ColorLegend />
          <ThermometerSlider 
            label="Altura Total" 
            value={H} 
            min={1000} 
            max={5000} 
            onChange={setH} 
            gradient={getGradient('height', effectiveL, topStepFlush)} 
            unit="mm" 
            tooltip="Altura total do piso inferior ao piso superior. O termômetro indica se a altura é confortável para o comprimento atual."
          />
          <ThermometerSlider 
            label="Lance 1 (Até o patamar)" 
            value={L1} 
            min={1000} 
            max={5000} 
            onChange={setL1} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Comprimento do primeiro lance de escada, antes da curva."
          />
          <ThermometerSlider 
            label="Lance 2 (Após o patamar)" 
            value={L2} 
            min={1000} 
            max={5000} 
            onChange={setL2} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Comprimento do segundo lance de escada, após a curva."
          />
          <ThermometerSlider 
            label="Largura da Escada" 
            value={W} 
            min={600} 
            max={2000} 
            onChange={setW} 
            gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
            unit="mm" 
            tooltip="Largura dos degraus. O patamar de canto terá essa mesma medida (Largura x Largura)."
          />
        </>
      }
      headerActions={
        <div className="flex items-center gap-3 print:hidden">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Modo:</span>
          <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('2d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <ImageIcon size={16} /> 2D
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <BoxIcon size={16} /> 3D
            </button>
          </div>
          {viewMode === '3d' && (
            <>
              <button
                onClick={() => setShowHandrail(!showHandrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showHandrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showHandrail ? 'Ocultar Corrimão' : 'Mostrar Corrimão'}
              >
                {showHandrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Corrimão
              </button>
              <button
                onClick={() => setShowGuardrail(!showGuardrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showGuardrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showGuardrail ? 'Ocultar Guarda-corpo' : 'Mostrar Guarda-corpo'}
              >
                {showGuardrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Guarda-corpo
              </button>
              <button
                onClick={() => setExploded(!exploded)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${exploded ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <LayersIcon size={16} /> {exploded ? 'Montar' : 'Explodir'}
              </button>
            </>
          )}
        </div>
      }
      visualizer={
        viewMode === '2d' ?
          <LShapeVisualizer L1={L1} L2={L2} W={W} p={config.p} steps={config.steps} topStepFlush={topStepFlush} /> :
          <LShape3DVisualizer L1={L1} L2={L2} W={W} p={config.p} h={config.h} steps={config.steps} topStepFlush={topStepFlush} exploded={exploded} showHandrail={showHandrail} showGuardrail={showGuardrail} />
      }
    />
  );
};

const SpiralCalc = ({ onBack, onNext }: any) => {
  const [H, setH] = useState(2800);
  const [D, setD] = useState(1500);
  const [tubeD, setTubeD] = useState(4); // 4 polegadas padrão
  const [topStepFlush, setTopStepFlush] = useState(false);
  const [direction, setDirection] = useState<'clockwise' | 'counter-clockwise'>('clockwise');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  
  const [startAngleIndex, setStartAngleIndex] = useState(0);
  const [landingQuadrant, setLandingQuadrant] = useState(0); // 0: TR, 1: TL, 2: BL, 3: BR
  const [manualSteps, setManualSteps] = useState<number | null>(null);
  const [showHandrail, setShowHandrail] = useState(false);
  const [showGuardrail, setShowGuardrail] = useState(false);
  const [isExploded, setIsExploded] = useState(false);

  const idealStepHeight = 180;
  const defaultSteps = Math.round(H / idealStepHeight);
  const totalSteps = manualSteps ?? defaultSteps;

  const stair = useMemo(() => generateSpiralStair(H, D, startAngleIndex, tubeD, direction, totalSteps), [H, D, startAngleIndex, tubeD, direction, totalSteps]);
  
  const steps = stair.quadrants.reduce((acc, q) => acc + q.steps.length, 0);
  const numRisers = topStepFlush ? steps : steps + 1;
  const h = H / numRisers;
  const p = stair.quadrants[0].steps[0]?.depth || 0;
  const numTreads = steps;
  const config = { steps, treads: numTreads, h, p, comfort: getSpiralComfort(h, D), blondel: 2 * h + p, topStepFlush };

  const stepsPerTurn = Math.max(12, Math.ceil(D / 100 / 4) * 4);
  const landingSteps = stepsPerTurn / 4; // 90 degrees landing

  let isValidConnection = false;
  if (direction === 'clockwise') {
    const expectedLandingStart = (startAngleIndex + totalSteps) % stepsPerTurn;
    const actualLandingStart = landingQuadrant * landingSteps;
    isValidConnection = expectedLandingStart === actualLandingStart;
  } else {
    const expectedLandingEnd = ((startAngleIndex - totalSteps + 1) % stepsPerTurn + stepsPerTurn) % stepsPerTurn;
    const actualLandingEnd = ((landingQuadrant + 1) * landingSteps) % stepsPerTurn;
    isValidConnection = expectedLandingEnd === actualLandingEnd;
  }

  const headroom = (stepsPerTurn * h) - 200;
  const headroomSafe = headroom >= 2000;

  const stepsUnderCeiling = [];
  for (let i = 1; i <= steps; i++) {
    const nextStepAbove = i + stepsPerTurn;
    if (nextStepAbove <= steps) {
      // Step is under another step
      stepsUnderCeiling.push({ step: i, headroom: (stepsPerTurn * h) - 200, isLanding: false });
    } else if (nextStepAbove <= steps + landingSteps) {
      // Step is under the landing
      stepsUnderCeiling.push({ step: i, headroom: H - (i * h) - 200, isLanding: true });
    }
  }

  const hasUnsafe = stepsUnderCeiling.some(s => s.headroom < 2000);

  return (
    <CalculatorLayout 
      title="Escada Caracol" onBack={onBack} config={config}
      salesKit={
        <WizardNextButton onNext={() => onNext({ steps: totalSteps, treads: totalSteps, h, p, blondel: 2*h+p }, { H, L: 0, W: D, D, L1: 0, L2: 0, landingL: 0, tubeD })} />
      }
      extraSection={
        <div className="space-y-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-4">Configuração do Patamar e Pé-direito</h2>
          
          {!isValidConnection && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-red-800">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <AlertTriangle size={20} />
                Conexão Inválida
              </h4>
              <p className="text-sm">
                A quantidade de degraus e o ângulo de início não se alinham com o patamar escolhido. 
                Ajuste o número de degraus, o ângulo de início ou a posição do patamar para que a escada se conecte corretamente.
              </p>
            </div>
          )}

          <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg mb-6">
            <h4 className="font-bold text-slate-700 mb-1">Patamar de Saída</h4>
            <p className="text-slate-600">O patamar de saída (90º) está posicionado após o <strong>{steps}º degrau</strong>, no nível superior.</p>
          </div>

          {stepsUnderCeiling.length > 0 && (
            <div className={`p-4 border rounded-lg text-sm font-medium ${hasUnsafe ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <AlertTriangle size={20} />
                {hasUnsafe ? 'Atenção: Risco de bater a cabeça em alguns degraus!' : 'Pé-direito livre nos degraus sobrepostos:'}
              </h4>
              
              <div className="mb-2 text-xs opacity-80">Degraus sob outros degraus:</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {stepsUnderCeiling.filter(s => !s.isLanding).map(({ step, headroom }) => (
                  <div key={step} className={`p-2 rounded border ${headroom < 2000 ? 'bg-red-100 border-red-200 text-red-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                    Degrau {step}: {headroom.toFixed(0)}mm
                  </div>
                ))}
                {stepsUnderCeiling.filter(s => !s.isLanding).length === 0 && (
                  <div className="col-span-full text-slate-500 italic">Nenhum degrau sob outro degrau.</div>
                )}
              </div>

              <div className="mb-2 text-xs opacity-80">Degraus sob o patamar de saída:</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stepsUnderCeiling.filter(s => s.isLanding).map(({ step, headroom }) => (
                  <div key={step} className={`p-2 rounded border ${headroom < 2000 ? 'bg-red-100 border-red-200 text-red-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                    Degrau {step}: {headroom.toFixed(0)}mm
                  </div>
                ))}
                {stepsUnderCeiling.filter(s => s.isLanding).length === 0 && (
                  <div className="col-span-full text-slate-500 italic">Nenhum degrau sob o patamar.</div>
                )}
              </div>
            </div>
          )}
        </div>
      }
      details={
        <div className="space-y-6">
          <SpiralPizzaVisualizer 
            stair={stair} 
            onDirectionChange={setDirection} 
            startAngleIndex={startAngleIndex}
            onStartAngleChange={setStartAngleIndex}
            landingQuadrant={landingQuadrant}
            onLandingQuadrantChange={setLandingQuadrant}
            isValidConnection={isValidConnection}
            tubeD={tubeD}
            D={D}
          />
        </div>
      }
      inputs={
        <>
          <TopStepToggle value={topStepFlush} onChange={setTopStepFlush} />
          <ColorLegend />
          <ThermometerSlider 
            label="Altura Total" 
            value={H} 
            min={1000} 
            max={5000} 
            onChange={(val: number) => { setH(val); setManualSteps(null); }} 
            gradient={getSpiralGradient('height', D, topStepFlush)} 
            unit="mm" 
            tooltip="Altura total do piso inferior ao piso superior. O termômetro indica se a altura é confortável para o diâmetro atual."
          />
          <ThermometerSlider 
            label="Diâmetro Externo" 
            value={D} 
            min={1100} 
            max={3000} 
            onChange={setD} 
            gradient={getSpiralGradient('diameter', H, topStepFlush)} 
            unit="mm" 
            tooltip="Diâmetro total da escada caracol. O termômetro indica se o diâmetro oferece uma pisada confortável na linha de trânsito."
          />
          <div className="mb-6 relative">
            <ThermometerSlider 
              label="Número de Degraus" 
              value={totalSteps} 
              min={Math.max(5, Math.floor(H / 300))} 
              max={Math.ceil(H / 100)} 
              step={1}
              onChange={(val: number) => setManualSteps(val)} 
              gradient="linear-gradient(to right, #e2e8f0, #94a3b8)" 
              unit="degraus" 
              tooltip="Número total de degraus. Altere para ajustar a altura de cada degrau (espelho)."
            />
            {manualSteps !== null && (
              <button 
                onClick={() => setManualSteps(null)}
                className="absolute top-0 right-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Resetar para ideal ({defaultSteps})
              </button>
            )}
          </div>
          <div className="mb-8">
            <label className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
              Diâmetro do Tubo Central (pol)
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[3, 4, 5].map((size) => (
                <button 
                  key={size}
                  onClick={() => setTubeD(size)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${tubeD === size ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {size}"
                </button>
              ))}
            </div>
          </div>
          <div className="mb-8 space-y-3">
            <label className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
              <span className="font-semibold text-slate-700">Incluir Corrimão</span>
              <input type="checkbox" checked={showHandrail} onChange={(e) => setShowHandrail(e.target.checked)} className="w-5 h-5 text-blue-600" />
            </label>
            <label className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
              <span className="font-semibold text-slate-700">Incluir Guarda-corpo no Patamar</span>
              <input type="checkbox" checked={showGuardrail} onChange={(e) => setShowGuardrail(e.target.checked)} className="w-5 h-5 text-blue-600" />
            </label>
          </div>
        </>
      }
      headerActions={
        <div className="flex items-center gap-3 print:hidden">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Modo:</span>
          <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('2d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <ImageIcon size={16} /> 2D
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
            >
              <BoxIcon size={16} /> 3D
            </button>
          </div>
          {viewMode === '3d' && (
            <>
              <button
                onClick={() => setShowHandrail(!showHandrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showHandrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showHandrail ? 'Ocultar Corrimão' : 'Mostrar Corrimão'}
              >
                {showHandrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Corrimão
              </button>
              <button
                onClick={() => setShowGuardrail(!showGuardrail)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${showGuardrail ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={showGuardrail ? 'Ocultar Guarda-corpo' : 'Mostrar Guarda-corpo'}
              >
                {showGuardrail ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />} Guarda-corpo
              </button>
              <button
                onClick={() => setIsExploded(!isExploded)}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all border ${isExploded ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <LayersIcon size={16} /> {isExploded ? 'Montar' : 'Explodir'}
              </button>
            </>
          )}
        </div>
      }
      visualizer={
        viewMode === '2d' ? (
          <Spiral2DVisualizer 
            stair={stair} 
            startAngleIndex={startAngleIndex} 
            onStartAngleChange={setStartAngleIndex}
            landingQuadrant={landingQuadrant}
            isValidConnection={isValidConnection}
            D={D}
            interactive={true}
          />
        ) : (
          <Spiral3DVisualizer steps={steps} h={h} H={H} D={D} topStepFlush={topStepFlush} stair={stair} tubeD={tubeD} landingQuadrant={landingQuadrant} isValidConnection={isValidConnection} showHandrail={showHandrail} showGuardrail={showGuardrail} isExploded={isExploded} setIsExploded={setIsExploded} />
        )
      }
    />
  );
};

// ============================================================
// MAIN APP — WIZARD DE COMPRA
// ============================================================

export default function App() {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [stairType, setStairType] = useState<StairType | null>(null);
  const [savedConfig, setSavedConfig] = useState<any>(null);
  const [savedDims, setSavedDims] = useState<any>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectType = (type: StairType) => {
    setStairType(type);
    setWizardStep(2);
  };

  const handleConfigDone = (config: any, dims: any) => {
    setSavedConfig(config);
    setSavedDims(dims);
    setWizardStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLeadSubmit = async (data: LeadData) => {
    setIsSubmitting(true);
    try {
      await fetch(`${SITE_URL}/wp-json/cds/v1/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          tipo: stairType,
          config: JSON.stringify(savedConfig),
          dims: JSON.stringify(savedDims),
          valor: calcPrice(),
        }),
      });
    } catch (_) { /* silently continue */ }
    setLeadData(data);
    setIsSubmitting(false);
    setWizardStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calcPrice = () => {
    if (!savedConfig || !savedDims || !stairType) return 0;
    let w = 0;
    if (stairType === 'straight') w = calcWeightStraight(savedDims.H, savedDims.L, savedDims.W, savedConfig.treads || savedConfig.steps, savedConfig.h, savedConfig.p);
    else if (stairType === 'landing') w = calcWeightLanding(savedDims.H, savedDims.L, savedDims.W, savedDims.landingL || 1000, savedConfig.treads || savedConfig.steps, savedConfig.h, savedConfig.p);
    else if (stairType === 'lshape') w = calcWeightLShape(savedDims.H, savedDims.L1, savedDims.L2, savedDims.W, savedConfig.treads || savedConfig.steps, savedConfig.h, savedConfig.p);
    else if (stairType === 'spiral') w = calcWeightSpiral(savedDims.H, savedDims.D, savedConfig.steps, savedDims.tubeD || 4);
    return w * PRECO_POR_KG;
  };

  const price = useMemo(calcPrice, [savedConfig, savedDims, stairType]);

  const options = [
    { id: 'straight' as StairType, title: 'Escada Reta', desc: 'Um único lance contínuo, sem patamar.', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'hover:border-blue-500' },
    { id: 'landing' as StairType, title: 'Com Patamar', desc: 'Escada reta com um patamar de descanso.', icon: SplitSquareHorizontal, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'hover:border-emerald-500' },
    { id: 'lshape' as StairType, title: 'Em L ou U', desc: 'Dois lances com patamar em canto.', icon: CornerUpRight, color: 'text-violet-600', bg: 'bg-violet-50', border: 'hover:border-violet-500' },
    { id: 'spiral' as StairType, title: 'Caracol', desc: 'Escada circular com eixo central.', icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-50', border: 'hover:border-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Progress bar (visible steps 2-4) */}
      {wizardStep > 1 && <WizardProgressBar step={wizardStep} />}

      {/* ---- PASSO 1: Escolha o Modelo ---- */}
      {wizardStep === 1 && (
        <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-screen">
          <div className="max-w-4xl w-full">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center p-4 bg-blue-600 text-white rounded-2xl mb-5 shadow-lg shadow-blue-600/20">
                <Calculator size={40} />
              </div>
              <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Calculadora de Escadas</h1>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">Selecione o modelo e calcule sua escada sob medida em minutos.</p>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" /> Visualização 3D</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" /> Cálculo automático</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" /> Preço instantâneo</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectType(opt.id)}
                  className={`group bg-white p-7 rounded-3xl border-2 border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl ${opt.border} text-left flex items-start gap-5`}
                >
                  <div className={`p-4 rounded-2xl ${opt.bg} ${opt.color} transition-transform group-hover:scale-110 flex-shrink-0`}>
                    <opt.icon size={30} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">{opt.title}</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-8">
              CDS Industrial · Fabricação de Escadas em Aço · <a href="https://cdsind.com.br" className="hover:text-blue-600 transition-colors">cdsind.com.br</a>
            </p>
          </div>
        </div>
      )}

      {/* ---- PASSO 2: Medidas + Visualização ---- */}
      {wizardStep === 2 && stairType && (
        <div className="p-4 md:p-8">
          {stairType === 'straight' && (
            <StraightCalc onBack={() => setWizardStep(1)} onNext={handleConfigDone} />
          )}
          {stairType === 'landing' && (
            <LandingCalc onBack={() => setWizardStep(1)} onNext={handleConfigDone} />
          )}
          {stairType === 'lshape' && (
            <LShapeCalc onBack={() => setWizardStep(1)} onNext={handleConfigDone} />
          )}
          {stairType === 'spiral' && (
            <SpiralCalc onBack={() => setWizardStep(1)} onNext={handleConfigDone} />
          )}
        </div>
      )}

      {/* ---- PASSO 3: Dados do Cliente ---- */}
      {wizardStep === 3 && (
        <StepDados
          onBack={() => setWizardStep(2)}
          onSubmit={handleLeadSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ---- PASSO 4: Orçamento + Carrinho ---- */}
      {wizardStep === 4 && savedConfig && leadData && (
        <StepOrcamento
          stairType={stairType!}
          price={price}
          leadData={leadData}
          savedDims={savedDims}
          savedConfig={savedConfig}
          onBack={() => setWizardStep(3)}
          onRestart={() => {
            setWizardStep(1);
            setStairType(null);
            setSavedConfig(null);
            setSavedDims(null);
            setLeadData(null);
          }}
        />
      )}
    </div>
  );
}
