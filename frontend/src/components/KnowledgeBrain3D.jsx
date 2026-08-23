import React, { useEffect, useRef } from 'react';

export default function KnowledgeBrain3D({ userStats, className = "" }) {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Calculate dynamics based on user level
  const level = userStats?.level || 1;
  const isHighMastery = level >= 10;
  const isMedMastery = level >= 4;

  const baseSpeed = isHighMastery ? 0.015 : (isMedMastery ? 0.009 : 0.004);
  const nodeColor = isHighMastery ? '#10b981' : (isMedMastery ? '#0ea5e9' : '#64748b');
  const edgeColor = isHighMastery ? '6, 182, 212' : (isMedMastery ? '56, 189, 248' : '100, 116, 139');
  const glowBlur = isHighMastery ? 15 : (isMedMastery ? 8 : 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let autoRotX = 0;
    let autoRotY = 0;

    // Abstract Synapse Node Network (Icosahedron base)
    const phi = (1 + Math.sqrt(5)) / 2;
    const baseVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ];

    const edges = [
      [0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[1,7],[1,8],[1,9],
      [2,11],[2,10],[2,6],[2,4],[2,3],[3,8],[3,9],[3,4],[3,6],
      [4,5],[4,9],[4,11],[4,2],[5,9],[5,11],[6,7],[6,8],[6,10],
      [7,8],[7,10],[8,9],[10,11]
    ];

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / (rect.width || 1) - 0.5;
      const y = (e.clientY - rect.top) / (rect.height || 1) - 0.5;
      mouse.current.targetX = x * 2.0;
      mouse.current.targetY = y * 2.0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = Math.min(cx, cy) * 0.6;

      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.08;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.08;

      autoRotX += baseSpeed * 0.7;
      autoRotY += baseSpeed;

      const totalRotX = autoRotX + mouse.current.y;
      const totalRotY = autoRotY + mouse.current.x;

      const cosX = Math.cos(totalRotX);
      const sinX = Math.sin(totalRotX);
      const cosY = Math.cos(totalRotY);
      const sinY = Math.sin(totalRotY);

      const projected = baseVertices.map(([x, y, z]) => {
        let x1 = x * cosY + z * sinY;
        let y1 = y;
        let z1 = -x * sinY + z * cosY;

        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        const distance = 4.0;
        const fov = 1 / (distance - z2 * 0.4);
        return {
          x: cx + x2 * scale * fov,
          y: cy + y2 * scale * fov,
          depth: z2
        };
      });

      // Draw Edges
      edges.forEach(([i, j]) => {
        const p1 = projected[i];
        const p2 = projected[j];
        const avgDepth = (p1.depth + p2.depth) / 2;
        const alpha = Math.max(0.1, Math.min(0.9, (avgDepth + 2) / 4));

        ctx.strokeStyle = `rgba(${edgeColor}, ${alpha})`;
        ctx.lineWidth = isHighMastery ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw Nodes
      projected.forEach(p => {
        const radius = Math.max(1.5, (isHighMastery ? 4 : 2.5) + p.depth * 0.8);
        ctx.fillStyle = nodeColor;
        ctx.shadowColor = `rgba(${edgeColor}, 1)`;
        ctx.shadowBlur = glowBlur;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; 
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [baseSpeed, nodeColor, edgeColor, glowBlur]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {isHighMastery && <div className="absolute w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />}
      <canvas
        ref={canvasRef}
        width={340}
        height={340}
        className="w-full max-w-[340px] h-auto cursor-grab active:cursor-grabbing transition-all duration-700"
      />
    </div>
  );
}
