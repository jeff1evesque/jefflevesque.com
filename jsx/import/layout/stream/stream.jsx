/**
 * stream.jsx: /stream, every stream as a row of bars -- see stream-rows.jsx
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import DataObjectIcon from '@mui/icons-material/DataObject';
import UpdateIcon from '@mui/icons-material/Update';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UpdateDisabledIcon from '@mui/icons-material/UpdateDisabled';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import StreamRows, { FIGURES_MIN, SORT_KEYS, SortMenu } from './stream-rows.jsx';
import StreamFocus from './stream-focus.jsx';
import { isMobile } from 'react-device-detect';
import trim from '../../general/trim-object.js';
import getData from '../../general/get-data.js';
import checkValidInt from '../../validator/valid-int.js';
import checkValidFloat from '../../validator/valid-float.js';
import checkValidObject from '../../validator/valid-object.js';
import checkValidArray from '../../validator/valid-array.js';
import checkValidString from '../../validator/valid-string.js';
import is_local from '../../../is_local.js';
import WorkerBuilder from '../../worker/web-worker.js';
import workerIngestPerformance from '../../worker/stream/performance.js';
import { Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import streamName from '../../general/stream-name.js';
import viewerTimeZone from '../../general/viewer-timezone.js';
import { performanceUrl, API_DOCS } from '../../general/api-url.js';
import { listSubscriptions } from '../../general/account-api.js';
import ApiLinks from '../../general/api-links.jsx';
import { readRefresh, writeRefresh } from '../../general/refresh-preference.js';
import { limitedUntil } from '../../general/rate-limit.js';
import { readOrder, readSort, writeOrder, writeSort } from '../../general/listing-preference.js';
import { readLayout, writeLayout } from '../../general/layout-preference.js';
import THROUGHPUT_KEY from '../../general/throughput-key.js';
import { STOCK_MARKET, STOCK_SPLIT, SEC_COMPANYFACTS, STREAMS } from '../../general/stream-id.js';
import { streamBars, scheduleLabel } from '../../general/stream-bars.js';
import scrollMargin from '../../general/scroll-margin.js';
{/*

    'runsContinuously' left with the weather branch. It answered whether a silent
    interval is a real gap or a schedule, which decided 'FillEmptyBuckets' -- a
    property of how the stream is COLLECTED, and so now the api's to answer per
    stream. 'expectedIntervals' stays: coverage still asks whether the scraper
    ran, which is a question about the chart rather than about the request.

*/}
import { coverageBucket, expectedIntervals } from '../../general/ingest-schedule.js';
{/*

    the chart's own gap fill, and deliberately NOT the report's
    'FillEmptyBuckets' -- see 'ingest-gaps.js'. That one zeroes every empty
    interval, which draws a weekend-long outage on a weekday-only stream; this
    one zeroes only the intervals a scraper was DUE to run in. The api decides
    the former per stream, the chart still decides the latter.

*/}
import { fillMissingIntervals, dropPaddedEmpties } from '../../general/ingest-gaps.js';
{/*

    only the two window functions the CHART needs remain. 'windowPartitions' and
    'windowYears' enumerated artifact paths for a request, and 'request-batch.js'
    split that list to fit the api's item cap -- api-stream-performance resolves
    the window itself now, from the interval it is given, so there is no list to
    enumerate and nothing to batch.

*/}
import {
    windowStart,
    windowLabel,
    windowHeading,
    intervalStart,
    lastInstant,
    localInstant,
    pageWindow,
    finerWindow
} from '../../general/rolling-window.js';


{/*

    the rates the rows can be drawn at, coarsest first. One rate for every row,
    so the rows line up interval for interval and can be read down as well as
    across.

*/}
const RATES = ['Month', 'Day', 'Hour', 'Minute'];


{/*

    how long a stream may take before its row says it is still loading. A slow
    stream is not a failed one -- the S&P 500's report can take a while when the
    api has not cached it -- so this only changes what the row says, and the
    request is left to finish. A row says it could not load only when the request
    actually fails.

*/}
export const SLOW_AFTER_MS = 10000;


{/*

    how often the page asks for every stream again on its own, while it is
    showing and the reader has left it on. A refresh is quiet: each row keeps
    what it shows until its new answer lands -- see refresh

*/}
export const REFRESH_MS = 5 * 60 * 1000;


{/*

    the time of day a refresh was asked for, in the reader's own clock, for the
    button's tooltip: '10:35 AM'

*/}
function clock(time) {
    return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}


{/*

    the rate an address names ('?rate=hour'), as the page writes it, or null

*/}
function linkedRate(search) {
    const asked = String(new URLSearchParams(search).get('rate') || '').toLowerCase();

    return RATES.find((rate) => rate.toLowerCase() === asked) || null;
}


{/*

    the window an address names ('?end=2026-09-17T23:00:00-04:00') at 'rate', as
    the start of its last bucket -- or null for the window ending now: when the
    address names none, names it in any other form, or names one that has not
    ended yet (#159)

*/}
function linkedEnd(search, rate, now = new Date()) {
    const asked = String(new URLSearchParams(search).get('end') || '');

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(asked)) {
        return null;
    }

    const when = new Date(asked);
    const last = isNaN(when) ? null : intervalStart(rate, when);

    return last && last < intervalStart(rate, now) ? last : null;
}


{/*

    the window on screen, in the address: '?rate=' and, for a window that has
    ended, '?end='. Replaced rather than pushed, so the back button leaves the
    page instead of stepping back through every window the reader looked at.
    Anything else the address carries, '?item=' among it, is kept

*/}
function writeWindow(rate, end) {
    const params = new URLSearchParams(window.location.search);

    params.set('rate', rate.toLowerCase());

    if (end) {
        params.set('end', localInstant(end));
    } else {
        params.delete('end');
    }

    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}${window.location.hash}`);
}


{/*

    the stream an address opens on its own ('?item=sec'), or null for every
    stream: when it names none, or names one that is not a stream (#161). An
    older name for a stream has been rewritten to its id before the page mounts
    -- see canonical-stream.jsx

*/}
function linkedItem(search) {
    const asked = new URLSearchParams(search).get('item');

    return STREAMS.includes(asked) ? asked : null;
}


{/*

    a stream opened on its own, or every stream again, in the address. PUSHED,
    unlike the window, so the back button -- or a phone's back gesture, which is
    how a phone leaves a stream's own view -- comes back to where the reader
    was. Everything else the address carries is kept (#161)

*/}
function writeItem(stream) {
    const params = new URLSearchParams(window.location.search);

    if (stream) {
        params.set('item', stream);
    } else {
        params.delete('item');
    }

    const search = params.toString();

    window.history.pushState(
        window.history.state,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    );
}


{/*

    how the reader arranged the figures, as layout-preference.js keeps it: the
    page, and the screen it was arranged on. Only a screen wide enough for the
    divider has one -- a phone lists the streams instead -- so there is only
    the one variant (#161)

*/}
const LAYOUT = ['stream', 'wide'];


{/*

    the first and last of the window's intervals as the axis over the rows names
    them: short, since the bar under the pointer says the rest

*/}
function axisLabel(date, rate) {
    const r = String(rate).toLowerCase();

    if (r === 'month') {
        return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }

    if (r === 'day') {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    }

    return date.toLocaleString('en-US', { hour: 'numeric', minute: r === 'minute' ? '2-digit' : undefined });
}


{/*

    the intervals a stream reported data in, of the intervals its scraper was
    due to run in.

    health cannot see a scraper that never ran -- no rows means no successes AND
    no failures, so the ratio never moves and only the total does. the
    denominator comes from the scraper's own schedule rather than from the
    report, since the intervals being counted are the ones the report does not
    carry (see 'ingest-schedule.js')

*/}
function streamCoverage(chart_data, stream, rate, field_datetime, stream_source, now = new Date()) {
    const expected = expectedIntervals(stream, rate, now);

    if (!expected.length) {
        return 'n/a';
    }

    {/*

        an interval counts as covered when SOMETHING was attempted in it,
        succeeded or failed alike -- coverage asks whether the scraper ran, and
        health asks how it did. counting a failed interval as uncovered would
        state the same fault twice

    */}
    {/*

        the row is filed under the interval it counts toward rather than under
        its own instant. For all but one case those are the same thing; for a
        stream scheduled 'rate(5 minutes)' the schedule fixes the spacing and
        not the offset, so the run is on time anywhere in its window (see
        'coverageBucket')

    */}

    const carried = new Set();
    chart_data.forEach((item) => {
        const throughput = stream_source.reduce((total, source) => {
            const key = `${source}${THROUGHPUT_KEY}`;
            return total + (checkValidObject(key, item) && !isNaN(item[key]) ? item[key] : 0);
        }, 0);

        if (throughput > 0 && item[field_datetime] instanceof Date) {
            carried.add(coverageBucket(stream, rate, item[field_datetime]).valueOf());
        }
    });

    const covered = expected.filter(v => carried.has(v.valueOf())).length;
    const coverage = 100 * covered / expected.length;

    return isMobile ? coverage.toFixed(0) : coverage.toFixed(2);
}


{/*

    thousands separators for the listing counts: a total ingest count runs to
    eight digits, and a bare run of numerals is read digit by digit rather than
    at a glance.

    Note: the counts sit at 'n/a' until the query resolves, so anything that is
          not a finite number passes through untouched rather than rendering as
          'NaN'. the empty string and null are excluded explicitly because
          Number() coerces both to 0

*/}
{/*

    a listing percentage, or whatever placeholder stands in for it.

    Note: the figures sit at 'n/a' until the query resolves, and a stream that
          cannot state one keeps it, so anything that is not a positive number
          passes through untouched rather than rendering as 'n/a%'

*/}
function format_percent(value) {
    return parseFloat(value) ? `${value}%` : value;
}


function format_count(value) {
    if (value === null || value === undefined || value === '') {
        return value;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString() : value;
}


class StreamLayout extends Component {
    constructor() {
        super();

        {/*

            each stream by its id, which is also its name everywhere on this
            page: the per-stream state keys, the rows and the requests. See
            stream-id.js.

        */}
        const streams = STREAMS;

        {/*

            one rate for every row: the one an address names ('?rate=hour'),
            and otherwise the day. The rows line up interval for interval, so
            the S&P 500 no longer opens by the minute on its own while the market
            is open -- every other row would open on a window of minutes it has
            no runs in.

        */}
        const rate = linkedRate(document.location.search) || 'Day';

        {/*

            the window's end, as the start of its last bucket, or null for the
            window ending now -- what an address names, see linkedEnd (#159)

        */}
        const end = linkedEnd(document.location.search, rate);

        {/*

            the figures as the reader last arranged them: folded behind the
            divider, and the width they were dragged to. A width narrower than
            a drag would stop at came from somewhere else, and is dropped rather
            than honored (#161)

            Note: folded unless this browser kept them open (#167). The rows
                  have the room for the bars, and a bar says what it holds in
                  its popup; a reader who opens the figures has them open on
                  the next visit, since any fold or drag keeps 'figures'

        */}
        const layout = readLayout(...LAYOUT);
        const kept_width = layout.size.figures;

        this.state = {
            local: is_local,
            'chart_data_stock-market': [],
            'chart_data_stock-split': [],
            chart_data_bls: [],
            chart_data_bls_bls: [],
            chart_data_sec: [],
            chart_data_sec_sec: [],
            'chart_data_sec-companyfacts': [],
            'chart_data_sec-companyfacts_companyfacts': [],
            'chart_data_us-national-weather': [],
            field_datetime: 'window_start',
            'promise_get_data_stock-market': false,
            'promise_get_data_stock-split': false,
            promise_get_data_bls: false,
            promise_get_data_sec: false,
            'promise_get_data_sec-companyfacts': false,
            'promise_get_data_us-national-weather': false,
            rate: rate,
            end: end,
            //
            // the stream shown on its own, as the address names it ('?item=sec'),
            // or null for every stream (#161)
            //
            focus: linkedItem(document.location.search),
            figures_folded: layout.fold.figures !== false,
            figures_width: kept_width >= FIGURES_MIN ? kept_width : null,
            'stream_source_stock-market': ['options', 'price'],
            'stream_source_stock-split': ['alpha', 'beta', 'gamma'],
            stream_source_bls: ['bls'],
            stream_source_sec: ['sec'],
            //
            // the sec report's other series: its company facts, a row of their
            // own (#211)
            //
            'stream_source_sec-companyfacts': ['companyfacts'],
            'stream_source_us-national-weather': ['weather'],
            streams: streams,
            'stream_rate_stock-market': rate,
            'stream_rate_stock-split': rate,
            stream_rate_bls: rate,
            stream_rate_sec: rate,
            'stream_rate_sec-companyfacts': rate,
            'stream_rate_us-national-weather': rate,
            stream_throughput: 0,
            stream_throughput_bls_bls: 0,
            stream_throughput_sec_sec: 0,
            'stream_throughput_sec-companyfacts_companyfacts': 0,
            'stream_stock-market_total': 'n/a',
            'stream_stock-market_health': 'n/a',
            'stream_stock-split_total': 'n/a',
            'stream_stock-split_health': 'n/a',
            stream_bls_total: 'n/a',
            stream_bls_health: 'n/a',
            stream_sec_total: 'n/a',
            stream_sec_health: 'n/a',
            'stream_sec-companyfacts_total': 'n/a',
            'stream_sec-companyfacts_health': 'n/a',
            'stream_us-national-weather_total': 'n/a',
            'stream_us-national-weather_health': 'n/a',
            'stream_stock-market_coverage': 'n/a',
            'stream_stock-split_coverage': 'n/a',
            stream_bls_coverage: 'n/a',
            stream_sec_coverage: 'n/a',
            'stream_sec-companyfacts_coverage': 'n/a',
            'stream_us-national-weather_coverage': 'n/a',
            //
            // where the 'This request' menu hangs from while it is open, or null
            //
            requests_anchor: null,
            //
            // how many of each stream's alarms the reader holds, by stream id --
            // see loadSubscriptions. Empty signed out, and until they arrive.
            //
            subscriptions: {},
            //
            // whether the page asks for every stream again every five minutes,
            // as the reader last left it -- see refresh-preference.js -- and when
            // it last asked, which the page opening counts as
            //
            auto_refresh: readRefresh(),
            refreshed_at: Date.now(),
            //
            // the figure the rows are sorted by, as the reader last left them, or
            // null for the page's own order -- see listing-preference.js
            //
            sort: readSort('stream', SORT_KEYS),
            //
            // the order the reader dragged the rows into, or null for the
            // page's own (#218). An order kept before #152, when the rows last
            // dragged, is theirs too
            //
            order: readOrder('stream', STREAMS)
        }

        this.updateMetrics = this.updateMetrics.bind(this);
        this.callbackGetData = this.callbackGetData.bind(this);
        this.downloadData = this.downloadData.bind(this);
        this.getControlTray = this.getControlTray.bind(this);
        this.reset_stream = this.reset_stream.bind(this);
        this.loadSubscriptions = this.loadSubscriptions.bind(this);
        this.chooseRate = this.chooseRate.bind(this);
        this.retryStream = this.retryStream.bind(this);
        this.failedData = this.failedData.bind(this);
        this.refresh = this.refresh.bind(this);
        this.toggleRefresh = this.toggleRefresh.bind(this);
        this.chooseSort = this.chooseSort.bind(this);
        this.reorder = this.reorder.bind(this);
        this.resetOrder = this.resetOrder.bind(this);
        this.chooseWindow = this.chooseWindow.bind(this);
        this.openBar = this.openBar.bind(this);
        this.onVisibility = this.onVisibility.bind(this);
        this.openStream = this.openStream.bind(this);
        this.showAll = this.showAll.bind(this);
        this.onAddress = this.onAddress.bind(this);
        this.foldFigures = this.foldFigures.bind(this);
        this.resizeFigures = this.resizeFigures.bind(this);
        this.saveLayout = this.saveLayout.bind(this);

        //
        // the page's own box, which a stream opened from far down a list is
        // brought back to the top of -- see openStream
        //
        this.page = React.createRef();

        //
        // the request each stream is waiting on, by stream id: a count that goes up
        // with every request, so a reply is matched to the request it answers and a
        // reply to one since replaced is dropped -- see callbackGetData. And the
        // timer that marks a stream still loading, by the same id.
        //
        this.asked = {};
        this.slow_timers = {};

        //
        // the next refresh, and by stream id the quiet request a refresh made and
        // the request whose first answer has landed -- see refresh and
        // callbackGetData
        //
        this.refresh_timer = null;
        this.quiet = {};
        this.landed = {};
    }

    componentWillUnmount() {
        //
        // a reply that lands after the page has gone answers a request nothing is
        // waiting on any more
        //
        Object.keys(this.asked).forEach((stream) => {
            this.asked[stream] += 1;
        });
        Object.values(this.slow_timers).forEach((timer) => clearTimeout(timer));
        clearTimeout(this.refresh_timer);
        document.removeEventListener('visibilitychange', this.onVisibility);
        window.removeEventListener('popstate', this.onAddress);
    }

    componentDidMount() {
        this.state.streams.forEach((stream) => {
            this.downloadData(stream, this.state.rate);
        });

        this.loadSubscriptions();

        if (this.state.auto_refresh) {
            this.scheduleRefresh(REFRESH_MS);
        }

        document.addEventListener('visibilitychange', this.onVisibility);

        //
        // the back and forward buttons, which move between the addresses a
        // stream opened on its own pushed (#161). The page they land on is
        // this one, at whatever the address they land on says -- see onAddress
        //
        this.path = window.location.pathname;
        window.addEventListener('popstate', this.onAddress);
    }

    //
    // the next refresh, `delay` from now, in place of any that was due
    //
    scheduleRefresh(delay) {
        clearTimeout(this.refresh_timer);
        this.refresh_timer = setTimeout(this.refresh, delay);
    }

    //
    // every stream asked for again, quietly: a row keeps its bars and figures
    // while the new answer is on its way. A stream still waiting on its first
    // answer is left to it, and a hidden tab asks for nothing -- it catches up
    // when it is shown again, see onVisibility.
    //
    refresh() {
        this.refresh_timer = null;

        if (document.hidden) {
            return;
        }

        //
        // Note: while the api has told the reader to wait, the turn is skipped
        //       and the next one kept: a request made while blocked still counts
        //       toward the limit, and would keep the block going (#210). A wait
        //       with no end known -- an answer that gave neither its wait nor its
        //       window -- lets it ask, since an answer that succeeds is what ends
        //       that one
        //
        const until = limitedUntil();

        if (until !== null && Number.isFinite(until)) {
            this.scheduleRefresh(REFRESH_MS);
            return;
        }

        //
        // Note: a window that has ended no longer moves, so it is not asked for
        //       again. The clock keeps running, and the window ending now is
        //       asked for as soon as the reader goes back to it (#159)
        //
        if (!this.state.end) {
            this.state.streams.forEach((stream) => {
                if (this.state[`promise_get_data_${stream}`] || this.state[`failed_${stream}`]) {
                    this.downloadData(stream, this.state.rate, true);
                }
            });
        }

        this.setState({ refreshed_at: Date.now() }, () => this.scheduleRefresh(REFRESH_MS));
    }

    //
    // switched on again, or shown again: at once where five minutes have gone
    // by since the page last asked, and otherwise when they have
    //
    resumeRefresh() {
        const since = Date.now() - this.state.refreshed_at;

        if (since >= REFRESH_MS) {
            this.refresh();
        } else {
            this.scheduleRefresh(REFRESH_MS - since);
        }
    }

    //
    // the rows sorted by another figure, or put back in the page's own order with
    // null, and kept for the reader's next visit
    //
    chooseSort(sort) {
        this.setState({ sort: sort });
        writeSort('stream', sort);
    }

    //
    // the rows in the reader's new order, from a drag or the arrow keys, kept for
    // their next visit; null puts the page's own order back (#218)
    //
    reorder(order) {
        this.setState({ order: order });
        writeOrder('stream', order);
    }

    resetOrder() {
        this.reorder(null);
    }

    //
    // whether the rows are in an order of the reader's that differs from the
    // page's, on screen: what Reset order is offered for (#218). Sorted, the
    // reader's order is not what they are looking at
    //
    resettable() {
        const order = this.state.order;

        return !this.state.sort
            && Array.isArray(order)
            && order.some((stream, index) => stream !== this.state.streams[index]);
    }

    //
    // the button beside the api icons: refreshing on its own, or not, kept for
    // the reader's next visit -- see refresh-preference.js
    //
    toggleRefresh() {
        const on = !this.state.auto_refresh;

        writeRefresh(on);
        this.setState({ auto_refresh: on }, () => {
            if (on) {
                this.resumeRefresh();
            } else {
                clearTimeout(this.refresh_timer);
                this.refresh_timer = null;
            }
        });
    }

    //
    // a hidden tab asks for nothing, so its clock stops; shown again, it picks up
    // where the five minutes left off
    //
    onVisibility() {
        if (document.hidden || !this.state.auto_refresh) {
            clearTimeout(this.refresh_timer);
            this.refresh_timer = null;
            return;
        }

        this.resumeRefresh();
    }

    //
    // how many of each stream's alarms the reader holds, for the bells in the
    // rows -- see getControlTray. Signed out, subscribed to nothing, or asking a
    // service that could not answer, every bell stays as it was: a bell that cannot
    // say anything says nothing.
    //
    loadSubscriptions() {
        listSubscriptions()
            .then((subscriptions) => {
                if (!subscriptions || !subscriptions.length) {
                    return;
                }

                const held = {};

                subscriptions.forEach((subscription) => {
                    held[subscription.stream] = (held[subscription.stream] || 0) + 1;
                });

                this.setState({ subscriptions: held });
            })
            .catch((error) => {
                console.log(`Error (account api): the subscriptions could not be listed, ${error.message}`);
            });
    }

    //
    // every row redrawn at another rate, over the window ending now
    //
    chooseRate(rate) {
        this.chooseWindow(rate, null);
    }

    //
    // every row redrawn over another window: a rate, and the start of the
    // window's last bucket, or null for the window ending now. Each stream is
    // cleared and asked for again, and the address says which window is on
    // screen -- see writeWindow (#159). Unless the address is where the window
    // came FROM, as it is when the back button lands on one (#161)
    //
    chooseWindow(rate, end, write = true) {
        const same = rate === this.state.rate
            && (end && this.state.end ? end.valueOf() === this.state.end.valueOf() : !end && !this.state.end);

        if (same) {
            return;
        }

        //
        // and the five minutes start over, since every stream has just been
        // asked for
        //
        this.setState({ rate: rate, end: end, refreshed_at: Date.now() }, () => {
            if (write) {
                writeWindow(rate, end);
            }

            this.state.streams.forEach((stream) => {
                this.reset_stream(stream);
                this.downloadData(stream, rate);
            });

            if (this.state.auto_refresh) {
                this.scheduleRefresh(REFRESH_MS);
            }
        });
    }

    //
    // a bar opened: the interval it covers, one rate finer -- a day's hours, an
    // hour's minutes, a month's days. A minute opens nothing. See finerWindow
    //
    openBar(bar) {
        const opened = finerWindow(this.state.rate, bar.start);

        if (opened) {
            this.chooseWindow(RATES.find((r) => r.toLowerCase() === opened.rate), opened.end);
        }
    }

    //
    // the instant the window on screen ends at: the present for the window ending
    // now, and otherwise the last instant of its last bucket. What the window is
    // measured from, wherever the page measures one
    //
    windowNow(rate = this.state.rate) {
        return this.state.end ? lastInstant(rate, this.state.end) : new Date();
    }

    //
    // a stream shown on its own, from its name (#161). Every stream is still
    // asked for and kept, so the way back to all of them draws at once.
    //
    // Note: a stream opened from far down a phone's list would open part way
    //       down its own view, under a scroll the list needed and the view does
    //       not. The page is brought back to its top when that is out of sight
    //       -- above the screen, or under the phone's pinned header, whose
    //       height the page's scroll margin holds (#177). scrollIntoView is
    //       guarded since jsdom has none.
    //
    openStream(stream) {
        if (stream === this.state.focus) {
            return;
        }

        writeItem(stream);
        this.setState({ focus: stream }, () => {
            const page = this.page.current;

            if (page && typeof page.scrollIntoView === 'function' && page.getBoundingClientRect().top < scrollMargin(page)) {
                page.scrollIntoView({ block: 'start' });
            }
        });
    }

    //
    // every stream again, from the rail beside one shown on its own, or from the
    // bar over its title on a phone
    //
    showAll() {
        if (!this.state.focus) {
            return;
        }

        writeItem(null);
        this.setState({ focus: null });
    }

    //
    // the back or forward button, landing on another of this page's addresses:
    // the stream it opens, and the window it names, which is asked for again
    // where it is not the one on screen. An address on another page is that
    // page's to draw (#161)
    //
    onAddress() {
        if (window.location.pathname !== this.path) {
            return;
        }

        const search = window.location.search;
        const rate = linkedRate(search) || 'Day';

        this.setState({ focus: linkedItem(search) });
        this.chooseWindow(rate, linkedEnd(search, rate), false);
    }

    //
    // the address a stream's name links to: the page with that stream open on
    // its own, at the window on screen. A plain click is handled without it --
    // see openStream -- so this is what a new tab, or a copied link, opens
    //
    itemHref(stream) {
        const params = new URLSearchParams();

        params.set('item', stream);
        params.set('rate', this.state.rate.toLowerCase());

        if (this.state.end) {
            params.set('end', localInstant(this.state.end));
        }

        return `${window.location.pathname}?${params}`;
    }

    //
    // the figures folded behind the divider, or opened again (#161). A fold the
    // DRAG made also lets the width go, so the figures open at their own width
    // rather than at the narrowest they were dragged to on the way past it
    //
    foldFigures(folded, reset = false) {
        this.setState(
            (state) => ({
                figures_folded: folded,
                figures_width: reset ? null : state.figures_width,
            }),
            this.saveLayout
        );
    }

    //
    // the figures dragged wider or narrower. Every move is drawn, and only the
    // last -- the pointer coming up -- is kept, since a drag is a hundred
    // pointer events and localStorage is synchronous
    //
    resizeFigures(width, done) {
        this.setState({ figures_width: width }, done ? this.saveLayout : undefined);
    }

    //
    // how the figures are arranged, for the next visit -- see layout-preference.js
    //
    saveLayout() {
        writeLayout(...LAYOUT, {
            fold: { figures: this.state.figures_folded },
            size: this.state.figures_width ? { figures: this.state.figures_width } : {},
        });
    }

    //
    // a stream asked for again from its row, after its request failed
    //
    retryStream(stream) {
        this.reset_stream(stream);
        this.downloadData(stream, this.state.rate);
    }

    //
    // a request that failed: its row says so and offers to ask again. A failure
    // of a request since replaced says nothing, since the row is waiting on
    // another.
    //
    failedData(stream, asked) {
        //
        // Note: and a refresh that fails says nothing either: the row keeps what
        //       it showed, and the next refresh tries again
        //
        if (this.asked[stream] !== asked || this.quiet[stream] === asked) {
            return;
        }

        clearTimeout(this.slow_timers[stream]);
        this.setState({ [`failed_${stream}`]: true, [`slow_${stream}`]: false });
    }

    reset_stream(selected_stream) {
        const stream = selected_stream;

        this.setState({ [`chart_data_${stream}`]: [], stream_throughput: 'n/a' });

        //
        // Note: stock-market and stock-split performance reports not partitioned by source,
        //       these streams treat the report csv column 'group_by' as the source, while
        //       other sources generally only have one value under the same csv column, thus
        //       the partition is instead treated as the source
        //
        if (stream !== STOCK_MARKET && stream !== STOCK_SPLIT) {
            this.state[`stream_source_${stream}`].forEach((source, i) => {
                this.setState({
                    [`chart_data_${stream}_${source.toLowerCase()}`]: [],
                    [`stream_throughput_${stream}_${source.toLowerCase()}`]: 0
                });
            });
        } else {
            this.setState({ [`stream_throughput_${stream}_${stream}`]: 0 });
        }
    }

    getControlTray(stream) {
        const font_size = isMobile ? 'medium' : 'large';
        {/*

            each control is a button, or a link where it leads to another page,
            named for what it does to which stream -- so a keyboard reaches it,
            and a screen reader says it. They were spans with click handlers,
            which did neither.

        */}
        const name = streamName(stream);
        const held = ((this.state && this.state.subscriptions) || {})[stream] || 0;

        //
        // the stock-market stream's triggers: a link to its triggers page,
        // which has the patterns to pick from. It opened a sheet of featured
        // patterns over the bottom of the page, each card a link to the same
        // page -- a second way to pick, laid over this one (#179).
        //
        // Note: only the stock-market stream has triggers; every other stream
        //       draws the tray without it
        //
        const trigger_button = stream !== STOCK_MARKET
            ? null
            : (
                <Link
                    className='border-circle-radius control-button'
                    to={`/stream/${stream}/trigger`}
                    aria-label={`Triggers for ${name}`}
                >
                    <QueryStatsIcon
                        className='control-icon pattern'
                        fontSize={font_size}
                    />
                </Link>
            );

        //
        // Note: every stream has its bell, the company facts' included since
        //       their alarm exists (#214). #211 left theirs off while the alarms
        //       api answered their id 'no such stream'.
        //
        return(
            <div className='control-tray'>
                {trigger_button}

                <Link
                    className='border-circle-radius control-button'
                    to={`/stream/${stream}/alarm`}
                    aria-label={held
                        ? `Alarms for ${name}: subscribed to ${held} ${held === 1 ? 'alarm' : 'alarms'}`
                        : `Alarms for ${name}`}
                >
                    {this.alarmBell(stream, font_size)}
                </Link>
            </div>
        );
    }

    //
    // the bell says whether the reader is subscribed to any of the stream's alarms:
    // ringing, and held in green, when they are, with how many under the pointer.
    // Either way it leads to the stream's alarm page, where they are changed.
    //
    alarmBell(stream, font_size) {
        const held = ((this.state && this.state.subscriptions) || {})[stream] || 0;

        if (!held) {
            return (
                <NotificationsIcon
                    className='control-icon notification'
                    fontSize={font_size}
                />
            );
        }

        return (
            <Tooltip title={`Subscribed to ${held} ${held === 1 ? 'alarm' : 'alarms'}`}>
                <NotificationsActiveIcon
                    className='control-icon notification subscribed'
                    fontSize={font_size}
                />
            </Tooltip>
        );
    }


    //
    // Note: the artifact layout is no longer built here. A request names the
    //       STREAM and the rate, and api-stream-performance resolves the bucket,
    //       the prefix, the partition scheme and the trailing window.
    //
    //       This used to be five branches building s3 keys per partition, which
    //       made the storage layout -- including the upstream provider baked
    //       into a prefix -- part of this component. It also capped the monthly
    //       rate: a trailing 12 months of day partitions is ~365 paths, and the
    //       query string could not carry them, so the chart quietly drew the
    //       current month alone.
    //
    //       It is the same move '#2382' made for 'group_by': the report already
    //       names the stream, so nothing here needs a hostname table either.
    //
    // Note: 'source' is what the ingest worker keys its series by, and it is NOT
    //       uniformly the stream id -- the local fixtures answer under a single
    //       series name while the live report answers under the stream's own.
    //       For the two stock streams it is the id, which is what reset_stream
    //       clears their throughput under.
    //
    STREAM_REQUEST = {
        [STOCK_MARKET]: {
            get_data: 'stock-market-ingest',
            source: STOCK_MARKET,
            source_local: 'options'
        },
        [STOCK_SPLIT]: {
            get_data: 'stock-split-ingest',
            source: STOCK_SPLIT,
            source_local: 'beta'
        },
        bls: {
            get_data: 'bls-ingest',
            source: 'bls',
            source_local: 'bls'
        },
        sec: {
            get_data: 'sec-ingest',
            source: 'sec',
            source_local: 'sec'
        },
        //
        // the same request as the filings' -- see performanceStream in
        // api-url.js -- read for its other series. The two rows ask at once, and
        // get-data.js sends one request for both (#211)
        //
        [SEC_COMPANYFACTS]: {
            get_data: 'sec-ingest',
            source: 'companyfacts',
            source_local: 'companyfacts'
        },
        'us-national-weather': {
            get_data: 'us-national-weather-ingest',
            source: 'weather',
            source_local: 'weather'
        }
    };

    //
    // Note: `quiet` is a refresh's: the row is left as it is -- no 'Loading', no
    //       n/a, no 'Still loading' -- until the answer lands and takes its place.
    //
    downloadData(type, stream_rate, quiet = false) {
        stream_rate = stream_rate.toLowerCase();

        const asked = (this.asked[type] || 0) + 1;
        this.asked[type] = asked;
        this.quiet[type] = quiet ? asked : null;

        //
        // Note: the figures go back to n/a with the rows, so a row waiting on a
        //       new report never shows the old one's figures beside 'Loading'.
        //
        if (!quiet) {
            this.setState({
                [`stream_rate_${type}`]: stream_rate,
                [`promise_get_data_${type}`]: false,
                [`slow_${type}`]: false,
                [`failed_${type}`]: false,
                [`stream_${type}_health`]: 'n/a',
                [`stream_${type}_coverage`]: 'n/a',
                [`stream_${type}_total`]: 'n/a'
            });
        }

        const request = this.STREAM_REQUEST[type];

        if (!request) {
            this.setState({ [`promise_get_data_${type}`]: true });
            return;
        }

        if (!quiet) {
            clearTimeout(this.slow_timers[type]);
            this.slow_timers[type] = setTimeout(() => {
                if (this.asked[type] === asked && !this.state[`promise_get_data_${type}`]) {
                    this.setState({ [`slow_${type}`]: true });
                }
            }, SLOW_AFTER_MS);
        }

        {/*

            the window is measured on the VIEWER's calendar, so the zone travels
            with the request rather than being applied to the answer: a trailing
            20 days ending at 22:00 in Tokyo is not the same 20 dates as one
            ending at 09:00 in New York.

            Note: 'LocalizeTimezone' and 'GroupByDelimiter' are deliberately not
                  sent. Both are properties of how a stream is stored -- one feed
                  writes utc and groups per instrument, the rest do neither --
                  and a caller that no longer knows the layout has no basis for
                  choosing them. The api supplies each stream's own.

            Note: built by api-url.js, which also builds the 'This request' menu
                  over the rows, so each link names this exact request.

        */}

        const url = performanceUrl(type, stream_rate, viewerTimeZone(), this.state.end);

        getData(
            request.get_data,
            this.state.local ? null : url,
            (item) => this.callbackGetData(item, type, asked),
            true,
            this.state.local ? request.source_local : request.source,
            type,
            () => this.failedData(type, asked)
        );
    }

    //
    // whether a reply answers the request its stream is waiting on. One that
    // names no request -- a caller outside downloadData -- is taken as it comes.
    //
    answersLatest(asked_stream, asked) {
        return !asked_stream || asked === null || this.asked[asked_stream] === asked;
    }

    //
    // Note: the stream and the request the reply was ASKED for travel with it. A
    //       report that came back empty names no stream of its own, and its row
    //       must still stop loading; a reply to a request since replaced -- by
    //       another rate, or a retry -- is dropped, so it cannot land on the rows
    //       of the one that replaced it. Asked twice: when the reply arrives, and
    //       again when the worker is done with it, since the reader can change
    //       the rate while the worker runs.
    //
    callbackGetData(item, asked_stream = null, asked = null) {
        if (!this.answersLatest(asked_stream, asked)) {
            return;
        }

        const field_datetime = Object.assign(this.state.field_datetime);
        const worker = new WorkerBuilder(workerIngestPerformance);

        worker.onerror = (err) => {
            console.log('Error (web-worker): could not process ingest performance data');
            console.log(err);
        };

        worker.onmessage = (event) => {
            if (!this.answersLatest(asked_stream, asked)) {
                return;
            }

            if (
                checkValidObject('data', event)
                && 'selected_source' in event.data
                && event.data.selected_source
                && `chart_data_${event.data.selected_source}` in event.data
                && `stream_throughput_${event.data.selected_source}` in event.data
                && event.data[`chart_data_${event.data.selected_source}`]
                && event.data[`stream_throughput_${event.data.selected_source}`]
            ) {
                var chart_data = event.data.chart_data_original;
                var selected_source = event.data.selected_source;
                var selected_stream = event.data.selected_stream || asked_stream;

                {/*

                    Note: this branch compares an array against a number and is
                          therefore always false, so it is dead today and every
                          response falls through to the append path below.
                          deliberately left as it is -- 'fixing' it would change
                          how the existing multi source streams merge, which is a
                          separate question and a separate risk

                */}

                const merge_held = !(
                    `chart_data_${selected_stream}_${selected_source}` in this.state
                    && this.state[`chart_data_${selected_stream}_${selected_source}`]
                    && `stream_source_${selected_stream}` in this.state
                    && this.state[`stream_source_${selected_stream}`]
                    && this.state[`stream_source_${selected_stream}`] > 0
                );

                if (!merge_held) {
                    this.state[`stream_source_${selected_stream}`].forEach((source, i) => {
                        chart_data = [...chart_data, ...this.state[`chart_data_${selected_stream}_${source}`]];
                    });
                }

                //
                // Note: stock-market and stock-split performance reports not partitioned by source,
                //       these streams treat the report csv column 'group_by' as the source, while
                //       other sources generally only have one value under the same csv column, thus
                //       the partition is instead treated as the source
                //
                {/*

                    the rows already held are read INSIDE the updater rather than
                    off 'this.state' beforehand. the monthly rate now issues one
                    request per batch of day partitions, so several responses land
                    for one stream and can be handled in the same tick -- each
                    reading the same pre-merge state and writing back only its own
                    batch, which silently dropped every batch but the last

                */}

                {/*

                    a refresh's first answer takes the place of the rows it found,
                    rather than joining them, since nothing cleared them before it
                    was asked for; any later batch of the same answer joins it.
                    Decided here, as the answer is handled, so batches handled in
                    one tick each read the right side of it

                */}
                const replace = asked !== null
                    && this.quiet[selected_stream] === asked
                    && this.landed[selected_stream] !== asked;
                this.landed[selected_stream] = asked;

                this.setState((state) => {
                    const held = merge_held && !replace && state[`chart_data_${selected_stream}`]
                        ? state[`chart_data_${selected_stream}`]
                        : [];

                    return {
                        [`chart_data_${selected_stream}`]: [...chart_data, ...held].sort(
                            (a, b) => a[state.field_datetime] - b[state.field_datetime]
                        ),
                        stream_throughput: event.data.stream_throughput,
                        [`chart_data_${selected_stream}_${selected_source}`]: event.data[`chart_data_${selected_source}`],
                        [`stream_throughput_${selected_stream}_${selected_source}`]: event.data[`stream_throughput_${selected_source}`]
                    };
                });
            } else {
                //
                // a report with nothing in it: the stream still stops loading,
                // and its row draws what was due as missed or pending
                //
                var selected_stream = asked_stream;
                var chart_data = [];
            }

            if (selected_stream) {
                clearTimeout(this.slow_timers[selected_stream]);

                //
                // Note: a refresh that lands clears a failure its row was showing
                //
                this.setState({
                    [`promise_get_data_${selected_stream}`]: true,
                    [`slow_${selected_stream}`]: false,
                    [`failed_${selected_stream}`]: false
                }, () => {
                    //
                    // the listing counts describe the chart, so they are computed
                    // from what the scale actually kept -- not from everything
                    // downloaded. a daily scale draws a trailing window while the
                    // request covers the whole month, so summing the raw response
                    // reports days the chart never plots
                    //
                    // Note: read back off state rather than from the row set this
                    //       response carried, so a batch aggregates against every
                    //       batch already merged rather than against its own share
                    //
                    const chart_data_scaled = this.toggleChartScale(
                        selected_stream,
                        this.state[`stream_rate_${selected_stream}`],
                        this.state[`chart_data_${selected_stream}`] || chart_data
                    );
                    this.updateMetrics(chart_data_scaled, selected_stream);
                });
            }
        };

        {/*

            web-worker cannot accept functions as postMessage arguments:

              - https://stackoverflow.com/a/47804656

        */}

        worker.postMessage({
            item: item,
            field_datetime: field_datetime,
            throughput_key: THROUGHPUT_KEY,
            stringifiedTrim: trim.toString(),
            stringifiedCheckValidInt: checkValidInt.toString(),
            stringifiedCheckValidObject: checkValidObject.toString(),
            stringifiedCheckValidArray: checkValidArray.toString(),
            stringifiedCheckValidString: checkValidString.toString()
        });
    }

    //
    // 'chart_data' is what the chart is drawing, already aggregated to the
    // selected rate and narrowed to its date window -- both counts are summed
    // from it so the row and the graph above it never disagree
    //
    // Note: throughput rides on the rows rather than arriving as one figure per
    //       report, which is what lets it be windowed at all. this also drops
    //       the old stock-market/stock-split special case: those reports are not
    //       partitioned by source, but their 'group_by' values are the series
    //       names, so the per-series keys line up like every other stream
    //
    updateMetrics(chart_data, selected_stream) {
        const stream_source = this.state[`stream_source_${selected_stream}`];
        var stream_success = 0;
        var stream_throughput = 0;

        chart_data.forEach((item, i) => {
            stream_source.forEach((source, i) => {
                const throughput = `${source}${THROUGHPUT_KEY}`;

                if (item[source] !== undefined && checkValidObject(source, item)) {
                    stream_success += isNaN(item[source]) ? 0 : item[source];
                }

                if (item[throughput] !== undefined && checkValidObject(throughput, item)) {
                    stream_throughput += isNaN(item[throughput]) ? 0 : item[throughput];
                }
            });
        });

        const stream_health = isMobile
            ? (100 * stream_success / stream_throughput).toFixed(0)
            : (100 * stream_success / stream_throughput).toFixed(2);

        const stream_coverage = streamCoverage(
            chart_data,
            selected_stream,
            this.state[`stream_rate_${selected_stream}`],
            this.state.field_datetime,
            stream_source,
            this.windowNow(this.state[`stream_rate_${selected_stream}`])
        );

        this.state.streams.forEach((stream) => {
            if (selected_stream === stream) {
                this.setState({
                    [`stream_${stream}_total`]: stream_success ? stream_success : 'n/a',
                    [`stream_${stream}_health`]: checkValidFloat(stream_health) && stream_health > 100
                        ? 100
                        : parseFloat(stream_health) && parseFloat(stream_health) > 0 ? stream_health : 'n/a',
                    [`stream_${stream}_coverage`]: checkValidFloat(stream_coverage) && stream_coverage > 100
                        ? 100
                        : parseFloat(stream_coverage) && parseFloat(stream_coverage) > 0 ? stream_coverage : 'n/a'
                });
            }
        });
    }

    toggleChartScale(selected_stream, v, chart_data=null) {
        {/*

            https://stackoverflow.com/a/39033210

        */}

        const arr_date = [];
        const arr_result = [];
        const stream_source = this.state[`stream_source_${selected_stream}`];
        v = v ? v.toLowerCase() : this.state[`stream_rate_${selected_stream}`].toLowerCase();

        if (selected_stream && Object.keys(chart_data || {}).length > 0) {
            chart_data.forEach((item) => {
                {/*

                    the rows are true instants now (see performance.js), so the
                    local getters below already read them in the viewer's zone
                    and the buckets fall on the viewer's own hour and day.

                    'dstDateAdjusted' used to run here to walk a row back an
                    hour outside daylight time. it existed only to patch the
                    new-york wall-clock re-read that fed it: subtracting an hour
                    from a genuine instant now moves the point off the moment it
                    reports, and lands the midnight rows of a day in the one
                    before it

                */}

                const year = item[this.state.field_datetime].getFullYear();
                const month = String(item[this.state.field_datetime].getMonth() + 1).padStart(2, '0');
                const day = String(item[this.state.field_datetime].getDate()).padStart(2, '0');
                const hour = item[this.state.field_datetime].getHours();
                const minute = item[this.state.field_datetime].getMinutes();

                {/*

                    the monthly bucket is dated to the 1st of its own month, in
                    the same 'YYYY/MM/DD' form the daily bucket uses. it was
                    '${year}-${month + 2}': a 'YYYY-MM' string parses as UTC and
                    lands in the previous month once shifted to New York, and the
                    '+ 2' walked it back over -- which overflowed to month 13 in
                    december and produced an Invalid Date. the slashed form
                    parses as local time, so no correction is needed at all

                */}

                if (v === 'month') {
                    var date_string = `${year}/${month}/01`;
                } else if (v === 'day') {
                    var date_string = `${year}/${month}/${day}`;
                } else if (v === 'hour') {
                    var date_string = `${year}/${month}/${day} ${hour}`;
                } else if (v === 'minute') {
                    var date_string = `${year}/${month}/${day} ${hour}:${minute}`;
                } else {
                    var date_string = item[this.state.field_datetime].toISOString().replace(/T/, ' ');
                }

                {/*

                    the slashed forms above parse as local time, so the bucket
                    is already the viewer's own hour or day. it was re-read
                    through a new york 'toLocaleString' here, which shifted the
                    label off the bucket it was built from

                */}

                const index = arr_date.indexOf(date_string);
                const date = new Date(v === 'hour' ? `${date_string}:00` : date_string);

                {/*

                    each series carries its throughput alongside it (see
                    throughput-key.js) so the two aggregate together and the
                    listing's health stays a ratio of the same rows

                */}

                if (index === -1) {
                    arr_date.push(date_string);
                    let obj = {};
                    obj[this.state.field_datetime] = date;
                    stream_source.forEach((source) => {
                        const throughput = `${source}${THROUGHPUT_KEY}`;
                        obj[source] = isNaN(item[source]) ? 0 : item[source];
                        obj[throughput] = isNaN(item[throughput]) ? 0 : item[throughput];
                    });
                    arr_result.push(obj);
                } else {
                    stream_source.forEach((source) => {
                        const throughput = `${source}${THROUGHPUT_KEY}`;
                        arr_result[index][source] += isNaN(item[source]) ? 0 : item[source]
                        arr_result[index][throughput] += isNaN(item[throughput]) ? 0 : item[throughput];
                    });
                }
            });

            {/*

                one trailing window per rate, from the same module the request
                was built from, rather than a filter per rate written against the
                calendar. the rates used to disagree about what 'now' meant --
                'hour' kept today, so it emptied at midnight; 'minute' kept the
                current hour, so it held a single point at the top of one; 'day'
                kept a trailing 20 days but was only ever handed the current
                month to filter. all four now end at now and reach back a fixed
                distance, and the fetch reaches exactly as far

            */}

            //
            // Note: measured from the window's own end, which is now unless the
            //       reader zoomed or paged back to one that has ended (#159). A
            //       window that has ended is bounded there too: the api answers no
            //       row past its End, but a row past it here would be counted in
            //       the figures beside bars that are not drawn. The window ending
            //       now keeps its lower bound only, as it always has
            //
            const window_now = this.windowNow(v);
            const window_start = windowStart(v, window_now);
            var chart_data = window_start
                ? arr_result.filter((item) => item[this.state.field_datetime] >= window_start
                    && (!this.state.end || item[this.state.field_datetime] <= window_now))
                : arr_result;

            {/*

                the report's own padding comes off first, while the rows still
                describe what the api sent. a stream the api treats as
                continuous is asked to zero its empty buckets, which at the
                minute rate zeroes the four minutes in five that
                'us-national-weather' is idle by design -- the area dropped to the
                axis between every run and read as a comb of separate humps.

                Note: before the fill below rather than after, because the fill
                      inserts rows of its own and would make an already sparse
                      report look contiguous

            */}

            chart_data = dropPaddedEmpties(
                chart_data,
                v,
                this.state.field_datetime,
                stream_source
            );

            {/*

                an interval whose scraper never ran carries no row, so the area
                joined straight across it and the outage read as a slightly
                wider day -- the S&P 500 daily chart drew an unbroken ramp over
                a monday nothing was captured on. the gap is drawn as a zero
                here instead, against the same schedule the coverage figure
                counts, so a coverage under 100% has a visible day to point at

            */}

            chart_data = fillMissingIntervals(
                chart_data,
                selected_stream,
                v,
                this.state.field_datetime,
                stream_source,
                window_now,
                new Date()
            );

            this.setState({ [`chart_data_${selected_stream}`]: chart_data });
            return chart_data;
        } else {
            if (selected_stream) {
                this.setState({ [`chart_data_${selected_stream}`]: arr_result });
            } else {
                console.log('Error: toggleChartScale has no selected_stream');
            }

            return arr_result;
        }
    }

    //
    // the page's rows: each stream's bars at the rate on screen, its figures, and
    // its controls
    //
    rows() {
        return this.state.streams.map((stream) => ({
            stream: stream,
            name: streamName(stream),
            schedule: scheduleLabel(stream),
            status: this.state[`failed_${stream}`]
                ? 'failed'
                : this.state[`promise_get_data_${stream}`]
                ? 'done'
                : this.state[`slow_${stream}`] ? 'slow' : 'loading',
            retry: () => this.retryStream(stream),
            href: this.itemHref(stream),
            bars: streamBars(
                this.state[`chart_data_${stream}`],
                stream,
                this.state.rate,
                this.state.field_datetime,
                this.state[`stream_source_${stream}`],
                this.windowNow(),
                new Date()
            ),
            figures: {
                health: format_percent(this.state[`stream_${stream}_health`]),
                coverage: format_percent(this.state[`stream_${stream}_coverage`]),
                total: format_count(this.state[`stream_${stream}_total`])
            },
            controls: this.getControlTray(stream)
        }));
    }

    render() {
        const rate = this.state.rate;
        const end = this.state.end;
        const start = windowStart(rate, this.windowNow());
        const size = isMobile ? 'medium' : 'large';
        const rows = this.rows();

        //
        // the stream shown on its own, when one is (#161)
        //
        const focused = this.state.focus
            ? rows.find((row) => row.stream === this.state.focus) || null
            : null;

        const window_text = end
            ? `${windowHeading(rate, end)}, by the ${rate.toLowerCase()}`
            : `${windowLabel(rate)}, one bar per ${rate.toLowerCase()}`;

        const first = start ? axisLabel(start, rate) : '';
        const last = end ? axisLabel(end, rate) : 'Now';
        const resettable = this.resettable();

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div
                    ref={this.page}
                    className={`container stream-layout${focused ? ' stream-layout-focused' : ''}`}
                >
                    <div className='stream-rows-bar'>
                        {/*

                            the way back to every stream, over the title of the
                            one shown on its own: a bar across a phone (#161),
                            and a small pill on a wider screen, where it took
                            the place of a rail down the graph's side (#167)

                        */}
                        {focused
                            ? (
                                <button type='button' className='stream-back' onClick={this.showAll}>
                                    <ChevronLeftIcon fontSize='inherit' />
                                    All streams
                                </button>
                            ) : null}
                        <div className='stream-rows-intro'>
                            {focused
                                ? (
                                    <div className='stream-rows-title'>
                                        <h4>{focused.name}</h4>
                                        {focused.controls}
                                    </div>
                                ) : (
                                    <div className='stream-rows-heading'>
                                        <h4>Streams</h4>
                                        <span className='stream-rows-count'>{this.state.streams.length}</span>
                                    </div>
                                )}
                            <span>{focused ? `${focused.schedule} · ${window_text}` : window_text}</span>
                        </div>
                        {/*

                            the rate, a window back or forward, and on a phone the
                            sort: one line of controls. A wide screen shows the
                            rates as buttons, and a phone as a menu (#161)

                        */}
                        <div className='stream-controls'>
                            <div className='stream-rates' role='group' aria-label='Rate'>
                                {RATES.map((r) => (
                                    <button
                                        key={r}
                                        type='button'
                                        className='stream-rate'
                                        aria-pressed={r === rate}
                                        onClick={() => this.chooseRate(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <label className='stream-rate-menu'>
                                <span className='visually-hidden'>Rate</span>
                                <select value={rate} onChange={(event) => this.chooseRate(event.target.value)}>
                                    {RATES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </label>
                            {/*

                                a window back, a window forward -- forward stops at the
                                window ending now -- and the way back to now from
                                wherever the reader has gone (#159)

                            */}
                            <div className='stream-pager' role='group' aria-label='Window'>
                                <button
                                    type='button'
                                    className='stream-page'
                                    aria-label={`Earlier ${windowLabel(rate).replace('Last ', '').toLowerCase()}`}
                                    onClick={() => this.chooseWindow(rate, pageWindow(rate, end, -1))}
                                >
                                    <ChevronLeftIcon fontSize='inherit' />
                                </button>
                                <button
                                    type='button'
                                    className='stream-page'
                                    aria-label={`Later ${windowLabel(rate).replace('Last ', '').toLowerCase()}`}
                                    disabled={!end}
                                    onClick={() => this.chooseWindow(rate, pageWindow(rate, end, 1))}
                                >
                                    <ChevronRightIcon fontSize='inherit' />
                                </button>
                                {end
                                    ? (
                                        <button
                                            type='button'
                                            className='stream-rate stream-now'
                                            onClick={() => this.chooseWindow(rate, null)}
                                        >
                                            Now
                                        </button>
                                    ) : null}
                            </div>
                            {/*

                                the page's order put back, while the rows are in the
                                reader's and it differs (#218): /data's pill at the end
                                of the line on a wide screen, and the last choice in the
                                sort button's menu on a phone, whose line has no room

                            */}
                            {!focused && resettable
                                ? (
                                    <button type='button' className='stream-reset' onClick={this.resetOrder}>
                                        <RestartAltIcon fontSize='inherit' />
                                        Reset order
                                    </button>
                                ) : null}
                            {focused
                                ? null
                                : (
                                    <SortMenu
                                        sort={this.state.sort}
                                        onSort={this.chooseSort}
                                        onReset={resettable ? this.resetOrder : null}
                                    />
                                )}
                        </div>
                        {/*

                            the docs, and the requests the rows were drawn from: one
                            per stream, so 'This request' opens a list of them rather
                            than linking any one -- or just the one, for a stream
                            shown on its own. Each is the url downloadData fetched,
                            built by the same function

                        */}
                        <div className='stream-api-links'>
                            <ApiLinks docs={API_DOCS.performance} size={size} />
                            <Tooltip title='This request'>
                                <button
                                    type='button'
                                    className='api-link stream-requests'
                                    aria-label='This request'
                                    aria-haspopup='menu'
                                    aria-expanded={Boolean(this.state.requests_anchor)}
                                    onClick={(event) => this.setState({ requests_anchor: event.currentTarget })}
                                >
                                    <DataObjectIcon fontSize={size} />
                                </button>
                            </Tooltip>
                            <Menu
                                anchorEl={this.state.requests_anchor}
                                open={Boolean(this.state.requests_anchor)}
                                onClose={() => this.setState({ requests_anchor: null })}
                            >
                                {(focused ? [focused.stream] : this.state.streams).map((stream) => (
                                    <MenuItem
                                        key={stream}
                                        component='a'
                                        href={String(performanceUrl(stream, rate.toLowerCase(), viewerTimeZone(), end))}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        onClick={() => this.setState({ requests_anchor: null })}
                                    >
                                        {streamName(stream)}
                                    </MenuItem>
                                ))}
                            </Menu>
                            {/*

                                the page asking for every stream again every five
                                minutes, switched off and on. Its tooltip says when
                                it last asked, or that it is off

                            */}
                            <Tooltip
                                title={this.state.auto_refresh
                                    ? `Refreshes every 5 minutes, last at ${clock(this.state.refreshed_at)}`
                                    : 'Auto-refresh is off'}
                            >
                                <button
                                    type='button'
                                    className='api-link stream-refresh'
                                    aria-label='Refresh every 5 minutes'
                                    aria-pressed={this.state.auto_refresh}
                                    onClick={this.toggleRefresh}
                                >
                                    {this.state.auto_refresh
                                        ? <UpdateIcon fontSize={size} />
                                        : <UpdateDisabledIcon fontSize={size} />}
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {focused
                        ? (
                            <StreamFocus
                                row={focused}
                                rate={rate}
                                first={first}
                                last={last}
                                onOpen={rate === 'Minute' ? null : this.openBar}
                            />
                        ) : (
                            <StreamRows
                                rows={rows}
                                rate={rate}
                                sort={this.state.sort}
                                onSort={this.chooseSort}
                                onOpen={rate === 'Minute' ? null : this.openBar}
                                onFocus={this.openStream}
                                folded={this.state.figures_folded}
                                width={this.state.figures_width}
                                onFold={this.foldFigures}
                                onResize={this.resizeFigures}
                                first={first}
                                last={last}
                                order={this.state.order}
                                onReorder={this.reorder}
                            />
                        )}
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default StreamLayout;
