/**
 * rate-limit-notice.jsx: the notice under the header while the api has told the
 * reader to wait (#210).
 *
 * Past the api's limit, every request fails, and without a word each row on
 * /stream only said it could not load. This says why, and how long: the wait
 * from the blocked answer, in whole minutes, rounded up. It goes away by itself
 * when the wait is over, or as soon as an answer succeeds. See rate-limit.js.
 *
 * Note: a 'status' region, so a screen reader announces it without taking the
 *       reader from what they were doing.
 */

import React, { useEffect, useState } from 'react';
import { limitedUntil, subscribe } from './rate-limit.js';

/**
 * the wait, in whole minutes rounded up, from the moment it ends -- or null where
 * no end is known, a wait that lasts until an answer succeeds.
 */
export function waitMinutes(until, now = Date.now()) {
    if (until === null || !Number.isFinite(until)) {
        return null;
    }

    return Math.max(1, Math.ceil((until - now) / 60000));
}

/**
 * what the notice says, for a wait of `minutes`, or of an unknown length.
 */
export function noticeText(minutes) {
    const when = minutes === null
        ? 'in a few minutes'
        : `in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;

    return `Too many requests from your network in the last few minutes. Data will load again ${when}.`;
}

function RateLimitNotice() {
    const [until, setUntil] = useState(() => limitedUntil());

    useEffect(() => subscribe(setUntil), []);

    //
    // gone at the moment the wait ends. Asked at that moment rather than at the
    // timer's, since a timer can fire a moment early
    //
    useEffect(() => {
        if (until === null || !Number.isFinite(until)) {
            return undefined;
        }

        const timer = setTimeout(() => setUntil(limitedUntil(Math.max(Date.now(), until))), Math.max(0, until - Date.now()));

        return () => clearTimeout(timer);
    }, [until]);

    if (until === null) {
        return null;
    }

    return (
        <div className='container rate-limit-row'>
            <div className='rate-limit-notice' role='status'>
                {noticeText(waitMinutes(until))}
            </div>
        </div>
    );
}

export default RateLimitNotice;
