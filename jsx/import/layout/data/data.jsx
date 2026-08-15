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
import LoopIcon from '@mui/icons-material/Loop';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArticleListing from '../../general/article-listing.jsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import trim from '../../general/trim-object.js';
import { default as getStockMarketDistribution } from '../../general/get-data/distribution/stock-market.js';
import { default as getUsWeatherAlertDistribution } from '../../general/get-data/distribution/us-weather-alert.js';
import { default as getBlsDistribution } from '../../general/get-data/distribution/bls.js';
import { default as getSecDistribution } from '../../general/get-data/distribution/sec.js';
import getData from '../../general/get-data.js';
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
import { toRGB, colors, colors_categorical, color_tail } from '../../general/colors.js';
import chartHeight, {
    CHART_X_AXIS_HEIGHT,
    CHART_X_AXIS_HEIGHT_MOBILE,
    CHART_X_AXIS_ANGLE,
    CHART_X_AXIS_ANCHOR
} from '../../general/chart-height.js';

{/*

    custom distribution tooltip: recharts colors each row's TEXT with the series
    color, which is hard to read (the "rainbow text") on the many-series streams
    like stock-market and us-national-weather. render the color as a small swatch
    instead and keep the label/value in neutral, readable text. also drop the
    empty (zero/undefined) segments so a hovered bar only lists the series it
    actually contains

*/}
{/*

    nws severity is an ordered scale, so the x-axis reads worst-first rather than
    alphabetically. anything not on the scale ranks after every scale member and
    falls back to alphabetical among its peers

*/}
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
    StockMarket: true,
    StockMarketStockSplit: false,
    BLS: true,
    SEC: true,
    USNationalWeather: true
};

function rdf_enabled(stream) {
    return RDF_ENABLED[stream] === true;
}

{/*

    how many months to step back when bls is selected.

    the date defaults to today, which is right for stock-market -- that data
    exists today. bls is the opposite: a reading is published the period AFTER
    the one it measures, so no bls row is ever labelled with the current month.
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

    the date bls should land on when it is selected, or null to leave the
    current selection alone.

    only shifts FROM the current month, which makes it idempotent: clicking bls
    twice must not walk two months back, and a month the reader chose
    deliberately is theirs. so this moves the landing point without overriding
    the date filter -- picking august by hand still shows august, and still
    reports 0, because no bls row is labelled august.

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

    snap points for the distribution detail sheet, shared with the scroller.

    react-modal-sheet sizes the container to the LARGEST snap point and reaches
    the smaller ones by translating the sheet downwards, so at a partial snap the
    lower part of the container sits below the screen edge. its scroller is
    'height: 100%' of that full container, so the last rows can never be scrolled
    into view. sizing the scroller to the CURRENT snap instead keeps the
    scrollable area equal to what is actually visible

*/}
const DETAIL_SNAP_POINTS = [0.9, 0.6, 0.4];
const DETAIL_INITIAL_SNAP = 1;

{/* the library's own drag header, subtracted so the scroller fits inside it */}
const DETAIL_HEADER_HEIGHT = 40;

{/*

    how long the loader takes to fade once the query resolves. the element stays
    mounted and animates its opacity, so the dots ease out as the bars arrive
    rather than being unmounted mid-frame

*/}
const LOADER_FADE_MS = 450;


const SEVERITY_ORDER = ['extreme', 'severe', 'moderate', 'minor', 'unknown'];

function severity_rank(label) {
    const index = SEVERITY_ORDER.indexOf(String(label).trim().toLowerCase());
    return index === -1 ? SEVERITY_ORDER.length : index;
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

    split the api's 'nvdl 3:1, mull 25:1' into [{ticker, ratio}], so both the
    hover and the click-through sheet can render the ticker left and its ratio
    right rather than one unreadable run-on string

*/}
export function splitTickerPairs(tickers) {
    if (!checkValidString(tickers)) {
        return [];
    }

    return tickers
        .split(',')
        .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            return { ticker: parts[0], ratio: parts.slice(1).join(' ') };
        })
        .filter((entry) => entry.ticker);
}


export function DistributionTooltip({ active, payload, label }) {
    if (!active || !checkValidArray(payload)) {
        return null;
    }

    const rows = payload.filter((entry) => entry && entry.value != null && entry.value !== 0);
    if (!rows.length) {
        return null;
    }

    {/*

        a recharts tooltip is pinned to the cursor and dismisses the moment the
        pointer leaves the plotting area, so a scrollbar on the wrapper is not
        actually reachable and any overflow is silently clipped. instead, sort by
        value and cap the number of rows, collapsing the remainder into a single
        "+N more" line so nothing rendered is ever cut off

    */}
    const MAX_ROWS = 12;
    const sorted = rows.slice().sort((a, b) => Number(b.value) - Number(a.value));
    const visible = sorted.slice(0, MAX_ROWS);
    const hidden = sorted.slice(MAX_ROWS);
    const hidden_total = hidden.reduce((sum, entry) => sum + Number(entry.value), 0);

    {/*

        stock-split carries the tickers that split on this date as
        'ticker ratio' pairs. a single date reaches 100 tickers, so the hover
        lists only the first few and defers the rest to the click-through sheet,
        mirroring how the stacked series above are capped

    */}
    const MAX_TICKERS = 6;
    const ticker_pairs = splitTickerPairs(rows[0] && rows[0].payload ? rows[0].payload.tickers : null);
    const ticker_visible = ticker_pairs.slice(0, MAX_TICKERS);
    const ticker_hidden = ticker_pairs.length - ticker_visible.length;

    return (
        <div
            style={{
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: '8px 10px',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#333'
            }}
        >
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#1a1a1a' }}>{label}</div>
            {visible.map((entry, index) => (
                <div
                    key={`tooltip-row-${index}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <span
                        style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            backgroundColor: entry.color,
                            flex: '0 0 auto'
                        }}
                    />
                    {/*

                        a per-bar ranked series is keyed 'slot_n' and carries the name
                        it holds in THIS bar alongside it; fall back to the series key
                        for the streams that are not ranked per bar

                    */}
                    <span style={{ flex: '1 1 auto', color: '#333' }}>
                        {(entry.payload && entry.payload[`${entry.dataKey}_name`]) || entry.name}
                    </span>
                    <span style={{ marginLeft: 12, fontVariantNumeric: 'tabular-nums', color: '#333' }}>
                        {Number(entry.value).toLocaleString()}
                    </span>
                </div>
            ))}
            {ticker_visible.length > 0 && (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #eee' }}>
                    {ticker_visible.map((entry, index) => (
                        <div
                            key={`tooltip-ticker-${index}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <span style={{ flex: '1 1 auto', color: '#333' }}>{entry.ticker}</span>
                            <span style={{ marginLeft: 12, fontVariantNumeric: 'tabular-nums', color: '#333' }}>
                                {entry.ratio}
                            </span>
                        </div>
                    ))}
                    {ticker_hidden > 0 && (
                        <div style={{ marginTop: 2, color: '#777', fontStyle: 'italic' }}>
                            {`+${ticker_hidden} more · click bar for all`}
                        </div>
                    )}
                </div>
            )}
            {hidden.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                        paddingTop: 4,
                        borderTop: '1px solid #eee',
                        color: '#777',
                        fontStyle: 'italic'
                    }}
                >
                    <span style={{ flex: '1 1 auto' }}>{`+${hidden.length} more · click bar for all`}</span>
                    <span style={{ marginLeft: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {hidden_total.toLocaleString()}
                    </span>
                </div>
            )}
        </div>
    );
}

class DataLayout extends Component {
    constructor() {
        super();

        const now = new Date();
        const today = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
        const day_of_week = today.getDay();

        {/*

            Note: 6 = Saturday, 0 = Sunday, and StockSplitSplitter function will
                  produce stock-split csv listing Mon-Fri regardless of holiday

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

        const dd = String(selected.getDate()).padStart(2, '0');
        const mm = String(selected.getMonth() + 1).padStart(2, '0'); // january is 0
        const yyyy = selected.getFullYear();
        const stream_stockmarket = 'StockMarket';
        const stream_stocksplit = `${stream_stockmarket}StockSplit`;
        const stream_bls = 'BLS';
        const stream_sec = 'SEC';
        const stream_usnationalweather = 'USNationalWeather';

        const streams = [
            stream_stockmarket,
            stream_stocksplit,
            stream_bls,
            stream_sec,
            stream_usnationalweather
        ];

        let list_article = [];
        streams.forEach((v, i) => {
            const stream = v.toLowerCase();
            const loader = <PuffLoader color='#228B22' size={isMobile ? 2 : 3} speedMultiplier='0.5' />;

            list_article.push({
                'name': v,
                'link': `?item=${stream}`,
                'detail': {
                    'Type': 'Hive',
                    /*

                        the two stock streams are adjacent and differ only in
                        universe, which the titles no longer carry: state it
                        rather than leaving 'SP500' next to 'Stock Splits' to
                        imply the splits are index members. they are not

                    */
                    ...(streamCoverage(v) ? { 'Coverage': streamCoverage(v) } : {}),
                    'Records': 'n/a',
                    'Partitions': 'n/a',
                    'RDF': rdf_enabled(v) ? 'Available' : 'None'
                },
                'loader': loader,
                'callback': this.toggleSetOpen,
                'control_tray': this.getControlTray(v)
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
        this.openDistributionDetail = this.openDistributionDetail.bind(this);
        this.updateChartHeight = this.updateChartHeight.bind(this);

        this.state = {
            local: is_local,
            bottom_sheet_open: false,
            distribution_detail_open: false,
            distribution_detail_title: '',
            distribution_detail_rows: [],
            distribution_detail_snap: DETAIL_INITIAL_SNAP,
            promise_data_distribution: false,
            promise_get_data_stockmarket: false,
            promise_get_data_stockmarketstocksplit: false,
            promise_get_data_bls: false,
            promise_get_data_sec: false,
            promise_get_data_usnationalweather: false,
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
            min_date: new Date(new Date(yyyy - 3, 0, 1).toLocaleString('en-US', {timeZone: 'America/New_York'})),
            selected_date: today,
            stream_stockmarket: stream_stockmarket.toLowerCase(),
            stream_stockmarketstocksplit: stream_stocksplit.toLowerCase(),
            stream_bls: stream_bls.toLowerCase(),
            stream_sec: stream_sec.toLowerCase(),
            stream_usnationalweather: stream_usnationalweather.toLowerCase(),
            streams: streams,
            selected_stream: stream_stockmarket.toLowerCase(),
            list_article: list_article,
            data_map: {
                [`${stream_stockmarket.toLowerCase()}`]: ['stock-market'],
                [`${stream_stocksplit.toLowerCase()}`]: ['stock-split'],
                [`${stream_bls.toLowerCase()}`]: ['bls'],
                [`${stream_sec.toLowerCase()}`]: ['sec'],
                [`${stream_usnationalweather.toLowerCase()}`]: ['us-weather-alert']
            },
            records_stockmarket: 'n/a',
            records_stockmarketstocksplit: 'n/a',
            records_bls: 'n/a',
            records_sec: 'n/a',
            records_usnationalweather: 'n/a',
            partitions_stockmarket: 'n/a',
            partitions_stockmarketstocksplit: 'n/a',
            partitions_bls: 'n/a',
            partitions_sec: 'n/a',
            partitions_usnationalweather: 'n/a',
            data_distribution_stockmarket: [],
            data_distribution_stockmarketstocksplit: [],
            data_distribution_bls: [],
            data_distribution_sec: [],
            data_distribution_usnationalweather: [],
            data_distribution_stockmarket_bar: [],
            data_distribution_stockmarketstocksplit_bar: [],
            data_distribution_bls_bar: [],
            data_distribution_sec_bar: [],
            data_distribution_usnationalweather_bar: [],
            listing_graphic_title: 'StockMarket',
            artifact_link: 'https://www.jefflevesque.com/artifact',
            chart_height: chartHeight()
        }
    }

    componentDidMount() {
        this.state.streams.forEach((v, i) => {
            this.downloadData(v.toLowerCase());
        });

        window.addEventListener('resize', this.updateChartHeight);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateChartHeight);
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
        const stream = selected_stream
            ? selected_stream.toLowerCase()
            : this.state.selected_stream;

        this.setState({
            [`chart_data_${stream}`]: [],
            [`records_${stream}`]: 'n/a',
            [`partitions_${stream}`]: 'n/a'
        });
    }

    updateStreamListing(s=null) {
        const streams = s ? s : this.state.streams;
        let list_article = [];

        streams.forEach((v, i) => {
            const stream = v.toLowerCase();
            const loader = ! this.state[`promise_get_data_${stream}`]
                ? <PuffLoader color='#228B22' size={isMobile ? 2 : 3} speedMultiplier='0.5' />
                : null;

            list_article.push({
                'name': v,
                'link': `?item=${stream}`,
                'detail': {
                    'Type': 'Hive',
                    ...(streamCoverage(v) ? { 'Coverage': streamCoverage(v) } : {}),
                    'Records': format_count(this.state[`records_${stream}`]),
                    'Partitions': format_count(this.state[`partitions_${stream}`]),
                    'RDF': rdf_enabled(v) ? 'Available' : 'None'
                },
                'loader': loader,
                'callback': this.toggleSetOpen,
                'control_tray': this.getControlTray(v)
            });
        });

        this.setState({ list_article: list_article });
    }

    getControlTray(stream_name) {
        const stream = stream_name.toLowerCase();
        const font_size = isMobile ? 'medium' : 'large';

        return(
            <div className='control-tray'>
                {/*

                    the handler sits on the oval, not on the glyph inside it. the
                    oval is '.border-circle-radius', whose ':before' both shades
                    and greens on hover across the full span -- so hanging the
                    click on the icon alone would light up a target larger than
                    the one that actually responds to a click

                */}
                <span
                    className='border-circle-radius'
                    onClick={() => {
                        {/*

                            selecting bls steps the date back off the current
                            month, which never holds bls data -- see
                            BLS_PUBLICATION_LAG_MONTHS.

                            only from the CURRENT month, so the step is
                            idempotent: clicking bls twice must not walk two
                            months back, and a month the reader chose
                            deliberately is left alone. that also means the date
                            picker keeps working normally for bls -- this moves
                            the landing point, it does not override the filter

                        */}
                        const shifted = stream === this.state.stream_bls
                            ? blsLandingDate(this.state.selected_date, this.state.now)
                            : null;

                        this.setState({
                            selected_stream: stream,
                            // keep the mobile chart header in sync with the selected
                            // stream (was stuck on the default 'StockMarket')
                            listing_graphic_title: stream_name,
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
                    }}
                >
                    <BarChartIcon
                        className='control-icon chart'
                        fontSize={font_size}
                    />
                </span>
            </div>
        );
    }

    downloadData(type) {
        type = type.toLowerCase();
        this.setState({ [`promise_get_data_${type}`]: false} );

        this.state.data_map[type].forEach((v, i) => {
            const stream = v.toLowerCase();
            if ([
                this.state.stream_stockmarket.toLowerCase(),
                this.state.stream_stockmarketstocksplit.toLowerCase(),
                this.state.stream_usnationalweather.toLowerCase(),
                this.state.stream_bls.toLowerCase(),
                this.state.stream_sec.toLowerCase()
            ].includes(type)) {
                const scale = { 'year': this.state.yyyy, 'month': String(this.state.mm).padStart(2, '0') };
                let url = new URL('https://api.jefflevesque.com/v1/public/datalake');
                const params = {
                    Data: stream,
                    Scale: JSON.stringify(scale)
                };
                Object.keys(params || {}).forEach(key => url.searchParams.append(key, params[key]));

                if ([this.state.stream_stockmarket, this.state.stream_stockmarketstocksplit].includes(type)) {
                    getStockMarketDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        this.state[`stream_${stream}`],
                        type
                    );
                } else if (type === this.state.stream_usnationalweather) {
                    getUsWeatherAlertDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        this.state[`stream_${stream}`],
                        type
                    );
                } else if (type === this.state.stream_bls) {
                    getBlsDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        this.state[`stream_${stream}`],
                        type
                    );
                } else if (type === this.state.stream_sec) {
                    getSecDistribution(
                        'data-distribution',
                        this.state.local ? null : url,
                        (item) => this.callbackGetData(item),
                        true,
                        this.state[`stream_${stream}`],
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
            if ([this.state.stream_stockmarket, this.state.stream_stockmarketstocksplit].includes(item.stream)) {
                var worker = new WorkerBuilder(workerStockMarket);
            } else if (item.stream === this.state.stream_usnationalweather) {
                var worker = new WorkerBuilder(workerUSWeatherAlert);
            } else if (item.stream === this.state.stream_bls) {
                var worker = new WorkerBuilder(workerBls);
            } else if (item.stream === this.state.stream_sec) {
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
                    const selected_stream = event.data.selected_stream.toLowerCase();
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
                    const selected_stream = event.data.selected_stream.toLowerCase();
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

                        aggregate_key must be stored per-stream: on initial load all streams
                        download in parallel, so a single shared aggregate_key ends up holding
                        whichever stream responded last, and the x-axis dataKey then points at a
                        column absent from the selected stream's rows (blank axis labels until
                        the stream is re-selected)

                    */}
                    this.setState({
                        [`records_${selected_stream}`]: event.data.records,
                        'Month': getData('list-months')[month_index],
                        'Year': yyyy,
                        [`aggregate_key_${selected_stream}`]: aggregate_key
                    }, () => {
                        this.updateStreamListing();
                    });

                    {/*

                        not const: the series cap below rebuilds these rows to fold
                        the long tail into a single 'Other' series

                    */}
                    let data_distribution = event.data.data_distribution;

                    {/*

                        collect the distinct stacked keys (everything except the x-axis
                        aggregate_key) as the union across every row, in first-seen order. the
                        previous logic pushed a <Bar> per key per row, which produced duplicate
                        bars (and position-dependent colors) once a stream had more than one row

                    */}
                    {/*

                        only numeric values are plottable: stock-split rows carry a
                        'tickers' string for the tooltip to read, which would otherwise
                        become its own <Bar> and a duplicate tooltip row

                    */}
                    let data_keys = [];
                    data_distribution.forEach((obj) => {
                        Object.keys(obj).forEach(key => {
                            if (
                                key !== aggregate_key
                                && !data_keys.includes(key)
                                && typeof obj[key] === 'number'
                            ) {
                                data_keys.push(key);
                            }
                        });
                    });

                    {/*

                        cap the number of stacked series. the previous code generated a
                        hue per series off the hsv wheel once the palette ran out, which
                        for us-weather-alert meant 58 fully saturated hues in one bar and
                        127 for stock-market -- a rainbow no palette can rescue, because
                        the problem is the count rather than the colors.

                        keep the largest few by total, roll the remainder into a single
                        neutral 'Other', and never cycle a hue: a repeated color would
                        claim two series share an identity. this mirrors what the x-axis
                        already does at MAX_BARS, and the full breakdown stays reachable
                        by clicking the bar

                    */}
                    const MAX_SERIES = colors_categorical.length;
                    const SERIES_SLOT = 'slot_';

                    {/*

                        one slot per palette hue. four left the remainder averaging 37%
                        of every bar -- the largest segment in most of them, which reads
                        as though 'Other' were the finding. eight drops it to 14%

                    */}

                    {/*

                        the chart is folded, the drill-down is not: keep the complete
                        pre-fold row per bar so clicking it still lists every series.
                        without this the sheet would only ever show what survived the
                        fold, which is exactly the detail the fold is hiding

                    */}
                    const series_detail = {};
                    data_distribution.forEach((obj) => {
                        series_detail[obj[aggregate_key]] = { ...obj };
                    });

                    if (data_keys.length > MAX_SERIES) {
                        {/*

                            rank within each bar rather than across all of them, and keep
                            every series -- no 'Other' lump.

                            a colour means 'the nth largest part of THIS bar' rather than
                            one fixed series, which is normally wrong, but here the bar is
                            the entity, it is named on the axis, and every segment is named
                            on hover and in the sheet, so nothing is identified by colour
                            alone. ranking globally instead left whole bars anonymous:
                            us-weather-alert put every 'Extreme' event below the cut
                            despite tornado warnings being 85% of that bar

                        */}
                        data_distribution = data_distribution.map((obj) => {
                            const ranked_in_bar = Object.keys(obj)
                                .filter((key) => key !== aggregate_key && typeof obj[key] === 'number')
                                .sort((a, b) => obj[b] - obj[a]);

                            const row = { [aggregate_key]: obj[aggregate_key] };

                            ranked_in_bar.forEach((key, slot) => {
                                row[`${SERIES_SLOT}${slot + 1}`] = obj[key];
                                row[`${SERIES_SLOT}${slot + 1}_name`] = key;
                            });

                            return row;
                        });

                        const slot_count = data_distribution.reduce(
                            (most, obj) => Math.max(
                                most,
                                Object.keys(obj).filter((key) => key.startsWith(SERIES_SLOT)
                                    && !key.endsWith('_name')).length
                            ),
                            0
                        );

                        data_keys = Array.from(
                            { length: slot_count },
                            (ignored, slot) => `${SERIES_SLOT}${slot + 1}`
                        ).filter((key) => data_distribution.some((obj) => obj[key] > 0));
                    }

                    const to_rgb_parts = (hex) => {
                        const rgb = toRGB(hex).replace('rgb(', '').replace(')', '').split(',');
                        return { r: rgb[0], g: rgb[1], b: rgb[2] };
                    };

                    {/*

                        the first slots carry the categorical hues; anything past them is
                        the long tail, which shares one desaturated hue and separates only
                        by lightness. that keeps each member hoverable while reading as a
                        single band rather than competing with the named series

                    */}
                    const tail_length = Math.max(data_keys.length - colors_categorical.length, 0);

                    let data_distribution_bar = data_keys.map((key, index) => {
                        const color = index < colors_categorical.length
                            ? colors_categorical[index]
                            : color_tail(index - colors_categorical.length, tail_length);

                        return { data_key: key, color: to_rgb_parts(color) };
                    });


                    {/*

                        cap the number of x-axis bars: some streams have hundreds of
                        categories (e.g. ~250 distinct sec filing 'form' types), which render
                        as an unreadable smear of razor-thin bars. select the top N by total,
                        then roll the long tail into a single 'Other' bar. the bucketed rows are
                        stashed so clicking 'Other' can list exactly what it contains.

                        the bars themselves are ordered ALPHABETICALLY by label (not by value)
                        so the axis doesn't read as an artificial descending staircase; 'Other'
                        is always pinned last

                    */}
                    const MAX_BARS = 20;
                    const row_total = (obj) =>
                        data_keys.reduce((sum, key) => sum + (Number(obj[key]) || 0), 0);
                    {/*

                        numeric collation, so labels carrying a number sort by its
                        value rather than digit by digit: plain localeCompare ordered
                        the stock-split axis '1, 10, 12, ... 2, 20, 23, 5', and orders
                        sec as 'Form 13F-HR' before 'Form 4'

                        severity is ranked rather than collated: it is an ordered
                        scale, and sorting it as text interleaves the ranks
                        ('Extreme, Minor, Moderate, Severe'). a label outside the
                        scale keeps its alphabetical position after the ranked ones,
                        so an unrecognised severity is still drawn rather than
                        silently pinned to an end

                    */}
                    const by_label = (a, b) => {
                        const label_a = String(a[aggregate_key]);
                        const label_b = String(b[aggregate_key]);

                        const rank_a = severity_rank(label_a);
                        const rank_b = severity_rank(label_b);

                        if (rank_a !== rank_b) {
                            return rank_a - rank_b;
                        }

                        return label_a.localeCompare(label_b, undefined, { numeric: true });
                    };

                    let chart_distribution;
                    let other_rows = [];
                    if (data_distribution.length > MAX_BARS) {
                        const by_value_desc = data_distribution
                            .slice()
                            .sort((a, b) => row_total(b) - row_total(a));
                        const head = by_value_desc.slice(0, MAX_BARS - 1).sort(by_label);
                        const tail = by_value_desc.slice(MAX_BARS - 1);

                        const other = { [aggregate_key]: 'Other' };
                        data_keys.forEach((key) => {
                            other[key] = tail.reduce((sum, obj) => sum + (Number(obj[key]) || 0), 0);
                        });

                        chart_distribution = head.concat([other]);
                        other_rows = tail
                            .map((obj) => ({
                                name: obj[aggregate_key],
                                value: row_total(obj),
                                color: null
                            }))
                            .sort((a, b) => b.value - a.value);
                    } else {
                        chart_distribution = data_distribution.slice().sort(by_label);
                    }

                    if (selected_stream) {
                        this.setState({
                            [`data_distribution_${selected_stream}`]: chart_distribution,
                            [`data_distribution_${selected_stream}_bar`]: data_distribution_bar,
                            [`data_distribution_${selected_stream}_other`]: other_rows,
                            [`data_distribution_${selected_stream}_series`]: series_detail,
                            [`promise_get_data_${selected_stream}`]: true
                        });
                    }
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

    /*

        the hover tooltip is pinned to the cursor and cannot hold interactive
        controls, so "expand" lives on a bar click instead: clicking any segment of
        a bar opens the bottom sheet with the FULL sorted breakdown for that x-axis
        entry, scrollable and reachable regardless of how many series it contains

    */
    openDistributionDetail(payload) {
        const stream = this.state.selected_stream.toLowerCase();
        const aggregate_key = this.state[`aggregate_key_${stream}`];

        {/* validate the clicked row is an object carrying the x-axis key */}
        if (!aggregate_key || !payload || !checkValidObject(aggregate_key, payload)) {
            return;
        }

        const title = payload[aggregate_key];

        {/*

            clicking the same bar again closes the sheet (toggle); clicking a
            different bar while open swaps in the new breakdown instead of closing

        */}
        if (this.state.distribution_detail_open && this.state.distribution_detail_title === title) {
            this.setState({ distribution_detail_open: false });
            return;
        }

        {/*

            the 'Other' bar is the bucketed long tail; clicking it lists the x-axis
            entries it rolled up (already sorted by value). every other bar shows its
            stacked-category breakdown

        */}
        const other = this.state[`data_distribution_${stream}_other`] || [];
        let rows;
        if (title === 'Other' && other.length) {
            rows = other;
        } else {
            const bars = this.state[`data_distribution_${stream}_bar`] || [];

            {/*

                key the swatches by the name the sheet actually lists.

                a per-bar ranked series is keyed 'slot_n', and which series that is
                depends on the bar, so the clicked row carries the name alongside it.
                mapping straight off the bar's data_key leaves every swatch unmatched
                and the whole sheet renders grey

            */}
            const color_map = {};
            bars.forEach((bar) => {
                const series_name = payload[`${bar.data_key}_name`] || bar.data_key;
                color_map[series_name] = bar.color;
            });

            {/*

                stock-split has a single 'splits' series, so the stacked breakdown
                would just restate the bar. list the tickers that split instead,
                each against its ratio; this is the full list the hover truncates

            */}
            const ticker_pairs = splitTickerPairs(payload.tickers);

            if (ticker_pairs.length) {
                rows = ticker_pairs.map((entry) => ({
                    name: entry.ticker,
                    value: entry.ratio,
                    color: color_map['splits']
                }));
            } else {
                {/*

                    numeric values only: a non-numeric field would otherwise list
                    as NaN

                */}
                {/*

                    prefer the pre-fold row: the chart caps its stacked series at the
                    palette size, so the clicked payload only carries what survived
                    that cap plus an 'Other' lump. the sheet is where the folded
                    detail is meant to reappear

                */}
                const series_detail = this.state[`data_distribution_${stream}_series`] || {};
                const source_row = series_detail[title] || payload;

                rows = Object.keys(source_row)
                    .filter((key) =>
                        key !== aggregate_key
                        && source_row[key] != null
                        && source_row[key] !== 0
                        && typeof source_row[key] === 'number'
                    )
                    .map((key) => ({
                        name: key,
                        value: Number(source_row[key]),
                        color: color_map[key]
                    }))
                    .sort((a, b) => b.value - a.value);
            }
        }

        this.setState({
            distribution_detail_open: true,
            distribution_detail_title: title,
            distribution_detail_rows: rows
        });
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
                    <button className='btn' type='button' onClick={() =>
                        this.setState({
                            display_filter_button: false,
                            display_apply_filter_button: true,
                            hide_all: true
                        })
                    }>Filter</button>
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

            var filter = (
                <div className={class_parent}>
                    <div className='row'>
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
                    </div>
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
                                        this.state.streams.forEach((v, i) => {
                                            this.downloadData(v.toLowerCase());
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

    listing() {
        return (
            <div className='col listing'>
                <ArticleListing
                    title='Data'
                    left_column={false}
                    list_article={this.state.list_article}
                    stream_labels={true}
                    name='data'
                    selected_identifier={this.state.selected_stream}
                />
            </div>
        )
    }

    render() {
        const stream = this.state.selected_stream.toLowerCase();
        const filter_column = this.filterColumn('expanded', true);
        const left_column = ! this.state.hide_all
            ? this.filterColumn()
            : null;

        //
        // the loader is rendered before the chart, so without a stacking order the
        // chart paints over it and the dots sit behind the bars. '.refresh' in
        // _area_chart.scss uses z-index 1 for the same reason; this sits above both
        // while a refresh is in flight
        //
        //
        // visible strictly while the query is in flight, so the dots begin fading
        // the moment the bars land rather than sitting on top of a chart that has
        // already rendered.
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
                    // cover the whole chart area and centre within it, rather than
                    // relying on the static position an absolutely positioned flex
                    // child happens to land on. '.recharts-wrapper' is itself
                    // position:relative, so a bare 'position:absolute; margin:auto'
                    // was resolving against a moving target
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
                    // above '.refresh' (z-index 1) and above the chart wrapper,
                    // which is positioned but carries no z-index of its own
                    //
                    zIndex: 10,
                    opacity: loader_visible ? 1 : 0,
                    transition: `opacity ${LOADER_FADE_MS}ms ease-out`,
                    pointerEvents: 'none'
                }}
            >
                {/*

                    a chip behind the dots, not a full-area wash.

                    the dots are the slot 1 hue, which is also the fill of bar
                    series 0 -- and because the bars are stacked, series 0 is the
                    bottom segment of every bar. on a stream whose data lands
                    inside the minimum hold (weather resolves almost at once) the
                    dots end up painted in the exact colour of the bar behind
                    them, which reads as the loader sitting *under* the chart
                    rather than over it. a few wide bars make it certain; many
                    thin bars leave gaps for the dots to show through, which is
                    why the slower default stream looked correct.

                    the chip restores a known surface under the dots so they hold
                    their 5.72:1 regardless of what the chart is showing. it is
                    sized to the dots rather than the chart so the spinning
                    '.refresh' icon is not dimmed while the query is in flight

                */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: isMobile ? '14px 18px' : '18px 24px',
                        borderRadius: 999,
                        background: 'rgba(255, 255, 255, 0.92)',
                        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.12)'
                    }}
                >
                    <BeatLoader
                        //
                        // the app's ui accent -- the same green as the selected
                        // row's left border -- rather than 'colors_categorical[0]'.
                        // that slot is the first *series* colour, so chrome and
                        // data were sharing one value: a legend swatch and a
                        // loading state meant different things in the same blue.
                        // it also measures better on the chip below, 5.72:1
                        // against the old 4.42:1
                        //
                        color={colors['green-6']}
                        margin={5}
                        size={isMobile ? 20 : 30}
                        speedMultiplier={0.75}
                    />
                </div>
            </div>
        );

        const refresh_class = this.state[`promise_get_data_${stream}`]
            ? 'refresh'
            : 'refresh-disabled';

        const y_axis = isMobile
            ? (
                // mobile: keep the solid axis line on the left edge, but no ticks
                // and no value labels (width just enough for the line, so bars stay
                // flush left)
                <YAxis tick={false} tickLine={false} width={1} />
            )
            : (
                <YAxis
                    tickFormatter={(value) => Number(value).toExponential(0)}
                    width={60}
                />
            );

        if (
            ! this.state.hide_all
            && this.state.display_data_distribution
        ) {
                const height = this.state.chart_height;
                const nBars = (this.state[`data_distribution_${stream}`] || []).length;
                const agg_key = this.state[`aggregate_key_${stream}`];
                const max_label_len = (this.state[`data_distribution_${stream}`] || [])
                    .reduce((max, row) => Math.max(max, String((row && row[agg_key]) || '').length), 0);

                {/*

                    only wrap the chart in the horizontal-scroll container when the bars would
                    actually exceed the viewport; few-bar streams (weather, stock-split) render
                    the chart bare so it fills the full width like the desktop chart

                */}
                const viewport_width = typeof window !== 'undefined' ? window.innerWidth : 400;
                const needs_scroll = isMobile && (nBars * 48) > viewport_width;

                {/*

                    label style controls how much edge margin the chart must reserve:
                      - desktop: angled down-left (textAnchor end)
                      - mobile scrolling: angled down-right (needs right margin, but it lives in
                        the scrollable overflow so it doesn't steal visible width)
                      - mobile NON-scrolling: horizontal, centered under the wide bars, so NO edge
                        margin is reserved and the bars fill the full width edge to edge

                */}
                const x_axis_angle = !isMobile ? CHART_X_AXIS_ANGLE : (needs_scroll ? 35 : 0);
                const x_axis_anchor = !isMobile ? CHART_X_AXIS_ANCHOR : (needs_scroll ? 'start' : 'middle');
                const x_axis_height = !isMobile
                    ? CHART_X_AXIS_HEIGHT
                    : needs_scroll
                        ? Math.min(78, Math.max(30, Math.round(max_label_len * 3) + 14))
                        : CHART_X_AXIS_HEIGHT_MOBILE;

                const chart_element = (
                            <ResponsiveContainer height={height} width='100%'>
                            <BarChart
                                width='100%'
                                height={height}
                                data={this.state[`data_distribution_${stream}`]}
                                margin={{
                                    top: 20,
                                    // reserve edge room only for angled labels; a non-scrolling
                                    // mobile chart uses horizontal labels, so no edge margin is
                                    // needed and the bars fill the full width
                                    right: !isMobile ? 25 : (needs_scroll ? 40 : 8),
                                    left: !isMobile ? -10 : (needs_scroll ? 0 : 8),
                                    bottom: isMobile ? 12 : 8,
                                }}
                            >
                                <CartesianGrid strokeDasharray='3 3' />
                                {/*

                                    recharts defaults to interval='preserveEnd', which silently
                                    drops tick labels that would overlap; the gics sector names
                                    are long enough that every label was being hidden, so force
                                    all ticks and angle them to fit

                                */}
                                {/*

                                    mobile: labels start at the tick and drop to the lower-right
                                    (angle +35, textAnchor start), so the left-most label never
                                    extends past the left edge and the bars can sit flush left.
                                    desktop keeps the conventional lower-left angle (unchanged)

                                */}
                                <XAxis
                                    dataKey={this.state[`aggregate_key_${stream}`]}
                                    interval={0}
                                    angle={x_axis_angle}
                                    textAnchor={x_axis_anchor}
                                    height={x_axis_height}
                                    tick={{ fontSize: isMobile ? 9 : 11 }}
                                />
                                {y_axis}
                                {/*

                                    desktop only: keep the tooltip on-screen and scrollable so a
                                    bar with many stacked segments no longer pushes its labels off
                                    the bottom of the page. on mobile the hover tooltip and the
                                    tap-to-expand sheet fire together and their dismissal is
                                    entangled, so mobile relies on the sheet alone

                                */}
                                {!isMobile && (
                                    <Tooltip
                                        content={<DistributionTooltip />}
                                        allowEscapeViewBox={{ x: false, y: false }}
                                        wrapperStyle={{ maxHeight: 340, overflowY: 'auto', overflowX: 'hidden' }}
                                    />
                                )}
                                {
                                    this.state[`data_distribution_${stream}_bar`].map((entry, index) => (
                                        <Bar
                                              key={`bar-${index}`}
                                              fill={`rgb(${entry.color.r}, ${entry.color.g}, ${entry.color.b})`}
                                              dataKey={entry.data_key}
                                              stackId='a'
                                              cursor='pointer'
                                              onClick={(data) =>
                                                  this.openDistributionDetail(
                                                      data && data.payload ? data.payload : data
                                                  )
                                              }
                                        />
                                ))}
                            </BarChart>
                            </ResponsiveContainer>
                );

                var data_distribution = (
                <div className='col-lg-12 mx-auto'>
                    <div className='area-chart-parent'>
                        <LoopIcon
                            className={refresh_class}
                            fontSize={ isMobile ? 'medium' : 'large' }
                            onClick={() => {
                                this.reset_stream(stream);
                                this.updateStreamListing();
                                this.downloadData(stream);
                            }}
                            sx={{
                                animation: ! this.state[`promise_get_data_${stream}`]
                                    ? 'spin 2s linear infinite' : 'none',
                                '@keyframes spin': ! this.state[`promise_get_data_${stream}`]
                                    ? {
                                        '0%': {
                                            transform: 'rotate(360deg)',
                                        },
                                        '100%': {
                                            transform: 'rotate(0deg)',
                                        },
                                    } : 'none'
                            }}
                        />
                        {/*

                            on mobile, give each bar a fixed readable width and let the axis
                            scroll horizontally (the chart is left-aligned and overflows the
                            viewport) so bars stay full width and the left-most angled label
                            isn't clipped. desktop renders the bare responsive chart, unchanged

                        */}
                        {needs_scroll
                            ? (
                                <div style={{ width: '100%', overflowX: 'auto' }}>
                                    <div style={{ width: `${nBars * 48}px` }}>
                                        {chart_element}
                                    </div>
                                </div>
                            )
                            : chart_element}
                        {/*

                            rendered after the chart, not before it.

                            recharts wraps the plot in its own positioned container, and
                            on the streams that keep a previous chart mounted while
                            refetching, that container won a z-index race the loader was
                            supposed to win. painting the loader later in tree order
                            settles it without depending on how recharts stacks itself

                        */}
                        {loader}
                    </div>
                </div>
            );
        } else {
            var data_distribution = null
        }

        const listing = ! this.state.hide_all
            ? this.listing()
            : null;

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container data-listing'>
                    <div className='row listing-graphic'>
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
                    {/*

                        click-to-expand: full, sorted, scrollable breakdown for the clicked
                        bar. unlike the hover tooltip this surface is interactive, so it holds
                        every series regardless of count

                    */}
                    <Sheet
                        isOpen={this.state.distribution_detail_open}
                        onClose={() => this.setState({ distribution_detail_open: false })}
                        snapPoints={DETAIL_SNAP_POINTS}
                        initialSnap={DETAIL_INITIAL_SNAP}
                        onSnap={(index) => this.setState({ distribution_detail_snap: index })}
                    >
                        <Sheet.Container>
                            <Sheet.Header />
                            {/*

                                no floating exit here: this sheet has a pinned heading,
                                so the close control rides inside it and stays reachable
                                at any scroll position. the sheet without a heading keeps
                                the absolutely positioned one

                            */}
                            <Sheet.Content>
                                <Sheet.Scroller
                                    style={{
                                        height: `calc(${
                                            DETAIL_SNAP_POINTS[
                                                this.state.distribution_detail_snap
                                            ] * 100
                                        }vh - ${DETAIL_HEADER_HEIGHT}px)`
                                    }}
                                >
                                    <div style={{ padding: '0 20px 32px' }}>
                                        {/*

                                            pin the heading to the top of the scroller: a
                                            bar can hold a hundred rows, and once the
                                            title scrolls away there is nothing left
                                            saying which bar is being read.

                                            opaque background and a rule so rows pass
                                            underneath rather than showing through

                                        */}
                                        <div
                                            style={{
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 2,
                                                background: '#fff',
                                                margin: '0 -20px 12px',
                                                padding: '4px 20px 8px',
                                                borderBottom: '1px solid #eee',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'space-between',
                                                gap: 12
                                            }}
                                        >
                                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                            <h5 style={{ margin: 0 }}>
                                                {this.state.distribution_detail_title}
                                            </h5>
                                            {/*

                                                stock-split lists tickers against their
                                                ratio, so the values are not summable;
                                                head it with the split count instead of
                                                a series/record total

                                            */}
                                            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                                                {this.state.distribution_detail_rows.every(
                                                    (row) => typeof row.value === 'number'
                                                )
                                                    ? `${this.state.distribution_detail_rows.length} series · ${
                                                        this.state.distribution_detail_rows
                                                            .reduce((sum, row) => sum + row.value, 0)
                                                            .toLocaleString()
                                                    } records`
                                                    : `splits · ${this.state.distribution_detail_rows.length}`}
                                            </div>
                                            </div>
                                            {/*

                                                laid out inline rather than reusing the
                                                '.exit' class, whose svg is absolutely
                                                positioned against the sheet and would
                                                escape this flex row

                                            */}
                                            <span
                                                style={{ cursor: 'pointer', flex: '0 0 auto', lineHeight: 1 }}
                                                onClick={() =>
                                                    this.setState({ distribution_detail_open: false })
                                                }
                                            >
                                                <SvgExit />
                                            </span>
                                        </div>
                                        {this.state.distribution_detail_rows.map((row, i) => (
                                            <div
                                                key={`detail-row-${i}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '6px 0',
                                                    borderBottom: '1px solid #eee'
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: 2,
                                                        backgroundColor: row.color
                                                            ? `rgb(${row.color.r}, ${row.color.g}, ${row.color.b})`
                                                            : '#ccc',
                                                        flex: '0 0 auto'
                                                    }}
                                                />
                                                <span style={{ flex: '1 1 auto' }}>{row.name}</span>
                                                <span style={{ marginLeft: 12, fontVariantNumeric: 'tabular-nums' }}>
                                                    {typeof row.value === 'number'
                                                        ? row.value.toLocaleString()
                                                        : row.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </Sheet.Scroller>
                            </Sheet.Content>
                        </Sheet.Container>
                        <Sheet.Backdrop onTap={() =>
                            this.setState({ distribution_detail_open: false })
                        } />
                    </Sheet>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default DataLayout;
