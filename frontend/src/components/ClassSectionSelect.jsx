import { useEffect, useMemo, useState } from 'react';

const getClassName = (item) => String(item?.class_name || item?.name || '').trim();

export default function ClassSectionSelect({
  classes = [],
  value = '',
  onChange,
  classLabel = 'Class',
  sectionLabel = 'Section',
  classPlaceholder = 'Select Class',
  sectionPlaceholder = 'Select Section',
  includeAll = false,
  style,
  classStyle,
  sectionStyle
}) {
  const selectedRow = classes.find(item => String(item.id) === String(value));
  const [selectedClassName, setSelectedClassName] = useState(getClassName(selectedRow));

  const classNames = useMemo(
    () => Array.from(new Set(classes.map(getClassName).filter(Boolean))),
    [classes]
  );

  const sections = useMemo(
    () => classes.filter(item => getClassName(item) === selectedClassName && String(item?.section || '').trim()),
    [classes, selectedClassName]
  );

  useEffect(() => {
    if (value) {
      setSelectedClassName(getClassName(selectedRow));
    } else if (!classNames.includes(selectedClassName)) {
      setSelectedClassName('');
    }
  }, [value, classes, classNames, selectedClassName, selectedRow]);

  const handleClassChange = (event) => {
    const className = event.target.value;
    setSelectedClassName(className);
    onChange('');
  };

  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      <select className="input" value={selectedClassName} onChange={handleClassChange} style={classStyle}>
        <option value="">{includeAll ? `All ${classLabel}s` : classPlaceholder}</option>
        {classNames.map(className => <option key={className} value={className}>{className}</option>)}
      </select>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={!selectedClassName}
        style={sectionStyle}
      >
        <option value="">{includeAll ? `All ${sectionLabel}s` : sectionPlaceholder}</option>
        {sections.map(item => (
          <option key={item.id} value={item.id}>{item.section}</option>
        ))}
      </select>
    </div>
  );
}