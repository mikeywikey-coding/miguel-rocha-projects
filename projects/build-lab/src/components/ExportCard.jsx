import { groups, formatHeight } from "../data";
import { CategoryIcon } from "./CategoryIcon";
import { buildCaps } from "../engine/buildModel";
import { projectedRatings } from "../engine/capProjections";

/** An offscreen card that the Share dialog renders to PNG. */
export function ExportCard({ ref, build, format }) {
  const caps = buildCaps(build.body),
    projection = projectedRatings(build);
  return (
    <div className="export-offscreen" aria-hidden="true">
      <div ref={ref} className={`export-card ${format}`}>
        <header>
          <strong>BUILD LAB</strong>
          <span>NBA 2K27 · BUILD PREVIEW</span>
        </header>
        <h1>{build.name}</h1>
        <div className="export-body">
          {build.body.position}
          <span>{formatHeight(build.body.height)}</span>
          <span>{build.body.weight} lbs</span>
          <span>{formatHeight(build.body.wingspan)} wingspan</span>
        </div>
        <div className="export-groups">
          {groups.map((g) => (
            <section key={g.id}>
              <h2 style={{ color: g.color }}>
                <CategoryIcon groupId={g.id} />
                {g.name}
              </h2>
              {g.attributes.map(([id, name]) => (
                <div key={id}>
                  <span>{name}</span>
                  <b>{projection.ratings[id]}</b>
                  <small>/ {caps[id] ?? "?"}</small>
                </div>
              ))}
            </section>
          ))}
        </div>
        <footer>
          AUG 22 RULES SNAPSHOT · Confirm in game.
          <span>Planned in Build Lab</span>
        </footer>
      </div>
    </div>
  );
}
