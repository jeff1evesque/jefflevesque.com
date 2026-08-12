/**
 * parse-csv.jsx: parse csv from url using papaparse.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { readString, readRemoteFile } from 'react-papaparse';

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

async function parse(csv, download=false, header=true) {
    if (isValidUrl(csv)) {
        try {
            const data = await fetch(csv);
            const text = await data.text();
            var r = readString(text, {download: download, header: header});
        } catch (e) {
            console.error('Error: could not parse csv,', csv);
        }
    } else {
        var r = readString(csv, {download: download, header: header});
    }

    if (typeof r != 'undefined' && 'data' in r && r.data.length > 0) {
        return r.data;
    } else {
        return [];
    }
}

async function papa_parse(csv, callback=()=>{}, worker=false, download=false, header=true, source=null, stream=null) {
    const obj = {'source': source, 'stream': stream};

    if (isValidUrl(csv)) {
        readRemoteFile(
            csv,
            {
                header: header,
                worker: worker,
                complete: (results, source, stream) => {
                    callback({ data: results.data, source: obj.source, stream: obj.stream });
                }
            }
        );
    } else {
        readString(
            csv,
            {
                header: header,
                worker: worker,
                download: download,
                complete: (results) => {
                    callback({ data: results.data, source: obj.source, stream: obj.stream });
                }
            }
        );
    }
}

export function parseCsv(csv, download=false, header=true) {
    return parse(csv, download=false, header=true)
}

export function papaParseCsv(
    csv,
    callback=()=>{},
    worker=false,
    download=false,
    header=true,
    source=null,
    stream=null
) {
    return papa_parse(csv, callback, worker, download, header, source, stream);
}
