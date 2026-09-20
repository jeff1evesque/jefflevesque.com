/**
 * home-page.jsx: main homepage for entire application.
 *
 * The page is the knowledge-graph cluster and nothing else. It draws the default
 * published build as a living backdrop, and everything a reader can do with that
 * graph -- pick a build, read a node, follow it to its api -- is on /graph, which
 * is the surface built for it.
 *
 * It used to be two pages behind a pair of checkboxes in the bottom right corner,
 * 'StockMarket' and 'Summary', which were not a choice anybody had a reason to
 * make: they were mutually exclusive, neither was labelled with what it would do,
 * and 'Summary' replaced the graph with a filterable listing of the day's stock
 * splits and one stream. That listing is what /data and /stream are, done
 * properly and reachable from the menu, so the front page carried a worse copy of
 * two other pages behind a control that described neither.
 *
 * Removing the control removed the branch, and the branch was most of this file:
 * the filter column and its Filter/Apply Filter dance on a phone, the date picker
 * that chose which trading day's splits to fetch, and the ~90 line merge that
 * joined those splits against two ticker lists. None of it had a second caller.
 * See git history for it -- #46's graph work is the reason it stopped being
 * needed, not this change.
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
import PropTypes from 'prop-types';
import getGraphSchema from '../general/get-graph-schema.js';
import filterSchema from '../animation/filter-schema.js';
import { buildPalette } from '../animation/encoding.js';

class HomePage extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLayout: PropTypes.func,
    }

    constructor() {
        super();
        this.currentUser = this.currentUser.bind(this);

        this.state = {
            graph_schema: null,
            // namespace -> colour for the WHOLE build, not for the slice drawn
            // below it. See buildPalette, and the note in componentDidMount.
            graph_palette: null
        }
    }

    async currentUser() {
        Auth.currentSession()
            .then(data => console.log(data))
            .catch(err => console.log(err));
    }

    componentDidMount() {
        const action = setLayout({ layout: 'analysis' });
        this.props.dispatchLayout(action);

        {/*

            the knowledge-graph backdrop's content, filtered to the handful of
            node types the animation can legibly carry. Until this resolves --
            and if it never does -- GraphCluster renders its gray field alone,
            which is the deliberate answer rather than a placeholder graph.

            Note: NOT gated on @is_local, the way the csv loads on the other
                  pages are. Those fail CORS from localhost, which is what the
                  gate is for; the graph api is public and allows any origin, so
                  a local build shows the same real graph the deployed one does.

            Note: filterSchema answers null for a null schema, so the failed
                  fetch and the unusable payload land in the same state as the
                  pending one without a branch here.

        */}

        {/*

            Note: the palette is built from the UNFILTERED schema, beside the
                  slice that gets drawn. Ranking it over the 24 types below --
                  which is what happened for as long as the backdrop existed --
                  ranks a different set from the one /graph ranks, so the same
                  namespace came out a different colour on the two pages and
                  /graph's legend described this cluster incorrectly. Both are
                  set in ONE setState so the cluster never redraws holding one
                  build's nodes and another's colours.

        */}

        getGraphSchema().then((schema) => {
            this.setState({
                graph_schema: filterSchema(schema),
                graph_palette: buildPalette(schema),
            });
        });
    }

    render() {
        {/*

            the frontpage IS the backdrop. GraphCluster draws one ball per node
            type from the live graph_schema served by the public graph api,
            clustered by edge topology and reactive to the cursor.

            Note: @graph_schema is null until the fetch lands, and stays null if
                  it fails. GraphCluster reads that as "draw the gray field and
                  no cluster" -- there is no committed fallback graph.

        */}

        return (
            <div className='main-full-span home'>
                <GraphCluster
                    data={this.state.graph_schema}
                    palette={this.state.graph_palette}
                />
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default HomePage;
