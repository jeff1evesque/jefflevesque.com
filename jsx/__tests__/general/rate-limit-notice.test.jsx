/**
 * rate-limit-notice.test.jsx: the notice under the header while the api has
 * told the reader to wait (#210).
 *
 * Held here: that it says nothing until there is a wait, then says why and for
 * how long -- in whole minutes, from the blocked answer -- as a status a screen
 * reader announces, and that it goes away when the wait ends or an answer
 * succeeds.
 *
 * Note: the clock is jest's, so the wait can be seen to end.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

import RateLimitNotice, { noticeText, waitMinutes } from '../../import/general/rate-limit-notice.jsx';
import { noteResponse, resetRateLimit } from '../../import/general/rate-limit.js';
import { blockedAnswer } from '../../test-support/blocked-answer.js';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const MINUTE = 60 * 1000;

const succeeded = { ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({}) };

async function blocked(options) {
    await act(async () => {
        await noteResponse(blockedAnswer(options));
    });
}

beforeEach(() => {
    resetRateLimit();
    jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
    jest.useRealTimers();
    resetRateLimit();
});

describe('the notice', () => {
    it('says nothing while there is no wait', () => {
        const { container } = render(<RateLimitNotice />);

        expect(container).toBeEmptyDOMElement();
    });

    it('says why, and for how long, once the api has said to wait', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: 300 });

        expect(screen.getByRole('status')).toHaveTextContent(
            'Too many requests from your network in the last few minutes. Data will load again in about 5 minutes.'
        );
        expect(screen.getByRole('status')).toHaveClass('rate-limit-notice');
    });

    it('takes its minutes from the answer, so a longer window says so', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: 600 });

        expect(screen.getByRole('status')).toHaveTextContent('Data will load again in about 10 minutes.');
    });

    it('shows a wait that started before it was drawn', async () => {
        await act(async () => {
            await noteResponse(blockedAnswer());
        });

        render(<RateLimitNotice />);

        expect(screen.getByRole('status')).toHaveTextContent('about 5 minutes');
    });

    it('goes away when the wait ends, and not before', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: 300 });

        act(() => {
            jest.advanceTimersByTime(5 * MINUTE - 1);
        });
        expect(screen.getByRole('status')).toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('goes away when a timer fires a moment early, at the wait\'s end all the same', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: 300 });

        //
        // the clock a moment short of the end when the timer fires
        //
        act(() => {
            jest.setSystemTime(NOW + 5 * MINUTE - 5);
            jest.runOnlyPendingTimers();
        });

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('goes away at the next answer that succeeds', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: 300 });
        await act(async () => {
            await noteResponse(succeeded);
        });

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('stays, saying "a few minutes", for a wait whose end is not known', async () => {
        render(<RateLimitNotice />);

        await blocked({ retryAfter: null, body: { report: { error: 'wait' } } });

        act(() => {
            jest.advanceTimersByTime(60 * MINUTE);
        });

        expect(screen.getByRole('status')).toHaveTextContent('Data will load again in a few minutes.');
    });

    it('stops listening once it is gone', async () => {
        const { unmount } = render(<RateLimitNotice />);

        unmount();

        await expect(blocked()).resolves.toBeUndefined();
    });
});

describe('its wording', () => {
    it.each([
        [5 * MINUTE, 5],
        [5 * MINUTE - 1, 5],
        [10 * MINUTE, 10],
        [30 * 1000, 1],
        [0, 1],
    ])('rounds a wait of %pms up to %p whole minutes', (left, minutes) => {
        expect(waitMinutes(NOW + left, NOW)).toBe(minutes);
    });

    it('has no minutes for no wait, or one with no end', () => {
        expect(waitMinutes(null, NOW)).toBeNull();
        expect(waitMinutes(Infinity, NOW)).toBeNull();
    });

    it('says a minute, minutes, or a few minutes', () => {
        expect(noticeText(1)).toMatch(/in about 1 minute\.$/);
        expect(noticeText(5)).toMatch(/in about 5 minutes\.$/);
        expect(noticeText(null)).toMatch(/in a few minutes\.$/);
    });
});
