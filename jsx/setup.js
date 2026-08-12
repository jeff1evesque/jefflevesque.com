//
// allow the use of 'sessionStorage' within jest + enzyme:
//
//     https://stackoverflow.com/a/42705765
//     https://github.com/jeff1evesque/machine-learning/
//         issues/3087#issuecomment-388694964
//
// Mock localStorage
(function () {

    function createStorage() {
        let s = {},
            noopCallback = () => {},
            _itemInsertionCallback = noopCallback;

        Object.defineProperty(s, 'setItem', {
            get: () => {
                return (k, v) => {
                    k = k + '';
                    if (!s.hasOwnProperty(k)) {
                        _itemInsertionCallback(s.length);
                    }
                    s[k] = v + '';
                };
            }
        });
        Object.defineProperty(s, 'getItem', {
            get: () => {
                return k => {
                    k = k + '';
                    if (s.hasOwnProperty(k)) {
                        return s[k];
                    } else {
                        return null;
                    }
                };
            }
        });
        Object.defineProperty(s, 'removeItem', {
            get: () => {
                return k => {
                    k = k + '';
                    if (s.hasOwnProperty(k)) {
                        delete s[k];
                    }
                };
            }
        });
        Object.defineProperty(s, 'clear', {
            get: () => {
                return () => {
                    for (let k in s) {
                        if (s.hasOwnProperty(k)) {
                            delete s[k];
                        }
                    }
                };
            }
        });
        Object.defineProperty(s, 'length', {
            get: () => {
                return Object.keys(s).length;
            }
        });
        Object.defineProperty(s, "key", {
            value: k => {
                let key = Object.keys(s)[k];
                return (!key) ? null : key;
            },
        });
        Object.defineProperty(s, 'itemInsertionCallback', {
            get: () => {
                return _itemInsertionCallback;
            },
            set: v => {
                if (!v || typeof v != 'function') {
                    v = noopCallback;
                }
                _itemInsertionCallback = v;
            }
        });
        return s;
    }

    const global = require('global')
    const window = require('global/window')

    global.localStorage = createStorage();
    global.sessionStorage = createStorage();

    window.localStorage = global.localStorage;
    window.sessionStorage = global.sessionStorage;
}());

//
// jsdom implements neither Web Workers nor URL.createObjectURL, and
// import/worker/web-worker.js subclasses Worker at MODULE LOAD:
//
//     export default class WorkerBuilder extends Worker { ... }
//
// so merely importing anything that reaches it -- data.jsx, and therefore
// main-route.jsx, and therefore most of the app -- throws
// 'ReferenceError: Worker is not defined' before a single test runs.
//
// These are environment shims of the same kind as the storage ones above, not
// test doubles: they exist so the module graph can be loaded at all. A test that
// actually cares what a worker DOES should mock the worker module itself.
//
if (typeof global.Worker === 'undefined') {
    global.Worker = class Worker {
        constructor() {}
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
    };
}

//
// jsdom implements neither of these, and both are reached during a normal render
// rather than by a test choosing to exercise them:
//
//   - ResizeObserver is required by the charting components, which measure their
//     container on mount.
//   - fetch is called on mount by the layouts that load their own data.
//
// The fetch default deliberately resolves to a NOT-ok response rather than to
// data. Every loader in this codebase handles a failed request by logging and
// carrying on, so a component can mount without a test having to care -- while a
// test that does care still sees no data unless it provides some. Resolving to
// plausible data here would let a component appear to work in a test that never
// supplied any.
//
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

if (typeof global.fetch === 'undefined') {
    global.fetch = () => Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
    });
}

if (typeof global.URL !== 'undefined' && !global.URL.createObjectURL) {
    global.URL.createObjectURL = () => 'blob:jsdom-stub';
    global.URL.revokeObjectURL = () => {};
}

//
// structuredClone is a browser global everywhere this app runs, and JSDOM does not
// implement it. general/multiselect.jsx calls it while rendering the selected
// chips, so every component holding a MultiSelect -- the trigger left column among
// them -- dies at render with 'structuredClone is not defined'.
//
// Note: the node version is NOT the reason, and it matters not to think it is.
//       structuredClone landed in node 17, but 'testEnvironment: jsdom' means the
//       globals a test sees come from jsdom rather than from node, so the function
//       is missing on node 20 exactly as it is on node 16 -- verified on both.
//       Deleting this shim after a node upgrade would put the suite straight back
//       to 10 failures in multiselect.test.jsx.
//
// v8.serialize/deserialize is the standard stand-in: it is the same
// structured-clone algorithm, so Dates, Maps and cycles survive, and a DOM node
// throws here exactly as it would in a browser.
//
if (typeof global.structuredClone === 'undefined') {
    const v8 = require('v8');
    global.structuredClone = value => v8.deserialize(v8.serialize(value));
}

//
// Fail a test that logged a console error or warning.
//
// Note: this used to throw synchronously from inside the console method:
//
//         console.error = x => { throw x; };
//
//       which cannot work against React 18. React reports problems by calling
//       console.error DURING render, so throwing there unwinds React's internals
//       mid-commit and every test fails with 'Should not already be working.'
//       rather than with the actual warning. react-router's future-flag notice
//       was enough to take the whole suite down.
//
//       The intent is kept -- an unexpected console error or warning still fails
//       the test -- but the failure is raised AFTER the test body, where throwing
//       is safe.
//
// Note: IGNORED holds third-party notices that are not defects in this codebase
//       and that no change here can silence. Keep it short, and prefer fixing the
//       cause over adding to it.
//
// Note: the ignore test is applied to the MESSAGE only -- args[0] -- while the
//       recorded text still holds every argument.
//
//       This matters, and it silently disabled most of the trap. The list held a
//       bare 'react-router' entry and the test ran against all the arguments joined
//       together. React appends a COMPONENT STACK as a later argument, and for
//       anything rendered inside a MemoryRouter that stack names react-router -- so
//       every React warning raised under a router matched the entry and was thrown
//       away: 'An update was not wrapped in act(...)', key warnings, invalid DOM
//       nesting, all of it. Eighteen act warnings were being swallowed in a single
//       suite, and nearly every component test in this codebase renders under a
//       router.
//
//       The bare entry is gone. The future-flag notices it was meant to cover are
//       matched by the specific string below, which appears in args[0].
//
const IGNORED = [
    'React Router Future Flag Warning',
];

const consoleErrors = [];
const realError = console.error;
const realWarn = console.warn;

function record(kind, original) {
    return (...args) => {
        const message = args.length ? String(args[0]) : '';
        const text = args
            .map(a => (a && a.message) ? a.message : String(a))
            .join(' ');

        if (!IGNORED.some(allowed => message.includes(allowed))) {
            consoleErrors.push(`console.${kind}: ${text}`);
        }

        original.apply(console, args);
    };
}

beforeEach(() => {
    consoleErrors.length = 0;
    console.error = record('error', realError);
    console.warn = record('warn', realWarn);
});

afterEach(() => {
    console.error = realError;
    console.warn = realWarn;

    if (consoleErrors.length) {
        const seen = consoleErrors.join('\n  ');
        consoleErrors.length = 0;
        throw new Error(`unexpected console output during this test:\n  ${seen}`);
    }
});
