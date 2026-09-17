/**
 * documentation.test.js: every issue and every file the documentation mentions is a link.
 *
 * The pages are read on the documentation site, where "#46" is plain text and a path in
 * backticks goes nowhere. So an issue a page mentions links to the issue, and a file in
 * this repository links to that file on GitHub -- and this suite fails when one does not.
 *
 * What it reads: every Markdown page under documentation/, and the sections of README.md
 * the pages pull in between their `--8<--` markers. Fenced code blocks are skipped, since
 * a command such as `cd jsx` is not a reference to anything.
 *
 * Note: the repository's files are read from git -- tracked, plus untracked files that
 *       are not ignored, so a page naming a file added in the same change is held to the
 *       rule before that file is committed. A file that exists only in a working copy
 *       and is ignored, such as jsx/aws-exports.js made from its template, has no page
 *       on GitHub to link to, and is not required to link.
 *
 * Note: under meta/, beside issue-templates.test.js and for its reason. It imports
 *       nothing from import/, so it moves no coverage figure.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const REPOSITORY = 'https://github.com/jeff1evesque/jefflevesque.com';

function repositoryPaths() {
    const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
    const directories = new Set();

    files.forEach(file => {
        const parts = file.split('/');
        for (let i = 1; i < parts.length; i++) {
            directories.add(parts.slice(0, i).join('/'));
        }
    });

    return { files: new Set(files), directories: directories };
}

function markdownUnder(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return markdownUnder(full);
        }
        return entry.name.endsWith('.md') ? [full] : [];
    });
}

//
// the README sections a page pulls in, as { name: text }
//
function readmeSections(text) {
    const sections = {};
    const pattern = /<!-- --8<-- \[start:([\w-]+)\] -->\n([\s\S]*?)<!-- --8<-- \[end:\1\] -->/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        sections[match[1]] = match[2];
    }

    return sections;
}

function withoutCodeBlocks(text) {
    return text.replace(/^```[\s\S]*?^```/gm, '');
}

//
// every issue mention in `text` that is not a link to that issue. An issue mention is
// '#' and digits, not inside a URL, an anchor, an entity or a word.
//
export function unlinkedIssues(text) {
    const problems = [];
    const linked = /\[#(\d+)\]\(([^)\s]+)\)/g;

    const rest = withoutCodeBlocks(text).replace(linked, (whole, number, url) => {
        if (url !== `${REPOSITORY}/issues/${number}`) {
            problems.push(`#${number} links to ${url}`);
        }
        return '';
    });

    (rest.match(/(?<![\w/&#-])#\d+\b/g) || []).forEach(mention => {
        problems.push(`${mention} is not a link`);
    });

    return problems;
}

//
// every file or directory of this repository named in backticks in `text` that is not
// a link to it on GitHub
//
export function unlinkedPaths(text, { files, directories }) {
    const problems = [];
    const known = (name) => files.has(name) || directories.has(name);
    const urlFor = (name) => files.has(name)
        ? `${REPOSITORY}/blob/master/${name}`
        : `${REPOSITORY}/tree/master/${name}`;
    const linked = /\[`([^`]+)`\]\(([^)\s]+)\)/g;

    const rest = withoutCodeBlocks(text).replace(linked, (whole, code, url) => {
        const name = code.replace(/\/$/, '');

        if (known(name) && url !== urlFor(name)) {
            problems.push(`\`${code}\` links to ${url}, not ${urlFor(name)}`);
        }
        return '';
    });

    (rest.match(/`[^`\n]+`/g) || []).forEach(span => {
        const name = span.slice(1, -1).replace(/\/$/, '');

        if (known(name)) {
            problems.push(`${span} is not a link to ${urlFor(name)}`);
        }
    });

    return problems;
}

const PATHS = repositoryPaths();
const PAGES = markdownUnder(path.join(ROOT, 'documentation'))
    .map(file => [path.relative(ROOT, file), fs.readFileSync(file, 'utf8')]);
const SECTIONS = Object.entries(readmeSections(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')))
    .map(([name, text]) => [`README.md:${name}`, text]);

describe.each([...PAGES, ...SECTIONS])('%s', (name, text) => {
    it('links every issue it mentions to the issue', () => {
        expect({ name, problems: unlinkedIssues(text) }).toEqual({ name, problems: [] });
    });

    it('links every repository file it mentions to the file', () => {
        expect({ name, problems: unlinkedPaths(text, PATHS) }).toEqual({ name, problems: [] });
    });
});

describe('what it reads', () => {
    it('finds the pages, and the README sections they pull in', () => {
        //
        // guards the guard: a moved directory or renamed markers would otherwise pass
        // this suite by giving it nothing to read.
        //
        expect(PAGES.length).toBeGreaterThan(10);
        expect(SECTIONS.map(([name]) => name).sort())
            .toEqual(['README.md:overview', 'README.md:quick-start', 'README.md:routes']);
    });
});

describe('the guard itself', () => {
    const paths = { files: new Set(['jsx/jest.config.js']), directories: new Set(['jsx']) };

    it('accepts a linked issue', () => {
        expect(unlinkedIssues(`see [#46](${REPOSITORY}/issues/46)`)).toEqual([]);
    });

    it('rejects a bare issue mention', () => {
        expect(unlinkedIssues('see #46 for why')).toEqual(['#46 is not a link']);
    });

    it('rejects an issue linked somewhere else', () => {
        expect(unlinkedIssues(`see [#46](${REPOSITORY}/issues/47)`)).toHaveLength(1);
    });

    it('ignores anchors, entities and code blocks', () => {
        expect(unlinkedIssues('[a](page.md#the-hooks) &#183; x\n```\ngit log #1\n```\n')).toEqual([]);
    });

    it('accepts a linked file', () => {
        expect(unlinkedPaths(`[\`jsx/jest.config.js\`](${REPOSITORY}/blob/master/jsx/jest.config.js)`, paths))
            .toEqual([]);
    });

    it('rejects a file named in backticks without a link', () => {
        expect(unlinkedPaths('the floor lives in `jsx/jest.config.js`', paths)).toHaveLength(1);
    });

    it('rejects a directory linked as a file', () => {
        expect(unlinkedPaths(`[\`jsx/\`](${REPOSITORY}/blob/master/jsx)`, paths)).toHaveLength(1);
    });

    it('leaves alone code that names nothing in the repository', () => {
        expect(unlinkedPaths('run `npx jest` with `is_local.js` set', paths)).toEqual([]);
    });
});
