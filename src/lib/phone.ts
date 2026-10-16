// Kenyan mobile numbers: 07xx xxx xxx, 01xx xxx xxx, +2547..., 2547..., 7xxxxxxxx (and +254 07.. typos).
// Stored normalised as +254XXXXXXXXX (matches the DB check on profiles.phone).
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?254)?0?([17]\d{8})$/.exec(digits);
  return m ? `+254${m[1]}` : null;
}

// +254712345678 -> 0712 345 678 (what people are used to reading)
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+254([17]\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

export function normalizePlate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const plate = input.toUpperCase().replace(/\s+/g, ' ').trim();
  return /^[A-Z0-9 ]{3,15}$/.test(plate) && /[A-Z0-9]{3,}/.test(plate.replace(/ /g, '')) ? plate : null;
}

export const isValidPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4}$/.test(pin);
