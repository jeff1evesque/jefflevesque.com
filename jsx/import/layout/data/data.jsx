/**
 * data.jsx: data article listing page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import Sheet from 'react-modal-sheet';
import BeatLoader from 'react-spinners/BeatLoader';
import PuffLoader from 'react-spinners/PuffLoader';
import Switch from '@mui/material/Switch';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import BarChartIcon from '@mui/icons-material/BarChart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ArticleListing from '../../general/article-listing.jsx';
import Sunburst from '../../general/sunburst.jsx';
import CubeChart from '../../general/cube-chart.jsx';
import distributionTree from '../../general/distribution-tree.js';
import trim from '../../general/trim-object.js';
import { default as getStockMarketDistribution } from '../../general/get-data/distribution/stock-market.js';
import { default as getUsWeatherAlertDistribution } from '../../general/get-data/distribution/us-weather-alert.js';
import { default as getBlsDistribution } from '../../general/get-data/distribution/bls.js';
import { default as getSecDistribution } from '../../general/get-data/distribution/sec.js';
import getData from '../../general/get-data.js';
import { datalakeUrl, API_DOCS, DATASETS } from '../../general/api-url.js';
import ApiLinks from '../../general/api-links.jsx';
import { isMobile } from 'react-device-detect';
import checkValidObject from '../../validator/valid-object.js';
import checkValidString from '../../validator/valid-string.js';
import checkValidInt from '../../validator/valid-int.js';
import checkValidArray from '../../validator/valid-array.js';
import SvgExit from '../../svg/svg-exit.jsx';
import is_local from '../../../is_local.js';
import WorkerBuilder from '../../worker/web-worker.js';
import { default as workerStockMarket } from '../../worker/data/distribution/stock-market.js';
import { default as workerUSWeatherAlert } from '../../worker/data/distribution/us-weather-alert.js';
import { default as workerBls } from '../../worker/data/distribution/bls.js';
import { default as workerSec } from '../../worker/data/distribution/sec.js';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import streamName, { streamCoverage } from '../../general/stream-name.js';
import {
    STOCK_MARKET,
    STOCK_SPLIT,
    BLS,
    SEC,
    US_NATIONAL_WEATHER,
    STREAMS,
} from '../../general/stream-id.js';
import { themeColors, translucent } from '../../general/colors.js';
import { readChart, writeChart, readOrder, writeOrder } from '../../general/listing-preference.js';
import { readLayout, writeLayout } from '../../general/layout-preference.js';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import chartHeight from '../../general/chart-height.js';
import scrollMargin from '../../general/scroll-margin.js';

{/*

    whether a stream's datalake table carries an rdf column, so the listing can
    say which sources are queryable as a graph rather than only as rows.

    source of truth is the stored parquet, NOT the glue table: bls writes a
    'triples' column that its table definition does not expose, so reading the
    catalog alone reports it as absent.

        processed_stock_market.quotes                 rdf_turtle
        us_national_weather.alerts                    rdf_turtle
        securities_exchange_commission.feed_filings   triples
        raw/source=bls/feed=*                         triples   (not in source_bls)
        stock_split.stock_split_jefflevesque_com      (none -- processed, never scraped)

    kept as a constant because it is a property of the stored data, not of the
    query the api runs, so nothing in the response reports it

*/}
const RDF_ENABLED = {
    [STOCK_MARKET]: true,
    [STOCK_SPLIT]: false,
    [BLS]: true,
    [SEC]: true,
    [US_NATIONAL_WEATHER]: true
};

function rdf_enabled(stream) {
    return RDF_ENABLED[stream] === true;
}

{/*

    how many months to step back when bls is selected.

    the date defaults to today, which is right for stock-market -- that data
    exists today. bls is the opposite: a reading is published the period AFTER
    the one it measures, so no bls row is ever labeled with the current month.
    the 12 aug 2026 cpi release carries JULY numbers, 4 aug jolts carries JUNE.
    landing on today therefore lands on the one month guaranteed to be empty,
    and the page reads 'Records 0' against a table holding 345,467 rows.

    the lag is not uniform across the ten feeds, so this offset is a compromise
    rather than a rule. measured against the 2026 objects:

        offset 1 (july)   4 of 10 feeds,  3,619 rows   cpi empsit ppi realer
        offset 2 (june)   8 of 10 feeds, 11,882 rows   + jolts laus metro ximpim

    every one of those is a MONTHLY series -- the difference is how long after
    the month ends bls publishes it. cpi and ppi take about two weeks, so the
    august release covers july. jolts/laus/metro/ximpim take about five, so
    their august release covers JUNE. eci and wkyeng are quarterly and only
    land in jan/apr/jul/oct.

    2 is chosen for the eight, not the four. no single month carries all ten
    outside a quarter start.

*/}
export const BLS_PUBLICATION_LAG_MONTHS = 2;

{/*

    what the listing says about that lag.

    deliberately NOT a rendering of BLS_PUBLICATION_LAG_MONTHS. that 2 is the
    landing offset, chosen above for the eight feeds rather than the four, so
    printing it would read '2 months' directly beneath a comment that just
    measured cpi and ppi at one. the range is the honest description of the
    spread, which makes these two separate facts that happen to be adjacent

*/}
export const BLS_PUBLICATION_LAG_LABEL = '1-2 months';

{/*

    the publication lag a stream carries, for the listing detail.

    only bls qualifies: it is the one feed whose current month is always empty,
    so its row would otherwise read 'Records 0' with nothing to say the month is
    unpublished rather than the stream unpopulated. a stream absent from this map
    renders no 'Lag' row rather than an empty one -- renderDetail prunes null,
    which is the same mechanism that keeps 'Coverage' on two of the five rows

*/}
const STREAM_LAG = {
    [BLS]: BLS_PUBLICATION_LAG_LABEL
};

function stream_lag(stream) {
    return STREAM_LAG[stream] || null;
}

{/*

    the date bls should land on when it is selected, or null to leave the
    current selection alone.

    only shifts FROM the current month, which makes it idempotent: clicking bls
    twice must not walk two months back, and a month the reader chose
    deliberately is theirs. so this moves the landing point without overriding
    the date filter -- picking august by hand still shows august, and still
    reports 0, because no bls row is labeled august.

    exported and pure so the rule can be tested without driving the component:
    the arithmetic has to go through a Date rather than subtracting from the
    month number, or december underflows into month -1 of the same year.

*/}
export function blsLandingDate(selected, now, lag = BLS_PUBLICATION_LAG_MONTHS) {
    if (!(selected instanceof Date) || !(now instanceof Date)) {
        return null;
    }

    const on_current_month = selected.getMonth() === now.getMonth()
        && selected.getFullYear() === now.getFullYear();

    if (!on_current_month) {
        return null;
    }

    const shifted = new Date(selected.getTime());
    shifted.setMonth(shifted.getMonth() - lag);

    return shifted;
}


{/*

    how long the loader takes to fade once the query resolves. the element stays
    mounted and animates its opacity, so the dots ease out as the ring arrives
    rather than being unmounted mid-frame

*/}
const LOADER_FADE_MS = 450;


{/*

    the listing's columns: each dataset's fields, as the table lays them out --
    see listing-table.jsx. Its counts sort; what it is and where it is stored
    only name it.

*/}
const LISTING_COLUMNS = [
    { key: 'Type', pill: true },
    { key: 'Coverage' },
    { key: 'Lag' },
    { key: 'Records', numeric: true, sortable: true },
    { key: 'Partitions', numeric: true, sortable: true },
    { key: 'RDF', on: 'Available' },
];


{/*

    what the ring calls a stream's groups, what each group holds, and what it
    counts, singular and plural: 'All sectors', '12 industries', '3,125,430
    records'. A stream missing from this map is named by its aggregate key, so a
    new stream still draws with a name rather than with none

*/}
const DISTRIBUTION_NAMES = {
    [STOCK_MARKET]: { group: ['sector', 'sectors'], member: ['industry', 'industries'], unit: ['record', 'records'] },
    [STOCK_SPLIT]: { group: ['day', 'days'], member: ['ticker', 'tickers'], unit: ['split', 'splits'] },
    [BLS]: { group: ['series', 'series'], member: ['category', 'categories'], unit: ['record', 'records'] },
    [SEC]: { group: ['form', 'forms'], member: ['category', 'categories'], unit: ['filing', 'filings'] },
    [US_NATIONAL_WEATHER]: {
        group: ['severity', 'severities'],
        member: ['event type', 'event types'],
        unit: ['event', 'events'],
    },
};

export function distributionNames(stream, aggregate_key) {
    if (DISTRIBUTION_NAMES[stream]) {
        return DISTRIBUTION_NAMES[stream];
    }

    const group = checkValidString(aggregate_key) ? aggregate_key : 'group';

    return { group: [group, `${group}s`], member: ['member', 'members'], unit: ['record', 'records'] };
}


{/*

    thousands separators for the listing counts: a record count runs to eight
    digits, and a bare run of numerals is read digit by digit rather than at a
    glance.

    Note: the counts sit at 'n/a' until the query resolves, so anything that is
          not a finite number passes through untouched rather than rendering as
          'NaN'. the empty string and null are excluded explicitly because
          Number() coerces both to 0

*/}
function format_count(value) {
    if (value === null || value === undefined || value === '') {
        return value;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString() : value;
}


{/*

    the 'Records' value, qualified when a zero is the publication lag rather than
    an empty stream.

    bls is the case. the 'Lag' row above already states the reason, but it sits
    BESIDE the number rather than on it: 'Lag 1-2 months' and 'Records 0' are two
    facts the reader has to join, and 'RDF Available' further along the same row
    reads as a live capability, which invites taking the 0 as the stream itself
    being empty. attaching the qualifier to the number it qualifies closes that.

    deliberately NOT applied to 'Partitions', which is zero for the same reason
    at the same time: saying it twice in one row reads as two findings rather
    than one, and the count that matters is the one the chart is drawn from.

    two gates, and both are load-bearing:

        the stream declares a lag     only bls does. a lag is the only thing that
                                      makes a published month look unpublished,
                                      so a stream without one has no excuse to
                                      offer for a zero

        the month is inside it        a zero for march 2024 is not 'unpublished',
                                      it is ABSENT -- a genuine hole in the
                                      datalake -- and the qualifier would excuse
                                      it. the window runs 0..lag: the current
                                      month is the always-empty one, and the
                                      picker's maxDate keeps the reader from
                                      selecting past it

    everything else falls through to format_count untouched, 'n/a' and the empty
    string from a failed query included. neither is zero, and a stream that
    reported nothing must not claim it measured nothing

*/}
export function recordsLabel(stream, value, selected, now, lag = BLS_PUBLICATION_LAG_MONTHS) {
    const formatted = format_count(value);

    if (!stream_lag(stream) || !(selected instanceof Date) || !(now instanceof Date)) {
        return formatted;
    }

    if (value === null || value === undefined || value === '' || Number(value) !== 0) {
        return formatted;
    }

    {/*

        the year term carries the difference across january rather than
        subtracting the month numbers, which underflows: january 2027 against
        november 2026 is 1 - 11 = -10 by month number alone, and 2 by this

    */}
    const months_behind = (now.getFullYear() - selected.getFullYear()) * 12
        + (now.getMonth() - selected.getMonth());

    return months_behind <= lag ? `${formatted} (unpublished)` : formatted;
}


{/*

    the dataset a phone shows on its own ('?item=sec'), or null for the listing:
    when the address names none, or names one that is not a dataset (#165). As
    /stream's linkedItem reads its own

*/}
export function linkedDataset(search) {
    const asked = new URLSearchParams(search).get('item');

    return STREAMS.includes(asked) ? asked : null;
}


{/*

    a dataset opened on its own, or the listing again, in the address. PUSHED,
    so the back button -- or a phone's back gesture -- returns to where the
    reader was, and everything else the address carries is kept. As /stream's
    writeItem (#165)

*/}
function writeDataset(stream) {
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

    where this page keeps how its chart is arranged -- see
    layout-preference.js. Only a wide screen draws the bars of cubes, so only
    it has the names to fold (#167)

*/}
const LAYOUT = ['data', 'wide'];


class DataLayout extends Component {
    //
    // the page's theme, which the ring's colors are drawn for, and the loading
    // chip's green is drawn in. See theme-mode.jsx.
    //
    static contextType = ThemeModeContext;

    constructor() {
        super();

        const now = new Date();
        const today = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
        const day_of_week = today.getDay();

        {/*

            Note: 6 = Saturday, 0 = Sunday. The stock-split feed produces its
                  listing Monday to Friday, holidays included

        */}

        {/*

            step the date itself back off the weekend, rather than subtracting
            from the day number. the day number alone underflows its month --
            saturday the 1st gave '00' and sunday the 1st gave '-1', naming a
            partition that cannot exist, and leaving month and year on the new
            month with no way to fall back into the old one. shifting the Date
            carries all three parts over the boundary together

        */}

        const selected = new Date(today.getTime());

        if (day_of_week === 6) {
            selected.setDate(selected.getDate() - 1);
        } else if (day_of_week === 0) {
            selected.setDate(selected.getDate() - 2);
        }

        {/*

            the stream the page opens on: the one this reader last charted here,
            and otherwise the first -- see listing-preference.js. bls opens a step
            back off the current month, as choosing it from the listing does, since
            its current month never holds a row -- see blsLandingDate.

        */}
        //
        // on a phone, a dataset the address names opens on its own, and charts
        // ahead of the remembered one -- see linkedDataset (#165)
        //
        const linked = isMobile ? linkedDataset(window.location.search) : null;
        const opening = linked || readChart('data', STREAMS) || STOCK_MARKET;
        const landing = opening === BLS ? blsLandingDate(today, today) : null;
        const opened = landing || selected;

        const dd = String(opened.getDate()).padStart(2, '0');
        const mm = String(opened.getMonth() + 1).padStart(2, '0'); // january is 0
        const yyyy = opened.getFullYear();
        {/*

            each stream by its id, which is also its name everywhere on this
            page: the listing's names and links, and the per-stream state keys.
            See stream-id.js. The page used to name each stream twice -- a
            capitalized name for the listing, lower-cased for everything else.

        */}
        const streams = STREAMS;

        let list_article = [];
        streams.forEach((stream) => {
            const loader = <PuffLoader color='#228B22' size={isMobile ? 2 : 3} speedMultiplier='0.5' />;

            list_article.push({
                'name': stream,
                'link': `?item=${stream}`,
                'detail': {
                    'Type': 'Hive',
                    /*

                        the two stock streams are adjacent and differ only in
                        universe, which the titles no longer carry: state it
                        rather than leaving 'SP500' next to 'Stock Splits' to
                        imply the splits are index members. they are not

                    */
                    ...(streamCoverage(stream) ? { 'Coverage': streamCoverage(stream) } : {}),
                    /*

                        before 'Records' rather than after: bls carries no row
                        for the current month, so the count this lands on is
                        always 0. the qualifier has to be met on the way to that
                        number, not after it has already registered as an empty
                        stream

                    */
                    ...(stream_lag(stream) ? { 'Lag': stream_lag(stream) } : {}),
                    'Records': 'n/a',
                    'Partitions': 'n/a',
                    'RDF': rdf_enabled(stream) ? 'Available' : 'None'
                },
                'loader': loader,
                'callback': this.toggleSetOpen,
                'control_tray': this.getControlTray(stream)
            });
        });

        this.updateStreamListing = this.updateStreamListing.bind(this);
        this.listing = this.listing.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
        this.toggleDataDistibution = this.toggleDataDistibution.bind(this);
        this.toggleSetOpen = this.toggleSetOpen.bind(this);
        this.callbackGetData = this.callbackGetData.bind(this);
        this.downloadData = this.downloadData.bind(this);

        this.getControlTray = this.getControlTray.bind(this);
        this.reset_stream = this.reset_stream.bind(this);
        this.updateChartHeight = this.updateChartHeight.bind(this);
        this.reorderListing = this.reorderListing.bind(this);
        this.keepNames = this.keepNames.bind(this);
        this.treeFor = this.treeFor.bind(this);
        this.chart = this.chart.bind(this);
        this.openDataset = this.openDataset.bind(this);
        this.showListing = this.showListing.bind(this);
        this.onAddress = this.onAddress.bind(this);
        this.filterButton = this.filterButton.bind(this);

        //
        // the page, which a dataset opened on a phone scrolls back to the top of
        //
        this.page = React.createRef();

        //
        // the tree each stream's ring was last drawn from, with the rows, key and
        // theme it was built for -- see treeFor
        //
        this.trees = {};

        this.state = {
            local: is_local,
            bottom_sheet_open: false,
            promise_data_distribution: false,
            'promise_get_data_stock-market': false,
            'promise_get_data_stock-split': false,
            promise_get_data_bls: false,
            promise_get_data_sec: false,
            'promise_get_data_us-national-weather': false,
            promise_list_ticker_complete: false,
            display_data_distribution: true,
            display_filter_button: true,
            display_apply_filter_button: false,
            item: 'n/a',
            ticker: 'n/a',
            tickers: null,
            aggregate_key: 'n/a',
            hide_all: false,
            date: `${mm}/${dd}/${yyyy}`,
            start_date: today,
            dd: dd,
            mm: mm,
            yyyy: yyyy,
            now: today,
            //
            // Note: from the year it is, not the year the page opens on, which bls
            //       can step back into the last one -- see `landing` above.
            //
            min_date: new Date(new Date(selected.getFullYear() - 3, 0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'})),
            selected_date: landing || today,
            streams: streams,
            selected_stream: opening,
            //
            // the order this reader dragged the listing into, or null for the
            // page's own -- see listing-preference.js
            //
            listing_order: readOrder('data', STREAMS),
            //
            // whether the chart's group names are shown under it (#167): folded
            // into a green bar unless this browser kept them shown
            //
            names_shown: readLayout(...LAYOUT).fold.names === false,
            list_article: list_article,
            //
            // each stream's datalake dataset, which is its own name for the data
            // -- see DATASETS
            //
            data_map: Object.fromEntries(STREAMS.map((stream) => [stream, [DATASETS[stream]]])),
            'records_stock-market': 'n/a',
            'records_stock-split': 'n/a',
            records_bls: 'n/a',
            records_sec: 'n/a',
            'records_us-national-weather': 'n/a',
            'partitions_stock-market': 'n/a',
            'partitions_stock-split': 'n/a',
            partitions_bls: 'n/a',
            partitions_sec: 'n/a',
            'partitions_us-national-weather': 'n/a',
            'data_distribution_stock-market': [],
            'data_distribution_stock-split': [],
            data_distribution_bls: [],
            data_distribution_sec: [],
            'data_distribution_us-national-weather': [],
            listing_graphic_title: opening,
            //
            // the dataset a phone shows on its own, in place of the listing, or
            // null while it shows the listing -- see openDataset (#165)
            //
            opened: linked,
            artifact_link: 'https://www.jefflevesque.com/artifact',
            chart_height: chartHeight()
        }
    }

    componentDidMount() {
        this.state.streams.forEach((stream) => {
            this.downloadData(stream);
        });

        window.addEventListener('resize', this.updateChartHeight);

        //
        // a phone follows the address, which holds the dataset it shows on its
        // own; this page's own path, so the back button landing on another
        // page's address is left to that page -- see onAddress
        //
        if (isMobile) {
            this.path = window.location.pathname;
            window.addEventListener('popstate', this.onAddress);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateChartHeight);
        window.removeEventListener('popstate', this.onAddress);
    }

    //
    // chart `stream`: the dataset the chart, the header and the api icons are
    // for, downloaded again for the month on screen
    //
    chart(stream) {
        {/*

            selecting bls steps the date back off the current month, which never
            holds bls data -- see BLS_PUBLICATION_LAG_MONTHS.

            only from the CURRENT month, so the step is idempotent: clicking bls
            twice must not walk two months back, and a month the reader chose
            deliberately is left alone. that also means the date picker keeps
            working normally for bls -- this moves the landing point, it does not
            override the filter

        */}
        const shifted = stream === BLS
            ? blsLandingDate(this.state.selected_date, this.state.now)
            : null;

        this.setState({
            selected_stream: stream,
            // keep the mobile chart header in sync with the selected
            // stream (was stuck on the default, the S&P 500)
            listing_graphic_title: stream,
            [`promise_get_data_${stream}`]: false,
            ...(shifted ? {
                selected_date: shifted,
                dd: String(shifted.getDate()).padStart(2, '0'),
                mm: shifted.getMonth() + 1,
                yyyy: shifted.getFullYear()
            } : {})
        }, () => {
            this.updateStreamListing();
            this.reset_stream(stream);
            this.downloadData(stream);
        });
    }

    //
    // on a phone, `stream` on its own, in place of the listing: pushed into the
    // address, so Back returns to the listing, and scrolled to its top, since
    // its graph icon may sit far down the listing (#165). Only the listing has
    // the icons, so no dataset is open yet. The top is out of sight above the
    // screen, or under the phone's pinned header, whose height the page's
    // scroll margin holds (#177).
    //
    // Note: scrollIntoView is guarded, since jsdom has none
    //
    openDataset(stream) {
        writeDataset(stream);

        this.setState({ opened: stream }, () => {
            const page = this.page.current;

            if (page && typeof page.scrollIntoView === 'function' && page.getBoundingClientRect().top < scrollMargin(page)) {
                page.scrollIntoView({ block: 'start' });
            }
        });
    }

    //
    // the listing again, from the bar over a dataset shown on its own (#165)
    //
    showListing() {
        writeDataset(null);
        this.setState({ opened: null });
    }

    //
    // the back or forward button, landing on another of this page's addresses:
    // a phone shows the dataset it names on its own, charting it where it is not
    // the one charted, or the listing where it names none. An address on another
    // page is that page's to draw. Only a phone listens (#165)
    //
    onAddress() {
        if (window.location.pathname !== this.path) {
            return;
        }

        const opened = linkedDataset(window.location.search);

        if (opened && opened !== this.state.selected_stream) {
            this.chart(opened);
        }

        this.setState({ opened: opened });
    }

    //
    // the reader's new order of the listing, kept for their next visit; null puts
    // the page's own order back
    //
    reorderListing(order) {
        this.setState({ listing_order: order });
        writeOrder('data', order);
    }

    //
    // the chart's names shown or folded, kept for this browser's next visit,
    // and for the chart drawn again for another dataset or month (#167)
    //
    keepNames(shown) {
        this.setState({ names_shown: shown });
        writeLayout(...LAYOUT, { fold: { names: !shown } });
    }

    //
    // the chart height follows the viewport, so it has to be recomputed rather
    // than read once: a fixed pixel height handed to recharts does not react to
    // a resize the way its own 'aspect' would
    //
    updateChartHeight() {
        const height = chartHeight();

        if (height !== this.state.chart_height) {
            this.setState({ chart_height: height });
        }
    }

    reset_stream(selected_stream=null) {
        const stream = selected_stream || this.state.selected_stream;

        this.setState({
            [`chart_data_${stream}`]: [],
            [`records_${stream}`]: 'n/a',
            [`partitions_${stream}`]: 'n/a'
        });
    }

    updateStreamListing(s=null) {
        const streams = s ? s : this.state.streams;
        let list_article = [];

        streams.forEach((stream) => {
            const loader = ! this.state[`promise_get_data_${stream}`]
                ? <PuffLoader color='#228B22' size={isMobile ? 2 : 3} speedMultiplier='0.5' />
                : null;

            list_article.push({
                'name': stream,
                'link': `?item=${stream}`,
                'detail': {
                    'Type': 'Hive',
                    ...(streamCoverage(stream) ? { 'Coverage': streamCoverage(stream) } : {}),
                    ...(stream_lag(stream) ? { 'Lag': stream_lag(stream) } : {}),
                    'Records': recordsLabel(
                        stream,
                        this.state[`records_${stream}`],
                        this.state.selected_date,
                        this.state.now
                    ),
                    'Partitions': format_count(this.state[`partitions_${stream}`]),
                    'RDF': rdf_enabled(stream) ? 'Available' : 'None'
                },
                'loader': loader,
                'callback': this.toggleSetOpen,
                'control_tray': this.getControlTray(stream)
            });
        });

        this.setState({ list_article: list_article });
    }

    getControlTray(stream) {
        const font_size = isMobile ? 'medium' : 'large';

        {/*

            Note: the listing is first built in the constructor, before there is
                  any state to read -- no chart button there is pressed yet.

        */}
        const charted = !!this.state && this.state.selected_stream === stream;

        return(
            <div className='control-tray'>
                {/*

                    a button named for what it does to which stream, so a keyboard
                    reaches it and a screen reader says it. It was a span with a
                    click handler, which did neither.

                */}
                <button
                    type='button'
                    className='border-circle-radius control-button'
                    aria-label={`Chart ${streamName(stream)}`}
                    aria-pressed={charted}
                    onClick={() => {
                        //
                        // kept, so the page opens on this chart next time -- see
                        // listing-preference.js
                        //
                        writeChart('data', stream);
                        this.chart(stream);

                        //
                        // a phone opens the dataset on its own, in place of
                        // the listing (#165)
                        //
                        if (isMobile) {
                            this.openDataset(stream);
                        }
                    }}
                >
                    <BarChartIcon
                        className='control-icon chart'
                        fontSize={font_size}
                    />
                </button>
            </div>
        );
    }

    downloadData(type) {
        this.setState({ [`promise_get_data_${type}`]: false} );

        this.state.data_map[type].forEach((dataset) => {
            if (STREAMS.includes(type)) {
                //
                // built by api-url.js, which also builds the 'This request' link
                // under the chart, so the link names this exact request
                //
                const url = datalakeUrl(dataset, this.state.yyyy, this.state.mm);

                if ([STOCK_MARKET, STOCK_SPLIT].includes(type)) {
                    getStockMarketDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        type,
                        type
                    );
                } else if (type === US_NATIONAL_WEATHER) {
                    getUsWeatherAlertDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        type,
                        type
                    );
                } else if (type === BLS) {
                    getBlsDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        type,
                        type
                    );
                } else if (type === SEC) {
                    getSecDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        type,
                        type
                    );
                } else {
                    console.log(`Error (data-distribution): ${type} NOT valid for get-data`);
                }
            }
        });
    }

    callbackGetData(item) {
        if (item && checkValidObject('stream', item)) {
            if ([STOCK_MARKET, STOCK_SPLIT].includes(item.stream)) {
                var worker = new WorkerBuilder(workerStockMarket);
            } else if (item.stream === US_NATIONAL_WEATHER) {
                var worker = new WorkerBuilder(workerUSWeatherAlert);
            } else if (item.stream === BLS) {
                var worker = new WorkerBuilder(workerBls);
            } else if (item.stream === SEC) {
                var worker = new WorkerBuilder(workerSec);
            } else {
                var worker = null;
            }
        } else {
            var worker = null;
        }

        if (worker) {
            worker.onerror = (err) => {
                console.log('Error (web-worker): could not process data-distribution data');
                console.log(err);
            };

            worker.onmessage = (event) => {
                if (
                    checkValidObject('data', event)
                    && event.data
                    && checkValidObject('count', event.data)
                    && typeof event.data.count === 'number'
                    && (event.data.count % 1) === 0
                    && 'selected_stream' in event.data
                    && event.data.selected_stream
                ) {
                    const selected_stream = event.data.selected_stream;
                    this.setState({
                        [`partitions_${selected_stream}`]: event.data.count
                    }, () => {
                        this.updateStreamListing();
                    });
                }

                if (
                    checkValidObject('data', event)
                    && event.data
                    && 'selected_stream' in event.data
                    && event.data.selected_stream
                    && 'data_distribution' in event.data
                    && event.data.data_distribution
                    && 'aggregate_key' in event.data
                    && event.data.aggregate_key
                ) {
                    const selected_stream = event.data.selected_stream;
                    const aggregate_key = event.data.aggregate_key;

                    {/*

                        this.state.mm is 'getMonth() + 1', which IS the calendar month
                        and not a compensation for anything. the note that used to sit
                        here claimed the s3 uri indexed months from 0, which the writer
                        contradicts: lambda-api-scraper renders 'month={now.month:02d}'
                        and the glue projection declares 'range: 1,12', so 'month=08' is
                        august. api-datalake agrees, sealing a scale only once
                        '(year, month) < (reference.year, reference.month)' -- a
                        comparison against a 1-indexed python month.

                        so 'downloadData' asks athena for the month state.mm names, and
                        this labels that same month.

                    */}
                    {/*

                        'list-months' is indexed from 0, so what is computed here is an
                        INDEX and not a month number: 'mm - 1' names the month state.mm
                        refers to.

                        it read 'mm - 2', one month behind the partition actually
                        fetched, on the since-disproven premise above that the request
                        lagged a month. that also forced a January special case -- 'mm -
                        2' being -1 there -- which wrapped the label to December of the
                        previous year. mm is 1..12, so 'mm - 1' is 0..11: it cannot
                        leave the array, and no wrap can be needed.

                    */}
                    const month_index = parseInt(this.state.mm) - 1;
                    const yyyy = this.state.yyyy;

                    {/*

                        aggregate_key is stored per stream: on the first load all five
                        streams download in parallel, so a single shared key would end
                        up holding whichever stream answered last, and the ring would
                        group the selected stream's rows by a column they do not have.

                        the rows are kept as the worker answered them. The ring is
                        drawn from a tree built as the page renders -- see treeFor --
                        because its colors follow the page's theme, which can change
                        with the rows already on screen

                    */}
                    this.setState({
                        [`records_${selected_stream}`]: event.data.records,
                        'Month': getData('list-months')[month_index],
                        'Year': yyyy,
                        [`aggregate_key_${selected_stream}`]: aggregate_key,
                        [`data_distribution_${selected_stream}`]: event.data.data_distribution,
                        [`promise_get_data_${selected_stream}`]: true
                    }, () => {
                        this.updateStreamListing();
                    });
                }
            };

            {/*

                web-worker cannot accept functions as postMessage arguments:

                  - https://stackoverflow.com/a/47804656

            */}

            worker.postMessage({
                item: item,
                stringifiedTrim: trim.toString(),
                stringifiedCheckValidInt: checkValidInt.toString(),
                stringifiedCheckValidObject: checkValidObject.toString(),
                stringifiedCheckValidArray: checkValidArray.toString(),
                stringifiedCheckValidString: checkValidString.toString()
            });
        } else {
            console.log('Error (data): worker=null')
        }
    }

    toggleDataDistibution() {
        const display_data_distribution = ! this.state.display_data_distribution;
        this.setState({
            display_data_distribution: display_data_distribution
        });
    }

    toggleSetOpen() {
        this.setState({ bottom_sheet_open: ! this.state.bottom_sheet_open });
    }

    //
    // the tree a stream's ring is drawn from: its groups, what each holds, and
    // their colors -- see distribution-tree.js. Built again only when the rows,
    // the key they are grouped by or the page's theme change, so pointing at the
    // ring does not rebuild it on every render
    //
    treeFor(stream, theme) {
        const rows = this.state[`data_distribution_${stream}`];
        const key = this.state[`aggregate_key_${stream}`];
        const held = this.trees[stream];

        if (held && held.rows === rows && held.key === key && held.theme === theme) {
            return held.tree;
        }

        const tree = distributionTree(rows, key, theme);
        this.trees[stream] = { rows: rows, key: key, theme: theme, tree: tree };

        return tree;
    }

    //
    // the button that opens the filter in place of the page: over the chart on
    // a phone and a narrow window, and in the listing's title row on a phone's
    // listing (#165)
    //
    filterButton() {
        return (
            <button className='btn' type='button' onClick={() =>
                this.setState({
                    display_filter_button: false,
                    display_apply_filter_button: true,
                    hide_all: true
                })
            }>Filter</button>
        );
    }

    filterColumn(style='default', btn=false) {
        if (btn && this.state.display_filter_button) {
            const mm = String(parseInt(this.state.mm) ).padStart(2, '0');
            const yyyy = this.state.yyyy;

            const header = isMobile && this.state.listing_graphic_title
                ? (
                    <div className='listing-graphic-title'>
                        <h5>{streamName(this.state.listing_graphic_title)}</h5>
                        <span className='title-count'> ({`${yyyy}/${mm}`})</span>
                    </div>
                ) : '';

            var button_filter = (
                <div className='d-block d-md-none filter'>
                    {header}
                    {this.filterButton()}
                </div>
            );
            var filter = null;
            var apply_filter = null;
        } else {
            const class_parent = style === 'default'
                ? 'col-md-3 d-none d-md-block checkbox-vertical checkbox-vertical-default'
                : 'checkbox-vertical checkbox-vertical-expanded';

            const class_date_label = 'col-lg-12 col-md-12 col-sm-4 col-xs-4';

            if (checkValidArray(this.state.tickers)) {
            } else {
            }

            const views = ['month', 'year'];
            const label_datepicker = 'mm/yyyy';

            {/*

                a phone has no Data Distribution switch: its listing is the page
                without the chart, and a dataset opened on its own with the
                chart off would have nothing to show (#165)

            */}
            var filter = (
                <div className={class_parent}>
                    {isMobile ? null : <div className='row'>
                        <FormControl
                            component='fieldset'
                            variant='standard'
                            className={`col-lg-${class_date_label} col-sm-${class_date_label}`}
                        >
                            <FormGroup>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={this.state.display_data_distribution}
                                            onChange={() => this.toggleDataDistibution()}
                                            name='Data Distribution'
                                        />
                                    }
                                    label='Data Distribution'
                                />
                            </FormGroup>
                        </FormControl>
                    </div>}
                    <div className='row'>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label={label_datepicker}
                                openTo='year'
                                onChange={(v) => {
                                    this.setState({
                                        selected_date: v,
                                        mm: v.getMonth() + 1,
                                        yyyy: v.getFullYear()
                                    }, () => {
                                        this.state.streams.forEach((stream) => {
                                            this.downloadData(stream);
                                        });
                                    });
                                }}
                                value={this.state.selected_date}
                                minDate={this.state.min_date}
                                maxDate={this.state.now}
                                views={views}
                            />
                        </LocalizationProvider>
                    </div>
                </div>
            );

            if (this.state.display_apply_filter_button) {
                var button_exit = (
                    <span className='exit' onClick={() =>
                        this.setState({
                            display_filter_button: true,
                            display_apply_filter_button: false,
                            hide_all: false
                        })
                    }>
                        <SvgExit />
                    </span>
                );
                var button_filter = <h5>Edit Content Filter</h5>;
                var apply_filter = (
                    <div className='apply-filter'>
                        <button className='btn' type='button' onClick={() =>
                            this.setState({
                                display_filter_button: true,
                                display_apply_filter_button: false,
                                hide_all: false
                            })
                        }>Apply Filter</button>
                    </div>
                );
            } else {
                var button_exit = null;
                var button_filter = null;
            }
        }

        return(
            <>
                {button_exit}
                {button_filter}
                {filter}
                {apply_filter}
            </>
        )
    }

    listing(actions=null) {
        return (
            <div className='col listing'>
                <ArticleListing
                    title='Data'
                    actions={actions}
                    left_column={false}
                    list_article={this.state.list_article}
                    stream_labels={true}
                    columns={LISTING_COLUMNS}
                    name_label='Dataset'
                    order={this.state.listing_order}
                    onReorder={this.reorderListing}
                    name='data'
                    selected_identifier={this.state.selected_stream}
                />
            </div>
        )
    }

    render() {
        const stream = this.state.selected_stream;

        {/*

            a phone shows its listing alone, with the Filter in the listing's
            title row, until a dataset's graph icon opens that dataset on its own,
            in place of the listing (#165). A wide screen shows both, as it did

        */}
        const opened = isMobile ? this.state.opened : null;
        const listing_first = Boolean(isMobile) && ! opened;

        const filter_column = listing_first && this.state.display_filter_button
            ? null
            : this.filterColumn('expanded', true);
        const left_column = ! this.state.hide_all
            ? this.filterColumn()
            : null;

        //
        // over the ring, above its middle, while the month on screen is on its way.
        //
        // visible strictly while the query is in flight, so the dots begin fading
        // the moment the ring lands rather than sitting on top of one that has
        // already drawn.
        //
        // there was a minimum hold here to stop a fast response flickering, but a
        // cache hit measures ~500ms end to end -- long enough to read as loading
        // on its own -- so the hold only bought an overlay on a finished chart
        //
        const loader_visible = ! this.state[`promise_get_data_${stream}`];

        //
        // kept mounted and faded with opacity rather than unmounted: removing the
        // node cannot be transitioned, which is what made it vanish abruptly.
        // 'pointerEvents: none' keeps the invisible layer from eating chart hovers
        //
        const loader = (
            <div
                style={{
                    //
                    // cover the whole ring and center within it
                    //
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    //
                    // above the ring and its middle, which is positioned over it
                    //
                    zIndex: 10,
                    opacity: loader_visible ? 1 : 0,
                    transition: `opacity ${LOADER_FADE_MS}ms ease-out`,
                    pointerEvents: 'none'
                }}
            >
                {/*

                    a chip behind the dots, not a full-area wash: it restores a
                    known surface under them, so they hold their 5.72:1 whatever
                    color of the ring is behind, and it is sized to the dots so
                    the ring still shows around it

                */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: isMobile ? '14px 18px' : '18px 24px',
                        borderRadius: 999,
                        background: translucent(themeColors(this.context.theme)['white-1'], 0.92),
                        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.12)'
                    }}
                >
                    <BeatLoader
                        //
                        // the app's ui accent -- the same green as the selected
                        // row's left border -- rather than 'colors_categorical[0]'.
                        // that slot is the first *series* color, so chrome and
                        // data were sharing one value: a legend swatch and a
                        // loading state meant different things in the same blue.
                        // it also measures better on the chip below, 5.72:1
                        // against the old 4.42:1 -- and on a dark page it is the
                        // dark theme's lighter green, for the same reason
                        //
                        color={themeColors(this.context.theme)['green-6']}
                        margin={5}
                        size={isMobile ? 20 : 30}
                        speedMultiplier={0.75}
                    />
                </div>
            </div>
        );

        if (
            ! this.state.hide_all
            && (isMobile ? !! opened : this.state.display_data_distribution)
        ) {
            const month = `${getData('list-months')[parseInt(this.state.mm) - 1]} ${this.state.yyyy}`;
            const chart = {
                tree: this.treeFor(stream, this.context.theme),
                names: distributionNames(stream, this.state[`aggregate_key_${stream}`]),
                caption: month,
                overlay: loader,
                actions: (
                    //
                    // the api's documentation, and the url downloadData fetches
                    // for the dataset and month on screen, so the request opens
                    // the response this chart was drawn from
                    //
                    <ApiLinks
                        docs={API_DOCS.datalake}
                        request={datalakeUrl(this.state.data_map[stream][0], this.state.yyyy, this.state.mm)}
                        size={isMobile ? 'medium' : 'large'}
                    />
                ),
            };

            {/*

                a wide screen draws the stacked bars of cubes, and a phone the
                sunburst, since a row of bars does not fit a phone's width -- see
                cube-chart.jsx.

                keyed by the stream and the month on screen, so choosing another
                closes a group or a list left open on the last one rather than
                carrying it over to rows that may not hold it

            */}
            var data_distribution = (
                <div className='col-lg-12 mx-auto'>
                    {isMobile ? (
                        <Sunburst key={`${stream}|${this.state.yyyy}|${this.state.mm}`} {...chart} phone />
                    ) : (
                        <CubeChart
                            key={`${stream}|${this.state.yyyy}|${this.state.mm}`}
                            {...chart}
                            height={this.state.chart_height}
                            namesShown={this.state.names_shown}
                            onNames={this.keepNames}
                        />
                    )}
                </div>
            );
        } else {
            var data_distribution = null
        }

        const listing = ! this.state.hide_all && ! opened
            ? this.listing(listing_first ? this.filterButton() : null)
            : null;

        {/*

            the way back from a dataset on its own to the listing, as /stream's
            "All streams" bar is on a phone (#165)

        */}
        const back = opened && ! this.state.hide_all
            ? (
                <div className='data-back-row'>
                    <button type='button' className='data-back' onClick={this.showListing}>
                        <ChevronLeftIcon fontSize='inherit' />
                        All data
                    </button>
                </div>
            ) : null;

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container data-listing' ref={this.page}>
                    <div className='row listing-graphic'>
                        {back}
                        {filter_column}
                        {data_distribution}
                    </div>
                    <div className='row listing-general'>
                        {left_column}
                        {listing}
                    </div>
                    <Sheet
                        isOpen={this.state.bottom_sheet_open}
                        onClose={() => null}
                        snapPoints={[1, 0.75, 0.55, 0.25]}
                        initialSnap={2}
                    >
                        <Sheet.Container>
                            <Sheet.Header />
                            <span className='exit' onClick={() =>
                                this.setState({ bottom_sheet_open: false })
                            }>
                                <SvgExit />
                            </span>
                            <Sheet.Content>Hold onto your seat, more to come!</Sheet.Content>
                        </Sheet.Container>
                        <Sheet.Backdrop />
                    </Sheet>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default DataLayout;
