/**
 * secret-rules.test.js: the scanner rules must work for gitleaks, not merely for
 * python.
 *
 * `.gitleaks.toml` is read by two engines. `scripts/check_secrets.py` applies it
 * with python's `re` at commit time; the gitleaks binary applies it with RE2 in
 * CI. Python's `re` is a SUPERSET, and the asymmetry is a trap: a rule using a
 * lookahead compiles locally, passes the hook on every commit, and then panics
 * gitleaks:
 *
 *     panic: regexp: Compile(...): error parsing regexp: bad perl operator: `(?=`
 *     Error: Process completed with exit code 2
 *
 * Exit 2 means no scan ran at all, so the branch reports clean while nothing
 * looked at it -- a broken rule is worse than a missing one, and neither the hook
 * nor a green checkmark would tell you. That is why the constraint is a test and
 * not a comment.
 *
 * The second half of this file is the other failure: a rule can compile under both
 * engines, pass every check above, and match nothing it was added for. #38 is
 * exactly that story -- a real bucket name sat on the default branch for months
 * because every anchor was an assignment and it had been written as prose.
 *
 * Note: detection is checked by RUNNING `scripts/check_secrets.py`, not by
 *       re-implementing its regexes in javascript. A javascript copy would be a
 *       third engine with a third set of semantics, and the rule this suite is
 *       about exists because two were already one too many. Shelling out costs a
 *       process per case and tests the thing that actually runs.
 *
 * Note: python3 is a hard requirement here rather than a skip, matching what
 *       .githooks/pre-commit does with ruff. A guard that silently opts out on the
 *       machines lacking the tool is not a guard. It is already required to commit
 *       to this repository at all.
 *
 * Note: the bucket-shaped values below are ASSEMBLED at runtime. A string these
 *       rules report must not sit literally in a tracked file, or the hook flags
 *       this very file on the commit that adds it. The pieces are meaningless
 *       apart, which is the point -- the file holds no bucket name, the test still
 *       gets one.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const CONFIG = path.join(REPO_ROOT, '.gitleaks.toml');
const CHECKER = path.join('scripts', 'check_secrets.py');

//
// RE2 supports none of these. Ordered as they appear in the panic message.
//
const RE2_UNSUPPORTED = [
    ['(?=', 'lookahead'],
    ['(?!', 'negative lookahead'],
    ['(?<=', 'lookbehind'],
    ['(?<!', 'negative lookbehind'],
];

//
// Every regex in the config, flattened to (label, pattern), plus whichever of them
// python itself refuses. tomllib is the same parser check_secrets.py uses, so this
// cannot disagree with the hook about what the config says.
//
function patterns() {
    const script = `
import json, re, sys, tomllib
cfg = tomllib.loads(open(sys.argv[1], encoding="utf-8").read())
out, bad = [], []
def add(label, rx):
    out.append([label, rx])
    try:
        re.compile(rx)
    except re.error as exc:
        bad.append([label, str(exc)])
for rule in cfg.get("rules", []):
    rid = rule.get("id", "<unnamed>")
    for field in ("regex", "path"):
        if field in rule:
            add(f"{rid}.{field}", rule[field])
    for i, rx in enumerate(rule.get("allowlist", {}).get("regexes", [])):
        add(f"{rid}.allowlist[{i}]", rx)
for i, allow in enumerate(cfg.get("allowlists", [])):
    for j, rx in enumerate(allow.get("regexes", [])):
        add(f"allowlists[{i}].regexes[{j}]", rx)
    for j, rx in enumerate(allow.get("paths", [])):
        add(f"allowlists[{i}].paths[{j}]", rx)
print(json.dumps({"patterns": out, "uncompilable": bad}))
`;
    const raw = execFileSync('python3', ['-c', script, CONFIG], { encoding: 'utf8' });
    return JSON.parse(raw);
}

const CONFIG_PATTERNS = patterns();

//
// Hostname-shaped, on no allowlist: what a real leak looks like to the rules.
//
const LEAK = ['acme', 'lake'].join('-') + '.' + ['corp', 'internal'].join('-') + '.' + 'net';

//
// Separator but no dot. Real buckets are often spelled this way, and the prose
// rule has to take it -- requiring dot-joined labels would miss the common case.
//
const HYPHENATED = ['jefflevesque', 'static', 'assets'].join('-');

let workdir;

beforeAll(() => {
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-rules-'));
});

afterAll(() => {
    fs.rmSync(workdir, { recursive: true, force: true });
});

//
// The rule ids check_secrets.py reports for one line of content. Written to a file
// OUTSIDE the repository so the scan is about the fixture and nothing else.
//
function reported(content) {
    const file = path.join(workdir, `fixture-${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(file, `${content}\n`);

    let stdout = '';
    try {
        stdout = execFileSync('python3', [CHECKER, file], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
    } catch (err) {
        //
        // A finding is a non-zero exit, which execFileSync throws on. That is the
        // expected path for every case in the first table below.
        //
        stdout = err.stdout || '';
    }

    return stdout
        .split('\n')
        .filter(line => /:\d+: \S/.test(line))
        .map(line => line.trim().split(': ').pop());
}

describe('.gitleaks.toml compiles for both engines', () => {
    it('parses, and yields patterns to check', () => {
        expect(CONFIG_PATTERNS.patterns.length).toBeGreaterThan(0);
    });

    it('every pattern compiles under python, so the hook can run it', () => {
        expect(CONFIG_PATTERNS.uncompilable).toEqual([]);
    });

    it.each(CONFIG_PATTERNS.patterns)(
        'uses no construct RE2 lacks: %s',
        (label, pattern) => {
            //
            // Express the constraint inside the capture group, or split the rule in
            // two. A lookahead here takes CI down rather than making it strict.
            //
            const found = RE2_UNSUPPORTED
                .filter(([token]) => pattern.includes(token))
                .map(([token, name]) => `${name} ${token}`);

            expect({ label, found }).toEqual({ label, found: [] });
        },
    );

    it.each(CONFIG_PATTERNS.patterns)(
        'uses no backreference: %s',
        (label, pattern) => {
            //
            // RE2 has none either. Matched as a digit escape outside a character
            // class, since '\d' and '\1' differ only by the character.
            //
            const outsideClasses = pattern.replace(/\[[^\]]*\]/g, '');
            const hit = /(^|[^\\])\\[1-9]/.test(outsideClasses);

            expect({ label, backreference: hit }).toEqual({ label, backreference: false });
        },
    );
});

//
// Everything above tests that a rule is VALID. None of it tests that a rule WORKS.
//
describe('the bucket rules catch what #38 was filed about', () => {
    it.each([
        // The shape that motivated the issue: documentation, not code. No
        // assignment, so every anchor that predates this rule missed it.
        ['a docstring naming a bucket', `    bucket: S3 bucket name (e.g., "${LEAK}")`],
        ['a README sentence', `The bundle is uploaded to the bucket "${LEAK}" nightly.`],
        // The javascript SDK spells its parameter as an object property, which is
        // the same shape as prose to a regex.
        ['an AWS SDK call', `await s3.send(new PutObjectCommand({ Bucket: '${LEAK}', Key: k }));`],
        ['a camelCase assignment', `const bucketName = '${LEAK}';`],
        ['a snake_case assignment', `bucket_name = "${LEAK}"`],
        ['a hyphenated name, no dots', `const bucket = '${HYPHENATED}';`],
        // Unambiguous anchors: these need no shape from the value at all.
        ['an s3:// URI', `aws s3 sync static/ s3://${LEAK}/`],
        ['an s3a:// URI', `spark.read.parquet("s3a://${LEAK}/x")`],
        ['an ARN', `"Resource": "arn:aws:s3:::${LEAK}"`],
        ['a virtual-host URL', `fetch("https://${LEAK}.s3.amazonaws.com/content.js")`],
    ])('reports %s', (_label, line) => {
        expect(reported(line)).not.toEqual([]);
    });

    it.each([
        // A README SHOULD be able to write a path. Blocking this teaches people to
        // write worse documentation rather than fewer leaks.
        ['a documented path', 'See `s3://bucket/path` for the layout.'],
        ['a placeholder host', "bucket: 'my-bucket.example.com'"],
        ['a REPLACE token', 'BUCKET="REPLACE-BUCKET-NAME"'],
        ['this project\'s own domain', 'the bucket serving "jefflevesque.com" content'],
        // 'bucket' is TIME vocabulary in this repository -- 126 lines across 21
        // files, almost none about storage. These four are the reason the rule
        // requires a separator in the value.
        ['a time bucket', "const bucket = 'minute';"],
        ['a schedule entry', "{ bucket: 'day', partition: 'year' }"],
        ['an hourly bucket', "const bucket = 'hour';"],
        // A quoted filename is dot-joined labels too, indistinguishable from a
        // hostname to the regex. This exact comment is in rolling-window.test.js.
        ['a filename in a comment', "// caller can name the bucket an instant falls in. 'ingest-gaps.js' uses it"],
        // The value is assembled at runtime, so it is not in the file.
        ['an interpolated name', 'const bucket = `${prefix}-assets`;'],
        ['an SDK call with no literal', 's3.getObject({ Bucket: bucket, Key: key })["Body"]'],
    ])('leaves %s alone', (_label, line) => {
        expect(reported(line)).toEqual([]);
    });
});
