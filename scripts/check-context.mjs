#!/usr/bin/env node
/**
 * check-context — mechanical consistency check for the live context documents.
 * GOVERNANCE.md §7.5 / §16.7 controls "State integrity" and "Context navigation" (status: PARTIAL).
 *
 * Establishes:
 *  1. Repository paths referenced in live documents exist, unless the line marks them pending / to be created.
 *  2. Work-item statuses use the §6.2 vocabulary; Edition-2 legacy strings are rejected.
 *  3. The Status header of docs/phases/PH-N.md matches its ROADMAP row; the Status header of PH-N.M.md
 *     matches the subphase row in its parent phase document.
 *  4. At most one phase and one subphase are ACTIVE/VERIFYING, and the subphase belongs to that phase.
 *  5. CURRENT_STATE.md names every active work item.
 *  6. Audit ledger (ROADMAP "## Audit ledger"): every APPROVED phase is counted exactly once; the open cycle
 *     shows "<count>/3" and CURRENT_STATE repeats it; three counted approvals without an audit record under
 *     docs/audits/ is a failure (audit due — §6.4), and an out-of-band record (`*-OOB.md`) does not count as one.
 *  7. No "<NAME>_PLACEHOLDER" token is left in a live document or an evidence record.
 *  8. Paths inside command spans (`node scripts/x.mjs …`) exist like single-path spans, from the root, the
 *     document or a workspace; commit hashes and release tags quoted in live documents exist in this clone
 *     (CI checks out full history for it). Added for BL-030.
 *  9. Repository paths (apps/…, packages/…, scripts/…, docs/…, docker/…) named in shell scripts, Dockerfiles,
 *     compose files, `.env.example` and the CI workflow exist (git-ignored build outputs skipped). PH-12.1, BL-030.
 *     Still unchecked: CI run ids (network) and prose freshness.
 *
 * Limitations: syntax and links only. It cannot judge prose freshness, semantic correctness or product
 * alignment, nor whether an audit record is complete. Bare filenames without a directory
 * component are only checked when they are a known root document or resolve next to the referencing file.
 * Paths Git ignores (build outputs, node_modules, env files) are skipped when missing: they depend on the
 * environment, not on the repository, and the check must give the same verdict locally and in a clean CI
 * checkout (FND-0001). docs/evidence and docs/audits are historical and are not link-checked.
 * Failure signal: non-zero exit, one line per finding. Maintenance owner: Agent (introduced in PH-1.1, BL-003).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DOCS = [
  'GOVERNANCE.md', 'PROJECT_CONTEXT.md', 'CLAUDE.md', 'CURRENT_STATE.md',
  'SESSION_HANDOFF.md', 'CONTEXT_INDEX.md', 'README.md', 'package.json',
];
// Owner-supplied documents contain template paths by design; they are targets, not checked sources.
const OWNER_DOCS = new Set(['GOVERNANCE.md', 'PROJECT_CONTEXT.md', 'README.md']);
const STATUSES = new Set(['PLANNED', 'ACTIVE', 'VERIFYING', 'BLOCKED', 'PAUSED', 'APPROVED', 'WITHDRAWN', 'REVERTED', 'SUPERSEDED']);
const ACTIVE = new Set(['ACTIVE', 'VERIFYING']);
const LEGACY = ['APPROVED WITH OPEN FINDINGS', 'NOT APPROVED'];
const SKIP_LINE = /\(pending\)|created (?:when|with)|to be created|not yet created/i;
const PATH_TOKEN = /^[A-Za-z0-9_./-]+$/;
const FILE_LIKE = /\.(?:md|mjs|cjs|js|ts|tsx|json|ya?ml)$/;
const TEMPLATE_TOKEN = /PH-N|NNNN|FEAT-ID/;

const findings = [];
const rel = (p) => relative(ROOT, p);
const fail = (doc, msg) => findings.push(`${rel(doc)}: ${msg}`);
const strip = (cell) => cell.replace(/`/g, '').trim();
const read = (p) => readFileSync(p, 'utf8').split('\n');

// True when a NON-EMPTY ignore pattern matches the path. `git check-ignore -q` on a non-existent path with a
// trailing slash "matches" a blank .gitignore line on Windows, which hid missing planned directories from the
// local run while CI failed (FND-0057); the pattern is therefore parsed from `-v` and must be non-empty.
function gitIgnored(relPath) {
  // The trailing slash is kept: directory-only patterns such as `dist/` match only when Git sees a directory.
  const path = relPath;
  if (!path) return false;
  try {
    const out = execFileSync('git', ['check-ignore', '-v', '--', path], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return out.split('\n').some((line) => {
      const m = line.match(/^(.*?):(\d+):(.*?)\t/);
      return Boolean(m && m[3].trim());
    });
  } catch {
    return false;
  }
}

/**
 * Exists with exactly this spelling: Windows resolves `docs/Phases/roadmap.md`, Linux (CI) does not, so a wrong-case
 * path passed the local gate and failed after the push (closing audit FND-0110).
 */
function existsExact(absPath) {
  if (!existsSync(absPath)) return false;
  try {
    const expected = relative(ROOT, absPath).replace(/\\/g, '/').replace(/\/$/, '');
    const actual = relative(ROOT, realpathSync.native(absPath)).replace(/\\/g, '/');
    return actual === expected;
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- 1. Links ----------
const liveDocs = [
  ...ROOT_DOCS.filter((f) => f.endsWith('.md') && !OWNER_DOCS.has(f)).map((f) => join(ROOT, f)),
  ...walk(join(ROOT, 'docs')).filter((p) => p.endsWith('.md') && !/[\\/]docs[\\/](?:evidence|audits)[\\/]/.test(p)),
].filter(existsSync);

let linksChecked = 0;
let linksIgnored = 0;
const WORKSPACES = ['apps/api', 'apps/web', 'packages/shared'];
/** A path-like word inside a command span (BL-030): checked from the root, the document and each workspace. */
function checkCommandWord(doc, i, word) {
  const w = word.replace(/^[("'<]+/, '').replace(/[)"'>,;:]+$/, '');
  if (!w.includes('/') || w.startsWith('-') || w.includes('=') || w.includes('://') || !PATH_TOKEN.test(w) || TEMPLATE_TOKEN.test(w)) return;
  if (!FILE_LIKE.test(w) && !w.endsWith('/')) return;
  const candidates = [join(ROOT, w), join(dirname(doc), w), ...WORKSPACES.map((ws) => join(ROOT, ws, w))];
  if (candidates.some(existsExact)) linksChecked++;
  else if (gitIgnored(w)) linksIgnored++;
  else fail(doc, `line ${i + 1}: path in a command not found: ${w}`);
}
for (const doc of liveDocs) {
  read(doc).forEach((line, i) => {
    if (SKIP_LINE.test(line)) return;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const tok = m[1].trim();
      if (/\s/.test(tok)) {
        for (const word of tok.split(/\s+/)) checkCommandWord(doc, i, word);
        continue;
      }
      if (!PATH_TOKEN.test(tok) || TEMPLATE_TOKEN.test(tok)) continue;
      if (!FILE_LIKE.test(tok) && !tok.endsWith('/')) continue;
      const candidates = [join(ROOT, tok), join(dirname(doc), tok)];
      if (tok.includes('/') || ROOT_DOCS.includes(tok)) {
        if (candidates.some(existsExact)) linksChecked++;
        else if (gitIgnored(tok)) linksIgnored++;
        else fail(doc, `line ${i + 1}: referenced path not found: ${tok}`);
      } else if (existsExact(candidates[1])) {
        linksChecked++;
      }
    }
  });
}

// ---------- 1b. Repository paths in non-Markdown sources (PH-12.1, BL-030) ----------
{
  const sources = [
    ...walk(join(ROOT, 'scripts')).filter((p) => p.endsWith('.sh')),
    ...walk(join(ROOT, 'docker')),
    ...walk(join(ROOT, '.github')).filter((p) => /\.ya?ml$/.test(p)),
    join(ROOT, '.env.example'),
  ].filter(existsSync);
  // A repository path: one of the known roots, not preceded by a slash, a dot or a word (container paths such as
  // /app/apps/web and ./apps/web are the image's, not the repository's).
  const REPO_PATH = /(?<![\w/.$-])(?:apps|packages|scripts|docs|docker)\/[A-Za-z0-9_./-]*[A-Za-z0-9_-]/g;
  for (const source of sources) {
    read(source).forEach((line, i) => {
      for (const m of line.matchAll(REPO_PATH)) {
        const tok = m[0];
        if (/[*$<>{}]/.test(tok) || TEMPLATE_TOKEN.test(tok)) continue;
        if (existsExact(join(ROOT, tok))) linksChecked++;
        else if (gitIgnored(tok)) linksIgnored++;
        else fail(source, `line ${i + 1}: repository path not found: ${tok}`);
      }
    });
  }
}

// ---------- 2–3. Lifecycle vocabulary and consistency ----------
const phasesDir = join(ROOT, 'docs/phases');
const roadmap = join(phasesDir, 'ROADMAP.md');
const phases = new Map(); // PH-N -> status (from ROADMAP)
const subphases = new Map(); // PH-N.M -> { status, parent } (from PH-N.md tables)

function statusCell(doc, line, id) {
  for (const legacy of LEGACY) {
    if (line.includes(legacy)) fail(doc, `${id}: legacy status "${legacy}" — migrate to §6.2 vocabulary`);
  }
  const cells = line.split('|').slice(1, -1).map(strip);
  const found = cells.filter((c) => STATUSES.has(c));
  if (found.length !== 1) {
    fail(doc, `${id}: expected exactly one §6.2 status cell, found ${found.length}`);
    return null;
  }
  return found[0];
}

function headerStatus(doc) {
  const line = read(doc).find((l) => /^Status:\s*/.test(l));
  if (!line) return fail(doc, 'missing "Status:" header');
  const status = strip(line.replace(/^Status:\s*/, ''));
  if (!STATUSES.has(status)) return fail(doc, `header status "${status}" is not §6.2 vocabulary`);
  return status;
}

if (!existsSync(roadmap)) {
  fail(roadmap, 'missing');
} else {
  for (const line of read(roadmap)) {
    const m = line.match(/^\|\s*(PH-\d+)\s*\|/);
    if (!m) continue;
    const status = statusCell(roadmap, line, m[1]);
    if (status) phases.set(m[1], status);
  }
}

const phaseDocs = existsSync(phasesDir) ? readdirSync(phasesDir) : [];
for (const name of phaseDocs.filter((n) => /^PH-\d+\.md$/.test(n))) {
  const id = name.replace(/\.md$/, '');
  const doc = join(phasesDir, name);
  const status = headerStatus(doc);
  if (!phases.has(id)) fail(doc, `${id} has no row in ROADMAP.md`);
  else if (status && phases.get(id) !== status) fail(doc, `${id} status "${status}" differs from ROADMAP "${phases.get(id)}"`);
  for (const line of read(doc)) {
    const m = line.match(/^\|\s*(PH-\d+\.\d+)\s*\|/);
    if (!m) continue;
    const sub = m[1];
    const parent = sub.split('.')[0];
    if (parent !== id) fail(doc, `${sub} listed under ${id} but belongs to ${parent}`);
    const s = statusCell(doc, line, sub);
    if (s) subphases.set(sub, { status: s, parent });
  }
}
for (const [id, status] of phases) {
  if ((ACTIVE.has(status) || status === 'APPROVED') && !phaseDocs.includes(`${id}.md`)) {
    fail(roadmap, `${id} is ${status} but docs/phases/${id}.md does not exist`);
  }
}
for (const name of phaseDocs.filter((n) => /^PH-\d+\.\d+\.md$/.test(n))) {
  const id = name.replace(/\.md$/, '');
  const doc = join(phasesDir, name);
  const status = headerStatus(doc);
  const row = subphases.get(id);
  if (!row) fail(doc, `${id} has no row in its parent phase document`);
  else if (status && row.status !== status) fail(doc, `${id} status "${status}" differs from parent table "${row.status}"`);
}

// ---------- 4–5. Active chain and CURRENT_STATE ----------
const activePhases = [...phases].filter(([, s]) => ACTIVE.has(s)).map(([id]) => id);
const activeSubs = [...subphases].filter(([, v]) => ACTIVE.has(v.status)).map(([id]) => id);
if (activePhases.length > 1) fail(roadmap, `more than one active phase: ${activePhases.join(', ')}`);
if (activeSubs.length > 1) fail(roadmap, `more than one active subphase: ${activeSubs.join(', ')}`);
if (activeSubs.length === 1) {
  const parent = subphases.get(activeSubs[0]).parent;
  if (activePhases[0] !== parent) fail(roadmap, `${activeSubs[0]} is active but its parent ${parent} is not the active phase`);
}
const currentState = join(ROOT, 'CURRENT_STATE.md');
if (!existsSync(currentState)) fail(currentState, 'missing');
else {
  const text = readFileSync(currentState, 'utf8');
  for (const id of [...activePhases, ...activeSubs]) {
    if (!text.includes(id)) fail(currentState, `does not mention active work item ${id}`);
  }
}

// ---------- 6. Audit ledger ----------
const AUDIT_CADENCE = 3;
if (existsSync(roadmap)) {
  const lines = read(roadmap);
  const start = lines.findIndex((l) => /^##\s+Audit ledger/.test(l));
  if (start === -1) {
    fail(roadmap, 'missing "## Audit ledger" section');
  } else {
    const counted = new Map(); // PH-N -> cycle
    const cycles = new Map(); // cycle -> { count, statusCell, record }
    for (const line of lines.slice(start + 1)) {
      if (/^##\s/.test(line)) break;
      const m = line.match(/^\|\s*(\d+)\s*\|/);
      if (!m) continue;
      const cells = line.split('|').slice(1, -1).map(strip);
      const [cycle, phaseCell, , recordCell, statusCell] = cells;
      const entry = cycles.get(cycle) ?? { count: 0, statusCell: '', record: '' };
      for (const phase of phaseCell.match(/PH-\d+/g) ?? []) {
        if (counted.has(phase)) fail(roadmap, `ledger counts ${phase} more than once`);
        counted.set(phase, cycle);
        entry.count++;
      }
      entry.statusCell = statusCell ?? '';
      // The cell may annotate its record ("… (out-of-band audit)"): the record is its first .md path (BL-030).
      if (recordCell && recordCell !== '—') {
        const paths = recordCell.match(/[^\s()[\]]+\.md/g) ?? [];
        entry.record = paths.find((p) => !/-oob\.md$/i.test(p)) ?? paths[0] ?? recordCell;
      }
      cycles.set(cycle, entry);
    }
    for (const [id, status] of phases) {
      if (status === 'APPROVED' && !counted.has(id)) fail(roadmap, `${id} is APPROVED but not counted in the audit ledger`);
    }
    const currentStateText = existsSync(currentState) ? readFileSync(currentState, 'utf8') : '';
    for (const [cycle, entry] of cycles) {
      const expected = `${entry.count}/${AUDIT_CADENCE}`;
      if (!entry.statusCell.includes(expected)) fail(roadmap, `cycle ${cycle} status should show "${expected}", found "${entry.statusCell}"`);
      // "Cycle N: n/3" — a stale count of another cycle must not satisfy this (Cycle Audit 2, FND-0038).
      const echo = new RegExp(`Cycle\\s*${cycle}\\s*:\\s*${expected.replace('/', '\\/')}`, 'i');
      if (!echo.test(currentStateText)) fail(currentState, `should repeat the ledger count as "Cycle ${cycle}: ${expected}"`);
      const hasRecord = entry.record && (existsExact(join(ROOT, entry.record)) || existsExact(join(phasesDir, entry.record)));
      if (entry.count >= AUDIT_CADENCE && !hasRecord) {
        fail(roadmap, `cycle ${cycle}: ${entry.count} first-time approvals without an audit record — Cycle Audit is due (§6.4)`);
      } else if (entry.count >= AUDIT_CADENCE && /-oob\.md$/i.test(entry.record)) {
        // An out-of-band audit does not silently reset the count (§6.4): the due cycle needs its own record (BL-030).
        fail(roadmap, `cycle ${cycle}: an out-of-band audit record does not discharge the due Cycle Audit (§6.4)`);
      }
    }
  }
}

// ---------- 7. Placeholder tokens (Cycle Audit 2, FND-0037) ----------
// A "<NAME>_PLACEHOLDER" left in a live document or an evidence record means a claim was never filled in.
{
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
  const rootDocs = ['CURRENT_STATE.md', 'SESSION_HANDOFF.md', 'CLAUDE.md', 'CONTEXT_INDEX.md'].map((f) => join(ROOT, f)).filter(existsSync);
  for (const f of [...walk(join(ROOT, 'docs')), ...rootDocs]) {
    const m = readFileSync(f, 'utf8').match(/[A-Z0-9_]+_PLACEHOLDER/);
    if (m) fail(f, `placeholder token "${m[0]}" left in the document`);
  }
}

// ---------- 8. Commit hashes and release tags (BL-030) ----------
// Evidence and audit records are historical and keep their own references; live documents must not cite a commit
// or a tag this clone does not have. A shallow clone cannot tell, so it fails with the reason (CI: fetch-depth 0).
{
  const git = (args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const exists = (args) => {
    try {
      git(args);
      return true;
    } catch {
      return false;
    }
  };
  const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
  const tags = new Set(git(['tag', '--list']).split('\n').filter(Boolean));
  for (const doc of liveDocs) {
    read(doc).forEach((line, i) => {
      for (const m of line.matchAll(/`([^`]+)`/g)) {
        const tok = m[1].trim();
        if (/^(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}$/.test(tok)) {
          if (shallow) fail(doc, `line ${i + 1}: commit ${tok} cannot be verified in a shallow clone (fetch full history)`);
          else if (!exists(['cat-file', '-e', `${tok}^{commit}`])) fail(doc, `line ${i + 1}: commit ${tok} does not exist in this clone`);
        } else if (/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tok) && !tags.has(tok)) {
          fail(doc, `line ${i + 1}: tag ${tok} does not exist in this clone`);
        }
      }
    });
  }
}

// ---------- Report ----------
const summary = `check-context: ${liveDocs.length} documents, ${linksChecked} links (${linksIgnored} gitignored skipped), ${phases.size} phases, ${subphases.size} subphases, active: ${[...activePhases, ...activeSubs].join(' / ') || 'none'}`;
if (findings.length) {
  console.error(summary);
  for (const f of findings) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`${summary} — OK`);
