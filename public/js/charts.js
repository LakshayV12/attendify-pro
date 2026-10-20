/**
 * High-Performance Vanilla Canvas Charts for Attendify Pro
 * Zero-dependency, responsive, retina-sharp, dark/light theme aware
 */
(function(window) {
  const ChartEngine = {};

  // Helper to get high-DPI canvas context
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.parentElement.clientWidth || 400;
    const height = rect.height || 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, width, height, dpr };
  }

  /**
   * Render Attendance Trend Area Line Chart
   */
  ChartEngine.renderTrendChart = function(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length === 0) return;

    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 25, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // Draw horizontal grid lines & Y labels (0% to 100%)
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const ySteps = [0, 25, 50, 75, 100];
    for (const val of ySteps) {
      const y = padding.top + chartH - (val / 100) * chartH;
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(`${val}%`, padding.left - 8, y);
    }

    // 75% target warning benchmark dashed line
    const y75 = padding.top + chartH - (75 / 100) * chartH;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, y75);
    ctx.lineTo(width - padding.right, y75);
    ctx.stroke();
    ctx.restore();

    // Map points
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartW;
      const rate = Math.min(100, Math.max(0, d.rate || 0));
      const y = padding.top + chartH - (rate / 100) * chartH;
      return { x, y, ...d };
    });

    if (points.length < 2) return;

    // Gradient fill beneath line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      // Smooth cubic bezier curves
      const prev = points[i - 1];
      const curr = points[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, curr.x, curr.y);
    }
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.lineTo(points[0].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw main smooth line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, curr.x, curr.y);
    }
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw points and X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    points.forEach((p, idx) => {
      // Outer glow/stroke
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Show X labels at selected intervals (e.g. every other or first/middle/last)
      if (points.length <= 7 || idx % Math.ceil(points.length / 7) === 0 || idx === points.length - 1) {
        const parts = p.date.split('-');
        const dateLabel = parts.length === 3 ? `${parts[1]}/${parts[2]}` : p.date;
        ctx.fillStyle = textColor;
        ctx.fillText(dateLabel, p.x, height - padding.bottom + 8);
      }
    });
  };

  /**
   * Render Doughnut Chart for Today's Distribution
   */
  ChartEngine.renderDoughnutChart = function(canvasId, stats) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !stats) return;

    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const segments = [
      { label: 'Present', value: stats.present || 0, color: '#10b981' },
      { label: 'Late', value: stats.late || 0, color: '#f59e0b' },
      { label: 'Absent', value: stats.absent || 0, color: '#f43f5e' },
      { label: 'Excused', value: stats.excused || 0, color: '#0ea5e9' },
      { label: 'Unmarked', value: stats.unmarked || 0, color: 'rgba(148, 163, 184, 0.25)' }
    ];

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(centerX, centerY) - 12;
    const innerRadius = outerRadius * 0.68;

    if (total === 0) {
      // Draw empty circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;

    for (const seg of segments) {
      if (seg.value === 0) continue;
      const sliceAngle = (seg.value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      startAngle = endAngle;
    }

    // Center percentage label
    const isDark = document.body.classList.contains('dark-theme');
    const markedTotal = (stats.present || 0) + (stats.late || 0) + (stats.absent || 0) + (stats.excused || 0);
    const rate = markedTotal > 0 
      ? Math.round((((stats.present || 0) + (stats.late || 0) * 0.5) / markedTotal) * 100) 
      : 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${rate}%`, centerX, centerY - 8);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Attendance', centerX, centerY + 12);
  };

  /**
   * Render Horizontal Bar Chart for Class Comparison
   */
  ChartEngine.renderClassComparisonBarChart = function(canvasId, classList) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !classList || classList.length === 0) return;

    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const subColor = isDark ? '#94a3b8' : '#64748b';

    const barHeight = 24;
    const spacing = 18;
    const startY = 16;
    const leftMargin = 120;
    const rightMargin = 55;
    const maxBarWidth = width - leftMargin - rightMargin;

    classList.forEach((c, i) => {
      const y = startY + i * (barHeight + spacing);
      if (y + barHeight > height) return;

      // Class Name Label
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const cleanName = c.name.length > 15 ? c.name.substring(0, 14) + '…' : c.name;
      ctx.fillText(cleanName, leftMargin - 12, y + barHeight / 2);

      // Background Track
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
      roundRect(ctx, leftMargin, y, maxBarWidth, barHeight, 6);
      ctx.fill();

      // Filled Bar
      const rate = Math.min(100, Math.max(0, c.rate || 0));
      const fillW = (rate / 100) * maxBarWidth;

      let barColor = '#10b981'; // Green
      if (rate < 75) barColor = '#f43f5e'; // Red alert
      else if (rate < 85) barColor = '#f59e0b'; // Amber

      if (fillW > 0) {
        ctx.fillStyle = barColor;
        roundRect(ctx, leftMargin, y, fillW, barHeight, 6);
        ctx.fill();
      }

      // Percentage Text
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.fillText(`${rate}%`, leftMargin + maxBarWidth + 10, y + barHeight / 2);
    });
  };

  // Helper for rounded rectangles
  function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  window.ChartEngine = ChartEngine;
})(window);
