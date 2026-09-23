/**
 * archive-links.js: the archived performance files a stream has published, as the
 *                   performance api lists them.
 *
 * `/stream/<source>/alarm` offers the raw ingest performance metrics as csv, a
 * file per year or per month. That list used to be built here. The page counted
 * from a start year to today, built a url per step, and sent each one a HEAD to
 * learn whether it was really there: up to 33 requests per stream, still a guess
 * at where each stream's files are filed, and judged by content type because the
 * site answers a missing path with its own shell and a 200.
 *
 * The api lists them now. One request answers for every stream, and each entry
 * carries the url its file is served from. Nothing here knows a folder name, and
 * nothing listed can turn out to be the app's shell saved under a `.csv` name.
 */

import { performanceArchiveUrl } from './api-url.js';
import { canonicalStream } from './stream-id.js';

/**
 * the listing: every stream the api carries, and each file each has published.
 *
 * Rejects when the api does not answer with one, so the page can tell "nothing
 * published" apart from "could not ask".
 */
export function loadArchiveListing(url = performanceArchiveUrl()) {
    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`the archive listing answered ${response.status}`);
            }

            return response.json();
        })
        .then(({ report }) => report);
}

//
// '2024' -> '2024.csv', '2025-09' -> '09/2025.csv': the labels this column has
// always drawn
//
function labelOf(period) {
    const [year, month] = String(period).split('-');

    return month ? `${month}/${year}.csv` : `${year}.csv`;
}

//
// what a stream is matched on: its id, for any name a stream has gone by, and
// the name itself, lower-cased, for one this site does not know
//
function keyOf(stream) {
    return canonicalStream(stream) || String(stream).toLowerCase();
}

/**
 * one stream's files from a listing, newest first, as the rows the page draws.
 *
 * Note: matched by the stream's id on both sides, so the same files come back
 *       whichever name the listing uses for a stream. It named them
 *       'stockmarket' and 'usnationalweather' while the page moved to
 *       'stock-market' and 'us-national-weather', and the two did not have to
 *       move together.
 *
 * Note: a year's own file sorts after that year's months. Both are listed when
 *       both were published, and they are different files.
 */
export function archiveFiles(listing, stream) {
    const key = keyOf(stream);
    const entries = listing && Array.isArray(listing.archives) ? listing.archives : [];

    return entries
        .filter((entry) => keyOf(entry.stream) === key)
        .sort((a, b) => String(b.period).localeCompare(String(a.period)))
        .map((entry) => ({ href: entry.url, label: labelOf(entry.period) }));
}
