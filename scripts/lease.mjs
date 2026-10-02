#!/usr/bin/env node
// Baux de périmètre partagés entre tous les workspaces Conductor.
// Stockés dans $CONDUCTOR_ROOT_PATH/.factory/leases.json (hors git, visible par tous les workspaces).
// Usage :
//   node scripts/lease.mjs acquire <TASK_ID> <chemin> [chemin...]
//   node scripts/lease.mjs release <TASK_ID>
//   node scripts/lease.mjs release-workspace <workspace_path>
//   node scripts/lease.mjs list
//   node scripts/lease.mjs check <chemin> [chemin...]
import fs from "node:fs";
import path from "node:path";

const root = process.env.CONDUCTOR_ROOT_PATH ?? process.cwd();
const dir = path.join(root, ".factory");
const file = path.join(dir, "leases.json");
const lockFile = path.join(dir, "leases.lock");
const workspace = process.env.CONDUCTOR_WORKSPACE_PATH ?? process.cwd();

const norm = (p) => p.replace(/^\.\//, "").replace(/\/+$/, "");
const overlaps = (a, b) => {
  const [x, y] = [norm(a), norm(b)];
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
};

function withLock(fn) {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 50; i++) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      try {
        const leases = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
        const out = fn(leases);
        fs.writeFileSync(file, JSON.stringify(out.leases, null, 2));
        return out.code;
      } finally {
        fs.closeSync(fd);
        fs.unlinkSync(lockFile);
      }
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  console.error("Impossible d'obtenir le verrou des baux");
  return 2;
}

const [cmd, arg, ...paths] = process.argv.slice(2);

const code = withLock((leases) => {
  switch (cmd) {
    case "acquire": {
      // Un même identifiant ne peut être ré-acquis que par le workspace qui le détient.
      const conflicts = leases.filter(
        (l) =>
          (l.task === arg && l.workspace !== workspace) ||
          (l.task !== arg && l.paths.some((lp) => paths.some((p) => overlaps(lp, p)))),
      );
      if (conflicts.length) {
        for (const c of conflicts)
          console.error(`Bail en conflit : ${c.task} (${c.paths.join(", ")}) tenu par ${c.workspace}`);
        return { leases, code: 1 };
      }
      const rest = leases.filter((l) => l.task !== arg);
      rest.push({ task: arg, paths: paths.map(norm), workspace, since: new Date().toISOString() });
      console.log(`Bail posé pour ${arg}`);
      return { leases: rest, code: 0 };
    }
    case "release":
      return { leases: leases.filter((l) => l.task !== arg), code: 0 };
    case "release-workspace":
      return { leases: leases.filter((l) => l.workspace !== arg), code: 0 };
    case "check": {
      const all = [arg, ...paths];
      const hits = leases.filter((l) => l.paths.some((lp) => all.some((p) => overlaps(lp, p))));
      for (const h of hits) console.log(`${h.task} : ${h.paths.join(", ")}`);
      return { leases, code: hits.length ? 1 : 0 };
    }
    case "list":
      if (!leases.length) console.log("Aucun bail actif");
      for (const l of leases) console.log(`${l.task}  ${l.paths.join(", ")}  (${l.since})`);
      return { leases, code: 0 };
    default:
      console.error("Commande inconnue. Voir l'en-tête du script.");
      return { leases, code: 2 };
  }
});
process.exit(code);
