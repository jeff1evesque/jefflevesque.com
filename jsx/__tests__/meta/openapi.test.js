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
const DOCUMENTS = ['performance', 'datalake', 'knowledge-graph'];

function documentOf(name) {
    return JSON.parse(fs.readFileSync(path.join(OPENAPI, `${name}.json`), 'utf8'));
}

function ajv() {
    return new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
}

//
// every example in a media type object, named: the single 'example', or each of
// 'examples' by its key.
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

    it('takes its parameters from the query string, each described', () => {
        operationsOf(document).forEach(({ operation }) => {
            operation.parameters.forEach(parameter => {
                expect({ name: parameter.name, in: parameter.in }).toEqual({ name: parameter.name, in: 'query' });
                expect(parameter.description).toBeTruthy();
            });
        });
    });

    it('shows an example of every successful response', () => {
        operationsOf(document).forEach(({ operation }) => {
            const media = operation.responses['200'].content['application/json'];
            expect(examplesOf(media).length).toBeGreaterThan(0);
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
            operation.parameters.forEach(parameter => {
                //
                // a parameter is described either by a schema of its own or, for a
                // structured one like the datalake's Scale, by a media type
                //
                const [schema, example] = parameter.content
                    ? [parameter.content['application/json'].schema, parameter.content['application/json'].example]
                    : [parameter.schema, parameter.example];

                expect({ parameter: parameter.name, valid: ajv().validate(schema, example) })
                    .toEqual({ parameter: parameter.name, valid: true });
            });
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

    it('finds both kinds of example', () => {
        expect(examplesOf({ example: 1, examples: { a: { value: 2 } } })).toEqual([['example', 1], ['a', 2]]);
        expect(examplesOf({})).toEqual([]);
    });
});
