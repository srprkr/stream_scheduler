/**
 * A search box that narrows the list below it. It looks like Home's search
 * but behaves differently: no dropdown, the page's own grid is the result.
 * type="search" gives a clear button, and Escape clears it, for free.
 */
export function FilterInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="search__field filter">
      <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input
        type="search"
        className="search__input"
        placeholder={label}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
