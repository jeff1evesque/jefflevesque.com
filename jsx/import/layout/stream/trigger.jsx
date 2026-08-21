/**
 * trigger.jsx: stream trigger page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import MultiLineChart from '../../general/line-chart.jsx';
import { isMobile } from 'react-device-detect';
import getData from '../../general/get-data.js';
import checkValidArray from '../../validator/valid-array.js';
import checkValidBool from '../../validator/valid-bool.js';
import checkValidString from '../../validator/valid-string.js';
import getColor from '../../general/generate-color.js';
import { dstDate } from '../../general/dst.js';
import BreadCrumbs from '../../navigation/breadcrumbs.jsx';
import Candlestick from './trigger/content/candlestick.jsx';
import StockSplit from './trigger/content/stock-split.jsx';
import USNationalWeather from './trigger/content/us-national-weather.jsx';
import ArticleIngest from './trigger/content/article-ingest.jsx';
import getCandlestickArrResult from './trigger/toggle_chart_scale/candlestick.js';
import getFilteredCandlestickData from './trigger/get_filtered_data/candlestick.js';
import CandlestickLeftColumnState from '../../redux/container/stream/trigger/left_column/candlestick.jsx';
import { useParams, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import streamName from '../../general/stream-name.js';

class StreamTriggerLayout extends Component {
    constructor(props) {
        super(props);

        const today = dstDate();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // january is 0
        const yyyy = today.getFullYear();
        const stream = 'StockMarket';
        const trigger_rate = 'Minutes';

        this.state = {
            local: true,//is_local,
            chart_data: [],
            chart_data_original: [],
            chart_data_keys: [],
            chart_data_colors: [],
            field_datetime: 'window_start',
            promise_chart_complete: false,
            display_candlestick: true,
            display_apply_filter_button: false,
            scale_chart_monthly: false,
            scale_chart_daily: false,
            scale_chart_hourly: false,
            scale_chart_Minutes: true,
            hide_all: false,
            x_ticker_format: '%I:%M:%p',
            label_format: '%d %B, %Y %H:%M%Z',
            mm: mm,
            yyyy: yyyy,
            selected_category: '',
            selected_trigger: [],
            candlestick_rates: ['Monthly', 'Daily', 'Hourly', 'Minutes'],
            listing_graphic_title: 'Candlestick',
            stream: stream,
            trigger_rate: trigger_rate,
            selected_rate: [trigger_rate.toLowerCase()],
            today: today
        }

        this.toggleChartScale = this.toggleChartScale.bind(this);
    }

    componentDidMount() {
        const { stream } = this.props.params;
        const [searchParams, setSearchParams] = this.props.searchParams;
        const selected = searchParams.get('selected');
        const category = searchParams.get('category');
        const selected_trigger = selected ? selected.replace(/\s+/g, '_').split(';') : [];

        this.setState({
            selected_category: category ? category : null,
            selected_trigger: selected_trigger,
            stream: stream,
            searchParams: searchParams,
            setSearchParams: setSearchParams
        });

        if (stream.toLowerCase() === 'stockmarket') {
            var promise_data = getData(
                'stock-market-candlestick-triggers',
                this.state.local
                    ? null
                    : `https://www.jefflevesque.com/artifact/performance/trigger/stock-market/candlestick/${this.state.yyyy}.csv`
            );
        } else {
            var promise_data = null;
        }

        if (promise_data) {
            Promise.all([promise_data]).then((v) => {
                const { data_filtered_detected, keys } = getFilteredCandlestickData(v, this.state.field_datetime);

                this.setState({
                    chart_data_original: Object.values(data_filtered_detected),
                    chart_data_keys: keys
                }, () => {
                    const d = new Date(this.state.today.toLocaleString('en-US', {timeZone: 'America/New_York'}));
                    const day = d.getDay();
                    const hour = d.getHours();
                    const minute = d.getMinutes();

                    if (
                        [1, 2, 3, 4, 5].includes(day)
                        && ( hour === 9 && minute > 30 || hour >= 10 )
                        && hour < 16
                        && this.state.stream.toLowerCase() === 'stockmarket'
                    ) {
                        this.toggleChartScale('Minutes', selected_trigger);
                    } else {
                        this.toggleChartScale('Daily', selected_trigger);
                    }

                    this.setState({ promise_chart_complete: true });
                });
            });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'hide' in prevProps
            && 'all' in prevProps.hide
            && 'hide' in this.props
            && 'all' in this.props.hide
            && checkValidBool(this.props.hide.all)
            && prevProps.hide.all !== this.props.hide.all
        ) {
            this.setState({
                hide_all: this.props.hide.all
            });
        }

        if (
            'hide' in prevProps
            && 'all' in prevProps.hide
            && 'hide' in this.props
            && 'graph' in this.props.hide
            && checkValidBool(this.props.hide.graph)
            && prevProps.hide.graph !== this.props.hide.graph
        ) {
            this.setState({
                display_candlestick: ! this.props.hide.graph
            });
        }
    }

    toggleChartScale(v, patterns=null) {
        if (patterns && checkValidArray(patterns)) {
            this.setState({ selected_trigger: patterns });
        }

        const params = patterns.join(';');
        if (checkValidString(params)) {
            this.state.setSearchParams({'selected': params});
            history.pushState(null, '', window.location.href);
        } else {
            this.state.searchParams.delete('selected');
            this.state.setSearchParams(this.state.searchParams);
        }

        const vv = v.toLowerCase();
        this.setState({ scale_chart_monthly: vv === 'monthly' ? true : false });
        this.setState({ scale_chart_daily: vv === 'daily' ? true : false });
        this.setState({ scale_chart_hourly: vv === 'hourly' ? true : false });
        this.setState({ scale_chart_Minutes: vv === 'minutes' ? true : false });

        if (this.state.stream.toLowerCase() === 'stockmarket') {
            var chart_data = getCandlestickArrResult(
                this.state.chart_data_original,
                this.state.field_datetime,
                vv,
                patterns
            );
        } else {
            var chart_data = [];
        }

        if (chart_data && chart_data.length > 0) {
            let color_count = 0;
            chart_data.forEach(function(obj) {
                color_count = Object.keys(obj).length > color_count ? Object.keys(obj).length : color_count
            });

            const dh = 1 / color_count;
            let colors = []
            for (let i=0; i < color_count; i++) {
                let rgb = getColor(dh*i, 1, 1);
                colors.push(rgb);
            }
            this.setState({ chart_data_colors: colors });
        }

        this.setState({ chart_data: chart_data });

        if (vv === 'monthly') {
            this.setState({
                x_ticker_format: '%m/%Y',
                label_format: '%B %Y',
                trigger_rate: v,
                selected_rate: [v]
            });
        } else if (vv === 'daily') {
            this.setState({
                x_ticker_format: '%m/%d',
                label_format: '%d %B, %Y',
                trigger_rate: v,
                selected_rate: [v]
            });
        } else if (vv === 'hourly') {
            this.setState({
                x_ticker_format: '%I%p',
                label_format: '%d %B, %Y (%I%p)',
                trigger_rate: v,
                selected_rate: [v]
            });
        } else if (vv === 'minutes') {
            this.setState({
                x_ticker_format: '%I:%M%p',
                label_format: '%d %B, %Y (%H:%M:%S%Z)',
                trigger_rate: v,
                selected_rate: [v]
            });
        }
    }

    render() {
        if (this.state.stream.toLowerCase() === 'stockmarket') {
            const stream = 'stock-market';

            var filter_page = (
                <CandlestickLeftColumnState
                    expanded={true}
                    display_filter_button={true}
                    trigger_rate={this.state.trigger_rate}
                    chart_data_keys={this.state.chart_data_keys}
                    listing_graphic_title={this.state.listing_graphic_title}
                    selected_rate={this.state.selected_rate}
                    selected_candlestick={this.state.selected_trigger}
                    candlestick_rates={this.state.candlestick_rates}
                    toggleChartScale={this.toggleChartScale}
                    display_candlestick={this.state.display_candlestick}
                    mm={this.state.mm}
                    yyyy={this.state.yyyy}
                />
            );

            var left_column = ! this.state.hide_all
                ? (
                    <CandlestickLeftColumnState
                        expanded={false}
                        display_filter_button={false}
                        display_apply_filter_button={this.state.display_apply_filter_button}
                        trigger_rate={this.state.trigger_rate}
                        chart_data_keys={this.state.chart_data_keys}
                        listing_graphic_title={this.state.listing_graphic_title}
                        selected_rate={this.state.selected_rate}
                        selected_candlestick={this.state.selected_trigger}
                        candlestick_rates={this.state.candlestick_rates}
                        toggleChartScale={this.toggleChartScale}
                        display_candlestick={this.state.display_candlestick}
                        mm={this.state.mm}
                        yyyy={this.state.yyyy}
                    />
                ) : null;

            var content = ! this.state.hide_all
                ? (
                    <Candlestick
                        stream={stream}
                        listing_graphic_title={this.state.listing_graphic_title}
                        trigger_rate={this.state.trigger_rate}
                    />
                ) : null;

        } else if (this.state.stream.toLowerCase() === 'stocksplit') {
            var filter_page = null;
            var left_column = null;
            var content = ! this.state.hide_all ? <StockSplit /> : null;
        } else if (this.state.stream.toLowerCase() === 'usnationalweather') {
            var filter_page = null;
            var left_column = null;
            var content = ! this.state.hide_all
                ? (
                    <USNationalWeather
                        x_unit='min'
                        x_increment={5}
                        ingest_interval='every 5 minutes'
                        window_1_purple={false}
                        window_1_green={false}
                        window_2_blue={false}
                    />
                ) : null;
        } else if (['bls', 'sec'].includes(this.state.stream.toLowerCase())) {
            const stream = this.state.stream.toLowerCase();
            const source_name = stream === 'bls'
                ? 'the U.S. Bureau of Labor Statistics (BLS)'
                : 'the U.S. Securities and Exchange Commission (SEC)';

            var filter_page = null;
            var left_column = null;
            var content = ! this.state.hide_all
                ? (
                    <ArticleIngest
                        listing_graphic_title={this.state.stream.toUpperCase()}
                        source_name={source_name}
                        x_unit='hour'
                        x_increment={1}
                        ingest_interval='every 1 hour'
                        window_1_purple={false}
                        window_1_green={false}
                        window_2_blue={false}
                    />
                ) : null;
        } else {
            var filter_page = null;
            var left_column = null;
            var content = null;
        }

        if (
            ! this.state.hide_all
            && this.state.promise_chart_complete
            && this.state.display_candlestick
            && this.state.chart_data.length > 0
        ) {
            var bar_chart = (
                <div className='col-lg-12 mx-auto'>
                    <MultiLineChart
                        data={this.state.chart_data}
                        data_keys={this.state.chart_data_keys}
                        color={this.state.chart_data_colors}
                        title={streamName('StockMarket')}
                        y_label='Total Alerts'
                        data_key={this.state.field_datetime}
                        aspect_ratio={isMobile ? 1.5 : 3}
                        x_ticker_format={this.state.x_ticker_format}
                        label_format={this.state.label_format}
                        y_tick_format={isMobile ? false : 'exponential'}
                        y_axis_tick_line={isMobile ? false : true}
                    />
                </div>
            );
        } else {
            var bar_chart = null
        }

        const viewport_class = isMobile ? 'container featured-mobile' : 'container featured-desktop';
        const breadcrumbs = filter_page ? '' : (
            <div className='header-featured center-text'>
                <h4>Triggers</h4>
                <span className='title-count'>{this.state.selected_trigger.length}</span>
                <BreadCrumbs />
            </div>
        );

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className={viewport_class}>
                    <div className='row listing-graphic'>
                        {filter_page}
                        {bar_chart}
                    </div>
                    <div className='row listing-general'>
                        {left_column}
                        <div className='col'>
                            {breadcrumbs}
                            {content}
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default (props) => <StreamTriggerLayout {...props} params={useParams()} searchParams={useSearchParams()} />;
