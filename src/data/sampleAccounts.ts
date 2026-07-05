import type { Account } from '../types'
import { normalizeText } from '../utils/normalize'

const now = new Date().toISOString()

export const sampleAccounts: Account[] = [
  {
    username: 'rank_master_01',
    password: 'Demo@123',
    nickname: 'Rừng không lạc',
    gold: '12600',
    level: '30',
    rank: 'Cao thủ',
    status: 'Sẵn sàng',
    heroes: ['Nakroth', 'Ngộ Không', 'Krixi', 'Valhein', 'Alice'],
    heroNamesNormalized: ['Nakroth', 'Ngộ Không', 'Krixi', 'Valhein', 'Alice'].map(
      normalizeText,
    ),
    note: 'Nick mẫu nhiều tướng đi rừng',
    createdAt: now,
    updatedAt: now,
  },
  {
    username: 'mid_lane_88',
    password: 'LienQuan#88',
    nickname: 'Pháp sư tập sự',
    gold: '20636',
    level: '30',
    rank: 'Kim cương 5',
    status: 'Chưa chơi',
    heroes: ['Điêu Thuyền', 'Tulen', 'Liliana', 'Krixi', 'Raz'],
    heroNamesNormalized: ['Điêu Thuyền', 'Tulen', 'Liliana', 'Krixi', 'Raz'].map(
      normalizeText,
    ),
    note: 'Phù hợp người chơi đường giữa',
    createdAt: now,
    updatedAt: now,
  },
  {
    username: 'ad_pro_mobile',
    password: 'Hayate2026',
    nickname: 'Số 1 Hayate',
    gold: '13700',
    level: '28',
    rank: 'Bạch kim 2',
    status: 'Sẵn sàng',
    heroes: ['Hayate', 'Capheny', 'Violet', 'Yorn', 'Tel’Annas'],
    heroNamesNormalized: ['Hayate', 'Capheny', 'Violet', 'Yorn', 'Tel’Annas'].map(
      normalizeText,
    ),
    note: 'Nick xạ thủ',
    createdAt: now,
    updatedAt: now,
  },
]
