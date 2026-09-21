/**
 * archive-links.test.js: which archived performance files a stream might have.
 *
 * The page used to count from a start year to today and build a url per step,
 * so every link was a guess. Thirty-one of the sixty-five it produced were
 * guesses that were wrong, and a wrong one did not 404 -- it downloaded the
 * app's shell under the name of the file it was asked for.
 *
 * So the two halves worth holding here are the shape of the candidates and the
 * judgement on an answer. What is deliberately NOT here is the asking: that
 * belongs to the page, and has its own cases in alarm.test.jsx.
 *
 * Note: every case states the date rather than reading the clock. The old
 *       month bound was the current month applied to every year, which is a bug
 *       a suite running in September cannot see and one running in January
 *       cannot miss.
 */

import { archiveCandidates, published, ARCHIVES } from '../../import/general/archive-links.js';

const BASE = 'https://example.com/artifact/performance';
const SEPTEMBER = new Date(2026, 8, 20);
const JANUARY = new Date(2026, 0, 4);

const labels = (...args) => archiveCandidates(...args).map((f) => f.label);

describe('which files a stream might have', () => {
    it('offers a file per year for a stream filed by year', () => {
        expect(labels('bls', BASE, SEPTEMBER)).toEqual(['2026.csv', '2025.csv', '2024.csv']);
    });

    it('offers a file per month for a stream filed by month', () => {
        const sec = labels('sec', BASE, SEPTEMBER);

        expect(sec[0]).toBe('01/2026.csv');
        expect(sec).toContain('09/2026.csv');
    });

    it('stops the CURRENT year at the current month', () => {
        expect(labels('sec', BASE, SEPTEMBER)).not.toContain('10/2026.csv');
    });

    it('runs a PAST year to december', () => {
        //
        // the bug this replaces: the month bound was the current month applied
        // to every year, so in September the archive hid October, November and
        // December of every year before this one -- six real files on the day
        // it was found, withheld because of the date on the reader's clock.
        //
        const sec = labels('sec', BASE, SEPTEMBER);

        ['10/2025.csv', '11/2025.csv', '12/2025.csv'].forEach((file) => {
            expect(sec).toContain(file);
        });
    });

    it('does not read the clock for a year it is not in', () => {
        //
        // the same list, asked for in January, still has all of 2025
        //
        expect(labels('sec', BASE, JANUARY)).toContain('12/2025.csv');
        expect(labels('sec', BASE, JANUARY)).not.toContain('02/2026.csv');
    });

    it('newest first', () => {
        expect(labels('bls', BASE, SEPTEMBER)[0]).toBe('2026.csv');
    });

    it('builds an absolute href under the artifact base', () => {
        //
        // the yearly links used to be RELATIVE -- href={`${i}.csv`}, with no
        // prefix at all -- so on /stream/bls/alarm they resolved to
        // /stream/bls/2026.csv and never reached the artifact host. Every bls
        // link on the page was pointing at the wrong origin.
        //
        expect(archiveCandidates('bls', BASE, SEPTEMBER)[0].href)
            .toBe(`${BASE}/ingest/article/bls/2026.csv`);
    });

    it('pads a single-digit month in both the href and the label', () => {
        const january = archiveCandidates('sec', BASE, SEPTEMBER)[0];

        expect(january.href).toBe(`${BASE}/ingest/article/sec/2026/01.csv`);
        expect(january.label).toBe('01/2026.csv');
    });

    it('reads a stream id in any casing', () => {
        //
        // the application links to this page with 'BLS', not 'bls'
        //
        expect(labels('BLS', BASE, SEPTEMBER)).toEqual(labels('bls', BASE, SEPTEMBER));
    });

    it.each([
        ['stockmarket'],
        ['stockmarketstocksplit'],
    ])('offers nothing for %s, which publishes nothing', (stream) => {
        //
        // four paths were tried against the live site for each and none
        // resolves. A stream with no archive should offer no links rather than
        // four that download the app's shell.
        //
        expect(archiveCandidates(stream, BASE, SEPTEMBER)).toEqual([]);
    });

    it('offers nothing for a stream it does not know', () => {
        expect(archiveCandidates('no-such-stream', BASE, SEPTEMBER)).toEqual([]);
    });

    it('offers nothing without somewhere to look', () => {
        expect(archiveCandidates('bls', '', SEPTEMBER)).toEqual([]);
        expect(archiveCandidates('bls', undefined, SEPTEMBER)).toEqual([]);
    });

    it('survives a stream that is not a string', () => {
        expect(archiveCandidates(undefined, BASE, SEPTEMBER)).toEqual([]);
        expect(archiveCandidates(null, BASE, SEPTEMBER)).toEqual([]);
    });

    it('starts each stream at its own first year', () => {
        Object.keys(ARCHIVES).forEach((stream) => {
            const oldest = labels(stream, BASE, SEPTEMBER).pop();

            expect(oldest).toContain(String(ARCHIVES[stream].since));
        });
    });
});

describe('whether an answer is the file or the app wearing its name', () => {
    it('accepts what the archive actually serves', () => {
        expect(published('binary/octet-stream')).toBe(true);
    });

    it('accepts a csv served as one', () => {
        expect(published('text/csv')).toBe(true);
    });

    it('rejects the app shell', () => {
        //
        // the whole point. A path with nothing behind it answers 200 and
        // text/html, and `download` saves that under the name asked for -- so
        // the judgement cannot be on the status, which is 200 either way.
        //
        expect(published('text/html')).toBe(false);
        expect(published('text/html; charset=utf-8')).toBe(false);
        expect(published('TEXT/HTML')).toBe(false);
    });

    it('rejects an answer that carries no type at all', () => {
        expect(published(null)).toBe(false);
        expect(published(undefined)).toBe(false);
        expect(published('')).toBe(false);
    });
});
