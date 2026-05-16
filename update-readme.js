/**
 * update-readme.js
 *
 * Fills the Version table in README.md from .env.
 * Driven by: VERSION, VERSION_date, VERSION_mess
 *
 * Run with: npm run update-readme   (called by git_steps.bat step 001)
 *
 * Anchoring: the table lives directly under the "## Version" heading.
 * We deliberately do NOT use <!-- HTML comment --> markers: a formatter/hook
 * in this workspace strips HTML comments from README.md, which would delete
 * the markers on every save. The "## Version" heading is a normal Markdown
 * heading the formatter keeps, so it is the stable anchor instead.
 *
 * On each run, everything between the "## Version" heading and the next
 * non-blank / non-table line is replaced with a freshly generated table.
 *
 * Zero dependencies — hand-rolled .env parser (no dotenv). Lookups are
 * case-insensitive (see pick()) because an editor hook lowercases the token
 * "MESS" (VERSION_mess); the canonical name used here is VERSION_mess but
 * any casing in .env still resolves.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');
const README_PATH = path.join(__dirname, 'README.md');
const HEADING = '## Version';

/**
 * Minimal .env parser. KEY=value, optional surrounding single/double quotes,
 * ignores blank lines and # comments. Keys kept as-is; use pick() to read.
 * @param {string} text
 * @returns {Record<string,string>}
 */
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Case-insensitive env lookup (the editor hook flips MESS<->mess casing). */
function pick(env, name) {
  const want = name.toLowerCase();
  for (const k of Object.keys(env)) {
    if (k.toLowerCase() === want) return env[k];
  }
  return '';
}

/** Escape a pipe so a value can't break the markdown table. */
function cell(v) {
  return String(v).replace(/\|/g, '\\|');
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`[update-readme] .env not found at ${ENV_PATH}`);
    process.exit(1);
  }

  const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  const version = pick(env, 'VERSION');
  const date = pick(env, 'VERSION_date');
  const mess = pick(env, 'VERSION_mess');

  if (!version && !date && !mess) {
    console.error(
      '[update-readme] .env has no VERSION / VERSION_date / VERSION_mess — nothing to write.'
    );
    process.exit(1);
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';

  if (!new RegExp(`^${HEADING}\\s*$`, 'm').test(readme)) {
    console.error(
      `[update-readme] "${HEADING}" heading not found in README.md. ` +
        `Add a "${HEADING}" heading where the table should go, then re-run.`
    );
    process.exit(1);
  }

  const table = [
    HEADING,
    '',
    '| Field          | Value        |',
    '| -------------- | ------------ |',
    `| \`VERSION\`      | \`${cell(version)}\` |`,
    `| \`VERSION_date\` | \`${cell(date)}\` |`,
    `| \`VERSION_mess\` | \`${cell(mess)}\` |`,
    '',
  ].join(eol);

  // Match the heading plus any following blank lines and an existing
  // markdown table (contiguous lines starting with '|'). Stops at the first
  // line that is neither blank nor a table row (e.g. the intro paragraph or
  // the next heading) so the rest of the README is untouched.
  const region = new RegExp(
    `^${HEADING}[ \\t]*\\r?\\n(?:[ \\t]*\\r?\\n|\\|[^\\r\\n]*\\r?\\n)*`,
    'm'
  );

  readme = readme.replace(region, table + eol);
  fs.writeFileSync(README_PATH, readme);
  console.log(
    `[update-readme] README.md Version table updated from .env:\n` +
      `  VERSION=${version}  VERSION_date=${date}  VERSION_mess=${mess}`
  );
}

main();
