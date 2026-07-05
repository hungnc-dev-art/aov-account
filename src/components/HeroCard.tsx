import type { Hero } from '../types'
import { HeroAvatar } from './HeroAvatar'

interface HeroCardProps {
  hero: Hero
  onClick: () => void
}

export function HeroCard({ hero, onClick }: HeroCardProps) {
  return (
    <button className="catalog-card" onClick={onClick}>
      <div className="catalog-card__visual">
        <HeroAvatar hero={hero} name={hero.name} size="catalog" />
      </div>
      <div className="catalog-card__body">
        <h3>{hero.name}</h3>
        <div className="role-list">
          {hero.roles.length ? (
            hero.roles.map((role) => (
              <span className="role-badge" key={role}>
                {role}
              </span>
            ))
          ) : (
            <span className="role-badge role-badge--muted">Đang cập nhật</span>
          )}
        </div>
      </div>
    </button>
  )
}
