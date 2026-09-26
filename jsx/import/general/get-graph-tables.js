/**
 * get-graph-tables.js: the published query tables, a day at a time, for the
 *                      Retrieval graph.
 *
 * Three calls, because a caller picks a day from a listing rather than naming
 * one, and a day's picture is two questions asked side by side:
 *
 *     GET <tables>/days                                -> { report: { rows: [{ day, run, published }, ...] } }
 *     GET <tables>/node-types?Day=<day>&Limit=1000     -> { report: { rows: [{ node_type, count, entities, facts }, ...] } }
 *     GET <tables>/edge-types?Day=<day>&Limit=1000     -> { report: { rows: [{ src_type, relation, dst_type, count, origin, ... }] } }
 *
 * A day comes back in the shape a build's schema has -- `node_types` keyed by type
 * with a `count`, `edge_types` keyed by a label and naming both ends -- so the page
 * draws it with the code that draws a build: the same filter, legend, canvas and
 * tables. That shape is the whole of the contract between this module and them.
 *
 * Each node type carries two measures a build's does not: `entities`, how many of
 * its nodes carry text and so can be found by name, and `facts`, how many values
 * are held about them. They are what the Retrieval graph is drawn by -- a day
 * weighed by its node count is its own build again. See source.js.
 *
 * Note: what a day does NOT carry is the ontology term of each node type. The tables
 *       hold none, and the tables below the graph drop the column that would print
 *       it. What a type's term would have said about its VOCABULARY -- which the
 *       legend colors by, and which puts 'jolts' under 'bls' -- the day's own
 *       predicates say instead. See vocabularies.
 *
 * Note: failures resolve to null, as get-graph-schema.js's do, and are logged with
 *       console.log rather than console.error for the reason it gives. A day with
 *       one half missing is a failure of the whole day: node types without their
 *       edges, or edges without the types they join, is a picture of something the
 *       tables do not hold.
 */

import { knowledgeGraphTablesUrl, ENDPOINTS } from './api-url.js';
import { report } from './get-graph-schema.js';
import { ontologyTerm } from '../animation/encoding.js';

const TABLES = ENDPOINTS.knowledgeGraphTables;

//
// the most rows either question may answer with, which is the api's own ceiling.
//
// A day holds about 155 node types and 838 edge types, so both fit whole. The api
// answers the biggest first, so a day that outgrew the ceiling would lose its
// smallest edge types rather than its shape.
//
const LIMIT = 1000;

//
// a day as the tables spell it, and as the api refuses anything else.
//
// Note: exported for source.js, which holds the day a build's listing entry
//       names to the pattern a published day matches. See buildDay there.
//
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function logged(what, e) {
    const detail = (e && e.status) ? `status ${e.status}` : e;
    console.log(`Error: ${what} returned ${detail}`);

    return null;
}

//
// a report's rows, or a rejection for a report that has none.
//
function rowsOf(answer) {
    return answer && Array.isArray(answer.rows) ? answer.rows : Promise.reject(answer);
}

/**
 * the request that lists the published days.
 *
 * Note: one builder for the fetch below and for the icon that shows a reader the
 *       request, so the icon cannot name a request the page did not make. See
 *       api-links.jsx.
 */
export function daysRequest(base = TABLES) {
    return knowledgeGraphTablesUrl('Days', {}, base);
}

/**
 * the two requests that make up one day's picture, for the same reason.
 */
export function dayRequests(day, base = TABLES) {
    return {
        nodeTypes: knowledgeGraphTablesUrl('NodeTypes', { Day: day, Limit: LIMIT }, base),
        edgeTypes: knowledgeGraphTablesUrl('EdgeTypes', { Day: day, Limit: LIMIT }, base),
    };
}

/**
 * the vocabulary each prefix of a name is published under, as a day's own
 * predicates say it: Map { 'jolts' => 'bls/jolts', ... }.
 *
 * A relation is named the way a node type is -- a prefix, then its own name --
 * and its predicate is an ontology term, which names the whole vocabulary. So
 * 'jolts_hasIndustry', whose predicate is '.../ontology/bls/jolts/hasIndustry', says
 * that 'jolts' is 'bls/jolts', and 'jolts_Industry' is then a type of it. That is
 * what a build's schema says of the same type in its own uri, and what the tables
 * have no column for.
 *
 * Measured against the build published 2026-09-25, whose types carry their uris:
 * every prefix both a type and a relation are named under is published under the
 * one vocabulary. Four prefixes no relation is named under -- market_quotes,
 * sec_common, temporal and weather, on every day published by then -- are left to
 * their names, which for the first three answer what the uri would.
 *
 * Note: a predicate whose own name is not the end of its relation's name is
 *       passed over, as is one that is not an ontology term -- owl:sameAs is the
 *       W3C's, and every source uses it. Neither says what a prefix means.
 *
 * Note: a prefix named under two vocabularies is named under neither. Picking
 *       one would be a guess made to look like the tables' answer.
 */
function vocabularies(edgeRows) {
    const named = new Map();

    edgeRows.forEach((row) => {
        const term = ontologyTerm(row.predicate_uri);

        if (!term || !row.relation.endsWith(`_${term.name}`)) {
            return;
        }

        const prefix = row.relation.slice(0, -(term.name.length + 1));

        if (prefix) {
            named.set(prefix, (named.get(prefix) || new Set()).add(term.vocabulary));
        }
    });

    return new Map([...named]
        .filter(([, paths]) => paths.size === 1)
        .map(([prefix, paths]) => [prefix, [...paths][0]]));
}

/**
 * one day's node and edge type rows, in the shape of a build's schema.
 *
 * Keyed as a schema is: node types by name, and edge types by a label naming
 * both ends and the relation, the way the builder writes a schema's keys. A day
 * holds each edge type once, so no two rows want the same label.
 *
 * A node type carries the `vocabulary` its name's prefix is published under,
 * where the day's predicates say -- see vocabularies. It stands in for the uri a
 * build's type carries, and is read where that would be: see vocabulary in
 * encoding.js.
 *
 * Returns null for rows that are not the ones asked for, so the page has one
 * check to make, as filterSchema gives it for a build.
 *
 * Note: `predicate_uri` and `relation_group` are carried through when a row has
 *       them. The predicates are read here, for the vocabularies; nothing on the
 *       page reads either one off an edge yet, and dropping them would make a
 *       later reader fetch the day again for fields it already had.
 */
export function daySchema(nodeRows, edgeRows) {
    if (!Array.isArray(nodeRows) || !Array.isArray(edgeRows)) {
        return null;
    }

    const node_types = {};

    //
    // Note: a row without its entities or its facts fails the day rather than
    //       counting as none. A day drawn by entities it was never told about is
    //       a canvas of connectors with nothing to connect -- a picture of
    //       something the tables do not hold, which is worse than no picture.
    //
    for (const row of nodeRows) {
        if (!row || typeof row.node_type !== 'string' || typeof row.count !== 'number'
            || typeof row.entities !== 'number' || typeof row.facts !== 'number') {
            return null;
        }

        node_types[row.node_type] = { count: row.count, entities: row.entities, facts: row.facts };
    }

    const edge_types = {};

    for (const row of edgeRows) {
        if (!row || typeof row.src_type !== 'string' || typeof row.relation !== 'string'
            || typeof row.dst_type !== 'string' || typeof row.count !== 'number') {
            return null;
        }

        const edge = {
            src_type: row.src_type,
            relation: row.relation,
            dst_type: row.dst_type,
            count: row.count,
            origin: row.origin || null,
        };

        if (row.predicate_uri) {
            edge.predicate_uri = row.predicate_uri;
        }
        if (row.relation_group) {
            edge.relation_group = row.relation_group;
        }

        edge_types[`(${row.src_type}, ${row.relation}, ${row.dst_type})`] = edge;
    }

    //
    // after both loops, so a day whose rows fail says nothing about any of them
    //
    const named = vocabularies(edgeRows);

    Object.keys(node_types).forEach((id) => {
        const underscore = id.lastIndexOf('_');
        const path = underscore > 0 ? named.get(id.slice(0, underscore)) : null;

        if (path) {
            node_types[id].vocabulary = path;
        }
    });

    return { node_types: node_types, edge_types: edge_types };
}

/**
 * every published day, newest first, as { day, run, published }: the day as
 * 'YYYY-MM-DD', the run that published it, and when that finished publishing.
 *
 * Resolves to the list, which may be empty, or to null if it cannot be had.
 *
 * Note: a row that is not a day is dropped rather than failing the list. The list
 *       is what the picker offers, and one row nobody could name is no reason to
 *       offer none of the rest.
 *
 * Note: `run` and `published` are null unless they are strings. A day's rows
 *       carried neither before the api said where each day came from, and one
 *       that still says nothing is read as a build's missing run is: 'n/a'.
 */
export function getTableDays(base = TABLES) {
    return report(daysRequest(base))
        .then(rowsOf)
        .then((rows) => rows
            .filter((row) => row && typeof row.day === 'string' && DAY.test(row.day))
            .map((row) => ({
                day: row.day,
                run: typeof row.run === 'string' ? row.run : null,
                published: typeof row.published === 'string' ? row.published : null,
            })))
        .catch((e) => logged(`${base}/days`, e));
}

/**
 * one day's picture: its node types and its edge types, asked at once.
 *
 * Resolves to the schema-shaped day, or to null for every failure -- either
 * request failing, a body without rows, rows that are not the ones asked for.
 */
export function getTableDay(day, base = TABLES) {
    if (!day) {
        return Promise.resolve(null);
    }

    const { nodeTypes, edgeTypes } = dayRequests(day, base);

    return Promise.all([report(nodeTypes).then(rowsOf), report(edgeTypes).then(rowsOf)])
        .then(([nodeRows, edgeRows]) => daySchema(nodeRows, edgeRows) || Promise.reject('rows NOT shaped as asked'))
        .catch((e) => logged(`${base} Day=${day}`, e));
}

export { DAY, LIMIT, TABLES };
