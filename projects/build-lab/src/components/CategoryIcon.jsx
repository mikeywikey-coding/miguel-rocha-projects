const labels = {
  fin: "Finishing",
  sht: "Shooting",
  plm: "Playmaking",
  def: "Defense",
  reb: "Rebounding",
  phy: "Physicals",
};

export function categoryIconPath(groupId) {
  return `/images/categories/${groupId}.png`;
}

export function CategoryIcon({ groupId, className = "" }) {
  return (
    <img
      className={`category-icon ${className}`.trim()}
      src={categoryIconPath(groupId)}
      alt=""
      aria-hidden="true"
      title={labels[groupId]}
      decoding="async"
      draggable="false"
    />
  );
}
