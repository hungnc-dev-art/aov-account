import * as cheerio from 'cheerio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_URL = 'https://lienquan.garena.vn/hoc-vien/tuong-skin/'
const OUTPUT_FILE = 'src/data/heroes.generated.ts'
const REPORT_FILE = 'src/data/hero-data-report.json'
const ASSET_ROOT = 'public/heroes'
const CONCURRENCY = 6
const FORCE = process.argv.includes('--force')

const roleById = new Map([
  ['28', 'Đấu sĩ'],
  ['31', 'Đỡ đòn'],
  ['29', 'Pháp sư'],
  ['32', 'Sát thủ'],
  ['30', 'Trợ thủ'],
  ['33', 'Xạ thủ'],
])

const headers = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'accept-language': 'vi-VN,vi;q=0.9,en;q=0.7',
}

function normalizeText(value) {
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

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-')
}

function cleanText(value) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchText(url) {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.text()
}

function extensionFrom(response, url) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('png')) return '.png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg'
  const extension = path.extname(new URL(url).pathname).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(extension)
    ? extension
    : '.jpg'
}

async function downloadImage(url, directory, baseName) {
  if (!url) return undefined
  await mkdir(directory, { recursive: true })

  if (!FORCE) {
    for (const extension of ['.webp', '.png', '.jpg', '.jpeg', '.avif']) {
      const existing = path.join(directory, `${baseName}${extension}`)
      try {
        await readFile(existing)
        return `/${path.relative('public', existing).replaceAll('\\', '/')}`
      } catch {
        // Continue until an existing format is found.
      }
    }
  }

  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`Không tải được ảnh ${response.status}: ${url}`)
  const extension = extensionFrom(response, url)
  const filePath = path.join(directory, `${baseName}${extension}`)
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
  return `/${path.relative('public', filePath).replaceAll('\\', '/')}`
}

function parseCatalog(html) {
  const $ = cheerio.load(html)
  const byName = new Map()

  $('.st-heroes__item').each((_, element) => {
    const item = $(element)
    const name = cleanText(item.find('.st-heroes__item--name').text())
    const sourceUrl = item.attr('href')?.trim()
    const avatarSource = item.find('.st-heroes__item--img img').attr('src')?.trim()
    if (!name || !sourceUrl) return

    const normalizedName = normalizeText(name)
    const roleIds = (item.attr('data-type')?.match(/\d+/g) ?? [])
    const roles = roleIds.map((id) => roleById.get(id)).filter(Boolean)
    const current = byName.get(normalizedName)

    if (current) {
      current.roles = [...new Set([...current.roles, ...roles])]
      current.sources.push({ sourceUrl, avatarSource })
    } else {
      byName.set(normalizedName, {
        id: slugify(name),
        name,
        normalizedName,
        roles,
        sources: [{ sourceUrl, avatarSource }],
      })
    }
  })

  return [...byName.values()]
}

function parseDetail(html) {
  const $ = cheerio.load(html)
  const iconByTarget = new Map()

  $('.hero__skills--list a').each((_, element) => {
    const link = $(element)
    const target = link.attr('href')
    if (target) iconByTarget.set(target, link.find('img').attr('src')?.trim())
  })

  const skills = []
  $('.hero__skills--detail').each((_, element) => {
    const detail = $(element)
    const id = detail.attr('id')
    const name = cleanText(detail.find('h3').first().text())
    const description = cleanText(detail.find('article').first().text())
    if (name && description) {
      skills.push({
        name,
        description,
        iconSource: id ? iconByTarget.get(`#${id}`) : undefined,
      })
    }
  })
  return skills
}

async function runPool(items, worker) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, run))
  return results
}

async function enrichHero(hero, index, total) {
  console.log(`[${index + 1}/${total}] ${hero.name}`)
  const details = []

  for (const source of hero.sources) {
    try {
      const skills = parseDetail(await fetchText(source.sourceUrl))
      details.push({ ...source, skills })
    } catch (error) {
      console.warn(`  Cảnh báo: ${error.message}`)
    }
  }

  const best = details.sort((a, b) => b.skills.length - a.skills.length)[0]
  const source = best ?? hero.sources[0]
  const assetDirectory = path.join(ASSET_ROOT, hero.id)
  let imageUrl

  try {
    imageUrl = await downloadImage(source.avatarSource, assetDirectory, 'avatar')
  } catch (error) {
    console.warn(`  Cảnh báo avatar: ${error.message}`)
  }

  const skills = []
  for (const [skillIndex, skill] of (best?.skills ?? []).entries()) {
    let iconUrl
    try {
      iconUrl = await downloadImage(
        skill.iconSource,
        assetDirectory,
        `skill-${skillIndex + 1}`,
      )
    } catch (error) {
      console.warn(`  Cảnh báo icon ${skill.name}: ${error.message}`)
    }
    skills.push({ name: skill.name, description: skill.description, iconUrl })
  }

  return {
    id: hero.id,
    name: hero.name,
    normalizedName: hero.normalizedName,
    roles: hero.roles,
    imageUrl,
    sourceUrl: source.sourceUrl,
    skills,
  }
}

function serialize(data) {
  return `// AUTO-GENERATED by npm run heroes:update. Do not edit manually.\nimport type { Hero } from '../types'\n\nexport const generatedHeroes = ${JSON.stringify(data, null, 2)} satisfies Hero[]\n`
}

const catalog = parseCatalog(await fetchText(SOURCE_URL))
if (!catalog.length) throw new Error('Không tìm thấy hero từ selector .st-heroes__item')

console.log(`Tìm thấy ${catalog.length} hero duy nhất. Bắt đầu tải chi tiết...`)
const heroes = await runPool(catalog, (hero, index) =>
  enrichHero(hero, index, catalog.length),
)
heroes.sort((a, b) => a.name.localeCompare(b.name, 'vi'))

const report = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  total: heroes.length,
  missingImages: heroes.filter((hero) => !hero.imageUrl).map((hero) => hero.name),
  missingRoles: heroes.filter((hero) => !hero.roles.length).map((hero) => hero.name),
  missingSkills: heroes.filter((hero) => !hero.skills.length).map((hero) => hero.name),
  missingSkillIcons: heroes
    .filter((hero) => hero.skills.some((skill) => !skill.iconUrl))
    .map((hero) => hero.name),
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
await writeFile(OUTPUT_FILE, serialize(heroes), 'utf8')
await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`Đã tạo ${OUTPUT_FILE}`)
console.log(
  `Coverage: ${heroes.length - report.missingImages.length}/${heroes.length} ảnh, ` +
    `${heroes.length - report.missingSkills.length}/${heroes.length} bộ kỹ năng`,
)
