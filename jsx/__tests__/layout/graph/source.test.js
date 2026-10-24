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
 * feed. Nothing else on the page shows it, so the day panel puts a note over it.
 * What is held is outsideGraph, which says which sources those are, and what
 * the note says.
 *
 * A build's node types need not all store the same number of features: from the
 * builder's #443 the option snapshots store 173 of the 1024 positions its variant
 * is named for, and from schema 1.7 each type says how many it stores. What is
 * held is the Variant row, which says Multi-D where they differ (#237).
 *
 * Both panels show the nightly job's steps as ranges of times, each label with a
 * note saying what the step is (#289). What is held is whenRange, which writes a
 * range, and which rows carry a note.
 *
 * Note: jest.config.js runs this suite in New York time, which is what lets the
 *       zone tests below tell a run read as UTC from one read in the local zone.
 */

import {
    BUILDS,
    DAYS as RETRIEVAL,
    DETAILS,
    DAY_DETAILS,
    MULTI_D,
    buildDay,
    mixedWidths,
    outsideGraph,
    sourceTypes,
    whenRange,
} from '../../../import/layout/graph/source.js';
import SCHEMA from '../../fixtures/graph-schema-1.7.mock.json';

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

    it('carries a note saying so, and no link', () => {
        const { noted } = DAY_DETAILS.find((row) => row.label === 'Sources');

        expect(noted.note).toBe('Not in the graph: its data is kept in a table of its own.');
        expect(noted).not.toHaveProperty('docs');
    });

    it('is not the company facts, whose namespace sec/companyfacts is the source sec-companyfacts (#211)', () => {
        //
        // its first part alone is 'sec', which is a source as well, and is not
        // the one the day lists the company facts by
        //
        const types = { ...TYPES, companyfacts_CompanyFact: FACTS };

        expect(outsideGraph({ sources: ['bls', 'market', 'noaa', 'sec', 'sec-companyfacts', 'stock-split'] }, types))
            .toEqual(['stock-split']);
    });

    it('is the company facts on a day that lists them and holds none of their nodes', () => {
        expect(outsideGraph({ sources: ['sec', 'sec-companyfacts'] }, TYPES)).toEqual(['sec-companyfacts']);
    });
});

//
// the company facts' one node type, filed under its source by the day's
// predicates. It carries no text, so it weighs nothing by entities
//
const FACTS = { count: 15_600, entities: 0, facts: 0, vocabulary: 'sec/companyfacts' };

describe('the types the canvas draws one of, for each source (#211)', () => {
    const types = { ...TYPES, companyfacts_CompanyFact: FACTS };
    const day = { sources: ['bls', 'market', 'noaa', 'sec', 'sec-companyfacts', 'stock-split'] };

    it('lists each source\'s node types, in the order of the Sources row', () => {
        expect(sourceTypes(day, types)).toEqual([
            ['jolts_Industry'],
            ['market_quotes_OptionSnapshot'],
            ['cap_Info'],
            ['filings_SECFiling', 'companyfacts_CompanyFact'],
            ['companyfacts_CompanyFact'],
        ]);
    });

    it('lists nothing for a source outside the graph', () => {
        expect(sourceTypes({ sources: ['stock-split'] }, types)).toEqual([]);
    });

    it('reads the sources off the node types on a day with no list of its own', () => {
        expect(sourceTypes({ sources: null }, types).map((ids) => ids.length)).toEqual([1, 1, 2]);
    });

    it('is what the Retrieval graph hands its canvas, and the Training graph has none', () => {
        const whole = { node_types: types, edge_types: {} };

        expect(RETRIEVAL.required(day, whole)).toEqual(sourceTypes(day, types));
        expect(BUILDS.required).toBeUndefined();
    });
});

//
// the Variant row, and a listing entry for the build the fixture describes: five
// of the node types of the build of 2026-10-09, as a 1.7 schema says them on the
// nightly's layout -- the option snapshots at 173, every other type at 1024.
//
const VARIANT = DETAILS.find((row) => row.label === 'Variant');
const LISTED_BUILD = { variant: '1024d', schema_version: '1.7' };

//
// the fixture with each node type's width as `width` says, at `version`
//
function storing(width, version = SCHEMA.version) {
    const node_types = Object.fromEntries(
        Object.entries(SCHEMA.node_types).map(([id, meta]) => [id, { ...meta, stored_dim: width(id) }])
    );

    return { ...SCHEMA, version: version, node_types: node_types };
}

describe('the Variant row (#237)', () => {
    it('reads Multi-D for a build whose node types store different numbers of features', () => {
        expect(mixedWidths(SCHEMA)).toBe(true);
        expect(VARIANT.read(LISTED_BUILD, SCHEMA)).toBe('Multi-D');
        expect(MULTI_D).toBe('Multi-D');
    });

    it('keeps the variant\'s own name where every type stores the same number', () => {
        expect(VARIANT.read(LISTED_BUILD, storing(() => 1024))).toBe('1024d');
    });

    it('reads any two numbers as Multi-D, not only one below the layout\'s width', () => {
        //
        // the row goes by whether the types differ, which is what makes one
        // number wrong for all of them. It reads nothing else of the build.
        //
        const halves = storing((id) => (id.startsWith('market_') ? 512 : 1024));

        expect(VARIANT.read(LISTED_BUILD, halves)).toBe('Multi-D');
    });

    it('goes by the version: below 1.7 no type\'s width is read, whatever the schema holds', () => {
        expect(VARIANT.read(LISTED_BUILD, storing((id) => SCHEMA.node_types[id].stored_dim, '1.6')))
            .toBe('1024d');
    });

    it.each(['1.10', '2.0'])('counts %s as newer than 1.7, compared a part at a time', (version) => {
        //
        // as one float, 1.10 is 1.1, and would read no widths at all
        //
        expect(VARIANT.read(LISTED_BUILD, { ...SCHEMA, version: version })).toBe('Multi-D');
    });

    it('reads a build with no version as too old to say', () => {
        expect(VARIANT.read(LISTED_BUILD, { ...SCHEMA, version: undefined })).toBe('1024d');
    });

    it('does not count a width of 0, which the builder writes for a type it never assembled', () => {
        const unassembled = storing((id) => (id === 'market_quotes_OptionSnapshot' ? 0 : 1024));

        expect(VARIANT.read(LISTED_BUILD, unassembled)).toBe('1024d');
    });

    it('keeps the listing\'s name where there is no schema', () => {
        //
        // a schema that could not be had. One still on its way is a bar, since
        // the row waits for it -- see below
        //
        expect(VARIANT.read(LISTED_BUILD, null)).toBe('1024d');
        expect(mixedWidths(undefined)).toBe(false);
    });

    it('reads no widths off a 1.7 schema with no node types, rather than failing', () => {
        expect(VARIANT.read(LISTED_BUILD, { version: '1.7' })).toBe('1024d');
    });

    it('waits for the schema, as Sources does, beside Dataset', () => {
        //
        // the listing's name put up first would change to Multi-D under the
        // reader when the schema landed
        //
        expect(VARIANT.schema).toBe(true);
        expect(VARIANT.pair).toBe(true);
    });

    it('carries a note where it reads Multi-D, and only there, pointing at the Features column', () => {
        expect(VARIANT.noted.names(LISTED_BUILD, SCHEMA)).toEqual(['Multi-D']);
        expect(VARIANT.noted.names(LISTED_BUILD, storing(() => 1024))).toEqual([]);
        expect(VARIANT.noted.names(LISTED_BUILD, null)).toEqual([]);
        expect(VARIANT.noted.note).toBe(
            'Node types store different numbers of features. See the Features column under Node types, below.'
        );
    });

    it('has the tables head a Features column on the Training graph, and not on the Retrieval graph', () => {
        //
        // what the tables' stand-in goes on while the rows are on their way. A
        // day of the tables says nothing of widths
        //
        expect(BUILDS.widths).toBe(true);
        expect(RETRIEVAL.widths).toBe(false);
    });
});

describe('the job\'s steps, each a range (#289)', () => {
    it('writes the day once where both ends fall on it, and the zone once, after the end', () => {
        expect(whenRange('2026-10-23T05:00:12Z', '2026-10-23T07:21:40Z')).toBe('2026-10-23 05:00 – 07:21 UTC');
        expect(whenRange('2026-10-23T07:21:40+00:00', '2026-10-23T09:32:05.118+00:00'))
            .toBe('2026-10-23 07:21 – 09:32 UTC');
    });

    it('writes both days for a range across midnight UTC', () => {
        expect(whenRange('2026-10-23T23:50:00Z', '2026-10-24T00:40:00Z')).toBe('2026-10-23 23:50 – 2026-10-24 00:40 UTC');
    });

    it('reads an end that was not recorded as n/a, and a step with neither end as n/a alone', () => {
        expect(whenRange('2026-09-15T06:37:02Z', null)).toBe('2026-09-15 06:37 UTC – n/a');
        expect(whenRange(null, '2026-09-24T05:41:57Z')).toBe('n/a – 2026-09-24 05:41 UTC');
        expect(whenRange(null, undefined)).toBe('n/a');
    });

    it('claims no zone for times published without one, and writes each end whole where the two differ', () => {
        expect(whenRange('2026-09-15T05:00:43', '2026-09-15T06:37:02')).toBe('2026-09-15 05:00 – 06:37');
        expect(whenRange('2026-09-15T05:00:43', '2026-09-15T06:37:02Z')).toBe('2026-09-15 05:00 – 2026-09-15 06:37 UTC');
    });

    it('carries a note on each step\'s label, and on a day\'s Published, and on no other row', () => {
        const noted = (rows) => rows.filter((row) => row.note).map((row) => row.label);

        expect(noted(DETAILS)).toEqual(['Processing data', 'Building graph']);
        expect(noted(DAY_DETAILS)).toEqual(['Processing data', 'Published']);
    });

    it('says each step in words with no number and no source in them, so they never need updating', () => {
        const notes = [...DETAILS, ...DAY_DETAILS].filter((row) => row.note).map((row) => row.note);

        expect(new Set(notes)).toEqual(new Set([
            'The job reads all of the day’s data, combines it, and saves the result.',
            'The job turns the combined data into this graph, which the model trains on.',
            'When the job started putting this graph on the site.',
        ]));
        notes.forEach((note) => expect(note).not.toMatch(/\d|bls|sec\b|noaa|market/i));
    });

    it('reads the day panel\'s range from its run to its tables\' finish, and not their start', () => {
        const range = DAY_DETAILS.find((row) => row.label === 'Processing data');
        const day = {
            run: '2026-10-23T05:00:31Z',
            tables_started: '2026-10-23T06:50:02Z',
            tables_finished: '2026-10-23T07:19:44Z',
        };

        expect(range.read(day)).toBe('2026-10-23 05:00 – 07:19 UTC');
    });
});
