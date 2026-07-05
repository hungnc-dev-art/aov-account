import type { Hero } from '../types'

interface HeroAvatarProps {
  hero?: Hero
  name: string
  size?: 'small' | 'large' | 'catalog'
}

export function HeroAvatar({ hero, name, size = 'small' }: HeroAvatarProps) {
  return (
    <span className={`hero-avatar hero-avatar--${size}`} title={name}>
      {hero?.imageUrl ? (
        <img src={hero.imageUrl} alt={`Ảnh ${name}`} loading="lazy" />
      ) : (
        <span>{name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  )
}
