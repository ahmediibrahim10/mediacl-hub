// src/components/Interactive3D.jsx
import React, { useEffect, useRef } from 'react';

/**
 * Interactive 3D Medical Icosahedron / DNA Core.
 * Responds dynamically to mouse coordinates with tilt & parallax,
 * smooth inertia physics, glowing cyan edges, and emerald nodes.
 */
export default function Interactive3D({ className = "" }) {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let autoRotX = 0;
    let autoRotY = 0;

    // 12 Vertices of Golden-ratio Icosahedron
    const phi = (1 + Math.sqrt(5)) / 2;
    const baseVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ];

    // Connectivity Edges
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

    // Handle mouse movement for interactive parallax
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / (rect.width || 1) - 0.5;
      const y = (e.clientY - rect.top) / (rect.height || 1) - 0.5;
      mouse.current.targetX = x * 1.5;
      mouse.current.targetY = y * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = Math.min(cx, cy) * 0.58;

      // Smooth inertia towards mouse
      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.06;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.06;

      autoRotX += 0.007;
      autoRotY += 0.01;

      const totalRotX = autoRotX + mouse.current.y;
      const totalRotY = autoRotY + mouse.current.x;

      const cosX = Math.cos(totalRotX);
      const sinX = Math.sin(totalRotX);
      const cosY = Math.cos(totalRotY);
      const sinY = Math.sin(totalRotY);

      // Project vertices with perspective
      const projected = baseVertices.map(([x, y, z]) => {
        let x1 = x * cosY + z * sinY;
        let y1 = y;
        let z1 = -x * sinY + z * cosY;

        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        const distance = 3.6;
        const fov = 1 / (distance - z2 * 0.4);
        return {
          x: cx + x2 * scale * fov,
          y: cy + y2 * scale * fov,
          depth: z2
        };
      });

      // Draw Edges with glowing cyan gradient effect
      edges.forEach(([i, j]) => {
        const p1 = projected[i];
        const p2 = projected[j];
        const avgDepth = (p1.depth + p2.depth) / 2;
        const alpha = Math.max(0.15, Math.min(0.9, (avgDepth + 2) / 4));

        ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw glowing nodes
      projected.forEach(p => {
        const radius = Math.max(2.5, 4 + p.depth * 0.8);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Ambient background glow */}
      <div className="absolute w-44 h-44 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={320}
        height={280}
        className="w-full max-w-[320px] h-auto cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}
