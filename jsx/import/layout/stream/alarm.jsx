/**
 * alarm.jsx: stream alarm page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import Tumbling from '../../svg/window/tumbling.jsx';
import NoticeTerms, { TERMS_VERSION } from '../../general/notice-terms.jsx';
import SummaryTrigger from '../../general/summary-trigger.jsx';
import BreadCrumbs from '../../navigation/breadcrumbs.jsx';
import { isMobile } from 'react-device-detect';
import {
    signedIn,
    listSubscriptions,
    subscribe,
    unsubscribe,
    streamAlarms,
} from '../../general/account-api.js';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
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
import { loadArchiveListing, archiveFiles } from '../../general/archive-links.js';
import {
    STOCK_MARKET,
    STOCK_SPLIT,
    BLS,
    SEC,
    US_NATIONAL_WEATHER,
    STREAMS,
} from '../../general/stream-id.js';
import { themeColors } from '../../general/colors.js';
import { ThemeModeContext } from '../../general/theme-mode.jsx';

class StreamAlarm extends Component {
    //
    // the page's theme, which the help icon's grays follow. See theme-mode.jsx.
    //
    static contextType = ThemeModeContext;

    constructor() {
        super();

        this.state = {
            stream: STOCK_MARKET,
            // whether the pointer is on the help icon, which is drawn in the
            // page's muted gray and in its body text under the pointer
            tool_tip_hover: false,
            artifact_link: 'https://www.jefflevesque.com/artifact',
            current_accordion: false,
            //
            // the stream's alarms, each { id, name }: null until the list
            // arrives, then the list -- or 'failed'. See loadAlarms.
            //
            alarms: null,
            //
            // whether a reader is signed in: null until the session has been
            // looked at. See loadReader.
            //
            signed_in: null,
            //
            // the stream's alarms the reader holds, by id: null until their
            // subscriptions arrive, and while they could not be had
            //
            subscribed: null,
            // whether the reader has ticked the terms
            accepted: false,
            // the alarms with a subscribe or an unsubscribe on its way, by id
            busy: {},
            // what the account api said about the last request it refused
            problem: null,
            window_1_purple: true,
            window_1_green: true,
            window_2_blue: true,
            //
            // whether each stream's archive row is open, keyed by its id
            //
            ...Object.fromEntries(STREAMS.map((id) => [`expand_archive_${id}`, false])),
            //
            // per stream: absent until asked, 'pending' while the listing is on
            // its way, then the files it lists -- or 'failed' when it could not
            // be had. See loadArchive.
            //
            archive: {}
        }

        this.handleArchiveClick = this.handleArchiveClick.bind(this);
        this.loadArchive = this.loadArchive.bind(this);
        this.selectedStream = this.selectedStream.bind(this);
        this.loadAlarms = this.loadAlarms.bind(this);
        this.loadReader = this.loadReader.bind(this);
        this.loadSubscriptions = this.loadSubscriptions.bind(this);
        this.toggleAlarm = this.toggleAlarm.bind(this);
        this.acceptTerms = this.acceptTerms.bind(this);
        this.alarmSwitches = this.alarmSwitches.bind(this);
    }

    //
    // the stream this page is for: the one its url names, by id.
    //
    // Note: taken as it is, and compared as it is. The route replaces a url
    //       naming a stream by a name it used to go by with the url naming it
    //       by its id before this page mounts -- see route/canonical-stream.jsx
    //       -- so this page converts nothing. It used to rename three streams
    //       for itself, into names streamName did not know, and was labeled
    //       'stock-market' and 'us-national-weather' as a result.
    //
    selectedStream() {
        return 'stream' in this.props.params ? this.props.params.stream : this.state.stream;
    }

    componentDidMount() {
        const stream = this.selectedStream();

        this.setState({ stream: stream });
        this.loadAlarms(stream);
        this.loadReader(stream);
    }

    handleArchiveClick(stream=null) {
        stream = stream ? stream : this.state.stream;
        this.setState({ [`expand_archive_${stream}`]: ! this.state[`expand_archive_${stream}`] });
        this.loadArchive(stream);
    }

    /**
     * ask the performance api which archive files the stream has published.
     *
     * On EXPANSION rather than on load, and once per stream. The sublinks sit
     * inside a Collapse with `unmountOnExit`, so they do not exist until a
     * reader opens that stream. One request answers it: the listing holds every
     * stream, and the api lets a browser keep it for five minutes.
     *
     * Note: 'pending' is set before the answer lands, and is not an empty list.
     *       An empty list read "Nothing published yet" for as long as the page
     *       was still asking.
     *
     * Note: a listing that could not be had is 'failed', not an empty list, and
     *       is asked again on the next expansion -- nothing was learned about
     *       what the stream published.
     */
    loadArchive(stream) {
        const key = stream;
        const asked = this.state.archive[key];

        if (asked && asked !== 'failed') {
            return;
        }

        this.setState((state) => ({ archive: { ...state.archive, [key]: 'pending' } }));

        loadArchiveListing()
            .then((listing) => {
                this.setState((state) => ({
                    archive: { ...state.archive, [key]: archiveFiles(listing, key) },
                }));
            })
            .catch(() => {
                this.setState((state) => ({ archive: { ...state.archive, [key]: 'failed' } }));
            });
    }

    //
    // the stream's alarms, from the account api's public list: what the count beside
    // the heading counts, and what a signed-in reader switches -- one list for both,
    // so the number and the switches cannot disagree.
    //
    // Note: 'failed' when the list could not be had, and the count is then left off
    //       rather than guessed. It used to be worked out here -- one per source, one
    //       per ticker, and three for stock splits -- from a datalake request made
    //       for nothing else, and it counted alarms there was no way to subscribe to.
    //
    loadAlarms(stream) {
        streamAlarms(stream)
            .then((alarms) => this.setState({ alarms: alarms }))
            .catch(() => this.setState({ alarms: 'failed' }));
    }

    //
    // whether there is a reader, from the session alone, so the notice shows the
    // right one of its two faces at once -- and then, for a reader, which alarms
    // they hold. See signedIn in account-api.js.
    //
    loadReader(stream) {
        signedIn().then((signed_in) => {
            this.setState({ signed_in: signed_in });

            if (signed_in) {
                this.loadSubscriptions(stream);
            }
        });
    }

    //
    // the reader's subscriptions to this stream's alarms. Null from the api is a
    // session that has ended, which is the signed-out view rather than an error;
    // a list that could not be had leaves every switch unknown, and says why.
    //
    loadSubscriptions(stream) {
        listSubscriptions()
            .then((subscriptions) => {
                if (subscriptions === null) {
                    this.setState({ signed_in: false });
                    return;
                }

                this.setState({
                    subscribed: Object.fromEntries(subscriptions
                        .filter((held) => held.stream === stream)
                        .map((held) => [held.alarm, true])),
                });
            })
            .catch((problem) => this.setState({ problem: problem.message }));
    }

    acceptTerms(accepted) {
        this.setState({ accepted: accepted });
    }

    /**
     * subscribe to one of the stream's alarms, or unsubscribe from it.
     *
     * A subscribe sends the version of the terms the reader accepted, which the api
     * keeps with the subscription. The switch shows what the api answered, not what
     * was asked for: it moves only once the request has succeeded.
     *
     * Note: null from the api is a session that has ended, and puts the page in its
     *       signed-out view. Any other refusal -- an email address not yet verified,
     *       a service too busy -- leaves the switch where it was, and the api's own
     *       message says why.
     */
    toggleAlarm(alarm, on) {
        //
        // a switch is drawn disabled until the terms are accepted, and while its
        // request is on its way. The rule is held here too, whatever reaches it.
        //
        if ((on && !this.state.accepted) || this.state.busy[alarm]) {
            return;
        }

        const stream = this.selectedStream();
        const settle = (change) => this.setState((state) => ({
            ...change(state),
            busy: { ...state.busy, [alarm]: false },
        }));

        this.setState((state) => ({ busy: { ...state.busy, [alarm]: true }, problem: null }));

        (on ? subscribe(stream, alarm, TERMS_VERSION) : unsubscribe(stream, alarm))
            .then((answered) => {
                if (answered === null) {
                    settle(() => ({ signed_in: false }));
                    return;
                }

                settle((state) => ({ subscribed: { ...state.subscribed, [alarm]: on } }));
            })
            .catch((problem) => settle(() => ({ problem: problem.message })));
    }

    /**
     * the stream's alarms, each with a switch, for a signed-in reader.
     *
     * A switch cannot be turned on until the terms are accepted, and can always be
     * turned off. While the reader's subscriptions are on their way, or could not be
     * had, every switch is held still: its position would be a guess.
     */
    alarmSwitches() {
        const { alarms, subscribed, accepted, busy, problem } = this.state;

        if (alarms === 'failed') {
            return <p className='alarm-status'>The alarms could not be listed right now.</p>;
        }

        if (!Array.isArray(alarms)) {
            return null;
        }

        return (
            <div className='alarm-subscriptions'>
                <FormGroup>
                    {alarms.map((alarm) => {
                        const held = Boolean(subscribed && subscribed[alarm.id]);

                        return (
                            <FormControlLabel
                                key={alarm.id}
                                control={(
                                    <Switch
                                        checked={held}
                                        disabled={!subscribed || Boolean(busy[alarm.id]) || (!held && !accepted)}
                                        onChange={(event) => this.toggleAlarm(alarm.id, event.target.checked)}
                                    />
                                )}
                                label={alarm.name}
                            />
                        );
                    })}
                </FormGroup>
                {accepted
                    ? null
                    : <p className='alarm-hint'>Accept the terms and conditions above to turn an alarm on.</p>}
                {problem ? <p className='alarm-problem' role='alert'>{problem}</p> : null}
            </div>
        );
    }

    render() {
        const stream = this.selectedStream();

        if ('stream' in this.props.params) {
            if (stream === STOCK_SPLIT) {
                {/*

                    window is actually sliding, with data drop once per day,
                    which is perceived by end users as a tumbling window(s).

                */}

                var ingest_interval = 'daily at 12am EDT (M-F)';
                var ingest_content_1 = `
                    Any detected stock-split ticker matching our list of tickers,
                    will start a refactor job on partitions in the ${streamName(STOCK_MARKET)}
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
            } else if (stream === STOCK_MARKET) {
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
            } else if (stream === US_NATIONAL_WEATHER) {
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
            } else if (stream === BLS) {
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
            } else if (stream === SEC) {
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
                    To subscribe to ${streamName(stream)} ${term},
                `}
                <span className='bold'>you must accept the terms and conditions.</span>
            </>
        );

        //
        // the alarms the stream has, counted from the list the switches are drawn
        // from, and left off until that list has arrived -- see loadAlarms
        //
        const alarm_count = Array.isArray(this.state.alarms) ? this.state.alarms.length : null;

        //
        // the archive column: the files this stream published, as the listing
        // names them -- see loadArchive. Keyed on the stream's id, which finds
        // its files whichever name the listing gives it -- see archiveFiles.
        //
        const key = stream;
        const found = this.state.archive[key];
        const files = Array.isArray(found) ? found : [];
        const status = found === 'failed'
            ? 'Archive unavailable right now'
            : Array.isArray(found) ? 'Nothing published yet' : 'Checking...';
        const links = [
            <div key={key}>
                <ListItemButton onClick={() => {
                    this.handleArchiveClick(key);
                }}>
                    <ListItemText primary={streamName(key)} />
                    {this.state[`expand_archive_${key}`] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse
                    in={this.state[`expand_archive_${key}`]}
                    timeout='auto'
                    unmountOnExit
                >
                    <List component='div' disablePadding>
                        {files.length
                            ? files.map((file) => (
                                <a href={file.href} download key={file.href}>
                                    <ListItemButton>
                                        <ListItemText primary={file.label} />
                                    </ListItemButton>
                                </a>
                            ))
                            : (
                                <ListItemButton disabled>
                                    <ListItemText primary={status} />
                                </ListItemButton>
                            )}
                    </List>
                </Collapse>
            </div>,
        ];

        const archive_text = `Download raw ${streamName(stream)} ingest performance metrics`;
        const tool_tip = ! isMobile
            ? (
                <Tooltip
                    title={archive_text}
                    placement='bottom'
                    PopperProps={{style:{zIndex:99999999}}}
                    arrow
                >
                    <IconButton
                        onMouseEnter={() => this.setState({ tool_tip_hover: true })}
                        onMouseLeave={() => this.setState({ tool_tip_hover: false })}
                    >
                        <HelpOutlineIcon
                            className='help-icon'
                            style={{
                                color: themeColors(this.context.theme)[
                                    this.state.tool_tip_hover ? 'gray-7' : 'gray-6'
                                ],
                            }}
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
                The ${streamName(stream)} ingest stream runs ${ingest_interval}.
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
                                {alarm_count === null
                                    ? null
                                    : <span className='title-count'>{alarm_count}</span>}
                                <BreadCrumbs />
                            </div>
                            <NoticeTerms
                                notice={notice}
                                subject={term}
                                signed_in={this.state.signed_in === true}
                                accepted={this.state.accepted}
                                onAccept={this.acceptTerms}
                            />
                            {this.state.signed_in ? this.alarmSwitches() : null}
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
