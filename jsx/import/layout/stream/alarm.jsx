/**
 * alarm.jsx: stream alarm page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import Tumbling from '../../svg/window/tumbling.jsx';
import is_local from '../../../is_local.js';
import WorkerBuilder from '../../worker/web-worker.js';
import workerDataDistribution from '../../worker/data/distribution/stock-market.js';
import NoticeTerms from '../../general/notice-terms.jsx';
import SummaryTrigger from '../../general/summary-trigger.jsx';
import BreadCrumbs from '../../navigation/breadcrumbs.jsx';
import { isMobile } from 'react-device-detect';
import trim from '../../general/trim-object.js';
import { default as getStockMarketDistribution } from '../../general/get-data/distribution/stock-market.js';
import checkValidObject from '../../validator/valid-object.js';
import checkValidInt from '../../validator/valid-int.js';
import checkValidString from '../../validator/valid-string.js';
import checkValidArray from '../../validator/valid-array.js';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BasicWorkflow from '../../svg/trigger/basic-workflow.jsx';
import AggregateWorkflow from '../../svg/trigger/aggregate-workflow.jsx';
import { useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import streamName from '../../general/stream-name.js';

class StreamAlarm extends Component {
    constructor() {
        super();

        const now = new Date();
        const today = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // january is 0
        const yyyy = today.getFullYear();
        const stream = 'StockMarket';

        this.state = {
            local: is_local,
            mm: mm,
            yyyy: yyyy,
            stream: stream,
            tool_tip_color: '#777',
            performance_link: 'https://www.jefflevesque.com/artifact/performance',
            artifact_link: 'https://www.jefflevesque.com/artifact',
            current_accordion: false,
            total_tickers: 0,
            total_source: 1,
            window_1_purple: true,
            window_1_green: true,
            window_2_blue: true,
            expand_archive_stocksplit: false,
            expand_archive_stockmarket: false,
            expand_archive_usnationalweather: false,
            expand_archive_bls: false,
            expand_archive_sec: false
        }

        this.callbackGetData = this.callbackGetData.bind(this);
        this.downloadData = this.downloadData.bind(this);
        this.handleArchiveClick = this.handleArchiveClick.bind(this);
    }

    componentDidMount() {
        if ('stream' in this.props.params) {
            const { stream } = this.props.params;

            if (stream.toLowerCase() === 'stocksplit') {
                var v = 'stock-split';
            } else if (stream.toLowerCase() === 'stockmarket') {
                var v = 'stock-market';
            } else if (stream.toLowerCase() === 'usnationalweather') {
                var v = 'us-national-weather';
            } else {
                var v = stream.toLowerCase();
            }

            this.setState({ stream: v });
            this.downloadData(stream);
        } else {
            this.downloadData(this.state.stream);
        }
    }

    handleArchiveClick(stream=null) {
        stream = stream ? stream : this.state.stream;
        this.setState({ [`expand_archive_${stream}`]: ! this.state[`expand_archive_${stream}`] });
    }

    //
    // the partition count behind the alarm listing.
    //
    // this asked a static artifact for it, and did so through three faults that
    // hid each other, so the count silently stayed at its initial 0:
    //
    //   - the loader was called as 'stock-market-distribution', which
    //     'get-data.js' does not dispatch. It fell out of the type chain, logged
    //     'not a valid choice' and returned undefined, so no request was ever
    //     issued and the two faults below could never be reached.
    //
    //   - the month was 'mm - 1', naming the month BEFORE the one state.mm
    //     holds, and underflowing to '00' every january -- a partition that
    //     cannot exist.
    //
    //   - the artifact itself, 'artifact/stock-market/data-distribution/
    //     YYYY/MM.csv', is written by nothing. The distribution moved to
    //     api-datalake, which computes it from the glue table.
    //
    // it now asks api-datalake for the same scale the /data page asks for, over
    // the same loader and the same worker, so the two pages cannot disagree
    // about how many partitions a month holds.
    //
    downloadData(type) {
        if (type.toLowerCase() !== 'stockmarket') {
            return;
        }

        const scale = {
            'year': this.state.yyyy,
            'month': String(this.state.mm).padStart(2, '0')
        };
        let url = new URL('https://api.jefflevesque.com/v1/public/datalake');
        const params = {
            Data: 'stockmarket',
            Scale: JSON.stringify(scale)
        };
        Object.keys(params || {}).forEach(key => url.searchParams.append(key, params[key]));

        getStockMarketDistribution(
            'data-distribution',
            this.state.local ? null : url,
            (item) => this.callbackGetData(item),
            true,
            'stockmarket',
            'stockmarket'
        );
    }

    callbackGetData(item) {
        const worker = new WorkerBuilder(workerDataDistribution);

        worker.onerror = (err) => {
            console.log('Error (web-worker): could not process data-distribution data');
            console.log(err);
        };

        {/*

            the worker posts two different shapes for the two halves of the
            response: the distribution as a 'detail' object, and the partition
            count as { count, selected_stream }. This read 'event.data.partitions',
            which neither carries, so the count resolved to undefined -- the third
            of the faults described above 'downloadData', and the one that would
            have survived fixing the other two.

        */}
        worker.onmessage = (event) => {
            if (event && event.data && checkValidInt(event.data.count)) {
                this.setState({ 'total_tickers': event.data.count });
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
    }

    render() {
        var stream = this.state.stream.replace('-', '').toLowerCase();
        if ('stream' in this.props.params) {
            var { stream } = this.props.params;

            if (stream.toLowerCase() === 'stocksplit' || stream.toLowerCase() === 'stockmarketstocksplit') {
                {/*

                    window is actually sliding, with data drop once per day,
                    which is perceived by end users as a tumbling window(s).

                */}

                var ingest_interval = 'daily at 12am EDT (M-F)';
                var ingest_content_1 = `
                    Any detected stock-split ticker matching our list of tickers,
                    will start a refactor job on partitions in the ${streamName('StockMarket')}
                    datalake. Jobs will be bounded between the beginning of time
                    and split date. Metrics are analyzed on two modalities: health
                    of stock-split detection, and job runtime for detected tickers
                    using tumbling windows`;
                var ingest_content_2_mobile = `
                    Performance ingest actually delivers single record per window`;
                var ingest_content_2 = `
                    The above figure shows four unique records per window. However,
                    actual ingest consists of a single record per window, passed to
                    downstream processes that split the attributes as needed`;
                var late_arrival = false;
                var x_unit = 'day';
                var x_increment = 1;
            } else if (stream.toLowerCase() === 'stockmarket') {
                var ingest_interval = 'between 9:30am through 4:30pm EDT (M-F)';
                var ingest_content_1 = `
                    While ingest continues into our datalake through extended hours,
                    performance metrics stop at 4:05pm allowing late data points.
                    Metrics are analyzed on two modalities (source and ticker symbol)
                    using tumbling windows`;
                var ingest_content_2_mobile = `
                    Performance ingest stream delivering a late record into window 3
                    (instead of window 4)`;
                var ingest_content_2 = `
                    The above figure shows four unique records in each window, with
                    exception of window 3 and window 4. Here we show the possibility
                    of the performance ingest stream delivering a late record into
                    window 3 (instead of window 4)`;
                var late_arrival = true;
                var x_unit = 'min';
                var x_increment = 1;
            } else if (stream.toLowerCase() === 'usnationalweather') {
                var ingest_interval = 'every 5 minutes (everyday)';
                var ingest_content_1 = `
                    Data is based on the National Weather Service alerts for the entire
                    United States. Raw content (i.e text format) is directly ingested
                    into our datalake every 5 minutes. Simultaneously, a nearly identical
                    dataset is put into a stream, where each record may contain zero or
                    more failures before success. You can be notified upon existence of
                    failure(s) per window. However, it is important to know the number
                    of records from one window could be very different with any adjacent
                    window`;
                var ingest_content_2_mobile = `
                    National Weather Service alert(s) delivered in batches of 5 minutes`;
                var ingest_content_2 = `
                    The above figure shows the number of records from any 5 minute batch
                    cycle can be different from another batch cycle. Lastly, when reviewing
                    the ingest performance via Archive (or datalake), window=0 indicates the
                    corresponding record did not ingest through normal processes, rather
                    from backfill operation`;
                var late_arrival = true;
                var x_unit = 'min';
                var x_increment = 5;
                var window_1_purple = false;
                var window_1_green = false;
                var window_2_blue = false;
            } else if (stream.toLowerCase() === 'bls') {
                var ingest_interval = 'every 1 hour (everyday)';
                var ingest_content_1 = `
                    Data is aggregated from the U.S. Bureau of Labor Statistics (BLS).
                    To get exact list of partitions, please review the ingest performance
                    via Archive (or datalake). Raw content (i.e text format) is directly
                    ingested into our datalake every 1 hour. Simultaneously, a nearly
                    identical dataset is put into a stream, where each record may contain
                    zero or more failures before success. You can be notified upon
                    existence of failure(s) per window. However, it is important to know the
                    number of records from one window could be very different with any
                    adjacent window`;
                var ingest_content_2_mobile = `
                    Partitions of data from the BLS source`;
                var ingest_content_2 = `
                    The above figure shows the number of records from any 1 hour batch cycle
                    can be different from another batch cycle. Lastly, when reviewing the
                    ingest performance via Archive (or datalake), window=0 indicates the
                    corresponding record did not ingest through normal processes, rather
                    from backfill operation`;
                var late_arrival = true;
                var x_unit = 'hour';
                var x_increment = 1;
                var window_1_purple = false;
                var window_1_green = false;
                var window_2_blue = false;
            } else if (stream.toLowerCase() === 'sec') {
                var ingest_interval = 'every 1 hour (everyday)';
                var ingest_content_1 = `
                    Data is aggregated from the U.S. Securities and Exchange Commission
                    (SEC). To get exact list of partitions, please review the ingest
                    performance via Archive (or datalake). Raw content (i.e text format) is
                    directly ingested into our datalake every 1 hour. Simultaneously, a
                    nearly identical dataset is put into a stream, where each record may
                    contain zero or more failures before success. You can be notified upon
                    existence of failure(s) per window. However, it is important to know the
                    number of records from one window could be very different with any
                    adjacent window`;
                var ingest_content_2_mobile = `
                    Partitions of data from the SEC source`;
                var ingest_content_2 = `
                    The above figure shows the number of records from any 1 hour batch cycle
                    can be different from another batch cycle. Lastly, when reviewing the
                    ingest performance via Archive (or datalake), window=0 indicates the
                    corresponding record did not ingest through normal processes, rather
                    from backfill operation`;
                var late_arrival = true;
                var x_unit = 'hour';
                var x_increment = 1;
                var window_1_purple = false;
                var window_1_green = false;
                var window_2_blue = false;
            } else {
                var ingest_interval = null;
                var ingest_content_1 = null;
                var ingest_content_2_mobile = null;
                var ingest_content_2 = null;
                var late_arrival = true;
                var x_unit = null;
                var x_increment = null;
                var window_1_purple = false;
                var window_1_green = false;
                var window_2_blue = false;
            }
        }

        const term = 'ingest alarms';
        const notice = (
            <>
                {`
                    To subscribe to ${this.state.stream} ${term},
                `}
                <span className='bold'>you must accept the terms and conditions.</span>
            </>
        );

        if (stream.toLowerCase() === 'stockmarket') {
            var alarm_count = parseInt(this.state.total_source) + parseInt(this.state.total_tickers);
        } else if (this.state.stream.toLowerCase() === 'stockmarketstocksplit') {
            var alarm_count = 3;
        } else {
            var alarm_count = parseInt(this.state.total_source);
        }

        const max_year = new Date().getFullYear();

        if (stream === 'usnationalweather') {
            var min_year = 2024;
            var download_prefix = `${this.state.performance_link}/ingest/article/weather`;
        } else if (['stockmarket', 'stockmarketstocksplit'].includes(stream)) {
            var min_year = 2023;
            var download_prefix = `${this.state.performance_link}/ingest/${stream}`;
        } else if (stream === 'bls') {
            var min_year = 2024;
            var download_prefix = [
                `${this.state.performance_link}/ingest/article/bls`
            ]
        } else if (stream === 'sec') {
            var min_year = 2024;
            var download_prefix = [
                `${this.state.performance_link}/ingest/article/sec`
            ]
        }

        const links = [];
        if (Array.isArray(download_prefix)) {
            for (let index = 0; index < download_prefix.length; index++) {
                const item = download_prefix[index];
                const stream = item.split('/').pop();
                const sublinks = [];

                for (let i = max_year; i >= min_year; i--) {
                    if (['sec', 'weather'].includes(stream)) {
                        for (let j = 1; j <= this.state.mm; j++) {
                            const month = (j).toLocaleString(
                                undefined,
                                {minimumIntegerDigits: 2}
                            );

                            sublinks.push(
                                <a href={`${item}/${i}/${month}.csv`} download>
                                    <ListItemButton key={`${item}-${i}-${j}-${index}`}>
                                        <ListItemText primary={`${month}/${i}.csv`} />
                                    </ListItemButton>
                                </a>
                            );
                        }
                    } else {
                        sublinks.push(
                            <a href={`${i}.csv`}download>
                                <ListItemButton>
                                    <ListItemText primary={`${i}.csv`} />
                                </ListItemButton>
                            </a>
                        );
                    }
                }
                links.push(
                    <div key={`${item}-${index}`}>
                        <ListItemButton onClick={() => {
                            this.handleArchiveClick(stream);
                        }}>
                            <ListItemText primary={stream} />
                            {this.state[`expand_archive_${stream}`] ? <ExpandLess /> : <ExpandMore />}
                        </ListItemButton>
                        <Collapse in={this.state[`expand_archive_${stream}`]} timeout='auto' unmountOnExit>
                            <List component='div' disablePadding>{sublinks}</List>
                        </Collapse>
                    </div>
                );
            }
        } else {
            const stream = download_prefix.split('/').pop() === 'stockmarketstocksplit'
                ? 'stocksplit'
                : download_prefix.split('/').pop();
            const sublinks = [];

            for (let i = max_year; i >= min_year; i--) {
                if (['sec', 'weather'].includes(stream)) {
                    for (let j = 1; j <= this.state.mm; j++) {
                        const month = (j).toLocaleString(
                            undefined,
                            {minimumIntegerDigits: 2}
                        );

                        sublinks.push(
                            <a href={`${download_prefix}/${i}/${month}.csv`} download>
                                <ListItemButton key={`${stream}-${i}-${j}`}>
                                    <ListItemText primary={`${month}/${i}.csv`} />
                                </ListItemButton>
                            </a>
                        );
                    }
                } else {
                    sublinks.push(
                        <a href={`${download_prefix}/${i}.csv`}download>
                            <ListItemButton>
                                <ListItemText primary={`${i}.csv`} />
                            </ListItemButton>
                        </a>
                    );
                }
            }

            if (sublinks.length > 0) {
                links.push(
                    <div>
                        <ListItemButton onClick={() => {
                            this.handleArchiveClick(stream);
                        }}>
                            <ListItemText primary={stream} />
                            {this.state[`expand_archive_${stream}`] ? <ExpandLess /> : <ExpandMore />}
                        </ListItemButton>
                        <Collapse in={this.state[`expand_archive_${stream}`]} timeout='auto' unmountOnExit>
                            <List component='div' disablePadding>{sublinks}</List>
                        </Collapse>
                    </div>
                );
            }
        }

        const archive_text = `Download raw ${this.state.stream} ingest performance metrics`;
        const tool_tip = ! isMobile
            ? (
                <Tooltip
                    title={archive_text}
                    placement='bottom'
                    PopperProps={{style:{zIndex:99999999}}}
                    arrow
                >
                    <IconButton
                        onMouseEnter={() => this.setState({ tool_tip_color: '#333' })}
                        onMouseLeave={() => this.setState({ tool_tip_color: '#777' })}
                    >
                        <HelpOutlineIcon
                            className='help-icon'
                            style={{ color: this.state.tool_tip_color }}
                        />
                    </IconButton>
                </Tooltip>
            ) : null;

        const archive_text_extended = isMobile
            ? <div className='summary-item'>{`${archive_text} for the most recent available 5 years.`}</div>
            : null;

        const viewport_class = isMobile ? 'container featured-mobile' : 'container featured-desktop';

        const summary_graphic = isMobile
            ? (
                <div className='summary-item summary-item-mobile'>
                    <Tumbling
                        x_unit={x_unit}
                        x_increment={x_increment}
                        late_arrival={late_arrival}
                        window_1_purple={window_1_purple}
                        window_1_green={window_1_green}
                        window_2_blue={window_2_blue}
                    />
                    <div className='accordion-description'>{ingest_content_2_mobile}</div>
                </div>
            ) : (
                <div className='summary-item'>
                    <Tumbling
                        x_unit={x_unit}
                        x_increment={x_increment}
                        late_arrival={late_arrival}
                        window_1_purple={window_1_purple}
                        window_1_green={window_1_green}
                        window_2_blue={window_2_blue}
                    />
                    <div>{ingest_content_2}</div>
                </div>
            );

        const summary = (
            <div>{`
                The ${this.state.stream} ingest stream runs ${ingest_interval}.
                ${ingest_content_1}.
            `}
                {isMobile ? null : summary_graphic}
            </div>
        );

        const accordion_summary = [{
            'id': 'summary_panel_tumbling',
            'title': 'Tumbling Window',
            'content': summary_graphic
        }];

        const summary_integration = (
            <div>
                You select alarms from a desired modality. When we detect the number
                of records in a window fall below threshold, you get notified. You
                can choose and customize workflows using basic triggers, and trigger
                aggregate. More advanced workflows will become available late-2024
                (stay tuned).
            </div>
        );

        const accordion_integration = [{
            'id': 'integration_panel1',
            'title': 'Basic Workflow',
            'content': (
                <>
                    <BasicWorkflow />
                    <div className='accordion-description'>
                        The <i>basic workflow</i> allows you to select a specific
                        performance modality. When records fall below a threshold
                        (T), you get notified (N).
                    </div>
                </>
            )
        }, {
            'id': 'integration_panel2',
            'title': 'Aggregate Workflow',
            'content': (
                <>
                    <AggregateWorkflow />
                    <div className='accordion-description'>
                        The <i>aggregate workflow</i> allows you to define custom logic
                        within a threshold aggregate (TA). For example, you can specify if
                        two of three threshold alarm (T) occur, then your threshold aggregate
                        (TA) should notify (N) you.
                    </div>
                </>
            )
        }];

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className={viewport_class}>
                    <div className='row'>
                        <div className='left-column margin-bottom col-lg-2 order-1 order-lg-first'>
                            <h4 className='header-featured center-text'>Latest Archive{tool_tip}</h4>
                            {archive_text_extended}
                            <List sx={{ width: '100%' }}>{links}</List>
                        </div>
                        <div className='right-column col-lg-10 order-12 order-sm-first'>
                            <div className='header-featured center-text'>
                                <h4>Ingest Alarms</h4>
                                <span className='title-count'>{alarm_count}</span>
                                <BreadCrumbs />
                            </div>
                            <NoticeTerms notice={notice} subject={term} />
                            <SummaryTrigger
                                header='How It Works'
                                header_summary='Performance Metrics'
                                summary={summary}
                                summary_integration={summary_integration}
                                accordion_summary={isMobile ? accordion_summary : null}
                                accordion_integration={accordion_integration}
                            />
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default (props) => <StreamAlarm {...props} params={useParams()} />;
