// Rendu HTML du tableau de bord : une page statique, sans dépendance ni JavaScript (dépliage par <details>), dans
// l'esprit de shadcn/ui (palette neutre, cartes à bordure fine, badges, clair et sombre).
// Aucune donnée n'est calculée ici : `scripts/dashboard.mjs` fournit les statistiques, `scripts/progress.mjs`
// l'avancement. Un statut n'est jamais porté par la couleur seule : toujours une icône et un libellé.

const STAGE_LABELS = {
  "to-write": "À écrire",
  specified: "Spécifiée",
  planned: "Planifiée",
  "in-progress": "En cours",
  delivered: "Livrée",
  released: "En production",
};
const STAGE_ORDER = Object.keys(STAGE_LABELS);
const TASK_LABELS = { todo: "À faire", "in-progress": "En cours", "in-review": "En revue", done: "Fusionnée" };
const STATUS_ICONS = {
  "to-write": "circle",
  specified: "circle",
  planned: "circle",
  todo: "circle",
  "in-progress": "dashed",
  "in-review": "dot",
  current: "dot",
  delivered: "check",
  released: "check",
  done: "check",
};
const ICON_PATHS = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  dashed: '<circle cx="12" cy="12" r="9" stroke-dasharray="4 4"/>',
  dot: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  alert:
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};

const STYLE = `
:root{color-scheme:light;--background:#fff;--foreground:#0a0a0a;--card:#fff;--muted:#f5f5f5;--muted-foreground:#737373;
--border:#e5e5e5;--primary:#171717;--track:#e5e5e5;--good:#0ca30c;--warning:#b77b00;--critical:#d03b3b;--series:#171717;--radius:.625rem}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--background:#0a0a0a;--foreground:#fafafa;--card:#171717;
--muted:#262626;--muted-foreground:#a1a1a1;--border:#2e2e2e;--primary:#e5e5e5;--track:#3a3a3a;--good:#0ca30c;
--warning:#fab219;--critical:#ef5f5f;--series:#fafafa}}
*{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--foreground);font:14px/1.5 Geist,Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1120px;margin:0 auto;padding:2rem 1.5rem 4rem;display:grid;gap:1.5rem}
h1{font-size:1.5rem;font-weight:600;letter-spacing:-.02em;margin:0}
h2{font-size:1.125rem;font-weight:600;letter-spacing:-.01em;margin:1rem 0 0}
h3{font-size:.875rem;font-weight:600;margin:0}
p{margin:0}.muted{color:var(--muted-foreground)}.small{font-size:.8125rem}
header{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;align-items:flex-start}
.badges{display:flex;flex-wrap:wrap;gap:.5rem}
.badge{display:inline-flex;align-items:center;gap:.3rem;border:1px solid var(--border);border-radius:.375rem;padding:.1rem .5rem;font-size:.75rem;font-weight:500;white-space:nowrap}
.icon{width:1em;height:1em;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:var(--muted-foreground)}
.icon.good{color:var(--good)}.icon.warning{color:var(--warning)}.icon.critical{color:var(--critical)}.icon.active{color:var(--foreground)}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 1px 2px rgb(0 0 0/.05);padding:1.25rem;display:grid;gap:1rem;align-content:start;min-width:0}
.card>header{display:grid;gap:.125rem}
.grid{display:grid;gap:1rem}.cols-4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}.cols-2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
.tile{gap:.375rem}.tile .value{font-size:1.75rem;font-weight:600;letter-spacing:-.02em;line-height:1.2}
.tile.bad{border-color:var(--critical)}
.meter{height:.5rem;border-radius:999px;background:var(--track);overflow:hidden}.meter>span{display:block;height:100%;border-radius:999px;background:var(--primary)}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem}
.steps li{display:grid;gap:.25rem;padding-top:.75rem;border-top:2px solid var(--track)}
.steps li.done,.steps li.current{border-top-color:var(--primary)}
.steps .name{display:flex;align-items:center;gap:.375rem;font-weight:500}.steps li.todo .name{color:var(--muted-foreground)}
.list{list-style:none;margin:0;padding:0;display:grid}
.list li{display:flex;gap:.625rem;align-items:flex-start;padding:.625rem 0;border-top:1px solid var(--border)}.list li:first-child{border-top:0;padding-top:0}
.list .icon{margin-top:.25rem}
code{font:500 .8125rem ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--muted);border-radius:.25rem;padding:.125rem .375rem}
.empty{color:var(--muted-foreground);font-size:.875rem}
.milestone{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-top:.5rem}
.specs{border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);overflow:hidden}
.spec{border-top:1px solid var(--border)}.spec:first-child{border-top:0}
.spec>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:5.5rem minmax(0,1fr) 11rem 9rem 1rem;gap:1rem;align-items:center;padding:.75rem 1rem}
.spec>summary::-webkit-details-marker{display:none}
.spec>summary:hover{background:var(--muted)}
.spec[open]>summary .chevron{transform:rotate(90deg)}
.spec .title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.spec .body{display:grid;gap:1rem;padding:1rem;background:var(--muted);border-top:1px solid var(--border)}
.stage{display:grid;gap:.375rem}.stage .name{display:flex;align-items:center;gap:.375rem}
.track{display:grid;grid-template-columns:repeat(5,1fr);gap:2px}.track i{height:.25rem;border-radius:999px;background:var(--track)}.track i.on{background:var(--primary)}
.tasks{display:grid;gap:.375rem}.tasks .count{font-variant-numeric:tabular-nums}
dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem 1.5rem;margin:0}
dt{color:var(--muted-foreground);font-size:.75rem}dd{margin:0}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.8125rem}
th{color:var(--muted-foreground);font-weight:500;text-align:left;padding:.5rem .75rem;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:.5rem .75rem;border-bottom:1px solid var(--border);vertical-align:top}tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
a{color:inherit;text-underline-offset:3px}
.cell{display:inline-flex;align-items:center;gap:.375rem;white-space:nowrap}
.alert{border-color:var(--warning)}
svg.chart{width:100%;height:auto}.chart rect,.chart path{fill:var(--series)}.axis{fill:var(--muted-foreground);font-size:11px}
details.data>summary{cursor:pointer;color:var(--muted-foreground);font-size:.8125rem}
ul.plain{margin:0;padding-left:1.125rem;display:grid;gap:.25rem}
@media (max-width:760px){.spec>summary{grid-template-columns:minmax(0,1fr) 1rem}.spec .order,.spec .stage,.spec .tasks{grid-column:1}}
`;

// --- Mise en forme ---

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (v) => (v === null ? "n/d" : `${Math.round(v * 100)} %`);
export const num = (v, digits = 1) => (v === null ? "n/d" : v.toFixed(digits));
const compact = (n) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

function icon(name, tone = "") {
  return `<svg class="icon ${tone}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** Icône d'un statut : verte quand c'est fait, encre pleine quand c'est en cours, atténuée sinon. */
function statusIcon(status) {
  const name = STATUS_ICONS[status] ?? "circle";
  const tone = name === "check" ? "good" : name === "circle" ? "" : "active";
  return icon(name, tone);
}

const badge = (content) => `<span class="badge">${content}</span>`;

function meter(done, total, label) {
  const width = total === 0 ? 0 : Math.round((done / total) * 100);
  return `<div class="meter" role="img" aria-label="${esc(label)} : ${done} sur ${total}"><span style="width:${width}%"></span></div>`;
}

function tile({ label, value, hint, bad = false, bar = "" }) {
  const note = bad ? `${icon("alert", "critical")} au-dessus du seuil` : esc(hint);
  return `<div class="card tile${bad ? " bad" : ""}"><div class="muted small">${esc(label)}</div><div class="value">${esc(value)}</div>${bar}<div class="muted small cell">${note}</div></div>`;
}

function card(title, description, body, extra = "") {
  const sub = description ? `<p class="muted small">${esc(description)}</p>` : "";
  return `<section class="card ${extra}"><header><h3>${esc(title)}</h3>${sub}</header>${body}</section>`;
}

// --- Avancement du projet ---

function pageHeader(progress, { generatedAt, since, source }) {
  const name = progress?.project.name || "Projet";
  const gates = progress?.project.gates;
  const gatesBadge =
    gates === "success"
      ? badge(`${icon("check", "good")} gates vert sur main`)
      : gates === "failure"
        ? badge(`${icon("alert", "critical")} gates rouge sur main`)
        : badge(`${icon("circle")} gates : n/d`);
  const phase = progress?.project.autonomyPhase;
  const badges = [phase ? badge(`Phase d'autonomie ${phase}`) : "", progress ? gatesBadge : ""].join("");
  const origin = source ? ` · lu sur ${esc(source)}` : "";
  return `<header><div><h1>${esc(name)}</h1><p class="muted">Tableau de bord · généré le ${esc(generatedAt)}${origin} · santé de la factory depuis le ${esc(since)}</p></div><div class="badges">${badges}</div></header>`;
}

function stepper(steps) {
  const items = steps
    .map((step) => {
      const state = step.status === "done" ? "Fait" : step.status === "current" ? "En cours" : "À venir";
      return `<li class="${esc(step.status)}"><span class="name">${statusIcon(step.status)}${esc(step.label)}</span><span class="muted small">${state}${step.detail ? ` · ${esc(step.detail)}` : ""}</span></li>`;
    })
    .join("");
  return card("Où en est le projet", "Les étapes du cycle, dans l'ordre.", `<ol class="steps">${items}</ol>`);
}

function summaryTiles(totals) {
  return `<div class="grid cols-4">
${tile({ label: "Specs livrées", value: `${totals.specsDelivered} / ${totals.specs}`, hint: "lignes de la roadmap", bar: meter(totals.specsDelivered, totals.specs, "Specs livrées") })}
${tile({ label: "Tâches fusionnées", value: `${totals.tasksDone} / ${totals.tasks}`, hint: "tâches des plans fusionnés", bar: meter(totals.tasksDone, totals.tasks, "Tâches fusionnées") })}
${tile({ label: "En revue", value: String(totals.tasksInReview), hint: `${plural(totals.tasksInProgress, "tâche")} en cours` })}
${tile({ label: "Bloquants", value: String(totals.blockers), hint: totals.blockers === 0 ? "rien ne bloque" : "détail ci-dessous" })}
</div>`;
}

function actionsCard(actions) {
  const items = actions
    .map(
      (a) =>
        `<li>${icon("chevron", "active")}<div><code>${esc(a.command)}</code><div class="muted small">${a.spec ? `${esc(a.spec)} · ` : ""}${esc(a.reason)}</div></div></li>`,
    )
    .join("");
  const body = items ? `<ul class="list">${items}</ul>` : '<p class="empty">Rien à lancer pour l\'instant.</p>';
  return card("À faire maintenant", "La prochaine commande de chaque spec, dans l'ordre de la roadmap.", body);
}

function blockerItems(blockers) {
  return blockers
    .map(
      (b) =>
        `<li>${icon("alert", "warning")}<div>${b.spec ? `<strong>${esc(b.spec)}</strong> · ` : ""}${esc(b.message)}</div></li>`,
    )
    .join("");
}

function blockersCard(blockers) {
  const items = blockerItems(blockers);
  const body = items ? `<ul class="list">${items}</ul>` : '<p class="empty">Aucun bloquant.</p>';
  return card("Bloquants", "Ce qui empêche une spec d'avancer.", body);
}

function stageCell(stage) {
  const reached = STAGE_ORDER.indexOf(stage);
  const segments = STAGE_ORDER.slice(1)
    .map((_, i) => `<i${i < reached ? ' class="on"' : ""}></i>`)
    .join("");
  return `<div class="stage"><span class="name">${statusIcon(stage)}${esc(STAGE_LABELS[stage] ?? stage)}</span><div class="track" role="img" aria-label="Étape ${reached} sur ${STAGE_ORDER.length - 1}">${segments}</div></div>`;
}

function tasksCell(spec) {
  if (!spec.plan) return '<div class="tasks muted small">pas de plan</div>';
  const tasks = spec.plan.tasks;
  const done = tasks.filter((task) => task.status === "done").length;
  return `<div class="tasks"><span class="small count">${done} / ${plural(tasks.length, "tâche")}</span>${meter(done, tasks.length, "Tâches fusionnées")}</div>`;
}

function taskRow(task) {
  const pr = task.pr ? `<a href="${esc(task.pr.url)}">#${task.pr.number}</a>` : "";
  const review = task.review.passes ? `${plural(task.review.passes, "passage")}, ${esc(task.review.lastVerdict)}` : "";
  return `<tr><td>${esc(task.id)}</td><td>${esc(task.title)}</td><td><span class="cell">${statusIcon(task.status)}${esc(TASK_LABELS[task.status] ?? task.status)}</span></td><td>${esc(task.group)}</td><td>${esc(task.risk)}</td><td>${esc(task.criteria.join(", "))}</td><td>${pr}</td><td>${review}</td></tr>`;
}

function tasksTable(spec) {
  if (!spec.exists) return '<p class="empty">Spec à écrire.</p>';
  if (!spec.plan) return `<p class="empty">Pas de plan sur la référence lue : <code>/plan ${esc(spec.id)}</code>.</p>`;
  const rows = spec.plan.tasks.map(taskRow).join("");
  return `<div class="scroll"><table><tr><th>Tâche</th><th>Titre</th><th>Statut</th><th>Groupe</th><th>Risque</th><th>Critères</th><th>PR</th><th>Revue</th></tr>${rows}</table></div>`;
}

function specFacts(spec) {
  const contract =
    spec.contract.files === 0
      ? "absent"
      : spec.contract.delivered
        ? "actif (plus de .skip)"
        : `en .skip${spec.contract.todos ? `, ${spec.contract.todos} it.todo` : ""}`;
  const uncovered = spec.uncoveredCriteria.length ? `, non couverts : ${spec.uncoveredCriteria.join(", ")}` : "";
  const facts = [
    ["Statut déclaré", spec.declaredStatus || "n/d"],
    ["Risque estimé", spec.risk || "n/d"],
    ["Dépend de", spec.dependsOn.join(", ") || "aucune"],
    ["Critères", `${spec.criteria.length}${uncovered}`],
    ["Contrat", contract],
    ["Scénarios cachés", spec.hasHoldout ? "présents" : "absents"],
    ["Plan", spec.plan ? spec.plan.status || "sans statut" : "aucun"],
    ["Livrée le", spec.deliveredAt ? spec.deliveredAt.slice(0, 10) : "n/d"],
  ];
  return `<dl>${facts.map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}

function specRow(spec, blockers) {
  const own = blockerItems(blockers.filter((b) => spec.id && b.spec === spec.id));
  const flag = own ? badge(`${icon("alert", "warning")} bloquée`) : "";
  const summary = `<summary><span class="order muted small">${esc(spec.id ?? "à écrire")}</span><span class="title" title="${esc(spec.title)}">${esc(spec.title)} ${flag}</span>${stageCell(spec.stage)}${tasksCell(spec)}${icon("chevron", "chevron")}</summary>`;
  const body = `<div class="body">${spec.exists ? specFacts(spec) : ""}${own ? `<ul class="list">${own}</ul>` : ""}${tasksTable(spec)}</div>`;
  return `<details class="spec">${summary}${body}</details>`;
}

function roadmapCard(progress) {
  const groups = progress.milestones
    .map((m) => {
      const specs = progress.specs.filter((spec) => spec.milestone === m.milestone);
      const rows = specs.map((spec) => specRow(spec, progress.blockers)).join("");
      return `<div class="milestone"><h3>${esc(m.milestone)}</h3><span class="muted small">specs livrées : ${m.specsDelivered} / ${m.specs} · tâches fusionnées : ${m.tasksDone} / ${m.tasks}</span></div><div class="specs">${rows}</div>`;
    })
    .join("");
  const body = groups || '<p class="empty">La roadmap est vide : <code>/roadmap &lt;brief&gt;</code>.</p>';
  return card("Roadmap", "Chaque spec, son étape et ses tâches. Clique sur une ligne pour le détail.", body);
}

function progressSections(progress) {
  if (!progress)
    return card(
      "Avancement indisponible",
      "",
      "<p>origin/main est illisible (dépôt sans remote ?). Relance avec <code>--local</code> pour lire l'arbre de travail.</p>",
      "alert",
    );
  return [
    stepper(progress.project.steps),
    summaryTiles(progress.totals),
    `<div class="grid cols-2">${actionsCard(progress.nextActions)}${blockersCard(progress.blockers)}</div>`,
    roadmapCard(progress),
  ].join("\n");
}

// --- Santé de la factory ---

/** Histogramme SVG de la consommation pondérée par jour, avec sa vue en tableau. */
function dailyChart(days) {
  if (days.length === 0) return '<p class="empty">Aucun transcript sur la période.</p>';
  const width = 720;
  const height = 180;
  const max = Math.max(...days.map((d) => d.weighted));
  const slot = width / days.length;
  const barWidth = Math.min(slot * 0.8, 16);
  const bars = days
    .map((d, i) => {
      const h = Math.max(4, (d.weighted / max) * (height - 34));
      const x = i * slot + (slot - barWidth) / 2;
      const top = height - 20 - h;
      const r = Math.min(4, barWidth / 2, h);
      // Extrémité arrondie côté valeur, base droite posée sur l'axe.
      const shape = `M${x.toFixed(1)} ${height - 20}V${(top + r).toFixed(1)}q0 -${r} ${r} -${r}h${(barWidth - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${height - 20}z`;
      return `<path d="${shape}"><title>${esc(d.day)} : ${esc(compact(d.weighted))} tokens pondérés, ${d.turns} tours</title></path>`;
    })
    .join("");
  const first = esc(days[0].day);
  const last = esc(days[days.length - 1].day);
  const rows = days
    .map(
      (d) =>
        `<tr><td>${esc(d.day)}</td><td class="num">${esc(compact(d.weighted))}</td><td class="num">${d.turns}</td></tr>`,
    )
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tokens pondérés par jour, de ${first} à ${last}">${bars}<text x="0" y="${height - 4}" class="axis">${first}</text><text x="${width}" y="${height - 4}" text-anchor="end" class="axis">${last}</text><text x="0" y="12" class="axis">max ${esc(compact(max))}</text></svg>
<details class="data"><summary>Voir les données</summary><div class="scroll"><table><tr><th>Jour</th><th class="num">Tokens pondérés</th><th class="num">Tours</th></tr>${rows}</table></div></details>`;
}

function tokensSection(stats, days, thresholds) {
  const total = days.reduce((acc, d) => acc + d.weighted, 0);
  const perDay = days.length === 0 ? null : total / days.length;
  const perPr = stats.merged === 0 || days.length === 0 ? null : total / stats.merged;
  return `<h2>Tokens</h2>
<div class="grid cols-4">
${tile({ label: "Moyenne par jour actif", value: perDay === null ? "n/d" : compact(perDay), hint: "tokens pondérés" })}
${tile({ label: "Total sur la période", value: compact(total), hint: `${days.length} jour(s) actif(s)` })}
${tile({ label: "Par PR fusionnée", value: perPr === null ? "n/d" : compact(perPr), hint: thresholds.tokensPerMergedPr.hint })}
</div>
${card("Tokens pondérés par jour", "Tous workspaces confondus, transcripts de ce poste.", dailyChart(days))}`;
}

function reviewSection(stats, flagged) {
  const levelRows = Object.entries(stats.levels)
    .map(
      ([level, l]) =>
        `<tr><td>${esc(level)}</td><td class="num">${l.passes}</td><td class="num">${l.rejected}</td><td class="num">${pct(l.rejected / l.passes)}</td></tr>`,
    )
    .join("");
  const rejected = stats.rejectedPrs.map((p) => `<li>#${p.number} ${esc(p.title)} (${esc(p.verdict)})</li>`).join("");
  const levels = `<div class="scroll"><table><tr><th>Niveau</th><th class="num">Passages</th><th class="num">Rejets</th><th class="num">Taux</th></tr>${levelRows || '<tr><td colspan="4" class="muted">Aucun passage journalisé.</td></tr>'}</table></div>`;
  return `<h2>Revue</h2>
<div class="grid cols-4">
${tile({ label: "Rejet au premier passage", value: pct(stats.firstPassRejectionRate), hint: `${stats.reviewedPrs} PR relue(s)`, bad: flagged.has("firstPassRejectionRate") })}
${tile({ label: "Passages moyens par PR", value: num(stats.avgPasses), hint: "objectif : 2 au plus", bad: flagged.has("avgPasses") })}
${tile({ label: "Taux de reprise", value: pct(stats.reworkRate), hint: "PR à plus d'un passage" })}
${tile({ label: "Revues écartées (waive)", value: String(stats.waived), hint: "réservées à l'humain" })}
</div>
<div class="grid cols-2">
${card("Passages par niveau de revue", "", levels)}
${card("PR rejetées au premier passage", "", `<ul class="plain">${rejected || '<li class="muted">Aucune.</li>'}</ul>`)}
</div>`;
}

function deliverySection(stats, flagged) {
  const lead = stats.leadTimeMedianHours === null ? "n/d" : `${num(stats.leadTimeMedianHours)} h`;
  return `<h2>Livraison</h2>
<div class="grid cols-4">
${tile({ label: "PR fusionnées", value: String(stats.merged), hint: `${stats.prs} PR ouvertes sur la période` })}
${tile({ label: "Fermées sans fusion", value: pct(stats.closedWithoutMergeRate), hint: `${stats.closedWithoutMerge} PR`, bad: flagged.has("closedWithoutMergeRate") })}
${tile({ label: "Délai médian ouverture → fusion", value: lead, hint: "PR fusionnées" })}
${tile({ label: "PR sans journal de revue", value: String(stats.prsWithoutJournal), hint: "hors périmètre des taux de revue" })}
</div>`;
}

function improvementCard(alerts) {
  const items = alerts
    .map(
      (a) =>
        `<li>${icon("alert", "critical")}<div><strong>${esc(a.key)}</strong> : ${num(a.value, 2)} pour un seuil de ${a.max}. ${esc(a.hint)}.</div></li>`,
    )
    .join("");
  const body = items
    ? `<ul class="list">${items}</ul><p>Lance <code>/retro</code>, puis <code>/learn</code> sur chaque problème récurrent.</p>`
    : '<p class="empty">Aucun seuil dépassé.</p>';
  return card("Boucle d'amélioration", "Indicateurs au-delà de leur seuil.", body);
}

function limitsCard(stats, { source, github }) {
  const limits = [
    source ? `Avancement lu sur ${source} : une spec ou un plan en PR non fusionnée n'y figure pas.` : "",
    github ? "" : "Mode sans GitHub : statuts déduits des fichiers seuls, aucune PR ni workflow lu.",
    "Tokens : seuls les transcripts de ce poste sont lus.",
    `${stats.prsWithoutJournal} PR sans journal de revue, comptées à part des taux de revue.`,
    "« En production » : une spec dont aucune PR de tâche n'est retrouvée n'y passe jamais.",
  ].filter(Boolean);
  return card(
    "Limites des données",
    "",
    `<ul class="plain muted small">${limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
  );
}

/** Page complète : avancement du projet (si `progress` est fourni), puis santé de la factory. */
export function renderPage({ stats, days, alerts, thresholds, generatedAt, progress, source = null, github = true }) {
  const flagged = new Set(alerts.map((a) => a.key));
  const withProgress = progress !== undefined;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tableau de bord</title>
<style>${STYLE}</style></head><body><main>
${pageHeader(progress, { generatedAt, since: stats.since, source })}
${withProgress ? progressSections(progress) : ""}
${withProgress ? "<h2>Santé de la factory</h2>" : ""}
${tokensSection(stats, days, thresholds)}
${reviewSection(stats, flagged)}
${deliverySection(stats, flagged)}
${improvementCard(alerts)}
${limitsCard(stats, { source, github })}
</main></body></html>
`;
}
