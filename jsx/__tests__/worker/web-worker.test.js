/**
 * web-worker.test.js: the WorkerBuilder.
 *
 * Fifteen lines, and the mechanism the whole worker layer rests on. It takes a
 * FUNCTION, stringifies it, wraps the text in an immediately-invoked expression,
 * and hands that to a real Worker as a blob url:
 *
 *     const code = worker.toString();
 *     const blob = new Blob([`(${code})()`]);
 *     return new Worker(URL.createObjectURL(blob));
 *
 * That is why every worker module in this codebase exports a bare arrow function
 * rather than an es module, and why nothing inside one may reference an import.
 *
 * Note: jsdom implements neither Worker nor URL.createObjectURL, so setup.js stubs
 *       both. These tests assert what the builder DOES with them -- the code text
 *       it produces and the fact that it constructs a Worker -- rather than that a
 *       real worker thread runs, which jsdom cannot do.
 *
 * Note: the Blob constructor is intercepted to read the generated code, because
 *       jsdom's Blob implements no .text() (nor arrayBuffer): there is no way to
 *       read a jsdom Blob's contents back out. Recording the constructor argument
 *       is both simpler and closer to what is being asserted -- the text the
 *       builder hands to the Blob.
 */

import WorkerBuilder from '../../import/worker/web-worker.js';

describe('WorkerBuilder', () => {
    let RealWorker;
    let RealCreateObjectURL;
    let RealBlob;
    let constructed;
    let blobs;
    let code;

    beforeEach(() => {
        constructed = [];
        blobs = [];
        code = [];

        RealWorker = global.Worker;
        RealCreateObjectURL = global.URL.createObjectURL;
        RealBlob = global.Blob;

        global.Worker = class FakeWorker {
            constructor(url) {
                constructed.push(url);
            }
        };
        global.URL.createObjectURL = (blob) => {
            blobs.push(blob);
            return 'blob:test-url';
        };
        global.Blob = class RecordingBlob extends RealBlob {
            constructor(parts, options) {
                super(parts, options);
                code.push(String(parts[0]));
            }
        };
    });

    afterEach(() => {
        global.Worker = RealWorker;
        global.URL.createObjectURL = RealCreateObjectURL;
        global.Blob = RealBlob;
    });

    it('constructs a Worker from a blob url', () => {
        new WorkerBuilder(() => {});

        expect(constructed).toEqual(['blob:test-url']);
    });

    it('wraps the function source so it runs immediately', () => {
        //
        // the '(...)()' wrapper is what makes the worker install its own onmessage.
        // Without the trailing call the blob would define a function and do nothing,
        // and the worker would silently never respond.
        //
        const marker = function namedForTheTest() { return 42; };

        new WorkerBuilder(marker);

        expect(code[0].startsWith('(')).toBe(true);
        expect(code[0].endsWith(')()')).toBe(true);
        expect(code[0]).toContain('namedForTheTest');
    });

    it('carries the whole function body across, not just its name', () => {
        //
        // the body IS the payload -- this is how a worker module's code reaches the
        // worker thread at all.
        //
        const fn = () => { const distinctive = 'sentinel-value'; return distinctive; };

        new WorkerBuilder(fn);

        expect(code[0]).toContain('sentinel-value');
    });

    it('produces a Blob rather than a string url', () => {
        new WorkerBuilder(() => {});

        expect(blobs[0]).toBeInstanceOf(Blob);
    });

    it('returns the Worker, not the builder instance', () => {
        //
        // the constructor RETURNS a different object than the one being built, which
        // is legal but unusual: 'new WorkerBuilder(fn)' is not a WorkerBuilder. Any
        // instanceof check against WorkerBuilder would fail.
        //
        const built = new WorkerBuilder(() => {});

        expect(built).not.toBeInstanceOf(WorkerBuilder);
        expect(built).toBeInstanceOf(global.Worker);
    });

    it('accepts a non-function and produces unrunnable code', () => {
        //
        // passing an object stringifies to '[object Object]', and '([object
        // Object])()' is a syntax error inside the worker -- a failure that would
        // surface only as a worker that never replies. It is better that this fails
        // here, and it does, because the blob is still constructed but the code is
        // nonsense.
        //
        // Recorded rather than relied on: the builder does not validate, so what
        // actually happens is a Worker is created around unrunnable text.
        //
        new WorkerBuilder({ not: 'a function' });

        expect(code[0]).toContain('[object Object]');
    });
});
