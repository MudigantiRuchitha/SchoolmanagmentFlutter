const fs = require('fs');
const PDFDocument = require('pdfkit');

const COLORS = {
  ink: '#202a2a',
  muted: '#5d6968',
  accent: '#176b59',
  rule: '#d7dfdd',
  header: '#eaf2ef'
};

function writePdf(filePath, render) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 38, right: 36, bottom: 38, left: 36 },
      bufferPages: true,
      info: { Title: 'Attendance Report', Author: 'School Management' }
    });
    const output = fs.createWriteStream(filePath);
    document.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
    document.pipe(output);

    try {
      render(document);
      document.end();
    } catch (error) {
      document.destroy(error);
      reject(error);
    }
  });
}

function addHeading(document, reportTitle, staff, periodLabel) {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  document.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.accent)
    .text(reportTitle, left, document.y, { width });
  document.moveDown(0.35);
  document.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink)
    .text(staff.org_name || 'Organization', { width });

  const organizationDetails = [staff.org_address, staff.org_phone, staff.org_email]
    .filter(Boolean)
    .join(' | ');
  if (organizationDetails) {
    document.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(organizationDetails, { width });
  }

  document.moveDown(0.65);
  document.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
    .text(`Teacher: ${staff.full_name || 'Unknown'} | Staff ID: ${staff.staff_id || staff.id}`, { width });
  const role = [staff.designation, staff.role_type].filter(Boolean).join(' | ');
  if (role) document.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(role, { width });
  document.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
    .text(periodLabel, { width });
  document.moveDown(0.75);
}

function addSummary(document, summary) {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const values = [
    ['Present', summary.present],
    ['Absent', summary.absent],
    ['Working days', summary.workingDays],
    ['Leave', summary.leaves],
    ['Holiday', summary.holidays],
    ['Weekly off', summary.weeklyOff],
    ['Attendance', `${summary.percentage}%`]
  ];
  const cellWidth = width / values.length;
  const y = document.y;

  values.forEach(([label, value], index) => {
    const x = left + index * cellWidth;
    document.rect(x, y, cellWidth, 40).fill(COLORS.header);
    document.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
      .text(label, x + 5, y + 6, { width: cellWidth - 10, align: 'center' });
    document.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink)
      .text(String(value), x + 5, y + 20, { width: cellWidth - 10, align: 'center' });
  });
  document.y = y + 50;
}

function drawTableHeader(document, columns) {
  const left = document.page.margins.left;
  const width = columns.reduce((total, column) => total + column.width, 0);
  const y = document.y;
  document.rect(left, y, width, 22).fill(COLORS.header);
  let x = left;
  columns.forEach(column => {
    document.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink)
      .text(column.label, x + 4, y + 6, { width: column.width - 8, lineBreak: false });
    x += column.width;
  });
  document.y = y + 22;
}

function drawTableRow(document, columns, values) {
  const left = document.page.margins.left;
  const widths = columns.map(column => column.width);
  document.font('Helvetica').fontSize(8);
  const heights = values.map((value, index) => document.heightOfString(String(value || '-'), {
    width: widths[index] - 8,
    font: 'Helvetica',
    size: 8,
    lineGap: 1
  }));
  const rowHeight = Math.max(20, ...heights) + 8;
  const bottom = document.page.height - document.page.margins.bottom;
  if (document.y + rowHeight > bottom) return false;

  const y = document.y;
  document.moveTo(left, y + rowHeight).lineTo(left + widths.reduce((sum, item) => sum + item, 0), y + rowHeight)
    .strokeColor(COLORS.rule).lineWidth(0.5).stroke();
  let x = left;
  values.forEach((value, index) => {
    document.font('Helvetica').fontSize(8).fillColor(COLORS.ink)
      .text(String(value || '-'), x + 4, y + 4, { width: widths[index] - 8, lineGap: 1 });
    x += widths[index];
  });
  document.y = y + rowHeight;
  return true;
}

function addFooter(document) {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    const y = document.page.height - 26;
    document.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`, document.page.margins.left, y);
    document.text(`Page ${index + 1} of ${range.count}`, document.page.width - 110, y, {
      width: 74,
      align: 'right'
    });
  }
}

async function generateMonthlyAttendancePdf(filePath, report) {
  await writePdf(filePath, document => {
    const columns = [
      { label: 'Date', width: 55 },
      { label: 'Day', width: 58 },
      { label: 'Status', width: 68 },
      { label: 'Punch-in / punch-out records', width: 225 },
      { label: 'Working duration', width: 117 }
    ];
    const drawHeader = () => drawTableHeader(document, columns);

    addHeading(document, 'Monthly Attendance Report', report.staff, report.periodLabel);
    addSummary(document, report.summary);
    document.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
      .text('Daily attendance and punches');
    document.moveDown(0.4);
    drawHeader();

    report.days.forEach(day => {
      const values = [day.date, day.weekDay, day.status, day.punchesText, day.workingDuration];
      if (!drawTableRow(document, columns, values)) {
        document.addPage();
        drawHeader();
        drawTableRow(document, columns, values);
      }
    });
    addFooter(document);
  });
}

async function generateDailyAttendancePdf(filePath, report) {
  await writePdf(filePath, document => {
    const columns = [
      { label: '#', width: 38 },
      { label: 'Punch type', width: 105 },
      { label: 'Punch time', width: 145 },
      { label: 'Working duration', width: 235 }
    ];
    const drawHeader = () => drawTableHeader(document, columns);

    addHeading(document, 'Daily Attendance Report', report.staff, report.periodLabel);
    document.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink)
      .text(`Attendance status: ${report.day.status}`);
    document.moveDown(0.4);
    document.font('Helvetica').fontSize(9).fillColor(COLORS.ink)
      .text(`First punch-in: ${report.firstIn || 'Not recorded'}`)
      .text(`Last punch-out: ${report.lastOut || 'Not recorded'}`)
      .text(`Total working duration: ${report.workingDuration}`);
    document.moveDown(0.8);
    document.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
      .text('Punch details');
    document.moveDown(0.4);
    drawHeader();

    const punches = report.punches.length ? report.punches : [];
    if (!punches.length) {
      drawTableRow(document, columns, ['', 'No punch recorded', '', report.workingDuration]);
    }
    punches.forEach((punch, index) => {
      const values = [index + 1, punch.type, punch.time, punch.duration || '-'];
      if (!drawTableRow(document, columns, values)) {
        document.addPage();
        drawHeader();
        drawTableRow(document, columns, values);
      }
    });
    addFooter(document);
  });
}

module.exports = { generateMonthlyAttendancePdf, generateDailyAttendancePdf };