import { ExternalLink, X } from 'lucide-react'
import type { Account, Hero } from '../types'
import { HeroAvatar } from './HeroAvatar'
import { HeroOwnerAccount } from './HeroOwnerAccount'

interface HeroDetailsProps {
  hero: Hero | null
  accounts: Account[]
  onClose: () => void
}

export function HeroDetails({ hero, accounts, onClose }: HeroDetailsProps) {
  if (!hero) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal hero-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hero-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
        <div className="hero-sheet__header">
          <HeroAvatar hero={hero} name={hero.name} size="large" />
          <div>
            <p className="eyebrow">Thông tin tướng</p>
            <h2 id="hero-title">{hero.name}</h2>
            <div className="role-list">
              {hero.roles.map((role) => (
                <span className="role-badge" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="skills">
          <h3>Kỹ năng</h3>
          {hero.skills.length ? (
            hero.skills.map((skill, index) => (
              <article className="skill" key={skill.name}>
                <span>
                  {skill.iconUrl ? (
                    <img src={skill.iconUrl} alt="" loading="lazy" />
                  ) : (
                    index
                  )}
                </span>
                <div>
                  <strong>{skill.name}</strong>
                  <p>{skill.description}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">
              Chưa có mô tả kỹ năng trong seed. Có thể bổ sung tại{' '}
              <code>src/data/heroes.ts</code>.
            </p>
          )}
        </div>
        <a className="text-link" href={hero.sourceUrl} target="_blank" rel="noreferrer">
          Xem nguồn Garena <ExternalLink size={16} />
        </a>

        <section className="hero-owners">
          <div className="hero-owners__title">
            <div>
              <p className="eyebrow">ACCOUNT SỞ HỮU</p>
              <h3>{accounts.length} tài khoản có {hero.name}</h3>
            </div>
          </div>
          {accounts.length ? (
            <div className="hero-owner-table-wrap">
              <table className="hero-owner-table" aria-label={`Tài khoản sở hữu ${hero.name}`}>
                <thead>
                  <tr>
                    <th scope="col">Tên tài khoản</th>
                    <th scope="col">Username</th>
                    <th scope="col">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <HeroOwnerAccount
                      account={account}
                      key={account.id ?? account.username}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hero-owner-empty">
              Chưa có account nào trong kho sở hữu tướng này.
            </p>
          )}
        </section>
      </section>
    </div>
  )
}
