/**
 * candlestick.jsx: left-column for trigger candlestick
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import MultiSelect from '../../../../general/multiselect.jsx';
import SvgExit from '../../../../svg/svg-exit.jsx';
import PropTypes from 'prop-types';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { isMobile } from 'react-device-detect';
import getData from '../../../../general/get-data.js';
import { dstDate } from '../../../../general/dst.js';
import { setHide }  from '../../../../redux/action/hide.jsx';
import checkValidBool from '../../../../validator/valid-bool.js';
import checkValidString from '../../../../validator/valid-string.js';
import checkValidArray from '../../../../validator/valid-array.js';
import checkValidObject from '../../../../validator/valid-object.js';
import checkValidInt from '../../../../validator/valid-int.js';

class CandlestickLeftColumn extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        expanded: PropTypes.bool,
        display_filter_button: PropTypes.bool,
        display_apply_filter_button: PropTypes.bool,
        trigger_rate: PropTypes.string,
        listing_graphic_title: PropTypes.string,
        chart_data_keys: PropTypes.PropTypes.array,
        selected_rate: PropTypes.PropTypes.array,
        selected_candlestick: PropTypes.PropTypes.array,
        candlestick_rates: PropTypes.PropTypes.array,
        toggleChartScale: PropTypes.PropTypes.func,
        display_candlestick: PropTypes.bool,
        dispatchHide: PropTypes.func,
        mm: PropTypes.string,
        yyyy: PropTypes.number,
    }

    constructor(props) {
        super(props);
        const today = dstDate();

        if (
            'expanded' in this.props && checkValidBool(this.props.expanded)
        ) {
            var expanded = this.props.expanded;
        } else {
            var expanded = false;
        }

        if (
            'display_filter_button' in this.props && checkValidBool(this.props.display_filter_button)
        ) {
            var display_filter_button = this.props.display_filter_button;
        } else {
            var display_filter_button = false;
        }

        if (
            'display_apply_filter_button' in this.props && checkValidBool(this.props.display_apply_filter_button)
        ) {
            var display_apply_filter_button = this.props.display_apply_filter_button;
        } else {
            var display_apply_filter_button = false;
        }

        //
        // the guard used to read 'this.props.trigger', a prop that does not
        // exist, so it was always false and the rate fell back to 'Daily' however
        // the chart was actually scaled -- the mobile filter header read a month
        // name on a minute chart.
        //
        if (
            'trigger_rate' in this.props && checkValidString(this.props.trigger_rate)
        ) {
            var trigger_rate = this.props.trigger_rate;
        } else {
            var trigger_rate = 'Daily';
        }

        if (
            'listing_graphic_title' in this.props && checkValidString(this.props.listing_graphic_title)
        ) {
            var listing_graphic_title = this.props.listing_graphic_title;
        } else {
            var listing_graphic_title = '';
        }

        if (
            'chart_data_keys' in this.props && checkValidArray(this.props.chart_data_keys)
        ) {
            var chart_data_keys = this.props.chart_data_keys;
        } else {
            var chart_data_keys = [];
        }

        if (
            'selected_rate' in this.props && checkValidArray(this.props.selected_rate)
        ) {
            var selected_rate = this.props.selected_rate;
        } else {
            var selected_rate = [trigger_rate.toLowerCase()];
        }

        if (
            'selected_candlestick' in this.props && checkValidArray(this.props.selected_candlestick)
        ) {
            var selected_candlestick = this.props.selected_candlestick;
        } else {
            var selected_candlestick = [];
        }

        if (
            'candlestick_rates' in this.props && checkValidArray(this.props.candlestick_rates)
        ) {
            var candlestick_rates = this.props.candlestick_rates;
        } else {
            var candlestick_rates = [];
        }

        if (
            'toggleChartScale' in this.props
        ) {
            var toggleChartScale = this.props.toggleChartScale;
        } else {
            var toggleChartScale = Function();
        }

        if (
            'display_candlestick' in this.props && checkValidBool(this.props.display_candlestick)
        ) {
            var display_candlestick = this.props.display_candlestick;
        } else {
            var display_candlestick = false;
        }

        if (
            'mm' in this.props && checkValidInt(this.props.mm)
        ) {
            var mm = this.props.mm;
        } else {
            var mm = String(today.getMonth() + 1).padStart(2, '0'); // january is 0;
        }

        if (
            'yyyy' in this.props && checkValidInt(this.props.yyyy)
        ) {
            var yyyy = this.props.yyyy;
        } else {
            var yyyy = today.getFullYear();
        }

        this.state = {
            expanded: expanded,
            display_filter_button: display_filter_button,
            display_apply_filter_button: display_apply_filter_button,
            trigger_rate: trigger_rate,
            listing_graphic_title: listing_graphic_title,
            chart_data_keys: chart_data_keys,
            selected_rate: selected_rate,
            selected_candlestick: selected_candlestick,
            candlestick_rates: candlestick_rates,
            toggleChartScale: toggleChartScale,
            scale_current: trigger_rate,
            display_candlestick: display_candlestick,
            mm: mm,
            yyyy: yyyy
        }

        this.toggleMultiLineChart = this.toggleMultiLineChart.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        //
        // Every clause compares against prevPROPS. Four of them used to compare
        // the incoming prop against prevSTATE, which fires whenever state
        // disagrees with props for ANY reason -- including the user having just
        // changed it here. Toggling the candlestick switch was undone on the very
        // next update: the redux dispatch had already gone out, so the graph hid
        // while the switch showed it as on.
        //
        // A prop is a change only when the PAGE changes it, which is what
        // prevProps says and prevState does not.
        //
        if (
            'chart_data_keys' in this.props
            && 'chart_data_keys' in prevProps
            && this.props.chart_data_keys !== prevProps.chart_data_keys
        ) {
            this.setState({ chart_data_keys: this.props.chart_data_keys });
        }

        if (
            'selected_rate' in this.props
            && 'selected_rate' in prevProps
            && this.props.selected_rate !== prevProps.selected_rate
        ) {
            this.setState({ selected_rate: this.props.selected_rate });
        }

        if (
            'trigger_rate' in this.props
            && 'trigger_rate' in prevProps
            && this.props.trigger_rate !== prevProps.trigger_rate
        ) {
            this.setState({ trigger_rate: this.props.trigger_rate });
        }

        if (
            'display_candlestick' in this.props
            && 'display_candlestick' in prevProps
            && this.props.display_candlestick !== prevProps.display_candlestick
        ) {
            this.setState({ display_candlestick: this.props.display_candlestick });
        }

        if (
            'selected_candlestick' in this.props
            && 'selected_candlestick' in prevProps
            && this.props.selected_candlestick !== prevProps.selected_candlestick
        ) {
            this.setState({ selected_candlestick: this.props.selected_candlestick });
        }
    }

    filterColumn() {
        if (this.state.display_filter_button) {
            if (this.state.trigger_rate.toLowerCase() === 'minutes') {
                var title_count = 'Now';
            } else if (this.state.trigger_rate.toLowerCase()=== 'hourly') {
                var title_count = 'Today';
            } else if (this.state.trigger_rate.toLowerCase() === 'daily') {
                var title_count = getData('list-months')[parseInt(this.state.mm) - 1];
            } else if (this.state.trigger_rate.toLowerCase() === 'monthly') {
                var title_count = this.state.yyyy;
            }

            const header = isMobile && this.state.listing_graphic_title
                ? (
                    <div className='listing-graphic-title'>
                        <h5>{this.state.listing_graphic_title}</h5>
                        <span className='title-count'> ({title_count})</span>
                    </div>
                ) : '';

            var button_filter = (
                <div className='d-block d-md-none filter'>
                    {header}
                    <button className='btn' type='button' onClick={() => {
                        this.setState({
                            display_filter_button: false,
                            display_apply_filter_button: true
                        })
                        this.props.dispatchHide(setHide({'type': 'SET-HIDE-ALL', 'action': true}));
                    }}>Filter</button>
                </div>
            );
            var filter = null;
            var apply_filter = null;
        } else {
            const class_parent = this.state.expanded
                ? 'checkbox-vertical checkbox-vertical-expanded'
                : 'col-md-3 d-none d-md-block checkbox-vertical checkbox-vertical-default';

            const class_date_label = this.state.expanded ? 3 : 12;

            const multiselect_candlestick = this.state.display_candlestick
                ? (
                    <>
                        <div className='row'>
                            <MultiSelect
                                input_label='Rate'
                                data={this.state.candlestick_rates}
                                items={this.state.selected_rate}
                                multi={false}
                                callback={(item) => {
                                    if (
                                        checkValidObject('selected', item)
                                        && checkValidArray(item.selected)
                                    ) {
                                        var scale_current = item.selected.slice(-1)[0];
                                        this.setState({
                                            selected_rate: item.selected.slice(-1),
                                            scale_current: scale_current
                                        });
                                    } else {
                                        var scale_current = this.state.scale_current;
                                        this.setState({ selected_rate: [] });
                                    }
                                    this.state.toggleChartScale(
                                        scale_current,
                                        this.state.selected_candlestick
                                    );
                                }}
                            />
                        </div>

                        <div className='row'>
                            <MultiSelect
                                input_label='Pattern'
                                data={this.state.chart_data_keys}
                                items={this.state.selected_candlestick}
                                callback={(item) => {
                                    if (
                                        checkValidObject('selected', item)
                                        && checkValidArray(item.selected)
                                    ) {
                                        var selected = item.selected;
                                    } else {
                                        var selected = this.state.selected_candlestick;
                                    }
                                    this.setState({ selected_candlestick: selected });
                                    this.state.toggleChartScale(this.state.scale_current, selected);
                                }}
                            />
                        </div>
                    </>
                ) : ''

            var filter = (
                <div className={class_parent}>
                    <div className='row'>
                        <FormControl
                            component='fieldset'
                            variant='standard'
                            className={`col-lg-${class_date_label} col-sm-${class_date_label}`}
                        >
                            <FormGroup>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={this.state.display_candlestick}
                                            onChange={() => this.toggleMultiLineChart()}
                                            name='Candlestick'
                                        />
                                    }
                                    label='Candlestick'
                                />
                            </FormGroup>
                        </FormControl>
                    </div>
                    {multiselect_candlestick}
                </div>
            );

            if (this.state.display_apply_filter_button) {
                var button_exit = (
                    <span className='exit' onClick={() => {
                        this.setState({
                            display_filter_button: true,
                            display_apply_filter_button: false
                        });
                        this.props.dispatchHide(setHide({'type': 'SET-HIDE-ALL', 'action': false}));
                    }}>
                        <SvgExit />
                    </span>
                );
                var button_filter = <h5>Edit Content Filter</h5>;
                var apply_filter = (
                    <div className='apply-filter'>
                        <button className='btn' type='button' onClick={() => {
                            this.setState({
                                display_filter_button: true,
                                display_apply_filter_button: false
                            });
                            this.props.dispatchHide(setHide({'type': 'SET-HIDE-ALL', 'action': false}));
                        }}>Apply Filter</button>
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

    toggleMultiLineChart() {
        this.props.dispatchHide(setHide({
            'type': 'SET-HIDE-GRAPH',
            'action': this.state.display_candlestick
        }));
        this.setState({ display_candlestick: ! this.state.display_candlestick });
    }

    render() {
        return(this.filterColumn());
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default CandlestickLeftColumn;
