//
// Bug-focused ESLint configuration -- the JavaScript mirror of the .ruff.toml
// used by the Python repositories alongside this one.
//
// Only rules that catch something arguably WRONG are enabled: undefined names,
// unused variables, duplicate keys, unreachable code. No stylistic rules --
// no semicolons, quotes, indentation or spacing -- so a red build always means
// a real defect rather than a formatting preference. This codebase had never
// been linted, and a style sweep across 144 files would bury the actual bugs.
//
// The `globals` package is deliberately not a dependency: the lists below are
// written out so CI needs only eslint and eslint-plugin-react, and does not
// have to install this project's full runtime dependency tree just to lint.
//
// eslint-plugin-react is required, not optional. This project uses the CLASSIC
// JSX transform (see .babelrc -- @babel/preset-react without runtime:
// "automatic"), so `<Foo />` compiles to React.createElement(Foo). Core eslint
// does not treat JSX as a *use* of an identifier, so without the plugin's
// jsx-uses-react and jsx-uses-vars rules, no-unused-vars reports every
// imported component -- including React itself -- as unused. That accounted
// for the large majority of findings on the first run.
//
// If CI reports a no-undef for a browser or test global that is genuinely
// available at runtime, add it to the relevant block below rather than
// weakening the rule.

import react from 'eslint-plugin-react';

const browserGlobals = {
    window: 'readonly',
    self: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    location: 'readonly',
    history: 'readonly',
    structuredClone: 'readonly',
    getComputedStyle: 'readonly',
    HTMLElement: 'readonly',
    Element: 'readonly',
    Node: 'readonly',
    Event: 'readonly',
    CustomEvent: 'readonly',
    MutationObserver: 'readonly',
    IntersectionObserver: 'readonly',
    ResizeObserver: 'readonly',
    DOMParser: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    screen: 'readonly',
    console: 'readonly',
    fetch: 'readonly',
    alert: 'readonly',
    confirm: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    performance: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    Blob: 'readonly',
    FormData: 'readonly',
    FileReader: 'readonly',
    XMLHttpRequest: 'readonly',
    WebSocket: 'readonly',
    Image: 'readonly',
    // The HTMLOptionElement constructor -- `new Option()` is used to resolve a
    // CSS colour string via the DOM in import/general/colors.js.
    Option: 'readonly',
    atob: 'readonly',
    btoa: 'readonly',
    crypto: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    requestAnimationFrame: 'readonly',
    cancelAnimationFrame: 'readonly',
    AbortController: 'readonly',
    Worker: 'readonly',
    postMessage: 'readonly',
    importScripts: 'readonly',
    // Injected by webpack's DefinePlugin at build time.
    process: 'readonly',
};

const nodeGlobals = {
    require: 'readonly',
    module: 'writable',
    exports: 'writable',
    process: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    global: 'readonly',
    Buffer: 'readonly',
    console: 'readonly',
};

const jestGlobals = {
    jest: 'readonly',
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
};

// Correctness rules only. Shared by every block below so that application
// code, config files and tests are all held to the same standard.
const correctnessRules = {
    'no-undef': 'error',

    // args: 'none' -- an unused function parameter is routine in React
    // callbacks (event handlers that ignore the event, render props that take
    // more arguments than they use) and is not a defect. Unused *variables*
    // are what this rule is here to catch.
    //
    // caughtErrors: 'none' -- `catch (err) { ... }` that does not inspect err
    // is idiomatic and harmless. eslint 9 changed this default to 'all'; the
    // narrower setting is kept here for the same reason as args.
    'no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
    ],

    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-unreachable': 'error',
    'no-cond-assign': 'error',
    'no-func-assign': 'error',
    'no-obj-calls': 'error',
    'no-sparse-arrays': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-unsafe-negation': 'error',

    // no-redeclare is deliberately NOT enabled. It fires 334 times here, all
    // on the same legacy pattern -- a function-scoped `var` reassigned inside
    // if/else branches by redeclaring it:
    //
    //     var node_qty = this.props.items.length;
    //     if (...)      { var node_qty = 150; }
    //     else if (...) { var node_qty = 200; }
    //
    // That is sloppy, but it behaves exactly as written (var hoists, so these
    // are plain reassignments), so it is a style complaint rather than a
    // defect. Enabling it would mean 334 mechanical edits that bury the real
    // findings, and it is the same call made for the Python repositories,
    // where .ruff.toml likewise selects only correctness rules.
    'use-isnan': 'error',
    'valid-typeof': 'error',

    // checkLoops: false -- `while (true)` with an internal break is a
    // legitimate pattern and not what this rule is meant to catch.
    'no-constant-condition': ['error', { checkLoops: false }],
};

const languageOptions = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
        ecmaFeatures: { jsx: true },
    },
};

export default [
    {
        // Build output and generated reports are not ours to lint. Flat config
        // does NOT read .gitignore, so anything generated has to be listed
        // here explicitly or it gets linted -- lcov-report/ is istanbul's HTML
        // coverage output (gitignored, absent in CI, present after `npm test`
        // locally) and was being reported on before it was added here.
        ignores: [
            '**/node_modules/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/lcov-report/**',
            '**/*.replace',
        ],
    },

    // Application code: browser environment.
    {
        files: ['**/*.js', '**/*.jsx'],
        languageOptions: { ...languageOptions, globals: browserGlobals },
        plugins: { react },
        settings: { react: { version: 'detect' } },
        rules: {
            ...correctnessRules,
            // The two rules that make no-unused-vars correct for JSX: mark
            // React and any component referenced in JSX as used. Neither
            // reports anything on its own.
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error',
        },
    },

    // Build and test tooling that Node executes directly, so it is CommonJS
    // and needs require/module rather than the browser globals.
    //
    // Note: setup.js additionally gets jest's globals and the browser ones. Jest
    //       loads it through setupFilesAfterEnv, so it runs INSIDE the test
    //       environment: it registers beforeEach/afterEach hooks, and installs
    //       shims onto window. It is configuration by location only, not by the
    //       environment it executes in.
    {
        files: ['webpack.config.js', 'jest.config.js'],
        languageOptions: {
            ...languageOptions,
            sourceType: 'commonjs',
            globals: nodeGlobals,
        },
        rules: correctnessRules,
    },

    {
        files: ['setup.js'],
        languageOptions: {
            ...languageOptions,
            sourceType: 'commonjs',
            globals: { ...browserGlobals, ...nodeGlobals, ...jestGlobals },
        },
        rules: correctnessRules,
    },

    // Test files get the browser globals (they render components) plus jest's.
    {
        files: ['**/__tests__/**/*.js', '**/__tests__/**/*.jsx', '**/*.test.js', '**/*.test.jsx'],
        languageOptions: {
            ...languageOptions,
            globals: { ...browserGlobals, ...nodeGlobals, ...jestGlobals },
        },
        plugins: { react },
        settings: { react: { version: 'detect' } },
        rules: {
            ...correctnessRules,
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error',
        },
    },
];
