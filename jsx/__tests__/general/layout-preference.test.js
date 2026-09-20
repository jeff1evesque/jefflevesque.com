/**
 * layout-preference.test.js: an arrangement kept between visits.
 *
 * Almost everything worth testing here is a way the stored value can be wrong.
 * It is a string in somebody's browser: they can edit it, an older version of
 * this code may have written it, and a newer one will read it. So the cases
 * below are mostly junk of one kind or another, and every one of them has to
 * answer with defaults rather than throw or, worse, hand a layout a width of
 * NaN.
 *
 * Note: setup.js installs a localStorage shim for every suite, so the happy
 *       paths need no scaffolding. The failure paths replace it deliberately --
 *       Safari's private mode throws on access rather than returning empty, and
 *       that is the case a guard is for.
 */

import { readLayout, writeLayout, KEY, VERSION } from '../../import/general/layout-preference.js';

const LAYOUT = {
    fold: { build: true, legend: false },
    size: { build: 212, canvas: 380 },
};

//
// the shim from setup.js, put back by whatever replaced it
//
const real = window.localStorage;

function stored() {
    return JSON.parse(window.localStorage.getItem(KEY));
}

function put(value) {
    window.localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

//
// a storage that throws on everything, which is what a blocked or private
// browser gives rather than an empty one
//
function hostile() {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem() { throw new Error('access denied'); },
            setItem() { throw new Error('quota exceeded'); },
        },
    });
}

beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    window.localStorage.clear();
});

afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
});

describe('keeping an arrangement', () => {
    it('reads back what it wrote', () => {
        writeLayout('graph', 'wide', LAYOUT);

        expect(readLayout('graph', 'wide')).toEqual(LAYOUT);
    });

    it('says whether it managed to store it', () => {
        expect(writeLayout('graph', 'wide', LAYOUT)).toBe(true);
    });

    it('keeps the two variants apart', () => {
        //
        // the whole point of a variant: a reader folds both columns on a phone
        // because a phone has room for one thing, and restoring that on a wide
        // monitor is the preference disagreeing with the person.
        //
        writeLayout('graph', 'wide', { fold: { build: false }, size: {} });
        writeLayout('graph', 'narrow', { fold: { build: true }, size: {} });

        expect(readLayout('graph', 'wide').fold).toEqual({ build: false });
        expect(readLayout('graph', 'narrow').fold).toEqual({ build: true });
    });

    it('keeps other surfaces when one of them is written', () => {
        writeLayout('stream', 'wide', { fold: { filters: true }, size: {} });
        writeLayout('graph', 'wide', LAYOUT);

        expect(readLayout('stream', 'wide').fold).toEqual({ filters: true });
    });

    it('replaces a variant rather than merging into it', () => {
        //
        // an arrangement is the whole arrangement. A column unfolded has to be
        // able to stop being folded, which a merge would never let it do.
        //
        writeLayout('graph', 'wide', { fold: { build: true }, size: { build: 212 } });
        writeLayout('graph', 'wide', { fold: { build: false }, size: {} });

        expect(readLayout('graph', 'wide')).toEqual({ fold: { build: false }, size: {} });
    });
});

describe('an arrangement that is not there', () => {
    it('answers empty for a surface never written', () => {
        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('answers empty for a variant never written', () => {
        writeLayout('graph', 'wide', LAYOUT);

        expect(readLayout('graph', 'narrow')).toEqual({ fold: {}, size: {} });
    });
});

describe('a stored value that cannot be trusted', () => {
    it('ignores a record it cannot parse', () => {
        put('{ not json');

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('ignores a record from a version it does not know', () => {
        put({ v: VERSION + 1, graph: { wide: LAYOUT } });

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('ignores a record with no version at all', () => {
        put({ graph: { wide: LAYOUT } });

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('ignores a document that is not an object', () => {
        put('42');

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('ignores a surface that is not an object', () => {
        put({ v: VERSION, graph: 'wide' });

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('ignores an array where a record belongs', () => {
        //
        // typeof [] is 'object', so an array walks straight into a loop over
        // what it thinks are names and comes out as { 0: ..., 1: ... }.
        //
        put({ v: VERSION, graph: { wide: { fold: ['build'], size: [212] } } });

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('drops a fold that is not a boolean', () => {
        put({ v: VERSION, graph: { wide: { fold: { build: 'true', legend: true } } } });

        expect(readLayout('graph', 'wide').fold).toEqual({ legend: true });
    });

    //
    // written as raw json, because these are what a record can actually CARRY
    // rather than what a caller can pass: the value has to survive JSON.parse to
    // reach the check at all.
    //
    // Note: '1e999' is the one that matters and the one that is easy to miss. It
    //       is valid json, it parses without complaint, and what comes out is
    //       Infinity -- a number that passes 'typeof value === "number"' and
    //       reaches a layout as a column with no computable width.
    //
    // Note: there is no NaN case here because json cannot express one. It can
    //       only arrive from a caller, which the write path checks -- see 'drops
    //       junk on the way IN' and the case below it.
    //
    it.each([
        ['a string', '"212"'],
        ['zero', '0'],
        ['negative', '-40'],
        ['an overflowing literal', '1e999'],
        ['null', 'null'],
        ['a boolean', 'true'],
    ])('drops a size that is %s', (_name, json) => {
        put(`{"v":${VERSION},"graph":{"wide":{"size":{"build":${json},"legend":180}}}}`);

        expect(readLayout('graph', 'wide').size).toEqual({ legend: 180 });
    });

    it('drops a NaN handed straight to the write', () => {
        writeLayout('graph', 'wide', { fold: {}, size: { build: NaN, legend: 180 } });

        expect(readLayout('graph', 'wide').size).toEqual({ legend: 180 });
    });

    it('drops junk on the way IN as well as out', () => {
        //
        // so a bad value cannot be stored by one version and read back by
        // another that has stopped checking for it.
        //
        writeLayout('graph', 'wide', { fold: { build: 'yes' }, size: { build: -1 } });

        expect(stored().graph.wide).toEqual({ fold: {}, size: {} });
    });

    it('does not merge into a document from an unknown version', () => {
        put({ v: VERSION + 1, graph: { wide: { fold: { build: true } } } });

        writeLayout('graph', 'narrow', { fold: { legend: true }, size: {} });

        expect(stored().v).toBe(VERSION);
        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
        expect(readLayout('graph', 'narrow').fold).toEqual({ legend: true });
    });

    it('survives a layout that is not an object at all', () => {
        expect(writeLayout('graph', 'wide', null)).toBe(true);
        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });
});

describe('a browser that will not store anything', () => {
    it('reads defaults rather than throwing', () => {
        hostile();

        expect(() => readLayout('graph', 'wide')).not.toThrow();
        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
    });

    it('reports the write it could not do rather than throwing', () => {
        hostile();

        expect(writeLayout('graph', 'wide', LAYOUT)).toBe(false);
    });

    it('carries on when localStorage is absent entirely', () => {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });

        expect(readLayout('graph', 'wide')).toEqual({ fold: {}, size: {} });
        expect(writeLayout('graph', 'wide', LAYOUT)).toBe(false);
    });
});
