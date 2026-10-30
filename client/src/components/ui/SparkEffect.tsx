import React from 'react';

/**
 * Reusable, High-Performance Geometric Spark Interaction
 * Spawns lightweight geometric particles (diamonds, circles, stars) on meaningful actions.
 * Zero layout thrashing, non-blocking pointer events, automatic self-cleanup.
 */

export type SparkColor = 'azure' | 'crimson' | 'mint' | 'gold' | 'white';

const SPARK_PALETTES: Record<SparkColor, string[]> = {
  azure: ['#0EA5E9', '#38BDF8', '#7DD3FC', '#F8FAFC'],
  crimson: ['#F43F5E', '#FB7185', '#FDA4AF', '#F8FAFC'],
  mint: ['#10B981', '#34D399', '#6EE7B7', '#F8FAFC'],
  gold: ['#F59E0B', '#FBBF24', '#FDE68A', '#F8FAFC'],
  white: ['#FFFFFF', '#E2E8F0', '#38BDF8', '#94A3B8'],
};

export const triggerSparks = (
  e: React.MouseEvent | MouseEvent | { clientX: number; clientY: number },
  color: SparkColor = 'azure',
  particleCount = 10
) => {
  if (typeof window === 'undefined') return;

  const clientX = 'clientX' in e ? e.clientX : 0;
  const clientY = 'clientY' in e ? e.clientY : 0;

  if (clientX === 0 && clientY === 0) return;

  const colors = SPARK_PALETTES[color] || SPARK_PALETTES.azure;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const distance = 24 + Math.random() * 38;
    const size = 3 + Math.random() * 4;
    const isDiamond = i % 2 === 0;
    const particleColor = colors[Math.floor(Math.random() * colors.length)];

    particle.style.position = 'fixed';
    particle.style.left = `${clientX}px`;
    particle.style.top = `${clientY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = particleColor;
    particle.style.borderRadius = isDiamond ? '1px' : '50%';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '99999';
    particle.style.transform = `translate(-50%, -50%) rotate(${isDiamond ? 45 : 0}deg)`;
    particle.style.boxShadow = `0 0 6px ${particleColor}`;
    particle.style.willChange = 'transform, opacity';
    particle.style.transition = 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), opacity 480ms ease-out';

    document.body.appendChild(particle);

    // Trigger animation in next frame
    requestAnimationFrame(() => {
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;
      particle.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(0.2) rotate(${isDiamond ? 135 : 0}deg)`;
      particle.style.opacity = '0';
    });

    // Clean up
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 520);
  }
};

export default triggerSparks;
