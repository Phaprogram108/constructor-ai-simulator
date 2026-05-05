'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const AMERICAS_COUNTRIES = [
  { code: 'CA', name: 'Canadá', dialCode: '1', flag: '🇨🇦' },
  { code: 'US', name: 'Estados Unidos', dialCode: '1', flag: '🇺🇸' },
  { code: 'MX', name: 'México', dialCode: '52', flag: '🇲🇽' },
  { code: 'GT', name: 'Guatemala', dialCode: '502', flag: '🇬🇹' },
  { code: 'BZ', name: 'Belice', dialCode: '501', flag: '🇧🇿' },
  { code: 'SV', name: 'El Salvador', dialCode: '503', flag: '🇸🇻' },
  { code: 'HN', name: 'Honduras', dialCode: '504', flag: '🇭🇳' },
  { code: 'NI', name: 'Nicaragua', dialCode: '505', flag: '🇳🇮' },
  { code: 'CR', name: 'Costa Rica', dialCode: '506', flag: '🇨🇷' },
  { code: 'PA', name: 'Panamá', dialCode: '507', flag: '🇵🇦' },
  { code: 'CU', name: 'Cuba', dialCode: '53', flag: '🇨🇺' },
  { code: 'DO', name: 'República Dominicana', dialCode: '1', flag: '🇩🇴' },
  { code: 'PR', name: 'Puerto Rico', dialCode: '1', flag: '🇵🇷' },
  { code: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴' },
  { code: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { code: 'PE', name: 'Perú', dialCode: '51', flag: '🇵🇪' },
  { code: 'BO', name: 'Bolivia', dialCode: '591', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', dialCode: '595', flag: '🇵🇾' },
  { code: 'BR', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { code: 'UY', name: 'Uruguay', dialCode: '598', flag: '🇺🇾' },
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
] as const;

type Country = (typeof AMERICAS_COUNTRIES)[number];

const DEFAULT_COUNTRY: Country =
  AMERICAS_COUNTRIES.find((c) => c.code === 'AR') ?? AMERICAS_COUNTRIES[AMERICAS_COUNTRIES.length - 1];

export interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string, meta: { country: Country; localDigits: string }) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  error,
  placeholder = 'Numero de WhatsApp',
  id,
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<Country>(DEFAULT_COUNTRY);
  const [localDigits, setLocalDigits] = React.useState<string>(() => {
    // Initialize localDigits from incoming value if it starts with the default dial code
    const digits = (value || '').replace(/\D/g, '');
    if (digits.startsWith(DEFAULT_COUNTRY.dialCode)) {
      return digits.slice(DEFAULT_COUNTRY.dialCode.length);
    }
    return '';
  });
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState<number>(
    AMERICAS_COUNTRIES.findIndex((c) => c.code === DEFAULT_COUNTRY.code)
  );

  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll highlighted item into view + auto-focus list when opening
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.focus();
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-idx="${highlightIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const emit = React.useCallback(
    (nextCountry: Country, nextLocalDigits: string) => {
      const full = `${nextCountry.dialCode}${nextLocalDigits}`;
      onChange(full, { country: nextCountry, localDigits: nextLocalDigits });
    },
    [onChange]
  );

  const handleSelectCountry = (c: Country) => {
    setCountry(c);
    setOpen(false);
    emit(c, localDigits);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setLocalDigits(digits);
    emit(country, digits);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(AMERICAS_COUNTRIES.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const c = AMERICAS_COUNTRIES[highlightIndex];
      if (c) handleSelectCountry(c);
    }
  };

  // Format display: show local digits as user typed (no formatting, just digits)
  const displayLocal = localDigits;

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          'flex items-stretch w-full rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring',
          error && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex items-center gap-1.5 px-3 h-12 border-r border-input rounded-l-md text-base hover:bg-accent disabled:cursor-not-allowed shrink-0',
            'focus:outline-none focus:bg-accent'
          )}
        >
          <span className="text-xl leading-none">{country.flag}</span>
          <span className="font-medium tabular-nums">+{country.dialCode}</span>
          <svg
            className={cn('w-3 h-3 transition-transform', open && 'rotate-180')}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={displayLocal}
          onChange={handleLocalChange}
          disabled={disabled}
          className="border-0 shadow-none rounded-l-none rounded-r-md h-12 text-base focus-visible:ring-0"
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-input bg-white shadow-lg focus:outline-none"
        >
          {AMERICAS_COUNTRIES.map((c, idx) => {
            const selected = c.code === country.code;
            const highlighted = idx === highlightIndex;
            return (
              <li
                key={c.code}
                data-idx={idx}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlightIndex(idx)}
                onClick={() => handleSelectCountry(c)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 cursor-pointer text-sm',
                  highlighted && 'bg-accent',
                  selected && 'font-medium'
                )}
              >
                <span className="text-lg leading-none w-6 text-center">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground tabular-nums">+{c.dialCode}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Helper export so callers (e.g. SimulatorForm) can validate against local digits
// without having to re-derive country selection.
export { AMERICAS_COUNTRIES };
export type { Country };
