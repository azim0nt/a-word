export default function CustomSelect({ value, onChange, options, className = '', id = '' }) {
  return (
    <div className={`custom-select ${className}`.trim()}>
      <select id={id} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
