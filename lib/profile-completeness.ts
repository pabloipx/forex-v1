export type ProfileFields = {
  full_name?: string | null
  phone?: string | null
  document_number?: string | null
  birth_date?: string | null
  country?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

export type RequiredField = keyof ProfileFields

export const REQUIRED_FIELDS: { key: RequiredField; label: string }[] = [
  { key: "full_name", label: "Nome completo" },
  { key: "phone", label: "Telefone" },
  { key: "document_number", label: "CPF / Documento" },
  { key: "birth_date", label: "Data de nascimento" },
  { key: "country", label: "País" },
  { key: "address_line", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "postal_code", label: "CEP" },
]

const digits = (v: string) => v.replace(/\D/g, "")

export function isValidCpf(value: string): boolean {
  const cpf = digits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10])
}

function fieldProblem(key: RequiredField, raw: string | null | undefined, country: string): string | null {
  const v = (raw ?? "").trim()
  if (!v) return "não preenchido"
  const isBR = country === "BR"
  switch (key) {
    case "full_name":
      return v.split(/\s+/).filter((p) => p.length > 1).length >= 2 ? null : "informe nome e sobrenome"
    case "phone":
      return digits(v).length >= 10 ? null : "telefone incompleto"
    case "document_number":
      if (isBR) return isValidCpf(v) ? null : "CPF inválido"
      return digits(v).length >= 5 || v.length >= 5 ? null : "documento inválido"
    case "birth_date": {
      const t = Date.parse(v)
      if (Number.isNaN(t)) return "data inválida"
      return (Date.now() - t) / (365.25 * 86400000) >= 18 ? null : "é necessário ter 18 anos"
    }
    case "postal_code":
      if (isBR) return digits(v).length === 8 ? null : "CEP deve ter 8 dígitos"
      return v.length >= 3 ? null : "código postal inválido"
    case "address_line":
      return v.length >= 5 ? null : "endereço incompleto"
    default:
      return v.length >= 2 ? null : "inválido"
  }
}

export function getProfileIssues(profile: ProfileFields | null | undefined) {
  const p = profile ?? {}
  const country = (p.country ?? "").toUpperCase()
  return REQUIRED_FIELDS.flatMap(({ key, label }) => {
    const problem = fieldProblem(key, p[key], country)
    return problem ? [{ key, label, problem }] : []
  })
}

export function profileCompletion(profile: ProfileFields | null | undefined) {
  const issues = getProfileIssues(profile)
  const total = REQUIRED_FIELDS.length
  return {
    issues,
    complete: issues.length === 0,
    percent: Math.round(((total - issues.length) / total) * 100),
  }
}

export const PROFILE_COLUMNS = REQUIRED_FIELDS.map((f) => f.key).join(", ")
