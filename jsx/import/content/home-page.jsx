/**
 * home-page.jsx: main homepage for entire application.
 *
 * @HomePage, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import Auth from '@aws-amplify/auth';
import React, { Component } from 'react';
import { setLayout } from '../redux/action/page.jsx';
import GraphCluster from '../animation/graph-cluster.jsx';
import ArticleListing from '../general/article-listing.jsx';
import PropTypes from 'prop-types';
import trim from '../general/trim-object.js';
import getData from '../general/get-data.js';
import checkValidObject from '../validator/valid-object.js';
import SvgExit from '../svg/svg-exit.jsx';
import DatePicker from 'react-datepicker';
import is_local from '../../is_local.js';

{/*

    the trading day whose stock-split csv should be requested, as the zero-padded
    parts of the s3 path.

    the file is published per weekday, so a weekend walks back to the Friday before
    -- StockSplitSplitter lists Mon-Fri regardless of holidays, so only the weekend
    needs handling. 6 = Saturday, 0 = Sunday.

    Note: the walk-back moves the DATE rather than subtracting from the day of the
          month. It read:

              var dd = String(today.getDate() - 1).padStart(2, '0');

          which on Saturday the 1st gave '00' and on Sunday the 1st gave '-1', and
          neither rolled the month back -- so the page requested
          '.../2026/08/00.csv' or '.../2026/11/-1.csv'. Both 404, the split listing
          stayed empty, and nothing reported why. setDate() handles the month and
          year boundaries itself.

    Note: exported for its tests. The same calculation is needed by the constructor
          and by the date picker, and it was previously duplicated between them --
          so the defect above existed in two places and had to be fixed in both.

*/}
export function tradingDate(date) {
    const trading = new Date(date.getTime());
    const day_of_week = trading.getDay();

    if (day_of_week === 6) {
        trading.setDate(trading.getDate() - 1);
    } else if (day_of_week === 0) {
        trading.setDate(trading.getDate() - 2);
    }

    return {
        dd: String(trading.getDate()).padStart(2, '0'),
        mm: String(trading.getMonth() + 1).padStart(2, '0'), // january is 0
        yyyy: trading.getFullYear()
    };
}

class HomePage extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLayout: PropTypes.func,
    }

    constructor() {
        super();
        this.currentUser = this.currentUser.bind(this);
        this.setDisplay = this.setDisplay.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
        this.toggleStockStream = this.toggleStockStream.bind(this);
        this.toggleStockSplit = this.toggleStockSplit.bind(this);
        this.horizontalCheckbox = this.horizontalCheckbox.bind(this);

        const { dd, mm, yyyy } = tradingDate(new Date());

        this.state = {
            tickers: [],
            split_list: [],
            promise_list_ticker_complete: false,
            display: 'stock-market',
            display_stock_stream: true,
            display_stock_split: true,
            display_filter_button: true,
            display_apply_filter_button: false,
            horizontal_checkbox: true,
            hide_all: false,
            start_date: new Date(),
            dd: dd,
            mm: mm,
            yyyy: yyyy
        }
    }

    async currentUser() {
        Auth.currentSession()
            .then(data => console.log(data))
            .catch(err => console.log(err));
    }

    setDisplay(v) {
        this.setState({ display: v });
    }

    filterColumn(style='default', btn=false) {
        if (btn && this.state.display_filter_button) {
            var button_filter = (
                <div className='d-block d-md-none filter'>
                    <button className='btn' type='button' onClick={() =>
                        this.setState({
                            display_filter_button: false,
                            display_apply_filter_button: true,
                            horizontal_checkbox: false,
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
            const class_date_picker = style === 'default'
                ? 'col-lg-12 col-md-9 col-sm-9'
                : 'col-lg-3 col-md-3 col-sm-3';

            var filter = (
                <div className={class_parent}>
                    <div>
                        <label>
                            <input
                                type='checkbox'
                                checked={this.state.display_stock_stream}
                                onChange={() => this.toggleStockStream()}
                            />
                            Streams
                        </label>
                    </div>
                    <div className='row'>
                        <label className={`col-lg-${class_date_label} col-sm-${class_date_label}`}>
                            <input
                                type='checkbox'
                                checked={this.state.display_stock_split}
                                onChange={() => this.toggleStockSplit()}
                            />
                            Stock Split
                        </label>
                        <div className={class_date_picker}>
                            <DatePicker
                                selected={this.state.start_date}
                                onChange={(date) => {
                                    const { dd, mm, yyyy } = tradingDate(date);

                                    this.setState({
                                        start_date: date,
                                        dd: dd,
                                        mm: mm,
                                        yyyy: yyyy
                                    });
                                }}
                            />
                        </div>
                    </div>
                </div>
            );

            if (this.state.display_apply_filter_button) {
                var button_exit = (
                    <span className='exit' onClick={() =>
                        this.setState({
                            display_filter_button: true,
                            display_apply_filter_button: false,
                            horizontal_checkbox: true,
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
                                horizontal_checkbox: true,
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

    toggleStockStream() {
        this.setState({ display_stock_stream: ! this.state.display_stock_stream });
    }

    toggleStockSplit() {
        this.setState({ display_stock_split: ! this.state.display_stock_split });
    }

    horizontalCheckbox() {
        return(
            <div className='checkbox-horizontal'>
                <label>
                    <input
                        type='checkbox'
                        checked={this.state.display === 'stock-market'}
                        onChange={() => this.setDisplay('stock-market')}
                    />
                    StockMarket
                </label>
                <label>
                    <input
                        type='checkbox'
                        checked={this.state.display === 'summary'}
                        onChange={() => this.setDisplay('summary')}
                    />
                    Summary
                </label>
            </div>
        );
    }

    componentDidUpdate(prevProps, prevState) {
        const dd = this.state.dd;
        const mm = this.state.mm;
        const yyyy = this.state.yyyy;

        if (prevState.dd !== dd || prevState.mm !== mm || prevState.yyyy !== yyyy) {
            const promise_split_list = getData(
                'stock-split',
                is_local ? null : `https://www.jefflevesque.com/artifact/stock-market/stock-split/${yyyy}/${mm}/${dd}.csv`
            );

            Promise.all([promise_split_list]).then((v) => {
                const split_list = v[0];

                const dedup_split_list = [...split_list.reduce(
                    (map, obj) => map.set(obj.ticker, trim(obj)), new Map()
                ).values()];

                {/*

                    @intersection, merge two array of objects on common ticker and
                          Symbol column, then filter if contain 'split_ratio'

                    @exclusion, get split-list objects not in intersection

                    @split_list_combined, remove Name column from first array(obj),
                        add Industry, Sector column if not exist to second array(obj)

                */}

                const intersection = this.state.tickers.map(itm => ({
                    ...dedup_split_list.find((item) => (item.ticker === itm.Symbol) && item),
                    ...itm
                })).filter(
                    obj => Object.keys(obj).includes('split_ratio')
                );

                const exclusion = dedup_split_list.filter(i => {
                    if (checkValidObject('ticker', i)) {
                        return !intersection.map(a => a.ticker).includes(i.ticker);
                    }
                });

                const split_list_combined = [
                    ...intersection.map(({Name, ticker, ...keep}) => keep),
                    ...exclusion.map((object) => {
                        if (!('Industry' in object)) {
                            object.Industry = 'n/a';
                        }

                        if (!('Sector' in object)) {
                            object.Sector = 'n/a';
                        }

                        if ('ticker' in object) {
                            object.Symbol = object.ticker;
                        }

                        return object;
                    })
                ];

                {/*

                    Note: remap structure is required by ArticleListing component

                */}

                const remap_split_list = split_list_combined.map(v => {
                    if (
                        v.split_date
                        && parseInt(v.split_date.split('/')[0]) === parseInt(mm)
                        && parseInt(v.split_date.split('/')[1]) === parseInt(dd)
                        && parseInt(v.split_date.split('/')[2]) === parseInt(yyyy)
                    ) {
                        const stream = v.Sector !== 'n/a' && v.Industry !== 'n/a' ? 'StockMarket' : 'none';
                        return {
                            name: v.Symbol,
                            link: `data?item=${stream}&sector=${v.Sector}&industry=${v.Industry}&symbol=${v.Symbol}&ratio=${v.split_ratio}&date=${v.split_date}`,
                            detail: {
                                Ratio: v.split_ratio,
                                Date: v.split_date,
                                Stream: v.Sector !== 'n/a' && v.Industry !== 'n/a' ? 'StockMarket' : 'none',
                                Sector: v.Sector,
                                Industry: v.Industry
                            }
                        }
                    } else {
                        return null;
                    }
                });

                this.setState({ split_list: remap_split_list });
            });
        }
    }

    componentDidMount() {
        const action = setLayout({ layout: 'analysis' });
        this.props.dispatchLayout(action);

        {/*

            @promise_list_ticker_complete is the only promise flag variable,
                since other promises will generally complete by the time the
                user selects a different presentation type

        */}

        const dd = this.state.dd;
        const mm = this.state.mm;
        const yyyy = this.state.yyyy;

        {/*

            Note: when @is_local, pass no url so getData() serves its built-in
                  mock csv instead of fetching from AWS (which fails CORS from
                  localhost). This mirrors how data.jsx / stream.jsx gate on
                  is_local.

        */}

        const promise_nasdaq = getData(
            'ticker-nasdaq',
            is_local ? null : 'https://www.jefflevesque.com/artifact/ticker/nasdaq_100/2021-06-xx.csv'
        );
        const promise_custom = getData(
            'ticker-custom',
            is_local ? null : 'https://www.jefflevesque.com/artifact/ticker/custom.csv'
        );
        const promise_split_list = getData(
            'stock-split',
            is_local ? null : `https://www.jefflevesque.com/artifact/stock-market/stock-split/${yyyy}/${mm}/${dd}.csv`
        );

        Promise.all([promise_custom, promise_nasdaq, promise_split_list]).then((v) => {
            const tickers = [...v[0], ...v[1]];
            const split_list = v[2];

            const dedup_tickers = [...tickers.reduce(
                (map, obj) => map.set(obj.Symbol, trim(obj)), new Map()
            ).values()];

            const dedup_split_list = [...split_list.reduce(
                (map, obj) => map.set(obj.ticker, trim(obj)), new Map()
            ).values()];

            {/*

                @intersection, merge two array of objects on common ticker and
                      Symbol column, then filter if contain 'split_ratio'

                @exclusion, get split-list objects not in intersection

                @split_list_combined, remove Name column from first array(obj),
                    add Industry, Sector column if not exist to second array(obj)

            */}

            const intersection = dedup_tickers.map(itm => ({
                ...dedup_split_list.find((item) => (item.ticker === itm.Symbol) && item),
                ...itm
            })).filter(
                obj => Object.keys(obj).includes('split_ratio')
            );

            const exclusion = dedup_split_list.filter(i => {
                if (checkValidObject('ticker', i)) {
                    return !intersection.map(a => a.ticker).includes(i.ticker);
                }
            });

            const split_list_combined = [
                ...intersection.map(({Name, ticker, ...keep}) => keep),
                ...exclusion.map((object) => {
                    if (!('Industry' in object)) {
                        object.Industry = 'n/a';
                    }

                    if (!('Sector' in object)) {
                        object.Sector = 'n/a';
                    }

                    if ('ticker' in object) {
                        object.Symbol = object.ticker;
                    }

                    return object;
                })
            ];

            {/*

                Note: remap structure is required by ArticleListing component

            */}

            const remap_split_list = split_list_combined.map(v => {
                if (
                    v.split_date
                    && parseInt(v.split_date.split('/')[0]) === parseInt(mm)
                    && parseInt(v.split_date.split('/')[1]) === parseInt(dd)
                    && parseInt(v.split_date.split('/')[2]) === parseInt(yyyy)
                ) {
                    const stream = v.Sector !== 'n/a' && v.Industry !== 'n/a' ? 'StockMarket' : 'none';
                    return {
                        name: v.Symbol,
                        link: `data?item=${stream}&sector=${v.Sector}&industry=${v.Industry}&symbol=${v.Symbol}&ratio=${v.split_ratio}&date=${v.split_date}`,
                        detail: {
                            Ratio: v.split_ratio,
                            Date: v.split_date,
                            Stream: stream,
                            Sector: v.Sector,
                            Industry: v.Industry
                        }
                    }
                } else {
                    return null;
                }
            });

            this.setState({
                tickers: dedup_tickers,
                split_list: remap_split_list,
                promise_custom: promise_custom,
                promise_nasdaq: promise_nasdaq,
                promise_list_ticker_complete: true
            });
        });
    }

    render() {
        {/*

            @animation, the frontpage backdrop. The knowledge-graph cluster
                (GraphCluster) draws one ball per node type from the pyg
                graph_schema mock, clustered by edge topology and reactive to
                the cursor.

        */}

        const animation = this.state.display == 'stock-market'
            ? <GraphCluster />
            : null;

        const filter_column = this.state.display == 'summary'
            ? this.filterColumn('expanded', true)
            : null;

        const left_column = ! this.state.hide_all && this.state.display == 'summary'
            ? this.filterColumn()
            : null;

        const list_article_stream = [{
            'name': 'StockMarket',
            'link': 'stream?item=StockMarket&rate=minute',
            'detail': {'Health': '98%', 'Rate': 'minute', 'Stream Total': 'n/a'}
        }];
        const list_stream = ! this.state.hide_all && this.state.display == 'summary' && this.state.display_stock_stream
            ? <div className='article-stream'><ArticleListing title='Streams' left_column={false} list_drop={['None', 'A-Z', 'Health']} list_article={list_article_stream} stream_labels={true} /></div>
            : null;

        const list_split = ! this.state.hide_all && this.state.display == 'summary' && this.state.display_stock_split
            ? <div className='article-stock-split'><ArticleListing title='Stock Split' left_column={false} list_drop={['None', 'A-Z', 'Ratio']} list_article={this.state.split_list} /></div>
            : null;

        const horizontal_checkbox = this.state.horizontal_checkbox
            ? this.horizontalCheckbox()
            : null

        return (
            <div className='main-full-span home'>
                {animation}
                <div className='row'>
                    {filter_column}
                    {left_column}
                    <div className='col listing'>
                        {list_stream}
                        {list_split}
                    </div>
                </div>
                {horizontal_checkbox}
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default HomePage;
