/**
 * listing-table.jsx: a listing drawn as a table -- a row per stream, a column per
 * figure -- for a page whose rows all carry the same figures, as /data's do.
 *
 * As cards, each row said its labels again in a line of its own, so no figure
 * sat under the one above it and a column could not be read down the page. Here
 * the labels are said once, in the header, and each figure keeps to its column,
 * right-aligned where it is a number.
 *
 * Below the large viewport the same table stacks into cards, one per row, each
 * figure under its own label -- see '_article.scss'. Nothing here knows which of
 * the two is on screen: the header sorts a wide page, and the sort menu, shown
 * only on a narrow one, sorts it the same way.
 *
 * The reader can drag the rows into an order of their own, by the grip at the
 * start of each. The page keeps that order -- see listing-preference.js -- and
 * hands it back as `order`. It is the order the rows take before any sort, and
 * the one a sort goes back to.
 *
 * Note: the grips show only while the rows are in the reader's order. Sorted or
 *       filtered, a drag would reorder a view the reader did not arrange.
 *
 * Note: a drag is framer-motion's Reorder, already here for the phone's bottom
 *       sheet, and it starts from the grip alone -- so on a phone, a swipe
 *       anywhere else on a row scrolls the page. The grip is a button, and the
 *       arrow keys on it move its row, for a reader without a pointer.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Reorder, DragControls } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

//
// the name column's key, for sorting by the name. A detail's own keys are its
// labels -- 'Health', 'Total Records' -- which this can never be.
//
const NAME = '$name';

//
// what a figure sorts by: its number where it starts with one, and its text,
// case aside, where it does not. Null for a figure that holds nothing -- 'n/a',
// a blank -- which sorts after everything, whichever way round.
//
// Note: the number is read off the front of the figure, so the page's own
//       formatting sorts as it reads: '1,284,113' by its separators, '99.6%' by
//       its percent, and bls's '0 (unpublished)' as the 0 it is.
//
export function sortValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    if (!text || text.toLowerCase() === 'n/a') {
        return null;
    }

    const figure = text.match(/^-?(\d[\d,]*)?\.?\d+/);

    if (figure) {
        const number = Number(figure[0].replace(/,/g, ''));

        if (Number.isFinite(number)) {
            return number;
        }
    }

    return text.toLowerCase();
}

//
// the order of two figures, `direction` 'ascending' or 'descending': numbers
// before text, and an empty figure last either way.
//
export function compareFigures(a, b, direction) {
    const x = sortValue(a);
    const y = sortValue(b);

    if (x === null || y === null) {
        return x === y ? 0 : (x === null ? 1 : -1);
    }

    if (typeof x !== typeof y) {
        return typeof x === 'number' ? -1 : 1;
    }

    if (x === y) {
        return 0;
    }

    const order = x < y ? -1 : 1;

    return direction === 'descending' ? -order : order;
}

//
// a figure's value is empty when there is nothing to show -- a lag /data does not
// have for the stream, say -- as against 'n/a', which is a figure not measured
// yet, and is shown as it is.
//
function empty(value) {
    return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}

class ListingTable extends Component {
    static propTypes = {
        title: PropTypes.string,
        name_label: PropTypes.string,
        columns: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            numeric: PropTypes.bool,
            sortable: PropTypes.bool,
            pill: PropTypes.bool,
            on: PropTypes.string,
        })).isRequired,
        rows: PropTypes.array,
        selected: PropTypes.string,
        order: PropTypes.arrayOf(PropTypes.string),
        onReorder: PropTypes.func,
        label: PropTypes.func,
        //
        // anything the page puts at the end of the title row -- the month, on
        // a phone's /data (#165)
        //
        actions: PropTypes.node,
    }

    static defaultProps = {
        title: 'Listing',
        name_label: 'Name',
        rows: [],
        selected: null,
        order: null,
        onReorder: null,
        label: (name) => name,
        actions: null,
    }

    constructor(props) {
        super(props);

        this.state = {
            query: '',
            sort: null,
            announcement: '',
        };

        //
        // a row's drag controls, by its name, so its grip can start a drag of the
        // row it sits in. Kept for the life of the table: a row's controls must be
        // the same object from one render to the next.
        //
        this.controls = new Map();

        //
        // the table's body, which a dragged row is held inside -- see row()
        //
        this.body = React.createRef();

        this.reorder = this.reorder.bind(this);
        this.search = this.search.bind(this);
        this.choose = this.choose.bind(this);
    }

    //
    // the rows the page gave, with a name and a detail each
    //
    named() {
        return (this.props.rows || []).filter((row) => (
            row && typeof row.name === 'string' && row.detail && typeof row.detail === 'object'
        ));
    }

    //
    // the rows in the reader's order, or the page's where they have made none.
    // A row the order does not name keeps its place among the rest, at the end.
    //
    ordered() {
        const rows = this.named();
        const order = this.props.order;

        if (!Array.isArray(order)) {
            return rows;
        }

        const at = (row) => {
            const index = order.indexOf(row.name);

            return index < 0 ? order.length : index;
        };

        return [...rows].sort((a, b) => at(a) - at(b));
    }

    //
    // the rows on screen: the reader's order, narrowed by the filter, and sorted
    // when a sort is on. The filter matches the name as shown ('S&P 500') and the
    // stream's id ('stock-market') alike.
    //
    shown() {
        const query = this.state.query.trim().toLowerCase();
        const sort = this.state.sort;
        let rows = this.ordered();

        if (query) {
            rows = rows.filter((row) => (
                row.name.toLowerCase().includes(query)
                || String(this.props.label(row.name)).toLowerCase().includes(query)
            ));
        }

        if (sort) {
            const value = (row) => (sort.key === NAME ? this.props.label(row.name) : row.detail[sort.key]);

            rows = [...rows].sort((a, b) => compareFigures(value(a), value(b), sort.direction));
        }

        return rows;
    }

    //
    // whether the reader's order differs from the page's, which is when there is
    // an order to reset
    //
    customized() {
        if (!Array.isArray(this.props.order)) {
            return false;
        }

        const own = this.named().map((row) => row.name);

        return this.ordered().some((row, index) => row.name !== own[index]);
    }

    //
    // a header's click: ascending, then descending, then back to the reader's own
    // order
    //
    sortBy(key) {
        const sort = this.state.sort;

        if (!sort || sort.key !== key) {
            this.setState({ sort: { key: key, direction: 'ascending' } });
        } else if (sort.direction === 'ascending') {
            this.setState({ sort: { key: key, direction: 'descending' } });
        } else {
            this.setState({ sort: null });
        }
    }

    //
    // the sort menu's choice, as 'key|direction', or '' for the reader's order
    //
    choose(event) {
        const [key, direction] = event.target.value.split('|');

        this.setState({ sort: key ? { key: key, direction: direction } : null });
    }

    search(event) {
        this.setState({ query: event.target.value });
    }

    //
    // a new order of the names on screen, from a drag or from the arrow keys.
    // The grips only show while every row is on screen in the reader's order, so
    // this is always the whole of it.
    //
    reorder(names) {
        if (this.props.onReorder) {
            this.props.onReorder(names);
        }
    }

    //
    // one row, `step` places up or down, and said aloud where it went
    //
    move(name, step) {
        const names = this.ordered().map((row) => row.name);
        const from = names.indexOf(name);
        const to = from + step;

        if (from < 0 || to < 0 || to >= names.length) {
            return;
        }

        names.splice(to, 0, names.splice(from, 1)[0]);

        this.reorder(names);
        this.setState({ announcement: `${this.props.label(name)}, ${to + 1} of ${names.length}` });
    }

    gripKey(event, name) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.move(name, event.key === 'ArrowUp' ? -1 : 1);
        }
    }

    control(name) {
        if (!this.controls.has(name)) {
            this.controls.set(name, new DragControls());
        }

        return this.controls.get(name);
    }

    //
    // a header that sorts: its name, and an arrow for the way it is sorted, or a
    // faint pair of them while it is not
    //
    header(key, text) {
        const sort = this.state.sort;
        const on = !!sort && sort.key === key;
        const Arrow = !on
            ? UnfoldMoreIcon
            : (sort.direction === 'ascending' ? ArrowUpwardIcon : ArrowDownwardIcon);

        return (
            <button
                type='button'
                className={on ? 'listing-table-sort listing-table-sorted' : 'listing-table-sort'}
                onClick={() => this.sortBy(key)}
            >
                {text}
                <Arrow className='listing-table-arrow' />
            </button>
        );
    }

    ariaSort(key) {
        const sort = this.state.sort;

        return sort && sort.key === key ? sort.direction : 'none';
    }

    //
    // what a cell shows for `value`
    //
    cell(column, value) {
        if (empty(value)) {
            return (
                <>
                    <span className='listing-table-empty' aria-hidden='true'>{'—'}</span>
                    <span className='visually-hidden'>none</span>
                </>
            );
        }

        const text = String(value);

        {/*

            a column with an 'on' value draws it as a green pill, and any other
            value as a gray one (#167) -- /data's RDF 'None' was plain text
            beside the green 'Available' pills, and read as a value missing
            rather than as the answer

        */}
        if (typeof column.on === 'string') {
            return text === column.on
                ? <span className='listing-table-pill listing-table-pill-on'>{text}</span>
                : <span className='listing-table-pill'>{text}</span>;
        }

        if (column.pill) {
            return <span className='listing-table-pill'>{text}</span>;
        }

        {/*

            a figure with a note on it -- bls's '0 (unpublished)' -- puts the note
            in front, so the figure itself stays at the right edge, lined up with
            the figures above and below it

        */}
        const noted = column.numeric ? text.match(/^(.*\S)\s+\((.+)\)$/) : null;

        if (noted) {
            return (
                <>
                    <span className='listing-table-note'>{noted[2]}</span> {noted[1]}
                </>
            );
        }

        return text;
    }

    //
    // the columns some rows have nothing in -- a lag only bls has, a coverage
    // only the stock streams have. A card sets them after the ones every row
    // has (#167), so the facts every card shares sit in the same places on
    // each, rather than moving along wherever a card leaves one out.
    //
    // Note: read from every row the page gave rather than the rows on screen,
    //       so narrowing the listing with the filter never moves a fact.
    //
    partial() {
        const rows = this.named();

        return new Set(this.props.columns
            .filter((column) => rows.some((row) => empty(row.detail[column.key])))
            .map((column) => column.key));
    }

    row(row, draggable) {
        const { columns, label, selected, onReorder } = this.props;
        const name = label(row.name);
        const partial = this.partial();

        const cells = (
            <>
                {onReorder ? (
                    <td className='listing-table-grip'>
                        {draggable ? (
                            <button
                                type='button'
                                className='listing-table-grip-button'
                                aria-label={`Move ${name}`}
                                title='Drag to move, or use the arrow keys'
                                onPointerDown={(event) => this.control(row.name).start(event)}
                                onKeyDown={(event) => this.gripKey(event, row.name)}
                            >
                                <DragIndicatorIcon />
                            </button>
                        ) : null}
                    </td>
                ) : null}
                <th scope='row' className='listing-table-name'>
                    {name}
                    {row.loader ? <span className='listing-table-loader'>{row.loader}</span> : null}
                </th>
                {columns.map((column) => {
                    const value = row.detail[column.key];
                    const classes = [
                        column.numeric ? 'listing-table-numeric' : '',
                        empty(value) ? 'listing-table-blank' : '',
                        partial.has(column.key) ? 'listing-table-partial' : '',
                    ].filter(Boolean).join(' ');

                    //
                    // the value in a span of its own, so a card can set it under its
                    // label as one thing, however many pieces it is drawn in
                    //
                    return (
                        <td key={column.key} data-label={column.key} className={classes || undefined}>
                            <span className='listing-table-value'>{this.cell(column, value)}</span>
                        </td>
                    );
                })}
                <td className='listing-table-controls'>{row.control_tray || null}</td>
            </>
        );

        const className = row.name === selected ? 'listing-table-selected' : undefined;

        {/*

            a dragged row is held inside the table's body, with no give past its
            edges. The frame around the table scrolls sideways where a window is
            too narrow for it, which makes it a scroll box both ways -- and Chrome
            counts a row dragged out past the table as more to scroll, so the table
            grew a scrollbar of its own, longer the further the row went.

        */}
        return draggable ? (
            <Reorder.Item
                as='tr'
                key={row.name}
                value={row.name}
                dragListener={false}
                dragControls={this.control(row.name)}
                dragConstraints={this.body}
                dragElastic={0}
                className={className}
            >
                {cells}
            </Reorder.Item>
        ) : (
            <tr key={row.name} className={className}>{cells}</tr>
        );
    }

    //
    // the sort menu's choices: the reader's order, and each sortable column
    // both ways round
    //
    options() {
        const sortable = [
            { key: NAME, text: this.props.name_label, numeric: false },
            ...this.props.columns
                .filter((column) => column.sortable)
                .map((column) => ({ key: column.key, text: column.key, numeric: !!column.numeric })),
        ];

        return [
            <option key='' value=''>Your order</option>,
            ...sortable.flatMap((column) => [
                <option key={`${column.key}|ascending`} value={`${column.key}|ascending`}>
                    {`${column.text}, ${column.numeric ? 'low to high' : 'A to Z'}`}
                </option>,
                <option key={`${column.key}|descending`} value={`${column.key}|descending`}>
                    {`${column.text}, ${column.numeric ? 'high to low' : 'Z to A'}`}
                </option>,
            ]),
        ];
    }

    render() {
        const { columns, title, name_label, onReorder, actions } = this.props;
        const sort = this.state.sort;
        const rows = this.shown();
        const draggable = !!onReorder && !sort && !this.state.query.trim() && rows.length > 1;

        const body = rows.map((row) => this.row(row, draggable));

        return (
            <div className='articles listing-table'>
                <div className='listing-table-head'>
                    <div className={`listing-table-title${actions ? ' has-actions' : ''}`}>
                        <h5>{title}</h5>
                        <span className='title-count'>{rows.length}</span>
                        {actions ? <div className='listing-table-actions'>{actions}</div> : null}
                    </div>
                    <div className='listing-table-tools'>
                        {onReorder && this.customized() ? (
                            <button
                                type='button'
                                className='listing-table-reset'
                                onClick={() => this.reorder(null)}
                            >
                                <RestartAltIcon fontSize='inherit' />
                                Reset order
                            </button>
                        ) : null}
                        <label className='listing-table-filter'>
                            <span className='visually-hidden'>Filter by name</span>
                            <SearchIcon />
                            <input
                                type='search'
                                placeholder='Filter by name'
                                value={this.state.query}
                                onChange={this.search}
                            />
                        </label>
                        <label className='listing-table-menu'>
                            <span className='visually-hidden'>Sort</span>
                            <select
                                value={sort ? `${sort.key}|${sort.direction}` : ''}
                                onChange={this.choose}
                            >
                                {this.options()}
                            </select>
                            <ExpandMoreIcon />
                        </label>
                    </div>
                </div>
                <div className='listing-table-frame'>
                    <table>
                        <caption className='visually-hidden'>{title}</caption>
                        <thead>
                            <tr>
                                {onReorder ? (
                                    <th scope='col' className='listing-table-grip'>
                                        <span className='visually-hidden'>Order</span>
                                    </th>
                                ) : null}
                                <th scope='col' aria-sort={this.ariaSort(NAME)}>
                                    {this.header(NAME, name_label)}
                                </th>
                                {columns.map((column) => (
                                    <th
                                        scope='col'
                                        key={column.key}
                                        className={column.numeric ? 'listing-table-numeric' : undefined}
                                        aria-sort={column.sortable ? this.ariaSort(column.key) : undefined}
                                    >
                                        {column.sortable ? this.header(column.key, column.key) : column.key}
                                    </th>
                                ))}
                                <th scope='col' className='listing-table-controls'>
                                    <span className='visually-hidden'>Controls</span>
                                </th>
                            </tr>
                        </thead>
                        {draggable ? (
                            <Reorder.Group
                                as='tbody'
                                ref={this.body}
                                axis='y'
                                values={rows.map((row) => row.name)}
                                onReorder={this.reorder}
                            >
                                {body}
                            </Reorder.Group>
                        ) : (
                            <tbody>{body}</tbody>
                        )}
                    </table>
                </div>
                <div className='visually-hidden' aria-live='polite'>{this.state.announcement}</div>
            </div>
        );
    }
}

export default ListingTable;
export { NAME };
