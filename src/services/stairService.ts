import { SpiralStair, SpiralQuadrant } from '../types';

export const generateSpiralStair = (
  H: number,
  D: number,
  startAngleIndex: number,
  tubeD: number,
  direction: 'clockwise' | 'counter-clockwise' = 'clockwise',
  totalStepsOverride?: number
): SpiralStair => {
  // 1. Enforce minimum diameter
  const diameter = Math.max(1100, D);
  
  // 2. Calculate steps per turn based on diameter, ensure it's a multiple of 4
  const stepsPerTurn = Math.max(12, Math.ceil(diameter / 100 / 4) * 4);
  const stepsPerQuadrant = stepsPerTurn / 4;
  
  // 3. Calculate total steps based on height for comfort (approx 180mm per step)
  const idealStepHeight = 180;
  const totalSteps = totalStepsOverride ?? Math.round(H / idealStepHeight);
  const h = H / totalSteps;
  
  const maxSteps = totalSteps;
  
  const R = diameter / 2;
  const tubeR = (tubeD * 25.4) / 2; // Convert inches to mm
  const lineOfTravelR = tubeR + (R - tubeR) * 0.6;
  const circumference = 2 * Math.PI * lineOfTravelR;
  const p = circumference / stepsPerTurn;

  // Calculate number of quadrants needed
  const numQuadrants = Math.ceil(maxSteps / stepsPerQuadrant);
  const quadrants: SpiralQuadrant[] = Array.from({ length: numQuadrants }, () => ({ steps: [] }));

  const angleStep = 360 / stepsPerTurn;
  
  let firstStepAngle: number;
  if (direction === 'clockwise') {
    firstStepAngle = startAngleIndex * angleStep;
  } else {
    firstStepAngle = startAngleIndex * angleStep;
  }

  // 6. Generate steps
  for (let i = 0; i < maxSteps; i++) {
    const quadrantIndex = Math.floor(i / stepsPerQuadrant);
    
    let angle: number;
    if (direction === 'clockwise') {
      angle = firstStepAngle + i * angleStep;
    } else {
      angle = firstStepAngle - i * angleStep;
    }

    quadrants[quadrantIndex].steps.push({
      angle: angle,
      height: h,
      depth: p,
    });
  }

  return { quadrants, direction };
};
