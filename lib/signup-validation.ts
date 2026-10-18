export type CountryCode = "BR" | "PT" | "AO" | "MZ" | "AR" | "US" | "ES"

type PhoneRule = {
  dial: string
  lengths: number[]
  pattern: RegExp
  example: string
}

export const PHONE_RULES: Record<CountryCode, PhoneRule> = {
  BR: { dial: "+55", lengths: [11], pattern: /^[1-9][1-9]9\d{8}$/, example: "(11) 91234-5678" },
  PT: { dial: "+351", lengths: [9], pattern: /^9[1236]\d{7}$/, example: "912 345 678" },
  AO: { dial: "+244", lengths: [9], pattern: /^9\d{8}$/, example: "923 456 789" },
  MZ: { dial: "+258", lengths: [9], pattern: /^8[2-7]\d{7}$/, example: "84 123 4567" },
  AR: { dial: "+54", lengths: [10, 11], pattern: /^9?[1-9]\d{9}$/, example: "11 2345-6789" },
  US: { dial: "+1", lengths: [10], pattern: /^[2-9]\d{2}[2-9]\d{6}$/, example: "(201) 555-0123" },
  ES: { dial: "+34", lengths: [9], pattern: /^[67]\d{8}$/, example: "612 345 678" },
}

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && value in PHONE_RULES
}

export function phoneMaxLength(country: CountryCode) {
  return Math.max(...PHONE_RULES[country].lengths)
}

export function formatNationalPhone(country: CountryCode, digits: string) {
  if (country === "BR") {
    if (digits.length <= 2) return digits.length ? `(${digits}` : ""
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (country === "US") {
    if (digits.length <= 3) return digits.length ? `(${digits}` : ""
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ")
}

export function validatePhone(country: CountryCode, rawDigits: string): string | null {
  const digits = rawDigits.replace(/\D/g, "")
  const rule = PHONE_RULES[country]
  if (!digits) return "Informe seu número de celular"
  if (!rule.lengths.includes(digits.length)) {
    const expected = rule.lengths.join(" ou ")
    return `Número incompleto: informe ${expected} dígitos (ex.: ${rule.example})`
  }
  if (!rule.pattern.test(digits) || /^(\d)\1+$/.test(digits)) {
    return `Número de celular inválido (ex.: ${rule.example})`
  }
  return null
}

const NAME_PATTERN = /^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u

export function normalizeName(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ")
}

export function validateName(value: string, label: "Nome" | "Sobrenome"): string | null {
  const name = normalizeName(value)
  if (!name) return `Informe seu ${label.toLowerCase()}`
  if (name.length > 60) return `${label} muito longo`
  if (!NAME_PATTERN.test(name)) return `${label} deve conter apenas letras`
  const letters = name.replace(/[^\p{L}]/gu, "")
  if (letters.length < 2) return `${label} incompleto: informe pelo menos 2 letras`
  if (/^(\p{L})\1+$/u.test(letters.toLowerCase())) return `${label} inválido`
  return null
}

export type SignupFieldErrors = Partial<Record<"firstName" | "lastName" | "phone", string>>

export function validateSignupProfile(input: {
  firstName: string
  lastName: string
  country: CountryCode
  phone: string
}): SignupFieldErrors {
  const errors: SignupFieldErrors = {}
  const first = validateName(input.firstName, "Nome")
  const last = validateName(input.lastName, "Sobrenome")
  const phone = validatePhone(input.country, input.phone)
  if (first) errors.firstName = first
  if (last) errors.lastName = last
  if (phone) errors.phone = phone
  return errors
}
