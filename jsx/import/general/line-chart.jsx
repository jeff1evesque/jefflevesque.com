/**
 * line-chart.jsx: interactive area chart:
 *
 *   - https://github.com/react-d3-library/react-d3-library
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import * as d3 from 'd3';
import PropTypes from 'prop-types';
import checkValidObject from '../validator/valid-object.js';
import checkValidArray from '../validator/valid-array.js';
import checkValidString from '../validator/valid-string.js';
import checkValidFloat from '../validator/valid-float.js';
import checkValidBool from '../validator/valid-bool.js';

class MultiLineChart extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        color: PropTypes.array,
        data: PropTypes.array,
        data_keys: PropTypes.array,
        title: PropTypes.string,
        y_label: PropTypes.string,
        data_key: PropTypes.string,
        aspect_ratio: PropTypes.number,
        x_ticker_format: PropTypes.string,
        label_format: PropTypes.string,
        y_tick_format: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.bool
        ]),
        y_axis_line: PropTypes.bool,
        y_axis_tick_line: PropTypes.bool
    }

    constructor(props) {
        super(props);

        if ('data' in this.props && checkValidArray('data', this.props)) {
            var data = this.props.data;
        } else {
            var data = [];
        }

        if ('data_keys' in this.props && checkValidArray('data_keys', this.props)) {
            var data_keys = this.props.data_keys;
        } else {
            var data_keys = [];
        }

        if ('title' in this.props && checkValidString(this.props.title)) {
            var title = this.props.title;
        } else {
            var title = 'Area Chart';
        }

        if ('y_label' in this.props && checkValidString(this.props.y_label)) {
            var y_label = this.props.y_label;
        } else {
            var y_label = '';
        }

        if ('data_key' in this.props && checkValidString(this.props.data_key)) {
            var data_key = this.props.data_key;
        } else {
            var data_key = 'name';
        }

        if ('aspect_ratio' in this.props && checkValidFloat(this.props.aspect_ratio)) {
            var aspect_ratio = this.props.aspect_ratio;
        } else {
            var aspect_ratio = 5/3;
        }

        if ('color' in this.props && checkValidArray('color', this.props)) {
            var color = this.props.color;
        } else {
            var color = ['#8884d8', '#82ca9d', '#ffc658'];
        }

        if ('x_ticker_format' in this.props && checkValidString(this.props.x_ticker_format)) {
            var x_ticker_format = this.props.x_ticker_format;
        } else {
            var x_ticker_format = '%I:%M%p';
        }

        if ('label_format' in this.props && checkValidString(this.props.label_format)) {
            var label_format = this.props.label_format;
        } else {
            var label_format = '%B %d, %Y %H:%M%Z';
        }

        if ('y_tick_format' in this.props && (
            checkValidBool(this.props.y_tick_format) || checkValidString(this.props.y_tick_format)
        )) {
            var y_tick_format = this.props.y_tick_format;
        } else {
            var y_tick_format = true;
        }

        if ('y_axis_line' in this.props && checkValidBool(this.props.y_axis_line)) {
            var y_axis_line = this.props.y_axis_line;
        } else {
            var y_axis_line = true;
        }

        if ('y_axis_tick_line' in this.props && checkValidBool(this.props.y_axis_tick_line)) {
            var y_axis_tick_line = this.props.y_axis_tick_line;
        } else {
            var y_axis_tick_line = true;
        }

        this.state = {
            data: data,
            data_keys: data_keys,
            title: title,
            y_label: y_label,
            data_key: data_key,
            color: color,
            aspect_ratio: aspect_ratio,
            x_ticker_format: x_ticker_format,
            label_format: label_format,
            y_tick_format: y_tick_format,
            y_axis_line: y_axis_line,
            y_axis_tick_line: y_axis_tick_line
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'data' in this.props
            && Array.isArray(this.props.data)
            && 'data' in prevProps
            && Array.isArray(prevProps.data)
            && this.props.data !== prevProps.data
        ) {
            this.setState({ data: this.props.data });
        }

        if (
            'data_keys' in this.props
            && Array.isArray(this.props.data_keys)
            && 'data_keys' in prevProps
            && Array.isArray(prevProps.data_keys)
            && this.props.data_keys !== prevProps.data_keys
        ) {
            this.setState({ data_keys: this.props.data_keys });
        }

        if (
            'title' in this.props
            && checkValidString(this.props.title)
            && 'title' in prevProps
            && checkValidString(prevProps.title)
            && this.props.title !== prevProps.title
        ) {
            this.setState({ title: this.props.title });
        }

        if (
            'y_label' in this.props
            && checkValidString(this.props.y_label)
            && 'y_label' in prevProps
            && checkValidString(prevProps.y_label)
            && this.props.y_label !== prevProps.y_label
        ) {
            this.setState({ y_label: this.props.y_label });
        }

        if (
            'data_key' in this.props
            && 'data_key' in prevProps
            && this.props.data_key !== prevProps.data_key
        ) {
            this.setState({ data_key: this.props.data_key });
        }

        if (
            'color' in this.props
            && Array.isArray(this.props.color)
            && this.props.color.length > 0
            && 'color' in prevProps
            && Array.isArray(prevProps.color)
            && this.props.color !== prevProps.color
        ) {
            this.setState({ color: this.props.color });
        }

        if (
            'aspect_ratio' in this.props
            && checkValidFloat(this.props.aspect_ratio)
            && this.props.aspect_ratio > 0
            && 'aspect_ratio' in prevProps
            //
            // 'checkValidFloat' -- this read 'Array.isArray(prevProps.aspect_ratio)',
            // and aspect_ratio is a NUMBER, so the test was false for every value it
            // could hold and the branch was unreachable: the constructor's ratio was
            // permanent. trigger.jsx computes it from isMobile, so a rotation left the
            // chart at whatever ratio it happened to mount with.
            //
            && checkValidFloat(prevProps.aspect_ratio)
            && this.props.aspect_ratio !== prevProps.aspect_ratio
        ) {
            this.setState({ aspect_ratio: this.props.aspect_ratio });
        }

        if (
            'x_ticker_format' in this.props
            && 'x_ticker_format' in prevProps
            && this.props.x_ticker_format !== prevProps.x_ticker_format
        ) {
            this.setState({ x_ticker_format: this.props.x_ticker_format });
        }

        if (
            'label_format' in this.props
            && 'label_format' in prevProps
            && this.props.label_format !== prevProps.label_format
        ) {
            this.setState({ label_format: this.props.label_format });
        }

        if (
            'y_tick_format' in this.props
            //
            // validated here as well as in the constructor. Without this the same value
            // behaved differently depending on when it arrived: the constructor rejects
            // null and '' and falls back to true, while this branch used to adopt them
            // unchecked -- so mounting with null rendered ordinary numbers and CHANGING
            // to null blanked the axis. 'false' still passes, which is the only falsy
            // spelling the constructor ever accepted.
            //
            && (checkValidBool(this.props.y_tick_format) || checkValidString(this.props.y_tick_format))
            && 'y_tick_format' in prevProps
            && this.props.y_tick_format !== prevProps.y_tick_format
        ) {
            this.setState({ y_tick_format: this.props.y_tick_format });
        }

        if (
            'y_axis_line' in this.props
            && 'y_axis_line' in prevProps
            && this.props.y_axis_line !== prevProps.y_axis_line
        ) {
            this.setState({ y_axis_line: this.props.y_axis_line });
        }

        if (
            'y_axis_tick_line' in this.props
            && 'y_axis_tick_line' in prevProps
            && this.props.y_axis_tick_line !== prevProps.y_axis_tick_line
        ) {
            this.setState({ y_axis_tick_line: this.props.y_axis_tick_line });
        }
    }

    render() {
        if (this.state.data) {
            var x_axis = <XAxis dataKey={this.state.data_key} tickFormatter={d3.timeFormat(this.state.x_ticker_format)} />;
        } else {
            var x_axis = <XAxis dataKey={this.state.data_key} tickFormatter={(value) => ''} />;
        }

        if (this.state.y_tick_format === 'exponential' || this.state.y_tick_format  === 'exp') {
            var y_axis = (
                <YAxis
                    tickFormatter={(value) => Number(value).toExponential(0)}
                    axisLine={this.state.y_axis_line}
                />
            )
        } else if (this.state.y_tick_format === null || this.state.y_tick_format === '' || this.state.y_tick_format === false) {
            var y_axis = (
                <YAxis
                    tickLine={this.state.y_axis_tick_line}
                    tickFormatter={(value) => ''}
                    axisLine={this.state.y_axis_line}
                />
            );
        } else {
            var y_axis = (
                <YAxis
                    tickLine={this.state.y_axis_tick_line}
                    tickFormatter={(value) => value}
                    axisLine={this.state.y_axis_line}
                />
            );
        }

        return (
            <ResponsiveContainer width='100%' aspect={this.state.aspect_ratio}>
                <LineChart
                    data={this.state.data}
                    margin={{
                        top: 20,
                        right: 20,
                        left: this.state.y_tick_format ? -10 : -55,
                        bottom: 0
                    }}
                >
                    <CartesianGrid strokeDasharray='3 3' />
                    {x_axis}
                    {y_axis}
                    <Tooltip labelFormatter={d3.timeFormat(this.state.label_format)} />
                    {
                        this.state.data_keys.map((entry, index) => {
                            if (
                                checkValidArray(this.state.color)
                                && checkValidObject('r', this.state.color[index])
                                && checkValidObject('g', this.state.color[index])
                                && checkValidObject('b', this.state.color[index])
                            ) {
                                var color = `rgb(${this.state.color[index].r}, ${this.state.color[index].g}, ${this.state.color[index].b})`;
                            } else {
                                var color = this.state.color[index];
                            }

                            return(
                                <Line
                                    key={`line-${index}`}
                                    type='monotone'
                                    dataKey={this.state.data_keys[index]}
                                    activeDot={{ r: 8 }}
                                    stroke={color}
                                />
                            )
                        })
                    }
                </LineChart>
            </ResponsiveContainer>
        )
    }
}

export default MultiLineChart;
