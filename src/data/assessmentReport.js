const REPORT_WIDTH = 1200;
const REPORT_PADDING = 48;
const REPORT_CONTENT_WIDTH = REPORT_WIDTH - REPORT_PADDING * 2;
const REPORT_FONT = '"Segoe UI", Arial, sans-serif';

export function buildAssessmentReportLayout(session, stats, duration) {
  const total = stats.total || 0;
  return {
    title: `${session.levelId} · ${session.moduleTitle}`,
    date: new Date(session.finishedAt).toLocaleString('en-GB'),
    duration,
    reviewed: total,
    accuracy: stats.accuracy,
    distribution: {
      correct: total ? stats.correct / total : 0,
      incorrect: total ? stats.incorrect / total : 0,
      skipped: total ? stats.skipped / total : 0,
    },
  };
}

function roundedRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawText(context, text, x, y, size, color, weight = 400) {
  context.font = `${weight} ${size}px ${REPORT_FONT}`;
  context.fillStyle = color;
  context.fillText(String(text), x, y);
}

export async function createAssessmentReportBlob(session, stats, duration) {
  if (document.fonts?.ready) await document.fonts.ready;

  const report = buildAssessmentReportLayout(session, stats, duration);
  const canvas = document.createElement('canvas');
  canvas.width = REPORT_WIDTH;
  canvas.height = 520;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser cannot create an image report.');

  context.fillStyle = '#0b0912';
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 20, 20, canvas.width - 40, canvas.height - 40, 30, '#12101d', '#49366f');

  drawText(context, 'A-WORD  ·  SESSION REPORT', REPORT_PADDING, 84, 18, '#bba0ff', 700);
  drawText(context, report.title, REPORT_PADDING, 142, 36, '#f5f1ff', 700);
  drawText(context, `${report.date}  ·  Duration: ${report.duration}`, REPORT_PADDING, 180, 18, '#b8b0ca');

  const cardGap = 20;
  const cardWidth = (REPORT_CONTENT_WIDTH - cardGap) / 2;
  const cards = [
    { label: 'WORDS REVIEWED', value: report.reviewed },
    { label: 'ACCURACY', value: `${report.accuracy}%` },
  ];
  cards.forEach((card, index) => {
    const x = REPORT_PADDING + index * (cardWidth + cardGap);
    roundedRect(context, x, 218, cardWidth, 118, 20, '#1a1824', '#49366f');
    drawText(context, card.label, x + 24, 258, 15, '#aaa2b9');
    drawText(context, card.value, x + 24, 310, 36, '#f5f1ff', 700);
  });

  drawText(context, 'RESULT DISTRIBUTION', REPORT_PADDING, 382, 16, '#aaa2b9', 600);
  const chartY = 402;
  const chartHeight = 16;
  const correctWidth = REPORT_CONTENT_WIDTH * report.distribution.correct;
  const incorrectWidth = REPORT_CONTENT_WIDTH * report.distribution.incorrect;
  const skippedWidth = REPORT_CONTENT_WIDTH * report.distribution.skipped;
  roundedRect(context, REPORT_PADDING, chartY, REPORT_CONTENT_WIDTH, chartHeight, 8, '#302d39');
  if (correctWidth > 0) {
    context.fillStyle = '#718f78';
    context.fillRect(REPORT_PADDING, chartY, correctWidth, chartHeight);
  }
  if (incorrectWidth > 0) {
    context.fillStyle = '#9b6870';
    context.fillRect(REPORT_PADDING + correctWidth, chartY, incorrectWidth, chartHeight);
  }
  if (skippedWidth > 0) {
    context.fillStyle = '#45414e';
    context.fillRect(REPORT_PADDING + correctWidth + incorrectWidth, chartY, skippedWidth, chartHeight);
  }

  const legendY = 458;
  [
    { label: 'Correct', color: '#91b899', x: REPORT_PADDING },
    { label: 'Wrong', color: '#d58a93', x: REPORT_PADDING + 190 },
    { label: 'Skipped', color: '#aaa2b9', x: REPORT_PADDING + 355 },
  ].forEach((item) => {
    context.beginPath();
    context.arc(item.x + 7, legendY - 5, 6, 0, Math.PI * 2);
    context.fillStyle = item.color;
    context.fill();
    drawText(context, item.label, item.x + 22, legendY, 16, '#c6bdd2');
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not render the PNG report.'));
    }, 'image/png');
  });
}

export async function downloadAssessmentReport(session, stats, duration) {
  const png = await createAssessmentReportBlob(session, stats, duration);
  const downloadUrl = URL.createObjectURL(png);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `a-word-${session.levelId}-${Date.now()}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export async function copyAssessmentReport(session, stats, duration) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image copying is not supported in this browser. Download the PNG instead.');
  }

  const png = await createAssessmentReportBlob(session, stats, duration);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
