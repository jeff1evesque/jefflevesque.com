/**
 * tables.jsx: everything in the build the canvas could not draw.
 *
 * The canvas carries sixty node types because sixty is the density a force
 * layout reads at, and the caption above it says so -- '60 of 151 node types'.
 * That sentence raised a question the page then had no way to answer. These two
 * tables are the answer: every node type and every edge type the selected build
 * holds, at a grain a canvas cannot show.
 *
 * Note: NO new request. The page already fetches the whole schema in order to
 *       draw a slice of it, and used to discard the rest on the line that
 *       measured it. This reads what was already in hand. See graph.jsx, which
 *       now keeps the unfiltered document alongside the filtered one.
 *
 * Note: NOT the `knowledge-graph/tables/*` api, which is the other thing called
 *       tables and is deliberately not used here. Those paths take no build id
 *       -- they answer across the published window -- so under a build picker
 *       their rows would read as belonging to the selected build when they do
 *       not. The schema in hand is exact for this build and cost nothing more.
 *
 * Note: it draws itself EMPTY while the build is on its way rather than not at
 *       all -- the controls, the column headings, a boxful of blank rows and
 *       the pager, so the bottom of the page is the shape it will be. See
 *       pending() below, and pending.jsx for the rest of the page doing the
 *       same thing.
 *
 * Note: colours come from the assignment the CANVAS made, handed down rather
 *       than recomputed. assignNamespaceColors ranks namespaces and deals out
 *       eight categorical slots, so the same namespace gets a different colour
 *       depending on which set it was ranked against -- recomputing here over
 *       all 151 types would paint swatches that disagree with the graph above
 *       them. A namespace that is not on the canvas therefore has no colour,
 *       and the swatch column says so by being empty.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import { sourceNamespace, originColor, ORIGIN_DASH } from '../../animation/encoding.js';
import { breakable } from '../../animation/graph-explorer.jsx';
import { PendingBar } from './pending.jsx';

const ROWS_PER_PAGE = [25, 50, 100];

//
// the two grains. Each names its own columns, how a row sorts on each, and what
// the filter box reads -- so the table itself is one component rendered twice
// rather than two that have to be kept looking alike.
//
// Note: 'category' is deliberately absent. It reads 'entity' for every node type
//       in a published build -- encoding.js says the same thing about it as a
//       colour channel -- while the committed mock fixture carries five values.
//       A column sourced from it looks informative in a test and empty in a
//       browser.
//
const TABS = [
    { key: 'nodes', label: 'Node types' },
    { key: 'edges', label: 'Edge types' },
];

//
// what each table heads its columns with, and how a row sorts on each.
//
// Module constants rather than two lists built inside the methods that render
// them, because the placeholder this component draws while the build is still
// on its way heads itself with the same names -- see pending() below. It is a
// table with no rows in it, and a table with neither rows nor headings is an
// empty box.
//
// 'pending' is the width that column's bar takes while there is nothing to put
// in it, chosen to be about what the real values measure: a type name is long,
// a count is short, and 'On canvas' is a single dot. Only the node columns
// carry one, because the placeholder is always the node table -- see pending().
//
const NODE_COLUMNS = [
    { key: 'id', label: 'Node type', pending: '11rem' },
    { key: 'count', label: 'Nodes', numeric: true, pending: '3.5rem' },
    { key: 'drawn', label: 'On canvas', pending: '0.6rem' },
    { key: 'uri', label: 'Ontology term', className: 'graph-tables-uri', pending: '15rem' },
];

const EDGE_COLUMNS = [
    { key: 'src', label: 'Edge type' },
    { key: 'count', label: 'Edges', numeric: true },
    { key: 'origin', label: 'Origin' },
];

//
// how many rows the placeholder stands in for: enough to fill the box the real
// table fills, and no more.
//
// '.graph-tables-scroll' stops at 32rem, which is 448px here, and the table
// that replaces this opens on 25 rows, which always reach it. A dense mui row is
// 30.5px -- a 17.5px line, 6px of padding either side and a 1px rule -- under a
// 34px heading, so the box holds thirteen and a half. A dozen used to be drawn,
// which left the placeholder 48px shorter than the table replacing it, and
// everything under it moved when the build landed.
//
// Note: fourteen OVERFILL the box, and the placeholder's box clips the last
//       rather than scrolling to it -- see '.graph-tables-pending' in
//       '_graph.scss'. Thirteen would stop short of the edge by half a row.
//
const PENDING_ROWS = 14;

/**
 * a long CamelCase type name, wrapped where a browser may break it.
 *
 * The longest name in a published build runs to sixty-six characters with no
 * space in it, so a cell left alone either overflows or is broken mid-word.
 * breakable() already solves this for the explorer's card and is imported rather
 * than repeated.
 */
function wrapped(name) {
    return breakable(String(name)).map((part, index) => (
        <React.Fragment key={index}>
            {index ? <wbr /> : null}
            {part}
        </React.Fragment>
    ));
}

function number(n) {
    return typeof n === 'number' ? n.toLocaleString() : 'n/a';
}

/**
 * the origin's own line, as the legend draws it.
 *
 * Note: the same colour and dash the canvas uses for that origin, from
 *       encoding.js. A second opinion about what 'enrichment' looks like is
 *       exactly what that module exists to prevent.
 */
function originMark(origin) {
    return (
        <svg className='graph-tables-origin' width='28' height='10' aria-hidden='true'>
            <line
                x1='0' y1='5' x2='28' y2='5'
                stroke={originColor(origin)}
                strokeWidth={origin === 'raw' ? 1 : 1.5}
                strokeDasharray={ORIGIN_DASH[origin] || undefined}
            />
        </svg>
    );
}

/**
 * the build's node types, as rows.
 *
 * `drawn` is the set the canvas is showing, so a reader can tell which sixty of
 * the hundred and fifty-one are the ones above.
 */
export function nodeRows(schema, drawn, painted) {
    if (!schema || !schema.node_types) {
        return [];
    }

    return Object.keys(schema.node_types).map((id) => {
        const meta = schema.node_types[id];
        const namespace = sourceNamespace(meta, id);

        return {
            key: id,
            id: id,
            namespace: namespace,
            colour: painted ? painted.get(namespace) : undefined,
            count: meta.count,
            uri: meta.source_type_uri || '',
            drawn: !!(drawn && drawn.has(id)),
            search: `${id} ${namespace} ${meta.source_type_uri || ''}`.toLowerCase(),
        };
    });
}

/**
 * the build's edge types, as rows.
 *
 * Note: keyed by the schema's own opaque key rather than by the triple. The
 *       triple is what a reader sees and it is not guaranteed unique, while the
 *       key is what the document is keyed by.
 */
export function edgeRows(schema) {
    if (!schema || !schema.edge_types) {
        return [];
    }

    return Object.keys(schema.edge_types).map((key) => {
        const edge = schema.edge_types[key];

        return {
            key: key,
            src: edge.src_type,
            relation: edge.relation,
            dst: edge.dst_type,
            count: edge.count,
            origin: edge.origin || '',
            search: `${edge.src_type} ${edge.relation} ${edge.dst_type} ${edge.origin || ''}`
                .toLowerCase(),
        };
    });
}

/**
 * rows matching the filter, ordered by the chosen column.
 *
 * Note: a stable comparison on the NUMERIC value where the column is numeric.
 *       Counts here span 1 to 10,267,904, and sorting them as text puts 9 above
 *       10,000,000 -- which looks like a broken table rather than a wrong sort.
 */
export function arrange(rows, query, sort) {
    const needle = String(query || '').trim().toLowerCase();
    const found = needle ? rows.filter((row) => row.search.includes(needle)) : rows.slice();

    if (!sort || !sort.key) {
        return found;
    }

    const direction = sort.direction === 'asc' ? 1 : -1;

    return found.sort((a, b) => {
        const left = a[sort.key];
        const right = b[sort.key];

        if (typeof left === 'number' && typeof right === 'number') {
            return (left - right) * direction;
        }
        if (typeof left === 'boolean' && typeof right === 'boolean') {
            return ((left ? 1 : 0) - (right ? 1 : 0)) * direction;
        }

        return String(left).localeCompare(String(right)) * direction;
    });
}

class GraphTables extends Component {
    static propTypes = {
        schema: PropTypes.shape({
            node_types: PropTypes.object,
            edge_types: PropTypes.object,
        }),
        // the FILTERED schema -- the slice the canvas drew -- rather than a Set
        // of its ids. A caller building the Set inline would hand this a new
        // object every render and defeat the row cache below.
        drawn: PropTypes.shape({ node_types: PropTypes.object }),
        painted: PropTypes.instanceOf(Map),
        // whether the build is still on its way, which is what tells a page
        // that has not loaded yet from one that failed. Both arrive here as no
        // schema, and only the first of them is worth drawing an empty table
        // for.
        loading: PropTypes.bool,
    }

    constructor(props) {
        super(props);

        //
        // biggest first, on both tabs. A build's shape is carried by its large
        // types, and an alphabetical first page opens on whatever happens to
        // begin with 'a'.
        //
        this.state = {
            tab: 'nodes',
            query: '',
            sort: { key: 'count', direction: 'desc' },
            page: 0,
            rows_per_page: ROWS_PER_PAGE[0],
        };

        this.selectTab = this.selectTab.bind(this);
        this.sortBy = this.sortBy.bind(this);
        this.search = this.search.bind(this);
        this.rows = this.rows.bind(this);
    }

    //
    // Note: the page is reset by every control that changes how many rows there
    //       are, or which. Left alone, filtering a 825 row table down to three
    //       while sitting on page nine shows an empty table over a control that
    //       says there are three results.
    //
    selectTab(tab) {
        if (tab === this.state.tab) {
            return;
        }

        this.setState({ tab: tab, page: 0, sort: { key: 'count', direction: 'desc' } });
    }

    search(query) {
        this.setState({ query: query, page: 0 });
    }

    sortBy(key) {
        this.setState((state) => ({
            page: 0,
            sort: state.sort.key === key
                ? { key: key, direction: state.sort.direction === 'asc' ? 'desc' : 'asc' }
                : { key: key, direction: key === 'count' ? 'desc' : 'asc' },
        }));
    }

    //
    // rows are rebuilt only when the schema or the canvas's selection changes,
    // not on every keystroke in the filter box. Filtering and sorting run per
    // render over the built rows, which is cheap; rebuilding 976 row objects
    // under a text input is not.
    //
    rows() {
        const { schema, drawn, painted } = this.props;

        if (this.built !== schema || this.builtDrawn !== drawn) {
            this.built = schema;
            this.builtDrawn = drawn;
            this.cache = {
                nodes: nodeRows(
                    schema,
                    new Set(drawn && drawn.node_types ? Object.keys(drawn.node_types) : []),
                    painted
                ),
                edges: edgeRows(schema),
            };
        }

        return this.cache[this.state.tab];
    }

    header(columns) {
        const { sort } = this.state;

        return (
            <TableHead>
                <TableRow>
                    {columns.map((column) => (
                        <TableCell
                            key={column.key}
                            className={column.className}
                            align={column.numeric ? 'right' : 'left'}
                            sortDirection={sort.key === column.key ? sort.direction : false}
                        >
                            <TableSortLabel
                                active={sort.key === column.key}
                                direction={sort.key === column.key ? sort.direction : 'asc'}
                                onClick={() => this.sortBy(column.key)}
                            >
                                {column.label}
                            </TableSortLabel>
                        </TableCell>
                    ))}
                </TableRow>
            </TableHead>
        );
    }

    nodeTable(shown) {
        return (
            <Table stickyHeader size='small' aria-label='Node types in this build'>
                {this.header(NODE_COLUMNS)}
                <TableBody>
                    {shown.map((row) => (
                        <TableRow key={row.key} hover>
                            <TableCell>
                                <span
                                    className='graph-legend-swatch'
                                    style={row.colour ? { backgroundColor: row.colour } : undefined}
                                    title={row.namespace}
                                />
                                {wrapped(row.id)}
                            </TableCell>
                            <TableCell align='right' className='graph-tables-count'>
                                {number(row.count)}
                            </TableCell>
                            <TableCell>
                                {row.drawn ? <span aria-label='on the canvas'>●</span> : ''}
                            </TableCell>
                            <TableCell className='graph-tables-uri'>
                                {wrapped(row.uri)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    edgeTable(shown) {
        return (
            <Table stickyHeader size='small' aria-label='Edge types in this build'>
                {this.header(EDGE_COLUMNS)}
                <TableBody>
                    {shown.map((row) => (
                        <TableRow key={row.key} hover>
                            <TableCell>
                                {wrapped(row.src)}
                                <span className='graph-tables-arrow'> → </span>
                                {wrapped(row.relation)}
                                <span className='graph-tables-arrow'> → </span>
                                {wrapped(row.dst)}
                            </TableCell>
                            <TableCell align='right' className='graph-tables-count'>
                                {number(row.count)}
                            </TableCell>
                            <TableCell>
                                {originMark(row.origin)}
                                {row.origin}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    /**
     * the tables before there is a build to fill them.
     *
     * The controls are the real ones, turned off: two tabs and a filter box, at
     * the size and in the place they will be usable in. They used to arrive with
     * the schema, which on a phone meant the rule, the tabs, the box and a
     * hundred rows all appeared at once at the bottom of a page that had been
     * empty -- and on a wide screen it meant the rule this page's third divider
     * rides on was not there to ride on.
     *
     * Note: disabled rather than merely inert. A filter box that accepts
     *       keystrokes and drops them when the build lands is worse than one
     *       that says it is not ready, and 'disabled' is also what keeps this
     *       whole aria-hidden block off the tab order.
     *
     * Note: the NODE columns, because 'nodes' is the tab the real one opens on.
     *       A placeholder headed with the other table's columns would be a
     *       column of headings that changes when the data arrives.
     *
     * Note: the pager is the real one too, and 'disabled' turns off both its
     *       dropdown and its arrows. It used to be missing, so a 52px row
     *       appeared under the table when the build landed. Its count is a bar
     *       rather than the '0-0 of 0' a count of nothing would print: what
     *       it will say depends on the build, and nothing here invents a value.
     */
    pending() {
        return (
            <section className='graph-tables graph-tables-pending' aria-hidden='true'>
                <div className='graph-tables-controls'>
                    <div className='graph-tables-tabs'>
                        {TABS.map((one) => (
                            <button
                                key={one.key}
                                type='button'
                                className='graph-tables-tab'
                                aria-pressed={one.key === 'nodes'}
                                disabled
                            >
                                {one.label}
                                <span className='graph-tables-tally'>
                                    <PendingBar width='1.5rem' />
                                </span>
                            </button>
                        ))}
                    </div>
                    <input
                        className='graph-tables-search'
                        type='search'
                        value=''
                        placeholder='Filter'
                        readOnly
                        disabled
                    />
                </div>

                <TableContainer className='graph-tables-scroll'>
                    <Table stickyHeader size='small'>
                        <TableHead>
                            <TableRow>
                                {NODE_COLUMNS.map((column) => (
                                    <TableCell
                                        key={column.key}
                                        className={column.className}
                                        align={column.numeric ? 'right' : 'left'}
                                    >
                                        {column.label}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[...Array(PENDING_ROWS).keys()].map((row) => (
                                <TableRow key={row}>
                                    {NODE_COLUMNS.map((column) => (
                                        <TableCell
                                            key={column.key}
                                            className={column.className}
                                            align={column.numeric ? 'right' : 'left'}
                                        >
                                            <PendingBar
                                                width={column.pending}
                                                delay={row * 50}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component='div'
                    count={0}
                    page={0}
                    rowsPerPage={ROWS_PER_PAGE[0]}
                    rowsPerPageOptions={ROWS_PER_PAGE}
                    onPageChange={() => {}}
                    labelDisplayedRows={() => <PendingBar width='4.75rem' />}
                    disabled
                />
            </section>
        );
    }

    render() {
        const { schema, loading } = this.props;

        if (!schema || !schema.node_types || !schema.edge_types) {
            return loading ? this.pending() : null;
        }

        const { tab, query, page, rows_per_page } = this.state;
        const arranged = arrange(this.rows(), query, this.state.sort);
        const shown = arranged.slice(page * rows_per_page, page * rows_per_page + rows_per_page);
        const counts = {
            nodes: Object.keys(schema.node_types).length,
            edges: Object.keys(schema.edge_types).length,
        };

        return (
            <section className='graph-tables'>
                <div className='graph-tables-controls'>
                    <div className='graph-tables-tabs' role='group' aria-label='Which table'>
                        {TABS.map((one) => (
                            <button
                                key={one.key}
                                type='button'
                                className='graph-tables-tab'
                                aria-pressed={tab === one.key}
                                onClick={() => this.selectTab(one.key)}
                            >
                                {one.label}
                                <span className='graph-tables-tally'>{counts[one.key]}</span>
                            </button>
                        ))}
                    </div>
                    <input
                        className='graph-tables-search'
                        type='search'
                        value={query}
                        placeholder='Filter'
                        aria-label='Filter rows'
                        onChange={(event) => this.search(event.target.value)}
                    />
                </div>

                <TableContainer className='graph-tables-scroll'>
                    {tab === 'nodes' ? this.nodeTable(shown) : this.edgeTable(shown)}
                </TableContainer>

                <TablePagination
                    component='div'
                    count={arranged.length}
                    page={page}
                    rowsPerPage={rows_per_page}
                    rowsPerPageOptions={ROWS_PER_PAGE}
                    onPageChange={(event, next) => this.setState({ page: next })}
                    onRowsPerPageChange={(event) => this.setState({
                        rows_per_page: Number(event.target.value),
                        page: 0,
                    })}
                />
            </section>
        );
    }
}

export default GraphTables;

export { TABS, ROWS_PER_PAGE, PENDING_ROWS };
