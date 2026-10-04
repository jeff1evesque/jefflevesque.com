/**
 * stream-item.jsx: '/stream/<id>', which opens that stream on its own (#214).
 *
 * The alarm emails link a stream as '/stream/<id>' -- 'The stream:
 * https://www.jefflevesque.com/stream/sec' -- and the site had no such page, so
 * every link sent so far opened the 404 page. The site opens a stream on its own
 * at '/stream?item=<id>' (#161), and this sends the email's address there, so the
 * links already in inboxes work as well as the next ones.
 *
 * Any name a stream has gone by finds it, as on every route naming a stream --
 * see canonical-stream.jsx -- and a name that is no stream's opens every stream.
 *
 * Note: replaced rather than pushed, as CanonicalStream replaces a url. The
 *       email's address is not a page the reader saw, and Back from the stream
 *       should leave rather than land on a url that sends them forward again.
 *
 * Note: anything else the address carries is kept: '/stream/sec?rate=hour'
 *       opens SEC Filings by the hour.
 */

import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { canonicalStream } from '../general/stream-id.js';

/**
 * where '/stream/<name>' goes: '/stream' with that stream on its own, or with
 * every stream for a name that is no stream's.
 */
export function streamItemLocation(location, name) {
    const id = canonicalStream(name);
    const params = new URLSearchParams(location.search);

    if (id) {
        params.set('item', id);
    } else {
        params.delete('item');
    }

    const search = params.toString();

    return { pathname: '/stream', search: search ? `?${search}` : '', hash: location.hash };
}

export default function StreamItem() {
    const location = useLocation();
    const { stream } = useParams();

    return <Navigate to={streamItemLocation(location, stream)} state={location.state} replace />;
}
