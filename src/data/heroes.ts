import { generatedHeroes } from './heroes.generated'

/*
 * Legacy manual seed kept only as migration history.
 * Runtime data is generated from Garena by scripts/update-hero-data.mjs.
 *
const roleSet = new Set<HeroRole>([
  'Đấu sĩ',
  'Đỡ đòn',
  'Pháp sư',
  'Sát thủ',
  'Trợ thủ',
  'Xạ thủ',
])

const heroRows: Array<[string, string]> = [
  ['Edras', ''],
  ['Goverra', ''],
  ['Airi', 'Đấu sĩ / Sát thủ'],
  ['Aleister', 'Pháp sư'],
  ['Alice', 'Trợ thủ'],
  ['Allain', 'Đấu sĩ'],
  ['Amily', 'Đấu sĩ'],
  ['Annette', 'Pháp sư / Trợ thủ'],
  ['Aoi', 'Sát thủ'],
  ['Arduin', 'Đấu sĩ / Đỡ đòn'],
  ['Arthur', 'Đấu sĩ'],
  ['Arum', 'Đỡ đòn / Trợ thủ'],
  ['Astrid', 'Đấu sĩ / Sát thủ'],
  ['Ata', 'Đỡ đòn'],
  ['Aya', 'Trợ thủ'],
  ["Azzen'Ka", 'Pháp sư'],
  ['Baldum', 'Đỡ đòn / Trợ thủ'],
  ['Bijan', 'Đấu sĩ'],
  ['Billow', 'Sát thủ / Đấu sĩ'],
  ['Biron', 'Đấu sĩ / Đỡ đòn'],
  ['Bolt Baron', 'Đấu sĩ / Pháp sư'],
  ['Bonnie', 'Pháp sư'],
  ['Bright', 'Sát thủ'],
  ['Butterfly', 'Đấu sĩ / Sát thủ'],
  ['Capheny', 'Xạ thủ'],
  ['Celica', 'Xạ thủ'],
  ['Charlotte', 'Đấu sĩ'],
  ['Chaugnar', 'Đỡ đòn / Trợ thủ'],
  ['Cresht', 'Đỡ đòn / Trợ thủ'],
  ["D'arcy", 'Pháp sư'],
  ['Dextra', 'Đấu sĩ / Đỡ đòn'],
  ['Điêu Thuyền', 'Pháp sư'],
  ['Dirak', 'Pháp sư'],
  ['Dolia', 'Trợ thủ'],
  ["Eland'orr", 'Xạ thủ'],
  ['Elsu', 'Xạ thủ'],
  ['Enzo', 'Sát thủ'],
  ['Erin', 'Xạ thủ'],
  ['Errol', 'Đấu sĩ'],
  ['Fennik', 'Xạ thủ'],
  ['Florentino', 'Đấu sĩ'],
  ['Gildur', 'Đỡ đòn / Trợ thủ'],
  ['Grakk', 'Đỡ đòn / Trợ thủ'],
  ['Hayate', 'Xạ thủ'],
  ['Heino', 'Pháp sư / Đấu sĩ'],
  ['Helen', 'Trợ thủ'],
  ['Iggy', 'Pháp sư'],
  ['Ignis', 'Pháp sư'],
  ['Ilumia', 'Pháp sư'],
  ['Ishar', 'Pháp sư / Trợ thủ'],
  ['Jinna', 'Pháp sư'],
  ['Kahlii', 'Pháp sư'],
  ['Kaine', 'Sát thủ'],
  ['Keera', 'Sát thủ'],
  ['Kil’Groth', 'Đấu sĩ'],
  ['Kriknak', 'Sát thủ'],
  ['Krixi', 'Pháp sư'],
  ['Krizzix', 'Trợ thủ'],
  ['Lauriel', 'Pháp sư'],
  ['Laville', 'Xạ thủ'],
  ['Liliana', 'Pháp sư / Sát thủ'],
  ['Lindis', 'Xạ thủ'],
  ['Lorion', 'Pháp sư'],
  ['Lữ Bố', 'Đấu sĩ'],
  ['Lumburr', 'Đỡ đòn / Trợ thủ'],
  ['Maloch', 'Đấu sĩ / Đỡ đòn'],
  ['Marja', 'Pháp sư'],
  ['Max', 'Đỡ đòn'],
  ['Mganga', 'Pháp sư'],
  ['Mina', 'Đỡ đòn / Trợ thủ'],
  ['Ming', 'Trợ thủ'],
  ['Moren', 'Xạ thủ'],
  ['Murad', 'Sát thủ'],
  ['Nakroth', 'Sát thủ'],
  ['Natalya', 'Pháp sư'],
  ['Ngộ Không', 'Sát thủ'],
  ['Omega', 'Đỡ đòn / Trợ thủ'],
  ['Omen', 'Đấu sĩ'],
  ['Ormarr', 'Đỡ đòn'],
  ['Paine', 'Sát thủ'],
  ['Preyta', 'Pháp sư'],
  ['Qi', 'Đấu sĩ / Sát thủ'],
  ['Quillen', 'Sát thủ'],
  ['Raz', 'Pháp sư / Sát thủ'],
  ['Richter', 'Đấu sĩ'],
  ['Rouie', 'Trợ thủ'],
  ['Rourke', 'Đấu sĩ'],
  ['Roxie', 'Đấu sĩ / Đỡ đòn'],
  ['Ryoma', 'Đấu sĩ / Sát thủ'],
  ['Sephera', 'Pháp sư / Trợ thủ'],
  ['Sinestrea', 'Sát thủ'],
  ['Skud', 'Đấu sĩ / Đỡ đòn'],
  ['Slimz', 'Xạ thủ'],
  ['Stuart', 'Xạ thủ'],
  ['Superman', 'Đấu sĩ / Đỡ đòn'],
  ['Taara', 'Đấu sĩ / Đỡ đòn'],
  ['Tachi', 'Đấu sĩ'],
  ['Teemee', 'Đỡ đòn / Trợ thủ'],
  ['Teeri', 'Xạ thủ'],
  ["Tel'Annas", 'Xạ thủ'],
  ['Thane', 'Đỡ đòn'],
  ['The Flash', 'Sát thủ'],
  ['Thorne', 'Xạ thủ'],
  ['Toro', 'Đỡ đòn / Trợ thủ'],
  ['Triệu Vân', 'Đấu sĩ'],
  ['Tulen', 'Pháp sư'],
  ['Valhein', 'Xạ thủ'],
  ['Veera', 'Pháp sư'],
  ['Veres', 'Đấu sĩ'],
  ['Violet', 'Xạ thủ'],
  ['Volkath', 'Đấu sĩ / Sát thủ'],
  ['Wiro', 'Đấu sĩ / Đỡ đòn'],
  ['Wisp', 'Xạ thủ'],
  ['Wonder Woman', 'Đấu sĩ'],
  ['Xeniel', 'Đỡ đòn / Trợ thủ'],
  ['Y’bneth', 'Đỡ đòn'],
  ['Yan', 'Đấu sĩ / Sát thủ'],
  ['Yena', 'Đấu sĩ'],
  ['Yorn', 'Xạ thủ'],
  ['Yue', 'Pháp sư'],
  ['Zata', 'Pháp sư / Sát thủ'],
  ['Zephys', 'Đấu sĩ / Sát thủ'],
  ['Zill', 'Sát thủ'],
  ['Zip', 'Trợ thủ'],
  ['Zuka', 'Đấu sĩ / Sát thủ'],
]

const featuredSkills: Record<string, HeroSkill[]> = {
  edras: [
    {
      name: 'Luân hồi quang trảm',
      description:
        'Đánh thường và chiêu thức tích luỹ kinh nghiệm, đồng thời thay đổi sức mạnh theo hình thái.',
    },
    {
      name: 'Đột kích dũng mãnh',
      description: 'Đột kích nhanh theo hướng chỉ định để tiếp cận hoặc rời giao tranh.',
    },
    {
      name: 'Hóa thân Quang minh',
      description:
        'Chuyển sang hình thái Quang minh với bộ kỹ năng tầm xa, miễn khống và xuyên giáp.',
    },
    {
      name: 'Hóa thân Hắc ám',
      description:
        'Chuyển sang hình thái Hắc ám, tăng khả năng đánh thường, hồi phục và khống chế.',
    },
  ],
  goverra: [
    {
      name: 'Binh đoàn thiết vệ',
      description:
        'Hạ gục kẻ địch để triệu hồi Thiết vệ; các đơn vị có thể hợp thể, thăng cấp hoặc tự hủy gây sát thương.',
    },
    {
      name: 'Tiêm kích tuần hành',
      description:
        'Điều khiển tiêm kích tấn công dọc đường và có thể tách thành hai máy bay ném bom.',
    },
    {
      name: 'Mệnh lệnh tập kích',
      description:
        'Thả Binh đoàn thiết vệ tại vùng chỉ định và tích trữ nhiều lần sử dụng.',
    },
    {
      name: 'Tín hiệu hủy diệt',
      description:
        'Đánh dấu, làm choáng và gây sát thương liên tục; đồng thời cường hóa các Thiết vệ lân cận.',
    },
  ],
  valhein: [
    {
      name: 'Ám khí',
      description: 'Đòn đánh thứ ba tạo phi tiêu đặc biệt và cộng dồn tốc chạy.',
    },
    {
      name: 'Chuyến săn mạo hiểm',
      description: 'Ném phi tiêu gây sát thương phép và tăng cộng dồn Thợ săn.',
    },
    {
      name: 'Lời nguyền tử vong',
      description: 'Phi tiêu hoàng kim gây sát thương phép và làm choáng mục tiêu.',
    },
    {
      name: 'Bão đạn',
      description: 'Bắn loạt đạn bạc, tăng tốc đánh khi trúng tướng địch.',
    },
  ],
  'ngo-khong': [
    {
      name: 'Vô địch thiên hạ',
      description: 'Sau khi dùng chiêu, đòn đánh kế tiếp được cường hóa và áp sát.',
    },
    {
      name: 'Phân thân thuật',
      description: 'Tiến vào tàng hình trong thời gian ngắn và tăng tốc chạy.',
    },
    {
      name: 'Cân đẩu vân',
      description: 'Tăng phòng thủ rồi lướt theo hướng chỉ định.',
    },
    {
      name: 'Gậy như ý',
      description: 'Quét gậy quanh người, gây sát thương và làm choáng.',
    },
  ],
  nakroth: [
    {
      name: 'Thẩm phán oai nghiêm',
      description: 'Hất tung mục tiêu định kỳ sau chuỗi đòn đánh.',
    },
    {
      name: 'Bồi thẩm đoàn',
      description: 'Lướt và hất tung kẻ địch; có thể tái kích hoạt.',
    },
    {
      name: 'Nguồn cơn rắc rối',
      description: 'Lướt ngược và cường hóa đòn đánh kế tiếp.',
    },
    {
      name: 'Gươm hành quyết',
      description: 'Vung gươm liên tục, miễn khống chế trong thời gian thi triển.',
    },
  ],
}

function slugify(name: string): string {
  return normalizeText(name).replace(/\s+/g, '-')
}

const sourceUrlOverrides: Record<string, string> = {
  edras: 'https://lienquan.garena.vn/hoc-vien/tuong-skin/d/11596/',
}

function makeAvatar(name: string, role: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5b942"/><stop offset="1" stop-color="#d35b23"/></linearGradient></defs><rect width="160" height="160" rx="32" fill="url(#g)"/><circle cx="80" cy="67" r="43" fill="#07111f" opacity=".22"/><text x="80" y="83" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="white">${initials}</text><text x="80" y="135" text-anchor="middle" font-family="Arial" font-size="13" fill="white">${role.split(' / ')[0]}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const legacyHeroes: Hero[] = heroRows.map(([name, roleText]) => {
  const id = slugify(name)
  const roles = roleText
    .split(' / ')
    .filter((role): role is HeroRole => roleSet.has(role as HeroRole))

  return {
    id,
    name,
    normalizedName: normalizeText(name),
    roles,
    imageUrl: makeAvatar(name, roleText),
    sourceUrl:
      sourceUrlOverrides[id] ??
      `https://lienquan.garena.vn/hoc-vien/tuong-skin/d/${id}/`,
    skills: featuredSkills[id] ?? [],
  }
})
*/

export const heroes = generatedHeroes

export const heroByNormalizedName = new Map(
  heroes.map((hero) => [hero.normalizedName, hero]),
)
