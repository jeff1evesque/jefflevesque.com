/**
 * candlestick.jsx: content for trigger candlestick
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import { isMobile } from 'react-device-detect';
import NoticeTerms from '../../../../general/notice-terms.jsx';
import Sliding from '../../../../svg/window/sliding.jsx';
import SummaryTrigger from '../../../../general/summary-trigger.jsx';
import BreadCrumbs from '../../../../navigation/breadcrumbs.jsx';
import checkValidString from '../../../../validator/valid-string.js';
import checkValidArray from '../../../../validator/valid-array.js';
import BasicWorkflow from '../../../../svg/trigger/basic-workflow.jsx';
import BasicModelWorkflow from '../../../../svg/trigger/basic-model-workflow.jsx';
import AggregateWorkflow from '../../../../svg/trigger/aggregate-workflow.jsx';
import AggregateModelWorkflow from '../../../../svg/trigger/aggregate-model-workflow.jsx';
import PropTypes from 'prop-types';

class Candlestick extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        listing_graphic_title: PropTypes.string,
        trigger_candlestick_table: PropTypes.array,
        trigger_candlestick_table_labels: PropTypes.array
    }

    constructor(props) {
        super(props);

        if (
            'listing_graphic_title' in this.props
            && checkValidString(this.props.listing_graphic_title)
        ) {
            var listing_graphic_title = this.props.listing_graphic_title;
        } else {
            var listing_graphic_title = 'Candlestick';
        }

        {/*

            Weak < 60%
            Moderate: 60-69%
            Strong > 70%

        */}

        if (
            'trigger_candlestick_table_labels' in this.props
            && checkValidArray(this.props.trigger_candlestick_table_labels)
        ) {
            var trigger_candlestick_table_labels = this.props.trigger_candlestick_table_labels;
        } else {
            var trigger_candlestick_table_labels = [
                { id: 'pattern', label: 'Pattern', minWidth: 170, align: 'right' },
                { id: 'type', label: 'Type', minWidth: 170, align: 'right' },
                { id: 'strength', label: 'Strength', minWidth: 170, align: 'right' },
                {
                    id: 'num_candle',
                    label: '# Candle',
                    minWidth: 170,
                    align: 'right',
                    format: (value) => value.toLocaleString('en-US')
                }
            ]
        }

        if (
            'trigger_candlestick_table' in this.props
            && checkValidArray(this.props.trigger_candlestick_table)
        ) {
            var trigger_candlestick_table = this.props.trigger_candlestick_table
        } else {
            var trigger_candlestick_table = [
                { 'pattern': 'Inverted Hammer', 'type': 'Bullish', 'strength': 'Moderate', 'num_candle': 1 },
                { 'pattern': 'Shooting Star', 'type': 'Bearish', 'strength':'Moderate', 'num_candle': 1 },
                { 'pattern': 'Hammer', 'type': 'Bullish', 'strength':'Weak', 'num_candle': 1 },
                { 'pattern': 'Hanging Man', 'type': 'Bearish', 'strength':'Weak', 'num_candle': 1 },
                { 'pattern': 'Piercing', 'type': 'Bullish', 'strength':'Moderate', 'num_candle': 2 },
                { 'pattern': 'Dark Cloud Cover', 'type': 'Bearish', 'strength':'Moderate', 'num_candle': 2 },
                { 'pattern': 'Morning Doji Star', 'type': 'Bullish', 'strength':'Strong', 'num_candle': 3 },
                { 'pattern': 'Evening Doji Star', 'type': 'Bearish', 'strength':'Strong', 'num_candle': 3 },
                { 'pattern': 'Bearish Engulfing', 'type': 'Bearish', 'strength':'Weak', 'num_candle': 2 },
                { 'pattern': 'Bullish Engulfing', 'type': 'Bullish', 'strength':'Moderate', 'num_candle': 2 },
                { 'pattern': 'Dragonfly Doji', 'type': 'Bullish', 'strength':'Weak', 'num_candle': 1 },
                { 'pattern': 'Gravestone Doji', 'type': 'Bearish', 'strength':'Weak', 'num_candle': 1 },
                { 'pattern': 'Morning Star', 'type': 'Bullish', 'strength':'Strong', 'num_candle': 3 },
                { 'pattern': 'Evening Star', 'type': 'Bearish', 'strength':'Strong', 'num_candle': 3 }
            ]
        }

        //
        // the fallback was null, and the summary interpolates it straight into a
        // sentence -- a missing prop rendered as 'The null ingest stream runs
        // between 9:30am...'. This content describes the stock-market stream and
        // nothing else (its hours and its grouping by ticker are written into the
        // copy below), so that is the name to fall back to.
        //
        if (
            'stream' in this.props
            && checkValidString(this.props.stream)
        ) {
            var stream = this.props.stream;
        } else {
            var stream = 'stock-market';
        }

        this.state = {
            listing_graphic_title: listing_graphic_title,
            trigger_candlestick_table_labels: trigger_candlestick_table_labels,
            trigger_candlestick_table: trigger_candlestick_table,
            stream: stream
        }
    }

    render() {
        const notice = (
            <>
                {`
                    To subscribe to individual ${this.state.listing_graphic_title.toLowerCase()}
                    triggers,
                `}
                <span className='bold'>you must accept the terms and conditions.</span>
            </>
        );

        const summary_graphic = isMobile
            ? (
                <div className='summary-item summary-item-mobile'>
                    <Sliding />
                    <div className='accordion-description'>
                        Sliding window having a fixed window size and slide interval.
                        Records do not have to overlap between windows.
                    </div>
                </div>
            ) : (
                <div className='summary-item'>
                    <Sliding />
                    <div>
                        Sliding window having a fixed window size and slide interval.
                        Between any two adjacent windows, any number of records may
                        overlap or none at all.
                    </div>
                </div>
            );

        const summary = (
            <div>{`
                The ${this.state.stream} ingest stream runs between 9:30am through 4:30pm EDT
                (M-F). During this time, ingested records are grouped by ticker symbol
                and bounded by 5 minute windows sliding every minute. Within each window,
                various analysis is performed.
            `}{isMobile ? null : summary_graphic}</div>
        );

        const accordion_summary = [{
            'id': 'summary_panel_sliding',
            'title': 'Sliding Window',
            'content': summary_graphic
        }];

        const summary_below = (
            <div className='summary-item'>
                Candlestick patterns is a form of technical analysis in the
                stock market, used to highlight current sentiment, and possible
                trend reversals. While many investors and traders use/standardize
                candlestick patterns, it is important to recognize that the overall
                market is composed of many variables. Be judicious, use multiple
                sources and methods before composing any conclusions.
            </div>
        );

        const summary_integration = (
            <div>
                You select any combination of stock-tickers, and candlestick patterns.
                Our system performs a sliding-window operation on the data stream,
                when your selected pattern(s) is detected, you get notified. You can
                choose and customize workflows using basic triggers, trigger aggregate,
                and machine-learning integration. More advanced workflows will become
                available mid-2024 (stay tuned).
            </div>
        );

        const accordion_integration = [{
            'id': 'panel1',
            'title': 'Basic Workflow',
            'content': (
                <>
                    <BasicWorkflow />
                    <div className='accordion-description'>
                        The <i>basic workflow</i> allows you to select any combination of
                        stock ticker(s) and candlestick pattern(s), and get notified (N)
                        when a pattern is triggered (T).
                    </div>
                </>
            )
        }, {
            'id': 'panel2',
            'title': 'Basic Model Workflow',
            'content': (
                <>
                    <BasicModelWorkflow />
                    <div className='accordion-description'>
                        The <i>basic model workflow</i> is an extention to the <i>basic
                        workflow</i>, except your candlestick pattern triggers (T) a
                        machine-learning model (M), then notifies (N) you with prediction
                        results.
                    </div>
                </>
            )
        }, {
            'id': 'panel3',
            'title': 'Aggregate Workflow',
            'content': (
                <>
                    <AggregateWorkflow />
                    <div className='accordion-description'>
                        The <i>aggregate workflow</i> allows you to define custom logic
                        within a trigger aggregate (TA). For example, you can specify if
                        two of three candlestick triggers (T) occur, then your trigger
                        aggregate (TA) should notify (N) you.
                    </div>
                </>
            )
        }, {
            'id': 'panel4',
            'title': 'Aggregate Model Workflow',
            'content': (
                <>
                    <AggregateModelWorkflow />
                    <div className='accordion-description'>
                        The <i>aggregate model workflow</i> is an extension of the <i>
                        aggregate workflow</i>, except your custom trigger aggregate (TA)
                        invokes a machine learning model (M), then notifies (N) you with
                        prediction results.
                    </div>
                </>
            )
        }];

        return (
            <div>
                <div className='header-featured center-text'>
                    <h4>{this.state.listing_graphic_title}</h4>
                    <BreadCrumbs />
                </div>
                <NoticeTerms notice={notice} />
                <SummaryTrigger
                    summary={summary}
                    accordion_summary={isMobile ? accordion_summary : null}
                    summary_below={summary_below}
                    trigger_table={this.state.trigger_candlestick_table}
                    trigger_table_labels={this.state.trigger_candlestick_table_labels}
                    summary_integration={summary_integration}
                    accordion_integration={accordion_integration}
                />
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default Candlestick;
