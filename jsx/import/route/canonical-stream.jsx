/**
 * canonical-stream.jsx: a url that names a stream by a name it used to go by,
 * replaced with the url that names it by its id.
 *
 * The site linked its streams by several names -- '/stream/StockMarket/alarm',
 * '/stream?item=USNationalWeather&rate=Day', '/data?item=stockmarket' -- and
 * those urls are in bookmarks, and in links other people have shared. Each one
 * still loads. It is replaced with the url the site links now before the page
 * under it mounts, so a page is only ever handed an id. See stream-id.js.
 *
 * Note: replaced rather than pushed. The old url is not a page the reader saw,
 *       and 'back' from the new one should leave rather than land on a url that
 *       sends them forward again.
 *
 * Note: a name that is no stream's is left as it is, and the page under it
 *       answers for it the way it always has.
 */

import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { canonicalStream } from '../general/stream-id.js';

//
// the id `name` should be written as, or null when it already is one or names
// no stream at all
//
function renamed(name) {
    const id = canonicalStream(name);

    return id && id !== name ? id : null;
}

function decoded(segment) {
    try {
        return decodeURIComponent(segment);
    } catch (e) {
        return segment;
    }
}

/**
 * where a location should be, or null when it is already there.
 *
 * `stream` is the route's `:stream` param, when the route has one. Its segment
 * is found in the path by value, so this holds for every route that takes one
 * -- the alarm and trigger pages alike -- without a copy of their patterns. The
 * `?item=` a listing links to is read off the location itself, and every other
 * parameter is kept as it was.
 */
export function canonicalLocation(location, stream) {
    let pathname = location.pathname;
    let search = location.search;

    const id = renamed(stream);

    if (id) {
        const segments = pathname.split('/');
        const at = segments.findIndex((segment) => decoded(segment) === stream);

        if (at !== -1) {
            segments[at] = id;
            pathname = segments.join('/');
        }
    }

    const params = new URLSearchParams(search);
    const item = renamed(params.get('item'));

    if (item) {
        params.set('item', item);
        search = `?${params}`;
    }

    if (pathname === location.pathname && search === location.search) {
        return null;
    }

    return { pathname: pathname, search: search, hash: location.hash };
}

/**
 * the page under it, at a url that names its stream by its id.
 */
export default function CanonicalStream({ children }) {
    const location = useLocation();
    const { stream } = useParams();
    const target = canonicalLocation(location, stream);

    return target
        ? <Navigate to={target} state={location.state} replace />
        : children;
}
