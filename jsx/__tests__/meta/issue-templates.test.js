/**
 * issue-templates.test.js: a broken issue template does not fail, it disappears.
 *
 * GitHub reads the YAML front matter of every file in `.github/ISSUE_TEMPLATE/` to
 * build the chooser behind "New issue". Front matter that does not parse, or that
 * omits `name`, drops that template out of the list SILENTLY -- nothing errors,
 * nothing 404s, and the only symptom is a chooser one entry short. A label named in
 * front matter that does not exist in the repository fails the same way: GitHub
 * ignores it rather than creating it, so a typo applies no label and says nothing.
 *
 * Both are only observable from the DEFAULT branch, because that is the only branch
 * the chooser loads templates from. So the first chance to catch either by hand is
 * AFTER the merge that shipped it -- which is the whole reason they are caught here.
 * `tests.yml` runs on every pull request, so this fails while the branch is still
 * open.
 *
 * Note: this is the only suite under __tests__/ that is not about a module in
 *       `import/`, which is why it sits in its own `meta/` directory rather than
 *       mirroring a source path that does not exist. It imports nothing from
 *       `import/`, so it moves no coverage figure and cannot affect the floor in
 *       jest.config.js.
 *
 * Note: the front matter is parsed HERE rather than with js-yaml. js-yaml is present
 *       only as a transitive dependency -- 3.15.1 hoisted out of istanbul, 4.3.1
 *       nested under eslint -- so which version resolves depends on what else npm
 *       happened to install, and none of it is declared in package.json. The same
 *       reasoning keeps `globals` out of eslint.config.mjs and keeps the two python
 *       checkers stdlib-only: a guard that can break when somebody else's tree moves
 *       is a guard with a second failure mode.
 *
 *       The parser below is deliberately STRICTER than YAML. It reads a flat
 *       `key: value` mapping and rejects anything else -- indentation, nesting, flow
 *       mappings, block scalars -- all of which real YAML would accept. That
 *       direction is the safe one: it can only ever reject a template GitHub would
 *       have taken, which is a loud red build with the fix in the message, never
 *       accept one GitHub would have dropped, which is the silent failure above. If
 *       a template ever genuinely needs a multi-line value, widen the parser in the
 *       same commit and say so here.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const TEMPLATES = path.join(REPO_ROOT, '.github', 'ISSUE_TEMPLATE');

//
// 'name' is what GitHub labels the chooser entry with, 'about' is the line beneath
// it. Neither may be empty or the entry is unreadable -- or, for 'name', absent.
//
const CHOOSER_KEYS = ['name', 'about'];

//
// Optional to GitHub, conventional here. Checked for presence rather than content:
// `labels: ''` on change.md is a deliberate value, not an oversight -- no existing
// label means "a behaviour or feature change", and defining a label set was put out
// of scope by #39.
//
const CONVENTION_KEYS = ['title', 'labels', 'assignees'];

//
// The repository's labels, which are GitHub's defaults, unmodified. A label named in
// front matter has to be one of these: GitHub silently ignores the rest.
//
// This list is hand-maintained, which #11 is the standing argument against -- but it
// differs from the figures that issue deleted in the way that matters. A coverage
// percentage changes on every run and cannot be kept true by hand; this set changes
// when somebody deliberately adds a label, and is one click to verify. A new label
// fails here with the fix named in the message rather than drifting quietly.
//
const REPOSITORY_LABELS = [
    'bug',
    'documentation',
    'duplicate',
    'enhancement',
    'good first issue',
    'help wanted',
    'invalid',
    'question',
    'wontfix',
];

//
// Reads the flat `key: value` mapping described at the head of this file. Throws
// with the reason GitHub would have skipped the file, so a failure names the cause
// rather than the symptom.
//
function flatMapping(lines, offset) {
    const mapping = {};

    lines.forEach((line, index) => {
        const where = `line ${index + offset}`;

        if (line.trim() === '' || line.trimStart().startsWith('#')) {
            return;
        }
        if (line !== line.trimStart()) {
            throw new Error(`${where} is indented, and only a flat mapping is read here`);
        }

        const colon = line.indexOf(':');
        if (colon === -1) {
            throw new Error(`${where} carries no 'key: value' pair`);
        }

        const key = line.slice(0, colon).trim();
        if (key === '') {
            throw new Error(`${where} has an empty key`);
        }

        //
        // Strip one matching pair of surrounding quotes, so `labels: ''` reads as the
        // empty string it means rather than as two apostrophes.
        //
        let value = line.slice(colon + 1).trim();
        const quote = value.charAt(0);
        if ((quote === "'" || quote === '"') && value.length >= 2 && value.endsWith(quote)) {
            value = value.slice(1, -1);
        }

        mapping[key] = value;
    });

    return mapping;
}

//
// Splits a template into its front matter and the body GitHub prefills the issue
// with. Exported shape mirrors what the assertions below need: both halves, or a
// throw naming why the file would not be offered.
//
function frontMatter(text) {
    const lines = text.split('\n');

    if (lines[0] !== '---') {
        throw new Error('does not open with a --- front matter fence');
    }

    const end = lines.indexOf('---', 1);
    if (end === -1) {
        throw new Error('front matter fence is never closed');
    }

    return {
        //
        // offset 2: line 1 is the opening fence, so the first mapping line is line 2
        // of the file. Keeps a failure message pointing at the line an editor shows.
        //
        meta: flatMapping(lines.slice(1, end), 2),
        body: lines.slice(end + 1).join('\n'),
    };
}

function templateFiles() {
    return fs.readdirSync(TEMPLATES)
        .filter(name => name.endsWith('.md'))
        .sort();
}

describe('.github/ISSUE_TEMPLATE', () => {
    it('offers every template to the chooser', () => {
        const names = [];

        templateFiles().forEach(name => {
            const where = `ISSUE_TEMPLATE/${name}`;
            const text = fs.readFileSync(path.join(TEMPLATES, name), 'utf8');

            let parsed;
            try {
                parsed = frontMatter(text);
            } catch (err) {
                throw new Error(`${where}: ${err.message}`);
            }

            //
            // Reported as a list rather than one assertion per key, so a failure
            // names the file and every key wrong with it in a single diff.
            //
            const empty = CHOOSER_KEYS.filter(key => !parsed.meta[key]);
            expect({ where, empty }).toEqual({ where, empty: [] });

            const missing = CONVENTION_KEYS.filter(key => !(key in parsed.meta));
            expect({ where, missing }).toEqual({ where, missing: [] });

            //
            // A template with nothing under the fence prefills an empty issue, which
            // is the blank issue with extra steps.
            //
            expect({ where, body: parsed.body.trim() === '' ? 'empty' : 'present' })
                .toEqual({ where, body: 'present' });

            names.push(parsed.meta.name);
        });

        //
        // Guards the guard: a rename or a moved directory would otherwise pass this
        // suite by giving it nothing to iterate.
        //
        expect(names.length).toBeGreaterThan(0);
        expect(new Set(names).size).toBe(names.length);
    });

    it('names only labels the repository actually has', () => {
        templateFiles().forEach(name => {
            const { meta } = frontMatter(fs.readFileSync(path.join(TEMPLATES, name), 'utf8'));

            const labels = (meta.labels || '')
                .split(',')
                .map(label => label.trim())
                .filter(label => label !== '');

            const unknown = labels.filter(label => !REPOSITORY_LABELS.includes(label));
            expect({ template: name, unknown }).toEqual({ template: name, unknown: [] });
        });
    });

    it('keeps the blank issue available', () => {
        //
        // Issues here are drafted in full, sometimes offline, and pasted in one
        // piece; the chooser must not be the only way in. This is GitHub's default,
        // so the file exists to state it rather than to change it -- which is exactly
        // why a silent edit to it is worth catching.
        //
        const text = fs.readFileSync(path.join(TEMPLATES, 'config.yml'), 'utf8');
        const config = flatMapping(text.split('\n'), 1);

        //
        // The literal token, not a truthiness test. YAML would also accept `True`,
        // `yes` and `on`; requiring the canonical spelling keeps the file readable to
        // the next person as well as to GitHub.
        //
        expect(config.blank_issues_enabled).toBe('true');
    });

    it('keeps the three deliverables anchored in the change template', () => {
        //
        // #39 calls this the part actually worth encoding: a change here lands as
        // code, tests and documentation, and only the first is obvious. Asserting the
        // anchors rather than the prose -- reword freely, but a rewrite that drops
        // one of these has dropped the deliverable with it.
        //
        const text = fs.readFileSync(path.join(TEMPLATES, 'change.md'), 'utf8');

        [
            'jsx/__tests__/',      // where a test goes
            'jest.config.js',      // the floor that holds it
            'README.md',           // the documentation nothing in CI reads
            'feature-<issue>',     // the branch convention
            '#<issue>:',           // the commit convention
        ].forEach(anchor => {
            expect({ anchor, present: text.includes(anchor) })
                .toEqual({ anchor, present: true });
        });
    });
});

//
// Guards the guard, the other half: a parser that never rejects anything would pass
// every assertion above while catching none of the failures this file exists for.
//
describe('the front matter parser', () => {
    it.each([
        ['no fence', 'name: Change\nabout: no fence at all\n'],
        ['unclosed fence', '---\nname: Change\nabout: fence never closed\n'],
        ['not a mapping', '---\njust a string, not a mapping\n---\n\n## Problem\n'],
        ['nested', '---\nname: Change\nlabels:\n  - bug\n---\n\n## Problem\n'],
    ])('rejects a template GitHub would skip: %s', (_label, text) => {
        expect(() => frontMatter(text)).toThrow();
    });
});
