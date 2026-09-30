/**
 * source.test.js: which day of the published tables a build holds, and which of a
 * day's sources is outside the graph.
 *
 * The Training graph's picker names each build by that day, the way the Retrieval
 * graph's names a day of the tables. From schema 1.5 a build records it, and the
 * listing passes it on. An older build records none, and holds the newest
 * published day before its run's UTC date. What is held here is buildDay, which
 * says which of the two applies and answers each.
 *
 * The older rule is pinned against the listing and the days of 2026-09-25, when it
 * was measured: each day below is the one whose node types and edges that build
 * equals, less the four node types the build leaves out. It applies only to builds
 * older than 1.5, which makes them a closed set, and this is that set.
 *
 * A day's own list of sources can name one that none of its node types come
 * from: a feed the builder reads into a table of its own, as it reads the split
 * feed. Nothing else on the page shows it, so the day panel links it to where the
 * docs explain it. What is held is outsideGraph, which says which sources those
 * are, and that the paragraph they link to is in the docs.
 *
 * Note: jest.config.js runs this suite in New York time, which is what lets the
 *       zone tests below tell a run read as UTC from one read in the local zone.
 */

import fs from 'fs';
import path from 'path';
import { API_DOCS } from '../../../import/general/api-url.js';
import { DAY_DETAILS, buildDay, outsideGraph } from '../../../import/layout/graph/source.js';

//
// the published days on 2026-09-25, newest first, as the tables list them. None
// from 09-10 to 09-13, and none for the weekend of 09-19.
//
const DAYS = [
    '2026-09-24', '2026-09-23', '2026-09-22', '2026-09-21', '2026-09-18',
    '2026-09-17', '2026-09-16', '2026-09-15', '2026-09-14', '2026-09-09',
];

//
// the 11 builds the listing held on 2026-09-25, by their run, and the day each
// holds. The 09-10 run's matches no day exactly: its market data is 09-09's, and
// its CPI an earlier state than the one the 09-13 run wrote into that day.
//
const LISTED = [
    ['2026-09-25T05:00:29Z', '2026-09-24'],
    ['2026-09-24T05:00:42Z', '2026-09-23'],
    ['2026-09-23T05:00:25Z', '2026-09-22'],
    ['2026-09-22T05:00:25Z', '2026-09-21'],
    ['2026-09-19T05:00:19Z', '2026-09-18'],
    ['2026-09-18T05:00:00Z', '2026-09-17'],
    ['2026-09-17T09:41:59Z', '2026-09-16'],
    ['2026-09-16T17:15:46Z', '2026-09-15'],
    ['2026-09-15T05:00:43Z', '2026-09-14'],
    ['2026-09-13T15:04:28Z', '2026-09-09'],
    ['2026-09-10T21:45:53Z', '2026-09-09'],
];

describe('a build from schema 1.5 on', () => {
    it('holds the day its listing entry names, whatever the run says', () => {
        expect(buildDay({ schema_version: '1.5', day: '2026-09-01', run: '2026-09-25T05:00:29Z' }, DAYS))
            .toBe('2026-09-01');
    });

    it('needs no published days to say so', () => {
        expect(buildDay({ schema_version: '1.5', day: '2026-09-24', run: '2026-09-25T05:00:29Z' }, null))
            .toBe('2026-09-24');
    });

    it.each([
        ['no day', undefined],
        ['a null one', null],
        ['an empty one', ''],
        ['one not written YYYY-MM-DD', '2026-9-24'],
        ['a time instead', '2026-09-24T00:00:00Z'],
    ])('holds none with %s, and none is guessed from its run', (_, day) => {
        expect(buildDay({ schema_version: '1.5', day: day, run: '2026-09-25T05:00:29Z' }, DAYS)).toBeNull();
    });

    it.each(['1.10', '2.0'])('counts %s as newer than 1.5, compared a part at a time', (version) => {
        //
        // as one float, 1.10 is 1.1, and would take the older rule
        //
        expect(buildDay({ schema_version: version, day: '2026-09-01', run: '2026-09-25T05:00:29Z' }, DAYS))
            .toBe('2026-09-01');
    });
});

describe('an older build', () => {
    //
    // the Tuesday 09-22 run holds Monday, the Saturday 09-19 run holds Friday, and
    // the Sunday 09-13 run holds Wednesday 09-09: the newest published day before
    // the run, not the day before it.
    //
    it.each(LISTED)('run %s holds %s, the newest published day before it', (run, day) => {
        expect(buildDay({ schema_version: '1.4', day: null, run: run }, DAYS)).toBe(day);
    });

    it('holds the day before a published date it ran on, not that date', () => {
        //
        // 09-16 was published by the time anyone read the listing, and the run
        // that afternoon holds 09-15.
        //
        expect(DAYS).toContain('2026-09-16');
        expect(buildDay({ schema_version: '1.3', run: '2026-09-16T17:15:46Z' }, DAYS)).toBe('2026-09-15');
    });

    it('does not take a day its listing entry names', () => {
        //
        // the rule goes by the version, as the Sources row does, and not by
        // whether the field is there. Below 1.5 the field means nothing the
        // builder defines.
        //
        expect(buildDay({ schema_version: '1.4', day: '2026-09-01', run: '2026-09-25T05:00:29Z' }, DAYS))
            .toBe('2026-09-24');
    });

    it('is what a build with no version is', () => {
        expect(buildDay({ day: '2026-09-01', run: '2026-09-25T05:00:29Z' }, DAYS)).toBe('2026-09-24');
    });

    it('goes by the date the run started on in UTC', () => {
        //
        // 01:30 on 09-16 at +05:00 is 20:30 on 09-15 in UTC
        //
        expect(buildDay({ run: '2026-09-16T01:30:00+05:00' }, DAYS)).toBe('2026-09-14');
    });

    it('reads a run published without a zone as UTC, which the listing says its times are', () => {
        //
        // 23:30 on 09-16 read in New York, where this suite runs, is 09-17 in
        // UTC, and would hold 09-16
        //
        expect(buildDay({ run: '2026-09-16T23:30:00' }, DAYS)).toBe('2026-09-15');
    });

    it('does not depend on the order the days come in', () => {
        expect(buildDay({ run: '2026-09-25T05:00:29Z' }, [...DAYS].reverse())).toBe('2026-09-24');
    });

    it.each([
        ['with no days', '2026-09-25T05:00:29Z', null],
        ['with an empty list of them', '2026-09-25T05:00:29Z', []],
        ['when no published day comes before its run', '2026-09-09T21:00:00Z', DAYS],
        ['with no run', null, DAYS],
        ['with a run that is not a time', 'soon', DAYS],
    ])('holds none %s', (_, run, days) => {
        expect(buildDay({ schema_version: '1.4', run: run }, days)).toBeNull();
    });
});

//
// a day's node types, as get-graph-tables.js puts them: three filed under their
// sources by the day's predicates, and two that no predicate names, which are
// named by their own names -- the market quotes and the shared temporal types.
// It holds no market enrichment, so nothing but the quotes' own name says market.
//
const TYPES = {
    jolts_Industry: { count: 24, entities: 24, facts: 0, vocabulary: 'bls/jolts' },
    filings_SECFiling: { count: 2_441, entities: 2_441, facts: 24_800, vocabulary: 'sec/filings' },
    cap_Info: { count: 893, entities: 893, facts: 12_532, vocabulary: 'noaa/cap-model' },
    market_quotes_OptionSnapshot: { count: 9_603_436, entities: 0, facts: 0 },
    temporal_Day: { count: 30, entities: 30, facts: 0 },
};

const DOCS = path.resolve(__dirname, '../../../../documentation/api/knowledge-graph.md');

describe('a source outside the graph', () => {
    it('is one the day lists that none of its node types come from', () => {
        expect(outsideGraph({ sources: ['bls', 'market', 'noaa', 'sec', 'stock-split'] }, TYPES))
            .toEqual(['stock-split']);
    });

    it('is any the day lists that way, whatever it is called', () => {
        expect(outsideGraph({ sources: ['bls', 'a-feed', 'sec', 'another-feed'] }, TYPES))
            .toEqual(['a-feed', 'another-feed']);
    });

    it('is not one whose node types are named by their own names', () => {
        //
        // no predicate names the market quotes' vocabulary, so nothing a day
        // publishes files them under market
        //
        expect(outsideGraph({ sources: ['market'] }, TYPES)).toEqual([]);
    });

    it.each([
        ['no list', undefined],
        ['a null one', null],
    ])('is none on a day with %s, whose sources are read off its node types', (_, sources) => {
        expect(outsideGraph({ sources: sources }, TYPES)).toEqual([]);
    });

    it('is linked to a paragraph the knowledge graph docs hold', () => {
        const { noted } = DAY_DETAILS.find((row) => row.label === 'Sources');
        const [page, anchor] = noted.docs.split('#');

        expect(page).toBe(API_DOCS.knowledgeGraph);
        expect(anchor).toBe('sources-outside-the-graph');
        expect(fs.readFileSync(DOCS, 'utf8')).toMatch(new RegExp(`^\\{: #${anchor} \\}$`, 'm'));
    });
});
