/**
 * stock-split.jsx: content for trigger candlestick
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import { isMobile } from 'react-device-detect';
import NoticeTerms from '../../../../general/notice-terms.jsx';
import Tumbling from '../../../../svg/window/tumbling.jsx';
import SummaryTrigger from '../../../../general/summary-trigger.jsx';
import checkValidBool from '../../../../validator/valid-bool.js';
import checkValidString from '../../../../validator/valid-string.js';
import BasicWorkflow from '../../../../svg/trigger/basic-workflow.jsx';
import BasicModelWorkflow from '../../../../svg/trigger/basic-model-workflow.jsx';
import AggregateWorkflow from '../../../../svg/trigger/aggregate-workflow.jsx';
import AggregateModelWorkflow from '../../../../svg/trigger/aggregate-model-workflow.jsx';
import PropTypes from 'prop-types';

class StockSplit extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        listing_graphic_title: PropTypes.string,
        ingest_interval: PropTypes.string,
        late_arrival: PropTypes.bool,
        x_unit: PropTypes.string
    }

    constructor(props) {
        super(props);

        if (
            'listing_graphic_title' in this.props
            && checkValidString(this.props.listing_graphic_title)
        ) {
            var listing_graphic_title = this.props.listing_graphic_title;
        } else {
            var listing_graphic_title = 'StockSplit';
        }

        if (
            'ingest_interval' in this.props
            && checkValidString(this.props.ingest_interval)
        ) {
            var ingest_interval = this.props.ingest_interval;
        } else {
            var ingest_interval = 'daily at 12am EDT (M-F)';
        }

        if (
            'late_arrival' in this.props
            && checkValidBool(this.props.late_arrival)
        ) {
            var late_arrival = this.props.late_arrival;
        } else {
            var late_arrival = false;
        }

        if (
            'x_unit' in this.props
            && checkValidString(this.props.x_unit)
        ) {
            var x_unit = this.props.x_unit;
        } else {
            var x_unit = 'day';
        }

        this.state = {
            listing_graphic_title: listing_graphic_title,
            ingest_interval: ingest_interval,
            late_arrival: late_arrival,
            x_unit: x_unit
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
                    <Tumbling x_unit={this.state.x_unit} late_arrival={this.state.late_arrival} />
                    <div className='accordion-description'>
                        Tumbling window having a fixed window size and slide interval.
                        Records cannot overlap between adjacent windows.
                    </div>
                </div>
            ) : (
                <div className='summary-item'>
                    <Tumbling x_unit={this.state.x_unit} late_arrival={this.state.late_arrival} />
                    <div>
                        Tumbling window having a fixed window size and slide interval.
                        Records cannot overlap between windows, since the slide interval
                        is proportional to the window size.
                    </div>
                </div>
            );

        const summary = (
            <div>{`
                The ${this.state.listing_graphic_title} ingest stream runs ${this.state.ingest_interval}.
                During this time, records are not grouped by any attributes. Within each window, various
                analysis is performed.
            `}
                {isMobile ? null : summary_graphic}
            </div>
        );

        const accordion_summary = [{
            'id': 'summary_panel_tumbling',
            'title': 'Tumbling Window',
            'content': summary_graphic
        }];

        const summary_below = (
            <div className='summary-item'>
                Stock Split occurs when shares of a ticker is scheduled to split/consolidate
                based on some ratio. For example, a 2-for-1 means for every share held before
                a scheduled split, will become two shares after the split. Conversely, a 1-for-2
                means for every two shares held will become one share after the split.
            </div>
        );

        const summary_integration = (
            <div>
                You select any combination of stock-tickers you anticipate a stock-split.
                Every day (M-F), a list of tickers scheduled for a stock-split is created.
                Our system performs a daily tumbling-window operation on the data stream,
                when your selected ticker(s) is detected (against the daily curated list),
                you get notified. You can choose and customize workflows using basic triggers,
                trigger aggregate, and machine-learning integration. More advanced workflows
                will become available mid-2024 (stay tuned).
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
                <NoticeTerms notice={notice} />
                <SummaryTrigger
                    header={this.state.listing_graphic_title}
                    summary={summary}
                    accordion_summary={isMobile ? accordion_summary : null}
                    summary_below={summary_below}
                    summary_integration={summary_integration}
                    accordion_integration={accordion_integration}
                />
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default StockSplit;
