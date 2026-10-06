import { useEffect, useRef, useState } from "react";

/**
 * A whole-number box for a saved setting. Typing is free - the box can be
 * emptied on the way to a new number - and only whole numbers in range are
 * saved. Leaving the box puts back the saved value if what's left isn't one.
 *
 * Without the free text, a controlled box snaps back the moment it's
 * emptied: clearing "20" to type "35" would give "203".
 */
export function NumberInput({
  value,
  min,
  max,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);

  // Follow changes made elsewhere - a reset, another component - but not
  // while the user is typing here.
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      className={className}
      min={min}
      max={max}
      value={text}
      aria-label={ariaLabel}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isInteger(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        editing.current = false;
        setText(String(value));
      }}
    />
  );
}
