import { readFile } from 'node:fs/promises'

const report = JSON.parse(
  await readFile('src/data/hero-data-report.json', 'utf8'),
)

console.log(`Hero data generated: ${report.generatedAt}`)
console.log(`Tổng số hero: ${report.total}`)

for (const [label, key] of [
  ['Thiếu ảnh', 'missingImages'],
  ['Thiếu vai trò', 'missingRoles'],
  ['Thiếu kỹ năng', 'missingSkills'],
  ['Thiếu icon kỹ năng', 'missingSkillIcons'],
]) {
  const values = report[key]
  console.log(`${label}: ${values.length}${values.length ? ` - ${values.join(', ')}` : ''}`)
}

if (report.missingImages.length || report.missingSkills.length) {
  process.exitCode = 1
}
