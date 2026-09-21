/**
 * archive-links.js: which archived performance files a stream might have, and
 *                   which of them are really there.
 *
 * `/stream/<source>/alarm` offers the raw ingest performance metrics as csv, a
 * file per year or per month. The list used to be INVENTED: the page counted
 * from a start year to today and built a url per step, so every link was a
 * guess that an object sat at that path. Thirty-one of the sixty-five it
 * generated were guesses that were wrong.
 *
 * Nothing catches that, because a path with no object behind it does not 404.
 * The site answers an unmatched path with the single-page app's shell -- HTTP
 * 200, `text/html`, about half a kilobyte -- and the anchors carry `download`,
 * so the browser saves that shell under the name it was asked for. A reader
 * clicking `2026.csv` got a file called `2026.csv` full of `<!DOCTYPE html>`.
 *
 * So this module does two things and the page does the asking between them:
 * name the candidates, and judge an answer. What it cannot do is publish a file
 * that was never published -- a candidate with nothing behind it is dropped
 * from the list, not repaired.
 *
 * Note: judged on the CONTENT TYPE rather than the status. Every dead path
 *       answers 200, so a status check passes all of them and changes nothing.
 */

//
// where each stream's archive lives, how far back it goes, and whether it is
// filed by year or by month.
//
// Note: the two stock market streams are deliberately absent. Nothing is
//       published for either -- '/ingest/stockmarket/', '/ingest/article/
//       stockmarket/', '/ingest/article/stocksplit/' and a month-nested variant
//       were all tried against the live site and none resolves -- so the page
//       has nothing to offer and should say so rather than offer four links
//       that download the app's shell. Give one an entry here when its csvs
//       start being published.
//
const ARCHIVES = {
    bls: { path: 'ingest/article/bls', since: 2024, by: 'year' },
    sec: { path: 'ingest/article/sec', since: 2024, by: 'month' },
    usnationalweather: { path: 'ingest/article/weather', since: 2024, by: 'month' },
};

/**
 * every file `stream` might have published, newest first.
 *
 * Note: the month bound applies to the CURRENT year alone. It used to cap every
 *       year at the month it happens to be now, so in September the archive hid
 *       October, November and December of 2024 and 2025 -- six real files, on
 *       the day this was written, withheld because of the date on the reader's
 *       clock.
 *
 * Note: `today` is an argument so a test can state the date rather than work
 *       around it. The page passes nothing.
 */
export function archiveCandidates(stream, base, today = new Date()) {
    const archive = ARCHIVES[String(stream).toLowerCase()];

    if (!archive || !base) {
        return [];
    }

    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1;
    const out = [];

    for (let year = thisYear; year >= archive.since; year--) {
        if (archive.by === 'year') {
            out.push({
                href: `${base}/${archive.path}/${year}.csv`,
                label: `${year}.csv`,
            });
            continue;
        }

        const last = year === thisYear ? thisMonth : 12;

        for (let month = 1; month <= last; month++) {
            const mm = String(month).padStart(2, '0');

            out.push({
                href: `${base}/${archive.path}/${year}/${mm}.csv`,
                label: `${mm}/${year}.csv`,
            });
        }
    }

    return out;
}

/**
 * whether an answer is the file that was asked for, or the app's shell wearing
 * its name.
 */
export function published(contentType) {
    return !!contentType && !/text\/html/i.test(contentType);
}

export { ARCHIVES };
