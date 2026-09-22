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

/**
 * one stream's files from a listing, newest first, as the rows the page draws.
 *
 * Note: matched on the stream id, lower-cased, which is how the listing names a
 *       stream -- 'usnationalweather', not the alarm page's own
 *       'us-national-weather'.
 *
 * Note: a year's own file sorts after that year's months. Both are listed when
 *       both were published, and they are different files.
 */
export function archiveFiles(listing, stream) {
    const key = String(stream).toLowerCase();
    const entries = listing && Array.isArray(listing.archives) ? listing.archives : [];

    return entries
        .filter((entry) => entry.stream === key)
        .sort((a, b) => String(b.period).localeCompare(String(a.period)))
        .map((entry) => ({ href: entry.url, label: labelOf(entry.period) }));
}
