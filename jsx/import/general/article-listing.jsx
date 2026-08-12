/**
 * article-list.jsx: dynamically render list of html articles.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import { setStockSplitProp } from '../redux/action/article.jsx';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import { NavLink } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import checkValidObject from '../validator/valid-object.js';
import checkValidString from '../validator/valid-string.js';
import checkValidArray from '../validator/valid-array.js';
import checkValidFloat from '../validator/valid-float.js';
import streamName from './stream-name.js';
import SvgOrder from '../svg/svg-order.jsx';

class ArticleListing extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        title: PropTypes.string,
        section_tags: PropTypes.array,
        stream_labels: PropTypes.bool,
        dispatchArticleProp: PropTypes.func
    }

    constructor() {
        super();
        this.state = {
            list_drop: ['A-Z', 'None'],
            list_article: [{'name': 'StockMarket', 'link': '#', 'detail': {'Health': '98%', 'Rate': 'minute', 'Stream Total': 'n/a'}}],
            list_article_original: [{'name': 'StockMarket', 'link': '#', 'detail': {'Health': '98%', 'Rate': 'minute', 'Stream Total': 'n/a'}}],
            left_column: true,
            search_text: '',
            search_column: 'name',
            active_listing: [],
            active_dropdown: [],
            listing_ascend: true,
            selected_sort: null,
            loader: null,
            control_tray: null
        };

        this.layout = this.layout.bind(this);
        this.renderDetail = this.renderDetail.bind(this);
        this.leftColumn = this.leftColumn.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.sorter = this.sorter.bind(this);
        this.search = this.search.bind(this);
        this.reformatDate = this.reformatDate.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        const active_class = `active_${this.props.name}`;

        if (
            'list_article' in this.props
            && checkValidArray('list_article', this.props)
            && 'list_article' in prevProps
            && checkValidArray('list_article', prevProps)
            && this.props.list_article != prevProps.list_article
        ) {
            //
            // copied, not aliased: state must not share the caller's array, or any
            // later reordering reaches back into the parent's own state.
            //
            this.setState({ list_article: Object.assign([], this.props.list_article) });
            this.setState({ list_article_original: Object.assign([], this.props.list_article) });
        }

        if (
            'name' in this.props
            && this.props.name
            && this.props.name !== 'n/a'
            && 'name' in prevProps
            && this.props.name !== prevProps.name
            && 'date' in this.props
            && this.props.date
            && 'date' in prevProps
            && this.props.date !== prevProps.date
        ) {
            const css_class = `${this.props.name}-${this.props.date.replaceAll('/', '_')}`;
            const active_class = `active_${css_class.replaceAll('-', '_')}`;
            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        } else if (
            'selected_identifier' in this.props
            && this.props.selected_identifier
            && 'selected_identifier' in prevProps
            && this.props.selected_identifier !== prevProps.selected_identifier
        ) {
            const active_class = `active_${this.props.selected_identifier}`;

            this.state.active_listing.forEach(v => {
                if (v in this.state) {
                    this.setState({ [v]: '' });
                }
            });

            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        } else if (
            'name' in this.props
            && this.props.name
            && 'name' in prevProps
            && this.props.name !== prevProps.name
        ) {
            this.state.active_listing.forEach(v => {
                if (v in this.state) {
                    this.setState({ [v]: '' });
                }
            });

            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        }
    }

    componentDidMount() {
        if (checkValidArray('list_article', this.props)) {
            // copied rather than aliased -- see the note in componentDidUpdate
            this.setState({ list_article: Object.assign([], this.props.list_article) });

            {/*

                Note: creates new object, otherwise this.state list_article_original
                      will always reference same object this.state.list_article

                    - https://stackoverflow.com/a/40133624

            */}
            this.setState({ list_article_original: Object.assign([], this.props.list_article) });
        }

        if ('left_column' in this.props && typeof this.props.left_column === 'boolean') {
            this.setState({ left_column: this.props.left_column });
        }

        if ('search_column' in this.props && typeof this.props.search_column === 'string') {
            this.setState({ search_column: this.props.search_column });
        }

        if (
            'name' in this.props
            && this.props.name !== 'n/a'
            && 'date' in this.props
            && this.props.date
            && !('selected_identifier' in this.props)
        ) {
            const css_class = `${this.props.name}-${this.props.date.replaceAll('/', '_')}`;
            const active_class = `active_${css_class.replaceAll('-', '_')}`;
            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        } else if (
            'selected_identifier' in this.props
            && this.props.selected_identifier !== 'n/a'
        ) {
            const active_class = `active_${this.props.selected_identifier}`;

            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        } else if (
            'name' in this.props
            && this.props.name !== 'n/a'
        ) {
            const active_class = `active_${this.props.name}`;
            this.setState({
                [active_class]: 'highlight',
                active_listing: [...this.state.active_listing, active_class]
            });
        }
    }

    reformatDate(value) {
        try {
            const arr = value.split('/');
            return(`${arr[0]}/${arr[1]}/${arr[2].slice(-2)}`);
        } catch (error) {
            console.log(`Error: article-listing could not reformatDate with ${value}`);
            return(value);
        }
    }

    renderDetail(obj) {
        if (checkValidObject('detail', obj)) {
            //
            // a COPY: the pruning below uses 'delete', and this used to run against the
            // caller's own object -- an element of its list_article -- so merely
            // rendering a row permanently stripped its blank fields from the data the
            // caller still held.
            //
            let detail = { ...obj.detail };

            if (Object.keys(detail).length === 0) {
                return null;

            } else {
                Object.keys(detail).forEach((k) => {
                    if (typeof detail[k] === 'undefined' || detail[k] === null) {
                        delete detail[k];
                    } else if ((typeof detail[k] === 'string' || detail[k] instanceof String) && detail[k].trim() === '') {
                        delete detail[k];
                    }
                });

                if (Object.keys(detail).length > 0) {
                    {/*

                        the ':' separator lives in css ('.key:after') rather than as a
                        text node between the key and value spans. on a narrow viewport
                        '.detail' becomes a two-column grid and '.detail-pair' is
                        'display: contents', so key and value are addressed as grid
                        items directly -- a bare ': ' text node would land in a cell of
                        its own and break the column alignment

                    */}
                    return(
                        <div className='detail'>
                            {
                                Object.entries(detail).map(
                                    (t,k) => (
                                        <span className='detail-pair' key={k}>
                                            {k > 0 && <span className='bullet'>•</span>}
                                            <span className='key'>{t[0]}</span>
                                            <span className='value'>
                                                {
                                                    t[0].toLowerCase() === 'date'
                                                        ? this.reformatDate(t[1])
                                                        : t[1]
                                                }
                                            </span>
                                        </span>
                                    )
                                )
                            }
                        </div>
                    );
                }
            }
        }
        return null;
    }

    sorter(key, ascend=true) {
        return function(a, b) {
            // sort null after anything else
            if (a === null) {
                return 1
            }
            if (b === null) {
                return -1;
            }

            const x1 = Number.isFinite(a[key]) ? a[key] : a[key].toUpperCase();
            const x2 = Number.isFinite(b[key]) ? b[key] : b[key].toUpperCase();

            // items sort equally
            if (x1 === x2) { return 0 }

            // lowest sorts first
            if (ascend) {
                return x1 < x2 ? -1 : 1;
            }

            // highest sorts first
            return x1 < x2 ? 1 : -1;
        }
    }

    handleSelect(e, type=null) {
        if (type && type === 'order') {
            var listing_ascend = !this.state.listing_ascend
            this.setState({ listing_ascend: listing_ascend });
        } else {
            var listing_ascend = this.state.listing_ascend;
        }

        this.setState({ selected_sort: e });
        //
        // 'toLowerCase' on both sides -- the second test read
        // 'e.toUpperCase() === "name"', which can never be true, so a caller offering a
        // 'Name' option fell past every branch to the final else. That sorts on the raw
        // label as a field name, no entry has a 'Name' key, and the comparator then read
        // .toUpperCase() of undefined and took the whole listing down.
        //
        if (e.toLowerCase() === 'a-z' || e.toLowerCase() === 'name') {
            this.setState({
                //
                // sorted on a COPY. '.sort()' reorders in place, and state.list_article
                // was the caller's own array, so choosing a sort rewrote the parent's
                // data -- outside setState, where nothing would notice.
                //
                list_article: [...this.state.list_article].sort(this.sorter('name', listing_ascend))
            });

        } else if (e.toLowerCase() === 'none') {
            {/*

                Note: creates new object, otherwise this.state list_article_original
                      will always reference same object this.state.list_article

                    - https://stackoverflow.com/a/40133624

            */}
            this.setState({
                list_article: Object.assign([], this.state.list_article_original)
            });

        } else if (e.toLowerCase() === 'ratio') {
            const list_article = this.state.list_article.map(v =>
                (
                    checkValidObject('detail', v) ? {
                        name: v.name,
                        temp: v.detail.Ratio.includes(':') ? v.detail.Ratio.split(':')[0] / v.detail.Ratio.split(':')[1] : v.detail.Ratio,
                        detail: v.detail,
                        link: 'link' in v && checkValidString(v.link) ? v.link : null,
                        performance: 'performance' in v && checkValidObject('performance', v) ? v.performance : null,
                        type: 'type' in v && checkValidString(v.type) ? v.type : null
                    } : null
                )
            ).sort(this.sorter('temp', listing_ascend));

            this.setState({ list_article: list_article });

        } else if (e.toLowerCase() === 'date') {
            const list_article = this.state.list_article.map(v =>
                (
                    checkValidObject('detail', v) ? {
                        name: v.name,
                        temp: v.detail.Date,
                        detail: v.detail,
                        link: 'link' in v && checkValidString(v.link) ? v.link : null,
                        performance: 'performance' in v && checkValidObject('performance', v) ? v.performance : null,
                        type: 'type' in v && checkValidString(v.type) ? v.type : null
                    } : null
                )
            ).sort(this.sorter('temp', listing_ascend));

            this.setState({ list_article: list_article });

        } else if (e.toLowerCase() === 'runtime') {
            const list_article = this.state.list_article.map(v =>
                (
                    checkValidObject('detail', v) ? {
                        name: v.name,
                        temp: v.detail.Runtime,
                        detail: v.detail,
                        link: 'link' in v && checkValidString(v.link) ? v.link : null,
                        performance: 'performance' in v && checkValidObject('performance', v) ? v.performance : null,
                        type: 'type' in v && checkValidString(v.type) ? v.type : null
                    } : null
                )
            ).sort(this.sorter('temp', listing_ascend));

            this.setState({ list_article: list_article });

        } else if (['health', 'coverage'].includes(e.toLowerCase())) {
            {/*

                both read as a percentage string, so one branch sorts either.

                Note: a stream that cannot state one sits at 'n/a', which strips
                      to the empty string and reads back as 0 -- those sort to
                      the bottom rather than throwing, the way an unresolved
                      health figure always has

            */}

            const key = e.toLowerCase() === 'health' ? 'Health' : 'Coverage';
            const list_article = this.state.list_article.map(v =>
                (
                    checkValidObject('detail', v) ? {
                        name: v.name,
                        temp: Number(String(v.detail[key]).replace(/[^0-9.]/g, '')),
                        detail: v.detail,
                        link: 'link' in v && checkValidString(v.link) ? v.link : null,
                        performance: 'performance' in v && checkValidObject('performance', v) ? v.performance : null,
                        type: 'type' in v && checkValidString(v.type) ? v.type : null
                    } : null
                )
            ).sort(this.sorter('temp', listing_ascend));

            this.setState({ list_article: list_article });

        } else {
            this.setState({
                list_article: [...this.state.list_article].sort(this.sorter(e, listing_ascend))
            });
        }
    }

    leftColumn() {
        if (this.state.left_column) {
            return(
                <div className='col-md-3 d-none d-md-block article-tags'>
                    <section>
                        <article>tag section</article>
                    </section>
                </div>
            );
        } else {
            return null;
        }
    }

    search(search_text) {
        const search_column = this.state.search_column;
        this.setState({ search_text: search_text });

        if (checkValidString(search_text)) {
            const list_article = Object.assign([], this.props.list_article);
            const results = list_article.filter(function(v) {
                return v !== null
                    && checkValidObject(search_column, v)
                    && v[search_column].toLowerCase().trim().includes(search_text.toLowerCase().trim());
            });
            this.setState({ list_article: results });

        } else {
            this.setState({ list_article: Object.assign([], this.props.list_article) });
        }
    }

    layout() {
        const left_column = this.leftColumn();
        const title = 'title' in this.props
            ? this.props.title
            : 'Listing';

        const list_drop = 'list_drop' in this.props ? this.props.list_drop : this.state.list_drop;
        let list_drop_elements = list_drop.map((item, index) => {
            const active_dropdown = `article-${item}-${index}`;
            return (
                <Dropdown.Item
                    as='button'
                    key={index}
                    eventKey={item}
                    className={active_dropdown in this.state && this.state[active_dropdown] || ''}
                    onClick={(e) => {
                        if (this.state.active_dropdown.indexOf(active_dropdown) < 0) {
                            this.setState({ active_dropdown: [...this.state.active_dropdown, active_dropdown] });
                        }

                        this.state.active_dropdown.forEach(v => {
                            if (v in this.state) {
                                this.setState({ [v]: '' });
                            }
                        });
                        this.setState({ [active_dropdown]: 'active' });
                    }
                }>
                    {item}
                </Dropdown.Item>
            );
        });

        {/*

            opt-in, because this component also lists TICKERS (the home-page
            stock-split column, whose names are symbols like 'crwd' or 'abtc').
            mapping unconditionally would rewrite any ticker that collides with
            a stream id -- a symbol 'bls' would render as 'Bureau of Labor
            Statistics'. only the callers passing a list of streams opt in

        */}
        const label = this.props.stream_labels
            ? streamName
            : (name) => name;

        let list_article = this.state.list_article.map((item, index)=>{
            const content = this.renderDetail(item);
            const link = checkValidObject('link', item) && checkValidString(item.link) && item.link !== '#'
                ? item.link
                : '#';

            if (content) {
                if ('detail' in item && 'Date' in item.detail) {
                    const css_class = `${item.name}-${item.detail.Date.replaceAll('/', '_')}`;
                    var active_class = `active_${css_class.replaceAll('-', '_')}`.toLowerCase();
                } else {
                    var active_class = `active_${item.name}`.toLowerCase();
                }

                const loader = 'loader' in item && item.loader
                    ? <span style={{ marginLeft: '3px' }}>{item.loader}</span>
                    : null;

                const control_tray = 'control_tray' in item && item.control_tray
                    ? item.control_tray
                    : null;

                const style = 'article-link shadow-sm';
                const content = control_tray
                    ? (
                        <div
                            className={`${style} ${active_class in this.state && this.state[active_class] || ''}`}
                            key={index}
                            onClick={(e) => {
                                if (
                                    'type' in item
                                    && item.type === 'stock-split'
                                    && 'performance' in item
                                ) {
                                    const action = setStockSplitProp({
                                        article: {
                                            type: item.type,
                                            ticker: item.name,
                                            date: item.detail.Date,
                                            clicked: true,
                                            started_on: 'started_on' in item.performance ? item.performance.started_on : 'n/a',
                                            completed_on: 'completed_on' in item.performance ? item.performance.completed_on : 'n/a',
                                            retry: 'retry' in item.performance ? item.performance.retry : 'n/a',
                                            expected_runtime: 'expected_runtime' in item.performance && checkValidFloat(item.performance.expected_runtime)
                                                ? item.performance.expected_runtime
                                                : 'n/a',
                                            actual_runtime: 'actual_runtime' in item.performance && checkValidFloat(item.performance.actual_runtime)
                                                ? item.performance.actual_runtime
                                                : 'n/a'
                                        }
                                    });
                                    this.props.dispatchArticleProp(action);
                                }
                            }}
                        >
                            <article>
                                <header>
                                    {/* label only -- item.name stays the id for the css class, deep link and ticker prop */}
                                    <h6 style={{ display: 'inline-block' }}>{label(item.name)}</h6>
                                    {loader}
                                    {control_tray}
                                </header>
                                <div>{this.renderDetail(item)}</div>
                            </article>
                        </div>
                    ) : (
                        <NavLink
                            className={`${style} ${active_class in this.state && this.state[active_class] || ''}`}
                            to={link}
                            key={index}
                            onClick={(e) => {
                                if (
                                    'type' in item
                                    && item.type === 'stock-split'
                                    && 'performance' in item
                                ) {
                                    const action = setStockSplitProp({
                                        article: {
                                            type: item.type,
                                            ticker: item.name,
                                            date: item.detail.Date,
                                            clicked: true,
                                            started_on: 'started_on' in item.performance ? item.performance.started_on : 'n/a',
                                            completed_on: 'completed_on' in item.performance ? item.performance.completed_on : 'n/a',
                                            retry: 'retry' in item.performance ? item.performance.retry : 'n/a',
                                            expected_runtime: 'expected_runtime' in item.performance && checkValidFloat(item.performance.expected_runtime)
                                                ? item.performance.expected_runtime
                                                : 'n/a',
                                            actual_runtime: 'actual_runtime' in item.performance && checkValidFloat(item.performance.actual_runtime)
                                                ? item.performance.actual_runtime
                                                : 'n/a'
                                        }
                                    });
                                    this.props.dispatchArticleProp(action);
                                }
                            }}
                        >
                            <article>
                                <header>
                                    {/* label only -- item.name stays the id for the css class, deep link and ticker prop */}
                                    <h6 style={{ display: 'inline-block' }}>{label(item.name)}</h6>
                                </header>
                                <div>{this.renderDetail(item)}</div>
                            </article>
                        </NavLink>
                    )

                return content;
            } else {
                return null;
            }
        }).filter(function(v) { return v != null });

        return(
            <>
                <div className='row'>
                    {left_column}
                    <div className='col'>
                        <div className='row'>
                            <div className={isMobile ? 'col article-heading' : 'col-md-2 article-heading'}>
                                <h5>{title}</h5>
                                <span className='title-count'>{list_article.length}</span>
                            </div>
                            <div className='col-sm-6 article-heading'>
                                <div className='input-group flex-nowrap'>
                                    <span className='input-group-text' id='addon-wrapping'>@</span>
                                    <input
                                        type='text'
                                        className='form-control'
                                        placeholder={`Filter by ${this.state.search_column}`}
                                        onChange={ (text) => this.search(text.target.value) }
                                        value={this.state.search_text}
                                        aria-label='Name'
                                        aria-describedby='addon-wrapping'
                                    />
                                </div>
                            </div>
                            <div className='col article-heading'>
                                <div className='row'>
                                    <div className='col-9 col-sm-7 col-md-7'>
                                        <DropdownButton id='dropdown-item-button' title='Sort' onSelect={this.handleSelect}>
                                            {list_drop_elements}
                                        </DropdownButton>
                                    </div>
                                    <div className='col-3 col-sm-5 col-md-5 svg-order'>
                                        <button className='btn' type='button' onClick={() => {
                                            if (this.state.selected_sort) {
                                                this.handleSelect(this.state.selected_sort, 'order');
                                            }
                                        }}>
                                            <SvgOrder ascend={this.state.listing_ascend} hover_bg={false} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='row'>
                            <div className='col'>
                                <section className='article-listing col'>{list_article}</section>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    render() {
        const content = this.layout();
        return (
            <div className='articles'>{content}</div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ArticleListing;
