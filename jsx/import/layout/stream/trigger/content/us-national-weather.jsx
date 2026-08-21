/**
 * us-national-weather.jsx
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
import checkValidInt from '../../../../validator/valid-int.js';
import BasicWorkflow from '../../../../svg/trigger/basic-workflow.jsx';
import BasicModelWorkflow from '../../../../svg/trigger/basic-model-workflow.jsx';
import AggregateWorkflow from '../../../../svg/trigger/aggregate-workflow.jsx';
import AggregateModelWorkflow from '../../../../svg/trigger/aggregate-model-workflow.jsx';
import PropTypes from 'prop-types';

class USNationalWeather extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        listing_graphic_title: PropTypes.string,
        ingest_interval: PropTypes.string,
        late_arrival: PropTypes.bool,
        x_unit: PropTypes.string,
        x_increment: PropTypes.number,
        window_1_purple: PropTypes.bool,
        window_1_green: PropTypes.bool,
        window_2_blue: PropTypes.bool
    }

    constructor(props) {
        super(props);

        if (
            'listing_graphic_title' in this.props
            && checkValidString(this.props.listing_graphic_title)
        ) {
            var listing_graphic_title = this.props.listing_graphic_title;
        } else {
            var listing_graphic_title = 'US National Weather';
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

        //
        // the fallback assigned 'var x_unit = 10', not x_increment -- and 'var'
        // made that the SAME binding filled in above, so omitting x_increment
        // silently overwrote the caller's unit with a number the graphic rejects.
        //
        if (
            'x_increment' in this.props
            && checkValidInt(this.props.x_increment)
        ) {
            var x_increment = this.props.x_increment;
        } else {
            var x_increment = 5;
        }

        if (
            'window_1_purple' in this.props
            && checkValidBool(this.props.window_1_purple)
        ) {
            var window_1_purple = this.props.window_1_purple;
        } else {
            var window_1_purple = false;
        }

        if (
            'window_1_green' in this.props
            && checkValidBool(this.props.window_1_green)
        ) {
            var window_1_green = this.props.window_1_green;
        } else {
            var window_1_green = false;
        }

        if (
            'window_2_blue' in this.props
            && checkValidBool(this.props.window_2_blue)
        ) {
            var window_2_blue = this.props.window_2_blue;
        } else {
            var window_2_blue = false;
        }

        this.state = {
            listing_graphic_title: listing_graphic_title,
            ingest_interval: ingest_interval,
            late_arrival: late_arrival,
            x_unit: x_unit,
            x_increment: x_increment,
            window_1_purple: window_1_purple,
            window_1_green: window_1_green,
            window_2_blue: window_2_blue
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
                    <Tumbling
                        x_unit={this.state.x_unit}
                        x_increment={this.state.x_increment}
                        late_arrival={this.state.late_arrival}
                        window_1_purple={this.state.window_1_purple}
                        window_1_green={this.state.window_1_green}
                        window_2_blue={this.state.window_2_blue}
                    />
                    <div className='accordion-description'>
                        Tumbling window having a fixed window size and slide interval.
                        Records cannot overlap between adjacent windows.
                    </div>
                </div>
            ) : (
                <div className='summary-item'>
                    <Tumbling
                        x_unit={this.state.x_unit}
                        x_increment={this.state.x_increment}
                        late_arrival={this.state.late_arrival}
                        window_1_purple={this.state.window_1_purple}
                        window_1_green={this.state.window_1_green}
                        window_2_blue={this.state.window_2_blue}
                    />
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
            <div className='summary-item'>{`
                Whenever the US National Weather Service issues a service alert, our system
                captures these notice(s), and batched ${this.state.ingest_interval}. These
                records are stored to our datalake and stream, ready to be consumed by stream
                application(s).
            `}</div>
        );

        const summary_integration = (
            <div>{`
                You select any combination of alert attributes such as urgency, severity, certainty,
                area, polygon (if provided), geocode, published date, or perhaps the title or summary
                of the alert. Alerts are aggregated and batched into the datalake and stream
                ${this.state.ingest_interval} every day. Our system performs tumbling-window operation
                on the data stream, when your selected attribute(s) is detected against a set criteria
                you get notified. You can choose and customize workflows using basic triggers, trigger
                aggregate, and machine-learning integration. More advanced workflows will become
                available early-2025 (stay tuned).
            `}</div>
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
export default USNationalWeather;
