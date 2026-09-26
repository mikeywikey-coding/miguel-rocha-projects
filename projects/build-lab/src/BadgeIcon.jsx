const tierSlug = (tier) => tier.toLowerCase().replaceAll(' ', '_');

export function badgeIconPath(badgeId, tier) {
  return `/images/badges/${badgeId}-${tierSlug(tier)}.webp`;
}

export function BadgeIcon({ badgeId, tier, className = '' }) {
  return <img
    className={`badge-icon ${className}`.trim()}
    src={badgeIconPath(badgeId, tier)}
    alt=""
    aria-hidden="true"
    loading="eager"
    decoding="async"
    draggable="false"
  />;
}
