import { useState, useEffect } from 'react';
import Modal from './Modal';
import { MdDownload, MdDateRange, MdCheckCircle, MdWarning } from 'react-icons/md';
import { filterRecordsByDateRange } from '../utils/csvExport';

const pad2 = (n) => String(n).padStart(2, '0');

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getOffsetDateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const getMonthStartDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
};

export default function ExportCSVModal({
  isOpen,
  onClose,
  title = 'Data',
  isAttendance = false,
  onExport,
  loading = false,
  records = []
}) {
  const today = getTodayDateStr();

  const [preset, setPreset] = useState(isAttendance ? 'this_week' : 'all');
  const [fromDate, setFromDate] = useState(isAttendance ? getOffsetDateStr(7) : '');
  const [fromTime, setFromTime] = useState('00:00');
  const [toDate, setToDate] = useState(today);
  const [toTime, setToTime] = useState('23:59');
  const [reportType, setReportType] = useState('detailed'); // 'detailed' | 'summary'
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setModalError('');
      if (!isAttendance) {
        applyPreset('all');
      } else {
        applyPreset('this_week');
      }
    }
  }, [isOpen, isAttendance]);

  const applyPreset = (key) => {
    setPreset(key);
    setModalError('');
    const now = getTodayDateStr();

    if (key === 'all') {
      setFromDate('');
      setFromTime('00:00');
      setToDate('');
      setToTime('23:59');
    } else if (key === 'this_week') {
      setFromDate(getOffsetDateStr(7));
      setFromTime('00:00');
      setToDate(now);
      setToTime('23:59');
    } else if (key === 'this_month') {
      setFromDate(getMonthStartDateStr());
      setFromTime('00:00');
      setToDate(now);
      setToTime('23:59');
    } else if (key === 'last_30_days') {
      setFromDate(getOffsetDateStr(30));
      setFromTime('00:00');
      setToDate(now);
      setToTime('23:59');
    } else if (key === 'custom') {
      if (!toDate) setToDate(now);
      if (!fromDate) setFromDate(getOffsetDateStr(7));
    }
  };

  // Real-time calculation of effective date boundaries
  const effectiveFilter = {
    fromDate: preset === 'all' ? '' : fromDate,
    fromTime: preset === 'all' ? '00:00' : fromTime,
    toDate: preset === 'all' ? '' : toDate,
    toTime: preset === 'all' ? '23:59' : toTime,
    isAttendance
  };

  // Live count preview
  const matchingCount = !isAttendance && Array.isArray(records) && records.length > 0
    ? filterRecordsByDateRange(records, effectiveFilter).length
    : null;

  const handleDownload = async () => {
    setModalError('');

    if (fromDate && toDate && fromDate !== toDate) {
      const startMs = new Date(`${fromDate}T${fromTime || '00:00'}:00`).getTime();
      const endMs = new Date(`${toDate}T${toTime || '23:59'}:59`).getTime();
      if (startMs > endMs) {
        setModalError('Start date & time cannot be after End date & time.');
        return;
      }
    }

    if (matchingCount !== null && matchingCount === 0) {
      setModalError(`No ${title.toLowerCase()} records match this date filter. Please select "All Records" or adjust the date.`);
      return;
    }

    if (onExport) {
      try {
        const result = await onExport({
          fromDate: effectiveFilter.fromDate,
          fromTime: effectiveFilter.fromTime,
          toDate: effectiveFilter.toDate,
          toTime: effectiveFilter.toTime,
          reportType,
          preset
        });

        if (result && result.error) {
          setModalError(result.error);
          return;
        }
      } catch (err) {
        console.error('Export error:', err);
        setModalError('CSV export failed. Please try again.');
      }
    }
  };

  const presetsList = isAttendance
    ? [
        { key: 'this_week', label: 'Last 7 Days' },
        { key: 'this_month', label: 'This Month' },
        { key: 'last_30_days', label: 'Last 30 Days' },
        { key: 'custom', label: 'Custom' }
      ]
    : [
        { key: 'all', label: 'All Records' },
        { key: 'this_week', label: 'Last 7 Days' },
        { key: 'this_month', label: 'This Month' },
        { key: 'custom', label: 'Custom' }
      ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Export ${title} (CSV Report)`}
      size="md"
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          {matchingCount !== null && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: matchingCount > 0 ? '#15803d' : '#b45309', marginRight: 'auto' }}>
              Matching: <strong>{matchingCount}</strong> {title.toLowerCase()}
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ minHeight: 38 }}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38 }}
          >
            <MdDownload size={18} />
            {loading ? 'Generating CSV...' : 'Download CSV Report'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Presets Bar */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
            Quick Range Presets:
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {presetsList.map(p => (
              <button
                key={p.key}
                type="button"
                className={`btn btn-sm ${preset === p.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => applyPreset(p.key)}
                style={{
                  fontSize: 12,
                  padding: '6px 14px',
                  borderRadius: 6
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Configuration (Only shown when not 'all') */}
        {preset !== 'all' && (
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdDateRange size={16} color="var(--primary)" />
              {isAttendance ? 'Attendance Date & Time Range:' : 'Select From Date & To Date:'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  From (Start Date & Time):
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    className="input"
                    style={{ flex: '1 1 120px', padding: '7px 8px', fontSize: 13 }}
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setPreset('custom');
                    }}
                  />
                  <input
                    type="time"
                    className="input"
                    style={{ flex: '0 0 95px', padding: '7px 8px', fontSize: 13 }}
                    value={fromTime}
                    onChange={(e) => {
                      setFromTime(e.target.value);
                      setPreset('custom');
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  To (End Date & Time):
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    className="input"
                    style={{ flex: '1 1 120px', padding: '7px 8px', fontSize: 13 }}
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setPreset('custom');
                    }}
                  />
                  <input
                    type="time"
                    className="input"
                    style={{ flex: '0 0 95px', padding: '7px 8px', fontSize: 13 }}
                    value={toTime}
                    onChange={(e) => {
                      setToTime(e.target.value);
                      setPreset('custom');
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
              {!isAttendance && fromDate === toDate && fromDate ? (
                <span>✨ <strong>Full Day Snapshot:</strong> Downloads all {title.toLowerCase()} that existed in the school on {toDate} (all enrolled up to {toDate} {toTime}). Anyone added after will be excluded.</span>
              ) : (
                <span>✨ Downloads all {title.toLowerCase()} enrolled between {fromDate || 'the beginning'} ({fromTime}) and {toDate || 'today'} ({toTime}).</span>
              )}
            </div>
          </div>
        )}

        {/* If Attendance: Choose Report Type */}
        {isAttendance && (
          <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8, display: 'block' }}>
              Attendance Report Format:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#15803d', fontWeight: reportType === 'detailed' ? 700 : 500 }}>
                <input
                  type="radio"
                  name="reportType"
                  value="detailed"
                  checked={reportType === 'detailed'}
                  onChange={() => setReportType('detailed')}
                />
                <span>
                  <strong>Detailed Day-by-Day Records</strong> (Individual rows for every date with Check-In, Check-Out, and Status)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#15803d', fontWeight: reportType === 'summary' ? 700 : 500 }}>
                <input
                  type="radio"
                  name="reportType"
                  value="summary"
                  checked={reportType === 'summary'}
                  onChange={() => setReportType('summary')}
                />
                <span>
                  <strong>Summary Aggregate Report</strong> (Totals per person: Total Days, Present Days, Absent Days)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Error Callout Displayed Directly Inside Modal */}
        {modalError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>
            <MdWarning size={18} />
            <span>{modalError}</span>
          </div>
        )}

        {/* Summary Info Banner */}
        {!modalError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: matchingCount === 0 ? '#fffbeb' : '#eff6ff', borderRadius: 8, border: matchingCount === 0 ? '1px solid #fde68a' : '1px solid #bfdbfe' }}>
            <MdCheckCircle color={matchingCount === 0 ? '#d97706' : '#3b82f6'} size={18} />
            <span style={{ fontSize: 12, color: matchingCount === 0 ? '#92400e' : '#1e40af' }}>
              {preset === 'all'
                ? `Exporting all available ${title.toLowerCase()} records in the directory.`
                : !isAttendance && fromDate === toDate && fromDate
                ? `Exporting all ${title.toLowerCase()} records that existed in the school on or before ${toDate} (${toTime}).`
                : `Exporting records from ${fromDate || 'Start'} (${fromTime}) to ${toDate || 'End'} (${toTime}).`}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
