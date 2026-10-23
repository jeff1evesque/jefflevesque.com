/**
 * openapi.test.js: the three OpenAPI documents the documentation site renders.
 *
 * Each document drives a Swagger UI on the site, and its examples are what a reader
 * takes the api to answer. A document that no longer parses renders nothing; an
 * example that does not match its own schema documents a response the api does not
 * give. Neither fails anything on the site itself, so both are caught here.
 *
 * Note: under meta/, beside issue-templates.test.js and for its reason -- this is about
 *       files in the repository rather than a module in import/, so it imports nothing
 *       from import/ and moves no coverage figure. Whether the application sends the
 *       parameters these documents declare is api-url.test.js's question, and whether
 *       it can read the examples is asked in each loader's own suite.
 *
 * Note: OpenAPI 3.1 schemas are JSON Schema 2020-12, so ajv validates them as they are.
 *       'allowUnionTypes' because the documents say "a string, or null" as
 *       type: ["string", "null"], which strict mode would otherwise report through
 *       console.warn -- and setup.js fails a test on unexpected console output.
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const OPENAPI = path.join(__dirname, '..', '..', '..', 'documentation', 'api', 'openapi');
const SERVER = 'https://api.jefflevesque.com/v1/public';
const DOCUMENTS = ['performance', 'datalake', 'knowledge-graph', 'model'];

//
// a document as it is written: a response every operation gives -- the 429 of a
// request past the rate limit (#210) -- is written once, under components, and
// referred to by each operation
//
function rawDocumentOf(name) {
    return JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
}

//
// what a '#/...' reference points at, in `document`
//
function pointedAt(document, ref) {
    return ref.slice(2).split('/').reduce((node, key) => node[key], document);
}

//
// a document as Swagger UI reads it, each operation's referred response in its
// place, so the checks below read every response alike
//
function documentOf(name) {
    const document = rawDocumentOf(name);

    Object.values(document.paths).forEach((item) => {
        Object.values(item).forEach((operation) => {
            Object.entries(operation.responses || {}).forEach(([status, response]) => {
                if (response && typeof response.$ref === 'string' && response.$ref.startsWith('#/')) {
                    operation.responses[status] = pointedAt(document, response.$ref);
                }
            });
        });
    });

    return document;
}

//
// the one format a document names: an ISO 8601 date-time, which the performance
// api's End takes. With its offset, since End names an instant and the api refuses
// one without -- strict mode refuses a format it was not told of, rather than
// ignoring it.
//
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function ajv() {
    return new Ajv2020({
        strict: true,
        allowUnionTypes: true,
        allErrors: true,
        formats: { 'date-time': DATE_TIME },
    });
}

//
// every example in a media type object -- or in a parameter, which carries them the
// same way -- named: the single 'example', or each of 'examples' by its key.
//
function examplesOf(media) {
    const named = Object.entries(media.examples || {}).map(([name, e]) => [name, e.value]);

    return 'example' in media ? [['example', media.example], ...named] : named;
}

function operationsOf(document) {
    return Object.entries(document.paths).flatMap(([route, item]) =>
        Object.entries(item).map(([method, operation]) => ({ route, method, operation }))
    );
}

describe.each(DOCUMENTS)('%s.json', (name) => {
    const document = documentOf(name);

    it('declares OpenAPI 3.1', () => {
        expect(document.openapi).toMatch(/^3\.1\.\d+$/);
    });

    it('names itself', () => {
        expect(document.info.title).toBeTruthy();
        expect(document.info.version).toBe('v1');
    });

    it('is served from the public api, and only from there', () => {
        //
        // Swagger UI sends Try it out to the first server, so a stale or local one here
        // would send the reader's requests somewhere else.
        //
        expect(document.servers).toEqual([{ url: SERVER }]);
    });

    it('offers only GET', () => {
        //
        // the apis answer a plain GET from any origin, and refuse the CORS preflight
        // any other method would need -- a documented POST could not be tried.
        //
        operationsOf(document).forEach(({ route, method }) => {
            expect({ route, method }).toEqual({ route, method: 'get' });
        });
    });

    it('takes its parameters from the query string or the path, each described', () => {
        operationsOf(document).forEach(({ route, operation }) => {
            (operation.parameters || []).forEach(parameter => {
                expect(['query', 'path']).toContain(parameter.in);
                expect(parameter.description).toBeTruthy();

                //
                // a path parameter is part of the address rather than something
                // that can be left off, and OpenAPI requires it be declared so.
                // Swagger UI reads it too: an optional one renders a field the
                // reader can clear into a url that does not exist.
                //
                if (parameter.in === 'path') {
                    expect({ parameter: parameter.name, required: parameter.required })
                        .toEqual({ parameter: parameter.name, required: true });
                    expect(route).toContain(`{${parameter.name}}`);
                }
            });
        });
    });

    it('declares a parameter for every templated segment in its route', () => {
        //
        // the other direction: a '{graph}' in the path with no parameter behind
        // it is a route Swagger UI cannot build a request for.
        //
        operationsOf(document).forEach(({ route, operation }) => {
            const templated = [...route.matchAll(/{([^}]+)}/g)].map(([, name]) => name);
            const declared = (operation.parameters || [])
                .filter(parameter => parameter.in === 'path')
                .map(parameter => parameter.name);

            expect({ route, templated: templated.sort() }).toEqual({ route, templated: declared.sort() });
        });
    });

    it('shows an example of every successful response', () => {
        //
        // successful is a 200 or, where the answer is where to find something
        // rather than the thing itself, a 302 -- the performance archive's
        // files, which are served by the website.
        //
        operationsOf(document).forEach(({ route, operation }) => {
            const success = operation.responses['200'] || operation.responses['302'];

            expect({ route, success: Boolean(success) }).toEqual({ route, success: true });
            expect(examplesOf(success.content['application/json']).length).toBeGreaterThan(0);
        });
    });

    it('says where every redirect points', () => {
        //
        // a 302 is only an answer together with its Location, and Swagger UI
        // renders the headers a response declares -- undeclared, the page would
        // document a redirect to nowhere.
        //
        operationsOf(document).forEach(({ route, operation }) => {
            Object.entries(operation.responses)
                .filter(([status]) => status.startsWith('3'))
                .forEach(([status, response]) => {
                    const location = (response.headers || {}).Location || {};

                    expect({ route, status, described: Boolean(location.description), schema: location.schema })
                        .toEqual({ route, status, described: true, schema: { type: 'string' } });
                });
        });
    });

    it('answers every response, errors included, in the report envelope', () => {
        operationsOf(document).forEach(({ operation }) => {
            Object.entries(operation.responses).forEach(([status, response]) => {
                const schema = response.content['application/json'].schema;
                expect({ status, required: schema.required }).toEqual({ status, required: ['report'] });
            });
        });
    });

    it('answers every operation with a 429 past the rate limit, written once and shared (#210)', () => {
        operationsOf(rawDocumentOf(name)).forEach(({ route, operation }) => {
            expect({ route, ref: (operation.responses['429'] || {}).$ref })
                .toEqual({ route, ref: '#/components/responses/RateLimited' });
        });
    });

    it('says in that 429 how long to wait, and the limit and window in force (#210)', () => {
        //
        // a caller reads the numbers from the answer, so a change to the limit or
        // its window needs no change in a client
        //
        const limited = document.components.responses.RateLimited;
        const wait = limited.headers['Retry-After'];
        const [[, example]] = examplesOf(limited.content['application/json']);

        expect(wait.description).toBeTruthy();
        expect(wait.schema).toEqual({ type: 'integer' });
        expect(Object.keys(example.report).sort()).toEqual(['error', 'limit', 'window_seconds']);
    });

    it('has examples that match their own schemas', () => {
        operationsOf(document).forEach(({ operation }) => {
            Object.entries(operation.responses).forEach(([status, response]) => {
                const media = response.content['application/json'];
                const validate = ajv().compile(media.schema);

                examplesOf(media).forEach(([example, value]) => {
                    const valid = validate(value);
                    expect({ status, example, errors: valid ? null : validate.errors })
                        .toEqual({ status, example, errors: null });
                });
            });
        });
    });

    it('has parameter examples that match their own schemas', () => {
        operationsOf(document).forEach(({ operation }) => {
            (operation.parameters || []).forEach(parameter => {
                //
                // a parameter is described either by a schema of its own or, for a
                // structured one like the datalake's Scale, by a media type. Either
                // way it carries a single 'example', or several named ones.
                //
                const source = parameter.content ? parameter.content['application/json'] : parameter;
                const validate = ajv().compile(source.schema);
                const examples = examplesOf(source);

                //
                // an unexemplified parameter used to fail the validation below, by
                // way of an undefined example. Asserted rather than left implicit,
                // now that a parameter can carry its examples either way.
                //
                expect({ parameter: parameter.name, exemplified: examples.length > 0 })
                    .toEqual({ parameter: parameter.name, exemplified: true });

                examples.forEach(([example, value]) => {
                    expect({ parameter: parameter.name, example, valid: validate(value) })
                        .toEqual({ parameter: parameter.name, example, valid: true });
                });
            });
        });
    });
});

describe('model.json, from format 2 on (#263)', () => {
    const responses = documentOf('model').paths['/model'].get.responses;
    const media = responses['200'].content['application/json'];
    const listing = media.schema.properties.report.anyOf[0];
    const model = listing.properties.models.items;

    it('documents on each model whether its live version was taken down, and when and by which check', () => {
        const down = model.properties.down;

        expect(down.type).toEqual(['object', 'null']);
        expect(down.required).toEqual(['since', 'days', 'in_a_row']);
        expect(model.required).not.toContain('down');
    });

    it('documents on each model how close each check is to taking it down', () => {
        const behind = model.properties.behind;

        expect(behind.type).toBe('array');
        expect(behind.items.required).toEqual(['days', 'in_a_row', 'limit']);
        expect(behind.items.properties.in_a_row.type).toEqual(['integer', 'null']);
        expect(model.required).not.toContain('behind');
    });

    it('names format 2, the track record\'s two columns, and what live is for a model taken down', () => {
        expect(listing.properties.format_version.description).toMatch(/2: a model's down and behind, and a track record's down_days and down_in_a_row/);
        expect(responses['200'].description).toMatch(/down_days and down_in_a_row/);
        expect(model.properties.live.description).toMatch(/taken down/);
    });

    it('shows a model taken down in the listing\'s example, and the two columns in the track record\'s', () => {
        //
        // a listing of format 3 since #279, which still holds what format 2 added
        //
        const models = media.examples.list.value.report.models;

        expect(media.examples.list.value.report.format_version).toBeGreaterThanOrEqual(2);
        expect(models.filter((each) => each.down)).toHaveLength(1);
        expect(media.examples['track-record'].value.report.split('\n')[0]).toMatch(/,down_days,down_in_a_row$/);
    });
});

describe('model.json, from format 3 on (#279)', () => {
    const operation = documentOf('model').paths['/model'].get;
    const media = operation.responses['200'].content['application/json'];
    const listing = media.schema.properties.report.anyOf[0];
    const model = listing.properties.models.items;
    const parameter = (name) => operation.parameters.find((each) => each.name === name);
    const headerOf = (example) => media.examples[example].value.report.split('\n')[0].split(',');
    const errors = (status) => Object.values(operation.responses[status].content['application/json'].examples)
        .map((example) => example.value.report.error);

    it('asks for an options model\'s picks as a Report, and a stock\'s by a Ticker of its symbol', () => {
        const validate = ajv().compile(parameter('Ticker').schema);

        expect(parameter('Report').schema.enum).toEqual(['summary', 'history', 'track-record', 'picks']);
        expect(parameter('Ticker')).toMatchObject({ in: 'query', required: false, example: 'AAPL' });
        expect(['AAPL', 'BRK.B', 'V'].map(validate)).toEqual([true, true, true]);
        expect(['aapl', 'BRK/B', 'BRK.BB', 'TOOLONG', ''].map(validate)).toEqual([false, false, false, false, false]);
    });

    it('says a task\'s scores, and keeps the four stock scores required beside the three it adds', () => {
        const task = listing.properties.tasks.items;

        expect(task.properties.scores).toMatchObject({ type: 'array', items: { type: 'string' } });
        expect(task.required).not.toContain('scores');
        ['score', 'baseline'].forEach((side) => {
            expect(model.properties[side].required).toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up']);
            ['profit_auc', 'top10_gain', 'top10_wins'].forEach((key) => {
                expect(model.properties[side].properties[key].type).toEqual(['number', 'null']);
            });
        });
    });

    it('says which hold a take-down and each check ran on, a whole number of days or null, and need not', () => {
        const down = model.properties.down;
        const check = model.properties.behind.items;

        [down, check].forEach((each) => {
            expect(each.properties.hold).toMatchObject({ type: ['integer', 'null'], minimum: 1 });
            expect(each.required).not.toContain('hold');
        });
    });

    it('names format 3, and what it added', () => {
        expect(listing.properties.format_version.description).toMatch(/3: a task's scores; the top 10's scores, profit_auc and an options model's track record's hold columns; the hold of down and of each check in behind; and the picks/);
    });

    it('describes every column of the picks, and an options model\'s track record\'s holds', () => {
        const described = operation.responses['200'].description;

        headerOf('picks').forEach((column) => expect(described).toContain(column));
        expect(described).toMatch(/<score>_1d, <score>_5d and <score>_20d/);
        expect(described).toMatch(/Its plain columns repeat the 1-day hold's/);
    });

    it('shows a listing of both tasks, an options model\'s picks, and its track record with a set of columns for each hold', () => {
        const report = media.examples.list.value.report;
        const options = report.tasks.find((task) => task.scores.includes('profit_auc'));

        expect(report.format_version).toBe(3);
        expect(options.scores).toEqual(['loss', 'profit_auc', 'top10_gain', 'top10_wins']);
        expect(report.tasks.find((task) => task.id === 'next-day').scores)
            .toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up', 'top10_gain', 'top10_wins']);
        expect(report.models.filter((each) => each.task === options.id).map((each) => each.name)).toEqual(['pt-options']);
        expect(headerOf('picks')).toEqual(['day', 'hold', 'rank', 'ticker', 'contract', 'call_put', 'strike', 'expiry',
            'buy_on', 'sell_on', 'last_bid', 'last_ask', 'chance', 'usual_chance', 'gain_low', 'gain_middle', 'gain_high']);
        ['_1d', '_5d', '_20d'].forEach((hold) => {
            expect(headerOf('option-picks-track-record')).toEqual(expect.arrayContaining([`loss${hold}`, `top10_gain${hold}`, `baseline_profit_auc${hold}`]));
        });
    });

    it('answers what is wrong with a Ticker, and a model or a stock with no picks, in the api\'s own words', () => {
        expect(errors('400')).toEqual([
            'Model and Report go together, and Report is summary, history, track-record or picks.',
            'Model, Report and Ticker are the only parameters.',
            'Ticker goes with Report=picks.',
            'Ticker is a stock\'s symbol, like AAPL or BRK.B.',
            'Model, Report and Ticker may each be given once.',
        ]);
        expect(errors('404')).toEqual(['There is no model named nope.', 'This model has no picks.', 'No picks for that stock.']);
    });

    it('says the api serves scores, and an options model\'s picks', () => {
        expect(documentOf('model').info.description).toMatch(/Scores, and for an options model, its nightly picks/);
    });
});

describe('model.json, loss\'s three parts (#265)', () => {
    const PARTS = ['up_log_loss', 'beats_log_loss', 'move_pinball'];
    const responses = documentOf('model').paths['/model'].get.responses;
    const examples = responses['200'].content['application/json'].examples;

    //
    // an example csv's rows, each keyed by its header
    //
    function rowsOf(report) {
        const [header, ...lines] = examples[report].value.report.trim().split('\n').map((line) => line.split(','));

        return lines.map((cells) => Object.fromEntries(header.map((name, at) => [name, cells[at]])));
    }

    it('says loss is the three added up, and names each one\'s column', () => {
        expect(responses['200'].description).toMatch(/Loss is three scores added up/);
        PARTS.forEach((part) => expect(responses['200'].description).toContain(part));
    });

    it.each([['history', ['attempt_', 'live_', 'baseline_']], ['track-record', ['', 'baseline_']]])(
        'shows each part in the %s\'s example, under every prefix, adding up to its loss',
        (report, prefixes) => {
            rowsOf(report).forEach((row) => {
                prefixes.forEach((prefix) => {
                    const parts = PARTS.reduce((total, part) => total + Number(row[`${prefix}${part}`]), 0);

                    expect({ report, day: row.day, prefix, gap: Math.abs(parts - Number(row[`${prefix}loss`])) < 0.00005 })
                        .toEqual({ report, day: row.day, prefix, gap: true });
                });
            });
        },
    );
});

describe('knowledge-graph.json, the two lists a night adds to (#269)', () => {
    const paths = documentOf('knowledge-graph').paths;

    it.each(['/knowledge-graph', '/knowledge-graph/tables/days'])('keeps %s five minutes, then only through an error, never stale while refetched', (route) => {
        const header = paths[route].get.responses['200'].headers['Cache-Control'];

        expect(header.schema).toEqual({ type: 'string' });
        expect(header.example).toBe('public, max-age=300, stale-if-error=86400');
        expect(header.description).not.toMatch(/usable stale/);
    });
});

describe('knowledge-graph.json, when each graph started and finished (#285)', () => {
    const paths = documentOf('knowledge-graph').paths;
    const media = (route) => paths[route].get.responses['200'].content['application/json'];
    const build = media('/knowledge-graph').schema.properties.report.properties.graphs.items.properties;
    const metadata = media('/knowledge-graph/{graph}').schema.properties.report.properties.build_metadata.properties;
    const day = media('/knowledge-graph/tables/days').schema.properties.report.properties.rows.items;
    const ROW = ['day', 'run', 'tables_started', 'tables_finished', 'published', 'sources'];

    it('says the listing\'s built is when the build started, and that a schema from 1.10 says when it finished', () => {
        expect(build.built.description).toMatch(/^When the build started, in UTC/);
        expect(build.built.description).toContain('build_metadata.build_finished_timestamp');
        expect(metadata.build_finished_timestamp.type).toBe('string');
        expect(metadata.build_finished_timestamp.description).toMatch(/From schema version 1\.10, and absent before it/);
    });

    it('documents when each day\'s tables were written, between its run and when its upload started', () => {
        expect(Object.keys(day.properties)).toEqual(ROW);
        ['tables_started', 'tables_finished'].forEach((field) => {
            expect({ field, type: day.properties[field].type }).toEqual({ field, type: ['string', 'null'] });
        });
        expect(day.required).toEqual(['day']);
        expect(day.properties.published.description).toMatch(/^When the run began uploading the day/);
    });

    it('shows both on every documented day', () => {
        media('/knowledge-graph/tables/days').example.report.rows.forEach((row) => {
            expect({ day: row.day, fields: Object.keys(row) }).toEqual({ day: row.day, fields: ROW });
        });
    });
});

describe('the guard itself', () => {
    it('rejects an example that does not match', () => {
        //
        // a validator that accepted everything would pass every assertion above.
        //
        const validate = ajv().compile(
            documentOf('performance').paths['/performance'].get.responses['200'].content['application/json'].schema
        );

        expect(validate({ report: 42 })).toBe(false);
        expect(validate({})).toBe(false);
    });

    it('has a redirect to hold to its Location', () => {
        //
        // only the performance archive answers with one, so without this the
        // redirect case above could pass by having nothing to check.
        //
        const redirects = operationsOf(documentOf('performance'))
            .filter(({ operation }) => operation.responses['302'])
            .map(({ route }) => route);

        expect(redirects).toEqual([
            '/performance/archive/{stream}/{year}',
            '/performance/archive/{stream}/{year}/{month}',
        ]);
    });

    it('holds a date-time to an offset', () => {
        //
        // the performance api's End refuses a date-time with no offset, so the
        // documentation may not show one
        //
        const validate = ajv().compile({ type: 'string', format: 'date-time' });

        expect(validate('2026-09-17T23:00:00-04:00')).toBe(true);
        expect(validate('2026-09-17T23:00:00Z')).toBe(true);
        expect(validate('2026-09-17T23:00:00')).toBe(false);
        expect(validate('2026-09-17')).toBe(false);
    });

    it('shows End answering an earlier window', () => {
        //
        // the second example of the performance report is the one End asks for:
        // Sep 17 by the hour, every row inside that day
        //
        const operation = documentOf('performance').paths['/performance'].get;
        const end = operation.parameters.find((parameter) => parameter.name === 'End');
        const earlier = operation.responses['200'].content['application/json'].examples.earlier.value.report;
        const days = earlier.trim().split('\n').slice(1).map((line) => line.split(',')[1].slice(0, 10));

        expect(end.example).toBe('2026-09-17T23:00:00-04:00');
        expect(days.length).toBeGreaterThan(0);
        expect(new Set(days)).toEqual(new Set(['2026-09-17']));
    });

    it('finds both kinds of example', () => {
        expect(examplesOf({ example: 1, examples: { a: { value: 2 } } })).toEqual([['example', 1], ['a', 2]]);
        expect(examplesOf({})).toEqual([]);
    });
});
