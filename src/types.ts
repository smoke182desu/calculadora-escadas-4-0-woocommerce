export interface SpiralStep {
  angle: number;
  height: number;
  depth: number;
}

export interface SpiralQuadrant {
  steps: SpiralStep[];
}

export interface SpiralStair {
  quadrants: SpiralQuadrant[];
  direction: 'clockwise' | 'counter-clockwise';
}
