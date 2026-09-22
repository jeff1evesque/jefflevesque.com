/**
 * archive-links.test.js: the archived performance files a stream has published.
 *
 * The page used to count from a start year to today, build a url per step, and
 * ask each one with a HEAD whether it was really there. Thirty-one of the
 * sixty-five it produced were wrong, and a wrong one did not 404 -- it saved the
 * app's shell under the name of the file it was asked for.
 *
 * The performance api lists the files now, so what is held here is the reading
 * of that listing: which rows a stream gets, in what order, labelled how, and
 * linked where. What is deliberately NOT here is when the page asks: that has
 * its own cases in alarm.test.jsx.
 *
 * Note: the listing below has the shape the api answers with, including what
 *       made the guessing go wrong -- two streams filed under a folder that is
 *       not their stream id, and a stream that has published nothing.
 */

import { loadArchiveListing, archiveFiles } from '../../import/general/archive-links.js';

const ORIGIN = 'https://www.jefflevesque.com/artifact/performance/ingest';

const LISTING = {
    streams: ['bls', 'sec', 'stockmarket', 'stockmarketstocksplit', 'usnationalweather'],
    archives: [
        { stream: 'sec', period: '2024', id: 'sec/2024', url: `${ORIGIN}/article/sec/2024.csv` },
        { stream: 'sec', period: '2024-12', id: 'sec/2024/12', url: `${ORIGIN}/article/sec/2024/12.csv` },
        { stream: 'sec', period: '2025-09', id: 'sec/2025/09', url: `${ORIGIN}/article/sec/2025/09.csv` },
        { stream: 'stockmarket', period: '2023', id: 'stockmarket/2023', url: `${ORIGIN}/stock-market/2023.csv` },
        { stream: 'stockmarket', period: '2026', id: 'stockmarket/2026', url: `${ORIGIN}/stock-market/2026.csv` },
        {
            stream: 'stockmarketstocksplit',
            period: '2025',
            id: 'stockmarketstocksplit/2025',
            url: `${ORIGIN}/stock-split/2025.csv`,
        },
        {
            stream: 'usnationalweather',
            period: '2025-07',
            id: 'usnationalweather/2025/07',
            url: `${ORIGIN}/article/weather/2025/07.csv`,
        },
    ],
};

const labels = (stream, listing = LISTING) => archiveFiles(listing, stream).map((file) => file.label);

describe('the files a stream has published', () => {
    it('offers exactly the files the listing names for it, newest first', () => {
        expect(labels('stockmarket')).toEqual(['2026.csv', '2023.csv']);
    });

    it('labels a year by its year, and a month as month/year', () => {
        expect(labels('usnationalweather')).toEqual(['07/2025.csv']);
        expect(labels('stockmarketstocksplit')).toEqual(['2025.csv']);
    });

    it('lists a year\'s own file after that year\'s months', () => {
        //
        // both are published for sec in 2024, and they are different files --
        // the one for the year is not a summary of the months.
        //
        expect(labels('sec')).toEqual(['09/2025.csv', '12/2024.csv', '2024.csv']);
    });

    it('links each file where the listing says it is served', () => {
        //
        // the folder is the listing's business. A stream filed under a name
        // other than its id -- as both stock market streams are -- is linked
        // correctly without this module knowing either name.
        //
        expect(archiveFiles(LISTING, 'stockmarket').map((file) => file.href)).toEqual([
            `${ORIGIN}/stock-market/2026.csv`,
            `${ORIGIN}/stock-market/2023.csv`,
        ]);
    });

    it('matches the stream id in any casing', () => {
        //
        // the page holds 'StockMarket' from its url and 'stockmarket' once
        // lower-cased; the listing names streams lower-cased.
        //
        expect(labels('StockMarket')).toEqual(labels('stockmarket'));
    });

    it('offers nothing for a stream the listing names with no files', () => {
        expect(LISTING.streams).toContain('bls');
        expect(archiveFiles(LISTING, 'bls')).toEqual([]);
    });

    it.each([
        ['an unknown stream', 'no-such-stream', LISTING],
        ['no listing', 'sec', undefined],
        ['a listing without archives', 'sec', { streams: ['sec'] }],
    ])('offers nothing for %s', (_, stream, listing) => {
        expect(archiveFiles(listing, stream)).toEqual([]);
    });
});

describe('asking for the listing', () => {
    const realFetch = global.fetch;

    afterEach(() => {
        global.fetch = realFetch;
    });

    function answering(response) {
        global.fetch = jest.fn(() => Promise.resolve(response));

        return global.fetch;
    }

    it('asks the performance api once, with a plain GET', async () => {
        //
        // one request for every stream, where the HEAD probing sent one per
        // candidate file.
        //
        const fetcher = answering({ ok: true, status: 200, json: () => Promise.resolve({ report: LISTING }) });

        await loadArchiveListing();

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(String(fetcher.mock.calls[0][0])).toBe('https://api.jefflevesque.com/v1/public/performance/archive');
        expect(fetcher.mock.calls[0][1]).toBeUndefined();
    });

    it('answers with the listing from the report', async () => {
        answering({ ok: true, status: 200, json: () => Promise.resolve({ report: LISTING }) });

        await expect(loadArchiveListing()).resolves.toEqual(LISTING);
    });

    it('refuses an answer that is not the listing', async () => {
        //
        // so the page can say it could not ask, rather than that nothing was
        // published -- the two read the same and mean opposite things.
        //
        answering({ ok: false, status: 503, json: () => Promise.resolve({}) });

        await expect(loadArchiveListing()).rejects.toThrow('503');
    });

    it('refuses when the request fails outright', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('offline')));

        await expect(loadArchiveListing()).rejects.toThrow('offline');
    });
});
