/**
 * stream.jsx: stream article listing page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import Sheet from 'react-modal-sheet';
import BeatLoader from 'react-spinners/BeatLoader';
import PuffLoader from 'react-spinners/PuffLoader';
import LoopIcon from '@mui/icons-material/Loop';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BarChartIcon from '@mui/icons-material/BarChart';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ArticleListing from '../../general/article-listing.jsx';
import StackedAreaChart from '../../general/area-chart.jsx';
import StockMarketFeatured from './featured/stock-market.jsx';
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
import SvgExit from '../../svg/svg-exit.jsx';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import { colors, colors_categorical } from '../../general/colors.js';
import streamName from '../../general/stream-name.js';
import viewerTimeZone from '../../general/viewer-timezone.js';
import THROUGHPUT_KEY from '../../general/throughput-key.js';
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
    windowLabel
} from '../../general/rolling-window.js';
import chartHeight, {
    CHART_X_AXIS_HEIGHT,
    CHART_X_AXIS_HEIGHT_MOBILE,
    CHART_X_AXIS_ANGLE,
    CHART_X_AXIS_ANCHOR
} from '../../general/chart-height.js';


{/*

    how long the loader takes to fade once the query resolves. the element stays
    mounted and animates its opacity, so the dots ease out as the chart arrives
    rather than being unmounted mid-frame. matches the /data page

*/}
const LOADER_FADE_MS = 450;


{/*

    the intervals a stream reported data in, of the intervals its scraper was
    due to run in.

    health cannot see a scraper that never ran -- no rows means no successes AND
    no failures, so the ratio never moves and only the total does. the
    denominator comes from the scraper's own schedule rather than from the
    report, since the intervals being counted are the ones the report does not
    carry (see 'ingest-schedule.js')

*/}
function streamCoverage(chart_data, stream, rate, field_datetime, stream_source) {
    const expected = expectedIntervals(stream, rate);

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

            the viewer's own clock, matching the window and the chart rows. it
            was 'dstDate()' -- eastern wall-clock in the local zone's slot --
            which also made the market-hours check below shift a second time,
            since that check converts to new york itself

        */}

        const today = new Date();
        const stream_stockmarket = 'StockMarket';
        const stream_stocksplit = `${stream_stockmarket}StockSplit`;
        const stream_bls = 'BLS';
        const stream_sec = 'SEC';
        const stream_usnationalweather = 'USNationalWeather';
        const stream_stockmarket_total = 'n/a';
        const stream_stockmarket_health = 'n/a';
        const stream_stocksplit_total = 'n/a';
        const stream_stocksplit_health = 'n/a';
        const stream_bls_total = 'n/a';
        const stream_bls_health = 'n/a';
        const stream_sec_total = 'n/a';
        const stream_sec_health = 'n/a';
        const stream_usnationalweather_total = 'n/a';
        const stream_usnationalweather_health = 'n/a';
        const stream_coverage = 'n/a';

        const streams = [
            stream_stockmarket,
            stream_stocksplit,
            stream_bls,
            stream_sec,
            stream_usnationalweather
        ];

        {/*

            deliberately still eastern: 09:30-16:00 is a fact about the
            exchange, not about the reader. a viewer in london gets the intraday
            rate while new york is open, not while london is

        */}

        const d = new Date(today.toLocaleString('en-US', {timeZone: 'America/New_York'}));
        const day = d.getDay();
        const hour = d.getHours();
        const minutes = d.getMinutes();

        var stream_rate = 'Day';
        var scale_chart_minutes = false;
        var scale_chart_daily = true;
        var x_ticker_format = '%m/%d';
        var label_format = '%d %B, %Y';

        if (
            [1, 2, 3, 4, 5].includes(day)
            && ( hour === 9 && minutes > 30 || hour >= 10 )
            && hour < 16
        ) {
            var stream_rate_stockmarket = 'Minute';
            var scale_chart_minutes_stockmarket = true;
            var scale_chart_daily_stockmarket = false;
            var x_ticker_format_stockmarket = '%I:%M%p';
            var label_format_stockmarket = '%d %B, %Y (%H:%M:%S%Z)';
        } else {
            var stream_rate_stockmarket = stream_rate;
            var scale_chart_minutes_stockmarket = scale_chart_minutes;
            var scale_chart_daily_stockmarket = scale_chart_daily;
            var x_ticker_format_stockmarket = x_ticker_format;
            var label_format_stockmarket = label_format;
        }

        let list_article = [];
        streams.forEach((v, i) => {
            const loader = <PuffLoader color='#228B22' size={isMobile ? 2 : 3} speedMultiplier='0.5' />;

            list_article.push({
                'name': v,
                'link': `?item=${v}&rate=${stream_rate}`,
                'detail': { 'Health': 'n/a', 'Coverage': 'n/a', 'Rate': 'n/a', 'Total Records': 'n/a' },
                'loader': loader,
                'control_tray': this.getControlTray(v)
            });
        });

        this.state = {
            local: is_local,
            chart_data_stockmarket: [],
            chart_data_stockmarketstocksplit: [],
            chart_data_bls: [],
            chart_data_bls_bls: [],
            chart_data_sec: [],
            chart_data_sec_sec: [],
            chart_data_usnationalweather: [],
            chart_data_placeholder_bls: [],
            chart_data_placeholder_sec: [],
            bottom_sheet_open: false,
            field_datetime: 'window_start',
            promise_get_data_stockmarket: false,
            promise_get_data_stockmarketstocksplit: false,
            promise_get_data_bls: false,
            promise_get_data_sec: false,
            promise_get_data_usnationalweather: false,
            display_area_chart: true,
            display_filter_button: true,
            display_apply_filter_button: false,
            time_map: {'Month': 'Monthly', 'Day': 'Daily', 'Hour': 'Hourly', 'Minute': 'Minutes'},
            scale_chart_monthly: false,
            scale_chart_daily: scale_chart_daily_stockmarket,
            scale_chart_hourly: false,
            scale_chart_minutes: scale_chart_minutes_stockmarket,
            hide_all: false,
            x_ticker_format: x_ticker_format_stockmarket,
            label_format: label_format_stockmarket,
            selected_stream: stream_stockmarket.toLowerCase(),
            selected_stream_rate: stream_rate_stockmarket,
            stream_source_stockmarket: ['options', 'price'],
            stream_source_stockmarketstocksplit: ['alpha', 'beta', 'gamma'],
            stream_source_bls: ['bls'],
            stream_source_sec: ['sec'],
            stream_source_usnationalweather: ['weather'],
            stream_stockmarket: stream_stockmarket,
            stream_stockmarketstocksplit: stream_stocksplit,
            stream_bls: stream_bls,
            stream_sec: stream_sec,
            stream_usnationalweather: stream_usnationalweather,
            streams: streams,
            stream_rate_stockmarket: stream_rate_stockmarket,
            stream_rate_stockmarketstocksplit: stream_rate,
            stream_rate_bls: stream_rate,
            stream_rate_sec: stream_rate,
            stream_rate_usnationalweather: stream_rate,
            stream_throughput: 0,
            stream_throughput_bls_bls: 0,
            stream_throughput_sec_sec: 0,
            stream_stockmarket_total: stream_stockmarket_total,
            stream_stockmarket_health: stream_stockmarket_health,
            stream_stockmarketstocksplit_total: stream_stocksplit_total,
            stream_stockmarketstocksplit_health: stream_stocksplit_health,
            stream_bls_total: stream_bls_total,
            stream_bls_health: stream_bls_health,
            stream_sec_total: stream_sec_total,
            stream_sec_health: stream_sec_health,
            stream_usnationalweather_total: stream_usnationalweather_total,
            stream_usnationalweather_health: stream_usnationalweather_health,
            stream_stockmarket_coverage: stream_coverage,
            stream_stockmarketstocksplit_coverage: stream_coverage,
            stream_bls_coverage: stream_coverage,
            stream_sec_coverage: stream_coverage,
            stream_usnationalweather_coverage: stream_coverage,
            today: today,
            ingest_performance_data: null,
            sheet_snap_points: [1, 0.75, 0.55, 0.25],
            tool_tip_color: '#777',
            performance_link: 'https://www.jefflevesque.com/artifact/performance',
            list_article: list_article,
            chart_height: chartHeight()
        }

        this.updateMetrics = this.updateMetrics.bind(this);
        this.updateStreamListing = this.updateStreamListing.bind(this);
        this.listing = this.listing.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
        this.toggleAreaChart = this.toggleAreaChart.bind(this);
        this.toggleChartScale = this.toggleChartScale.bind(this);
        this.toggleSetOpen = this.toggleSetOpen.bind(this);
        this.callbackGetData = this.callbackGetData.bind(this);
        this.downloadData = this.downloadData.bind(this);
        this.getControlTray = this.getControlTray.bind(this);
        this.initializeChartScale = this.initializeChartScale.bind(this);
        this.reset_stream = this.reset_stream.bind(this);
        this.updateChartHeight = this.updateChartHeight.bind(this);
    }

    componentDidMount() {
        this.state.streams.forEach((v, i) => {
            const stream = v.toLowerCase();
            this.downloadData(stream, this.state[`stream_rate_${stream}`]);
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

        this.setState({ [`chart_data_${stream}`]: [], stream_throughput: 'n/a' });

        //
        // Note: stockmarket and stocksplit performance reports not partitioned by source,
        //       these streams treat the report csv column 'group_by' as the source, while
        //       other sources generally only have one value under the same csv column, thus
        //       the partition is instead treated as the source
        //
        if (
            stream !== this.state.stream_stockmarket.toLowerCase()
            && stream !== this.state.stream_stockmarketstocksplit.toLowerCase()
        ) {
            this.state[`stream_source_${stream}`].forEach((source, i) => {
                this.setState({
                    [`chart_data_${stream}_${source.toLowerCase()}`]: [],
                    [`stream_throughput_${stream}_${source.toLowerCase()}`]: 0
                });
            });
        } else {
            this.setState({ [`stream_throughput_${selected_stream}_${selected_stream}`]: 0 });
        }
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
                'name': this.state[`stream_${stream}`],
                'link': `?item=${this.state[`stream_${stream}`]}&rate=${this.state[`stream_rate_${stream}`]}`,
                'detail': {
                    'Health': format_percent(this.state[`stream_${stream}_health`]),
                    'Coverage': format_percent(this.state[`stream_${stream}_coverage`]),
                    'Rate': this.state[`stream_rate_${stream}`][0].toUpperCase() + this.state[`stream_rate_${stream}`].slice(1),
                    'Total Records': format_count(this.state[`stream_${stream}_total`])
                },
                'loader': loader,
                'control_tray': this.getControlTray(this.state[`stream_${stream}`])
            });
        });

        this.setState({ list_article: list_article });
    }

    getControlTray(stream_name, url_trigger=false) {
        const stream = stream_name.toLowerCase();
        const font_size = isMobile ? 'medium' : 'large';
        {/*

            click handlers hang off the surrounding oval rather than the glyph,
            so the area that responds to a click is the same area that shades
            and greens on hover -- see '.border-circle-radius' in style.scss

        */}
        //
        // Note: the query stats control is only offered for the stockmarket
        //       stream; every other stream renders the tray without it
        //
        const trigger_button = stream !== 'stockmarket'
            ? null
            : url_trigger
            ? (
                <span className='border-circle-radius'>
                    <Link to={`/stream/${stream}/trigger`}>
                        <QueryStatsIcon
                            className='control-icon pattern'
                            fontSize={font_size}
                        />
                    </Link>
                </span>
            ) : (
                <span
                    className='border-circle-radius'
                    onClick={() => {
                        this.toggleSetOpen();
                        this.setState({ bottom_sheet_open: true });
                    }}
                >
                    <QueryStatsIcon
                        className='control-icon pattern'
                        fontSize={font_size}
                    />
                </span>
            );

        return(
            <div className='control-tray'>
                {trigger_button}

                <span
                    className='border-circle-radius'
                    onClick={() => {
                        this.setState({
                            selected_stream: stream,
                            [`promise_get_data_${stream}`]: false
                        }, () => {
                            this.updateStreamListing();
                            this.initializeChartScale(this.state.selected_stream_rate);
                            this.reset_stream(stream);
                            this.downloadData(stream, this.state.selected_stream_rate);
                        });
                    }}
                >
                    <BarChartIcon
                        className='control-icon chart'
                        fontSize={font_size}
                    />
                </span>

                <span className='border-circle-radius'>
                    <Link to={`/stream/${stream}/alarm`}>
                        <NotificationsIcon
                            className='control-icon notification'
                            fontSize={font_size}
                        />
                    </Link>
                </span>
            </div>
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
    //       Both are preserved exactly as they were.
    //
    STREAM_REQUEST = {
        stockmarket: {
            get_data: 'stock-market-ingest',
            source: 'stockmarket',
            source_local: 'options'
        },
        stockmarketstocksplit: {
            get_data: 'stock-split-ingest',
            source: 'stockmarketstocksplit',
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
        usnationalweather: {
            get_data: 'us-national-weather-ingest',
            source: 'weather',
            source_local: 'weather'
        }
    };

    downloadData(type, stream_rate) {
        type = type.toLowerCase();
        stream_rate = stream_rate.toLowerCase();
        this.setState({
            [`stream_rate_${type}`]: stream_rate,
            [`promise_get_data_${type}`]: false
        }, () => {
            this.updateStreamListing();
        });

        const request = this.STREAM_REQUEST[type];

        if (!request) {
            this.setState({ selected_stream: type, [`promise_get_data_${type}`]: true });
            return;
        }

        let url = new URL('https://api.jefflevesque.com/v1/public/performance');

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

        */}

        const params = {
            Stream: type,
            Interval: stream_rate,
            Timezone: viewerTimeZone()
        };
        Object.keys(params || {}).forEach(key => url.searchParams.append(key, params[key]));

        getData(
            request.get_data,
            this.state.local ? null : url,
            (item) => this.callbackGetData(item),
            true,
            this.state.local ? request.source_local : request.source,
            type
        );
    }

    callbackGetData(item) {
        const field_datetime = Object.assign(this.state.field_datetime);
        const worker = new WorkerBuilder(workerIngestPerformance);

        worker.onerror = (err) => {
            console.log('Error (web-worker): could not process ingest performance data');
            console.log(err);
        };

        worker.onmessage = (event) => {
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
                var selected_stream = event.data.selected_stream.toLowerCase();

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
                // Note: stockmarket and stocksplit performance reports not partitioned by source,
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

                this.setState((state) => {
                    const held = merge_held && state[`chart_data_${selected_stream}`]
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
                var selected_stream = this.state.selected_stream.toLowerCase();
                if (selected_stream) {
                    var chart_data = event.data.chart_data_original;
                    this.setState((state) => ({
                        [`chart_data_${selected_stream}`]: [
                            ...chart_data,
                            ...(state[`chart_data_${selected_stream}`] || [])
                        ],
                        stream_throughput: event.data.stream_throughput
                    }));
                } else {
                    var selected_stream = null
                    var chart_data = null;
                    console.log('Error: callback has no selected_stream');
                }
            }

            const params = new URLSearchParams(document.location.search);
            if (params && params.toString().length > 0) {
                var selected_stream = params.get('item').toLowerCase();
                this.setState({ selected_stream: selected_stream });
            }

            if (selected_stream) {
                this.setState({
                    [`promise_get_data_${selected_stream}`]: true
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

    toggleAreaChart() {
        this.setState({ display_area_chart: ! this.state.display_area_chart });
    }

    toggleSetOpen() {
        this.setState({ bottom_sheet_open: ! this.state.bottom_sheet_open });
    }

    initializeChartScale(v) {
        const rate = v.toLowerCase();
        if (rate) {
            this.setState({ scale_chart_monthly: ['monthly', 'month'].includes(rate) ? true : false });
            this.setState({ scale_chart_daily: ['daily', 'day'].includes(rate) ? true : false });
            this.setState({ scale_chart_hourly: ['hourly', 'hour'].includes(rate) ? true : false });
            this.setState({ scale_chart_minutes: ['minutes', 'minute'].includes(rate) ? true : false });

            if (['monthly', 'month'].includes(rate)) {
                this.setState({
                    x_ticker_format: '%m/%Y',
                    label_format: '%B %Y',
                    [`stream_rate_${this.state.selected_stream}`]: 'Month'
                });
            } else if (['daily', 'day'].includes(rate)) {
                this.setState({
                    x_ticker_format: '%m/%d',
                    label_format: '%d %B, %Y',
                    [`stream_rate_${this.state.selected_stream}`]: 'Day'
                });
            } else if (['hourly', 'hour'].includes(rate)) {
                this.setState({
                    x_ticker_format: '%I%p',
                    label_format: '%d %B, %Y (%I%p)',
                    [`stream_rate_${this.state.selected_stream}`]: 'Hour'
                });
            } else if (['minutes', 'minute'].includes(rate)) {
                this.setState({
                    x_ticker_format: '%I:%M%p',
                    label_format: '%d %B, %Y (%H:%M:%S%Z)',
                    [`stream_rate_${this.state.selected_stream}`]: 'Minute'
                });
            }
        }
    }

    //
    // 'chart_data' is what the chart is drawing, already aggregated to the
    // selected rate and narrowed to its date window -- both counts are summed
    // from it so the row and the graph above it never disagree
    //
    // Note: throughput rides on the rows rather than arriving as one figure per
    //       report, which is what lets it be windowed at all. this also drops
    //       the old stockmarket/stocksplit special case: those reports are not
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
            this.state[`stream_rate_${selected_stream.toLowerCase()}`],
            this.state.field_datetime,
            stream_source
        );

        this.state.streams.forEach((v, i) => {
            const stream = v.toLowerCase();
            if (selected_stream.toLowerCase() === stream) {
                this.setState({
                    [`stream_${stream}_total`]: stream_success ? stream_success : 'n/a',
                    [`stream_${stream}_health`]: checkValidFloat(stream_health) && stream_health > 100
                        ? 100
                        : parseFloat(stream_health) && parseFloat(stream_health) > 0 ? stream_health : 'n/a',
                    [`stream_${stream}_coverage`]: checkValidFloat(stream_coverage) && stream_coverage > 100
                        ? 100
                        : parseFloat(stream_coverage) && parseFloat(stream_coverage) > 0 ? stream_coverage : 'n/a'
                }, () => {
                    this.updateStreamListing();
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
        selected_stream = selected_stream.toLowerCase();
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

            const window_start = windowStart(v);
            var chart_data = window_start
                ? arr_result.filter((item) => item[this.state.field_datetime] >= window_start)
                : arr_result;

            {/*

                the report's own padding comes off first, while the rows still
                describe what the api sent. a stream the api treats as
                continuous is asked to zero its empty buckets, which at the
                minute rate zeroes the four minutes in five that
                'usnationalweather' is idle by design -- the area dropped to the
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
                stream_source
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

    filterColumn(style='default', btn=false) {
        const selected_stream = this.state.selected_stream.toLowerCase();
        if (btn && this.state.display_filter_button) {
            //
            // the range the chart is actually drawing. it used to name the
            // calendar period the rate sat in ('Today', 'July', '2026') for a
            // chart that has always drawn a trailing window, so the label
            // disagreed with the chart under it -- now both come from
            // rolling-window.js and cannot drift apart
            //
            var title_count = windowLabel(this.state[`stream_rate_${selected_stream}`]);

            const header = isMobile && selected_stream
                ? (
                    <div className='listing-graphic-title'>
                        <h5>{streamName(this.state[`stream_${this.state.selected_stream}`])}</h5>
                        <span className='title-count'> ({title_count})</span>
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

            const class_date_label = style === 'default' ? 12 : 3;

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
                                            checked={this.state.display_area_chart}
                                            onChange={() => this.toggleAreaChart()}
                                            name='Ingest Rate'
                                        />
                                    }
                                    label='Ingest Rate'
                                />
                            </FormGroup>
                        </FormControl>
                    </div>

                    {
                        this.state.display_area_chart && <div className='row'>
                            {Object.keys(this.state.time_map).map((key, index) => (
                                <label className={`col-lg-${class_date_label} col-sm-${class_date_label} checkbox-container`} key={key}>
                                    <input
                                        type='checkbox'
                                        checked={this.state[`scale_chart_${this.state.time_map[key].toLowerCase()}`]}
                                        onChange={() => {
                                            Object.entries(this.state.time_map).map(([k, v]) => {
                                                const rate = this.state.time_map[key].toLowerCase();
                                                const stream_rate = `stream_rate_${selected_stream}`;

                                                if (rate === v.toLowerCase()) {
                                                    this.setState({
                                                        [stream_rate]: key,
                                                        selected_stream_rate: key,
                                                        [`promise_get_data_${selected_stream}`]: false
                                                    }, () => {
                                                        this.updateStreamListing();
                                                        this.initializeChartScale(key);
                                                        this.reset_stream(selected_stream);
                                                        this.downloadData(selected_stream, key);
                                                    });
                                                }
                                            });
                                        }}
                                        disabled={!this.state.display_area_chart}
                                    />
                                    <span className='checkbox-checkmark'></span>
                                    <div className='checkbox-label'>{this.state.time_map[key]}</div>
                                </label>
                            ))}
                        </div>
                    }
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
                    title='Streams'
                    left_column={false}
                    list_article={this.state.list_article}
                    stream_labels={true}
                    list_drop={['None', 'A-Z', 'Health', 'Coverage']}
                    name={this.state.selected_stream ? this.state.selected_stream : null}
                />
            </div>
        )
    }

    render() {
        const filter_page = this.filterColumn('expanded', true);
        const left_column = ! this.state.hide_all
            ? this.filterColumn()
            : null;

        //
        // visible strictly while the query is in flight, so the dots begin fading
        // the moment the chart lands rather than sitting on top of a chart that
        // has already rendered
        //
        const loader_visible = ! this.state[`promise_get_data_${this.state.selected_stream}`];

        //
        // same treatment as the /data page: kept mounted and faded with opacity
        // rather than unmounted (removing the node cannot be transitioned, which
        // is what made it vanish abruptly), and centred over the whole chart area
        // rather than wherever a bare 'margin: auto' happens to land inside the
        // positioned chart wrapper. 'pointerEvents: none' keeps the invisible
        // layer from eating chart hovers
        //
        const loader = (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    //
                    // above '.refresh' (z-index 1 in _area_chart.scss) and above
                    // the chart wrapper, which is positioned but carries no
                    // z-index of its own
                    //
                    zIndex: 10,
                    opacity: loader_visible ? 1 : 0,
                    transition: `opacity ${LOADER_FADE_MS}ms ease-out`,
                    pointerEvents: 'none'
                }}
            >
                {/*

                    a chip behind the dots, not a full-area wash: it restores a
                    known surface under the dots so they hold their contrast
                    regardless of what the chart is showing. sized to the dots
                    rather than the chart so the spinning '.refresh' icon is not
                    dimmed while the query is in flight

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
                        // row's left border -- rather than a series colour, so
                        // chrome and data do not share one value
                        //
                        color={colors['green-6']}
                        margin={5}
                        size={isMobile ? 20 : 30}
                        speedMultiplier={0.75}
                    />
                </div>
            </div>
        );

        const refresh_class = this.state[`promise_get_data_${this.state.selected_stream}`]
            ? 'refresh'
            : 'refresh-disabled';

        if (
            ! this.state.hide_all
            && this.state.display_area_chart
        ) {
            var area_chart = (
                <div className='col-lg-12 mx-auto'>
                    <div className='area-chart-parent'>
                        {loader}
                        <LoopIcon
                            className={refresh_class}
                            fontSize={ isMobile ? 'medium' : 'large' }
                            onClick={() => {
                                this.initializeChartScale(this.state[`stream_rate_${this.state.selected_stream}`]);
                                this.reset_stream(this.state.selected_stream);
                                this.updateStreamListing();
                                this.downloadData(this.state.selected_stream, this.state[`stream_rate_${this.state.selected_stream}`]);
                            }}
                            sx={{
                                animation: ! this.state[`promise_get_data_${this.state.selected_stream}`]
                                    ? 'spin 2s linear infinite' : 'none',
                                '@keyframes spin': ! this.state[`promise_get_data_${this.state.selected_stream}`]
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
                        <StackedAreaChart
                            data={this.state[`chart_data_${this.state.selected_stream.toLowerCase()}`]}
                            data_keys={this.state[`stream_source_${this.state.selected_stream.toLowerCase()}`]}
                            color={colors_categorical}
                            title={streamName(this.state.selected_stream)}
                            y_label='Total Ingest'
                            data_key={this.state.field_datetime}
                            height={this.state.chart_height}
                            x_axis_height={isMobile ? CHART_X_AXIS_HEIGHT_MOBILE : CHART_X_AXIS_HEIGHT}
                            x_axis_angle={isMobile ? 0 : CHART_X_AXIS_ANGLE}
                            x_axis_anchor={isMobile ? 'middle' : CHART_X_AXIS_ANCHOR}
                            x_ticker_format={this.state.x_ticker_format}
                            label_format={this.state.label_format}
                            y_tick_format={isMobile ? false : 'exponential'}
                            y_axis_tick_line={isMobile ? false : true}
                        />
                    </div>
                </div>
            );
        } else {
            var area_chart = null;
        }

        const listing = ! this.state.hide_all
            ? this.listing()
            : null;

        const sheet_class = isMobile
            ? 'container featured-sheet-mobile'
            : 'container featured-sheet-desktop';

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container'>
                    <div className='row listing-graphic'>
                        {filter_page}
                        {area_chart}
                    </div>
                    <div className='row listing-general'>
                        {left_column}
                        {listing}
                    </div>
                    <Sheet
                        isOpen={this.state.bottom_sheet_open}
                        onClose={() => null}
                        snapPoints={this.state.sheet_snap_points}
                        initialSnap={2}
                    >
                        <Sheet.Container>
                            <Sheet.Header />
                            <div className={`${sheet_class} sheet-container`}>
                                <span className='exit' onClick={() =>
                                    this.setState({ bottom_sheet_open: false })
                                }>
                                    <SvgExit />
                                </span>
                            </div>
                            <Sheet.Content className={sheet_class}>
                                <StockMarketFeatured />
                            </Sheet.Content>
                        </Sheet.Container>
                        <Sheet.Backdrop />
                    </Sheet>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default StreamLayout;
