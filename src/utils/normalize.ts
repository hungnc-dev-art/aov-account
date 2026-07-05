export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitHeroes(value: string): string[] {
  const seen = new Set<string>()

  return value
    .split(/[,;\n\r]+/)
    .map((hero) => hero.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((hero) => {
      const normalized = normalizeText(hero)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

export function editDistance(first: string, second: string): number {
  const rows = first.length + 1
  const columns = second.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0))

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      )
    }
  }

  return matrix[first.length][second.length]
}

export function fuzzyMatch(candidate: string, query: string): boolean {
  if (!query) return true
  if (candidate.includes(query) || query.includes(candidate)) return true
  if (query.length < 4) return false

  const threshold = query.length >= 7 ? 2 : 1
  return editDistance(candidate, query) <= threshold
}
