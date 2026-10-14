/**
 * Universal CSV Export & Download Utility
 * 
 * Works reliably across Desktop browsers (Chrome, Edge, Firefox, Safari)
 * and Mobile browsers (Android Chrome, iOS Safari) by using Blob + URL.createObjectURL
 * and proper UTF-8 BOM encoding for Excel/Sheets compatibility.
 */

/**
 * Escapes a cell value conforming to RFC 4180
 * @param {any} val
 * @returns {string}
 */
export function escapeCSVCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).trim();
  // Double any existing internal double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Downloads a CSV file with given filename, headers, and row data
 * @param {string} filename - Desired download filename (e.g. 'students_list.csv')
 * @param {string[]} headers - Array of column header names
 * @param {Array<Array<any>>} rows - 2D array of rows and values
 */
export function downloadCSV(filename, headers, rows) {
  try {
    if (!headers || !headers.length) {
      console.warn('downloadCSV: No headers provided');
      return;
    }

    const headerLine = headers.map(escapeCSVCell).join(',');
    const dataLines = (rows || []).map(row => (row || []).map(escapeCSVCell).join(','));
    
    // Prepend UTF-8 BOM (\uFEFF) so Excel, Google Sheets and system openers properly interpret UTF-8
    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

    // Create a Blob with text/csv mime type
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Ensure valid filename extension
    const cleanFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

    // Modern browsers & mobile devices: Use createObjectURL
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      // Legacy IE/Edge support
      window.navigator.msSaveOrOpenBlob(blob, cleanFilename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFilename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup resources
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 500);
  } catch (error) {
    console.error('Failed to trigger CSV download:', error);
    throw error;
  }
}

/**
 * Robust date/time range filter for directory & entity records (Students, Staff, Branches, etc.)
 * Supports:
 * - Both fromDate and toDate (Between range)
 * - Only toDate (All records up to date/time, e.g. "Up to Yesterday")
 * - Only fromDate (All records from date/time onwards)
 * - Neither (All records)
 *
 * @param {Array<object>} records - Array of data objects
 * @param {object} options
 * @param {string} [options.fromDate] - Start date (YYYY-MM-DD)
 * @param {string} [options.fromTime] - Start time (HH:MM)
 * @param {string} [options.toDate] - End date (YYYY-MM-DD)
 * @param {string} [options.toTime] - End time (HH:MM)
 * @param {string} [options.dateField] - Optional custom date field
 * @returns {Array<object>} Filtered records
 */
export function filterRecordsByDateRange(records, { fromDate, fromTime, toDate, toTime, dateField, isAttendance = false } = {}) {
  if (!Array.isArray(records)) return [];
  if (!fromDate && !toDate) return records;

  // For directory records (students, staff, branches, etc.), if a user chooses a single day
  // (e.g. fromDate === toDate, or only toDate is set), they want the full directory data
  // that existed on that day (all records enrolled up to that day's cutoff), regardless
  // of whether new people joined on that day or not.
  const isSingleDayExport = !isAttendance && Boolean(fromDate && toDate && fromDate === toDate);

  let startLimit = null;
  if (fromDate && !isSingleDayExport) {
    const timeStr = fromTime ? (fromTime.length === 5 ? `${fromTime}:00` : fromTime) : '00:00:00';
    startLimit = new Date(`${fromDate}T${timeStr}`).getTime();
  }

  let endLimit = null;
  if (toDate) {
    const timeStr = toTime ? (toTime.length === 5 ? `${toTime}:59.999` : toTime) : '23:59:59.999';
    endLimit = new Date(`${toDate}T${timeStr}`).getTime();
  }

  return records.filter(record => {
    let raw = dateField ? record[dateField] : null;
    if (!raw) {
      // Prioritize created_at, then admission_date or date_of_joining or date
      raw = record.created_at || record.createdAt || record.admission_date || record.admissionDate || record.date_of_joining || record.dateOfJoining || record.date;
    }
    if (!raw) return false;

    const t = new Date(raw).getTime();
    if (isNaN(t)) return false;

    // Must be on or after start limit if defined
    if (startLimit !== null && t < startLimit) return false;

    // Must be on or before end limit if defined
    if (endLimit !== null && t > endLimit) return false;

    return true;
  });
}

/**
 * Generates a clean descriptive filename for CSV exports
 */
export function generateExportFilename(prefix = 'export', { fromDate, toDate, preset } = {}) {
  const p = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  if (preset === 'all' || (!fromDate && !toDate)) {
    return `${p}_all_records.csv`;
  }
  if (!fromDate && toDate) {
    return `${p}_upto_${toDate}.csv`;
  }
  if (fromDate && !toDate) {
    return `${p}_from_${fromDate}.csv`;
  }
  if (fromDate === toDate) {
    return `${p}_date_${fromDate}.csv`;
  }
  return `${p}_${fromDate}_to_${toDate}.csv`;
}
