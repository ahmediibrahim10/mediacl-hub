// src/components/Interactive3DCanvas.jsx
import React, { useEffect, useRef } from 'react';

/**
 * Pure HTML5 Canvas 3D rotating icosahedron/wireframe.
 * Zero external dependencies (no Drei/R3F conflicts).
 */
export default function Interactive3DCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let angleX = 0;
    let angleY = 0;

    // Golden ratio for icosahedron vertices
    const phi = (1 + Math.sqrt(5)) / 2;
    const vertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ];

    const edges = [
      [0,11],[0,5],[0,1],[0,7],[0,10],
      [1,5],[1,7],[1,8],[1,9],
      [2,11],[2,10],[2,6],[2,4],[2,3],
      [3,8],[3,9],[3,4],[3,6],
      [4,5],[4,9],[4,11],[4,2],
      [5,9],[5,11],
      [6,7],[6,8],[6,10],
      [7,8],[7,10],
      [8,9],
      [10,11]
    ];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = Math.min(cx, cy) * 0.55;

      angleX += 0.008;
      angleY += 0.012;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      // Project vertices
      const projected = vertices.map(([x, y, z]) => {
        // Rotate Y
        let x1 = x * cosY + z * sinY;
        let y1 = y;
        let z1 = -x * sinY + z * cosY;

        // Rotate X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Perspective
        const distance = 3.5;
        const fov = 1 / (distance - z2 * 0.4);
        return {
          x: cx + x2 * scale * fov,
          y: cy + y2 * scale * fov
        };
      });

      // Draw edges
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.6)';
      ctx.lineWidth = 1.5;
      edges.forEach(([i, j]) => {
        const p1 = projected[i];
        const p2 = projected[j];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw vertices
      ctx.fillStyle = '#0d9488';
      projected.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full flex items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={260}
        className="w-full max-w-[300px] h-auto pointer-events-none"
      />
    </div>
  );
}
