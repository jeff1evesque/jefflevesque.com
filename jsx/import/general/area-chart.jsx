/**
 * area-chart.jsx: interactive area chart:
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
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import * as d3 from 'd3';
import PropTypes from 'prop-types';
import checkValidArray from '../validator/valid-array.js';
import checkValidString from '../validator/valid-string.js';
import checkValidInt from '../validator/valid-int.js';
import checkValidFloat from '../validator/valid-float.js';
import checkValidBool from '../validator/valid-bool.js';
import { colors_categorical, color_tail } from './colors.js';

class StackedAreaChart extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        data: PropTypes.array,
        data_keys: PropTypes.array,
        title: PropTypes.string,
        y_label: PropTypes.string,
        data_key: PropTypes.string,
        height: PropTypes.number,
        aspect_ratio: PropTypes.number,
        x_ticker_format: PropTypes.string,
        label_format: PropTypes.string,
        y_tick_format: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.bool
        ]),
        y_axis_line: PropTypes.bool,
        y_axis_tick_line: PropTypes.bool,
        x_axis_height: PropTypes.number,
        x_axis_angle: PropTypes.number,
        x_axis_anchor: PropTypes.string
    }

    constructor(props) {
        super(props);

        if ('data' in this.props && checkValidArray('data', this.props)) {
            var data = this.props.data;
        } else {
            var data = []
        }

        if ('data_keys' in this.props && checkValidArray('data_keys', this.props)) {
            var data_keys = this.props.data_keys;
        } else {
            var data_keys = []
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

        {/*

            an explicit height wins over the aspect ratio: a container-relative
            aspect cannot be made to agree with the distribution barchart, which
            is sized off the viewport instead -- see 'chart-height.js'

        */}
        if ('height' in this.props && checkValidInt(this.props.height)) {
            var height = this.props.height;
        } else {
            var height = null;
        }

        {/*

            fall back to the shared categorical palette rather than recharts'
            demo hues, so a caller that omits 'color' still renders in the same
            scheme as every other chart

        */}
        if ('color' in this.props && checkValidArray('color', this.props)) {
            var color = this.props.color;
        } else {
            var color = colors_categorical;
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

        {/*

            reserve the same band below the plot as the distribution barchart,
            so an equal container height yields an equal plotted height

        */}
        if ('x_axis_height' in this.props && checkValidInt(this.props.x_axis_height)) {
            var x_axis_height = this.props.x_axis_height;
        } else {
            var x_axis_height = null;
        }

        {/*

            an angled label descends into the reserved band rather than sitting
            on one line at the top of it, which is both how the barchart reads
            and less empty space above the listing

        */}
        if ('x_axis_angle' in this.props && checkValidInt(this.props.x_axis_angle)) {
            var x_axis_angle = this.props.x_axis_angle;
        } else {
            var x_axis_angle = 0;
        }

        if ('x_axis_anchor' in this.props && checkValidString(this.props.x_axis_anchor)) {
            var x_axis_anchor = this.props.x_axis_anchor;
        } else {
            var x_axis_anchor = 'middle';
        }

        if ('y_axis_width' in this.props && checkValidInt(this.props.y_axis_width)) {
            var y_axis_width = this.props.y_axis_width;
        } else {
            var y_axis_width = 60;
        }

        this.state = {
            data: data,
            data_keys: data_keys,
            title: title,
            y_label: y_label,
            data_key: data_key,
            color: color,
            height: height,
            aspect_ratio: aspect_ratio,
            x_ticker_format: x_ticker_format,
            label_format: label_format,
            y_tick_format: y_tick_format,
            y_axis_line: y_axis_line,
            y_axis_tick_line: y_axis_tick_line,
            y_axis_width: y_axis_width,
            x_axis_height: x_axis_height,
            x_axis_angle: x_axis_angle,
            x_axis_anchor: x_axis_anchor
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
            && this.props.color !== prevProps.color
        ) {
            this.setState({ color: this.props.color });
        }

        if (
            'height' in this.props
            && checkValidInt(this.props.height)
            && this.props.height !== prevProps.height
        ) {
            this.setState({ height: this.props.height });
        }

        if (
            'aspect_ratio' in this.props
            && checkValidFloat(this.props.aspect_ratio)
            && this.props.aspect_ratio > 0
            && 'aspect_ratio' in prevProps
            //
            // 'checkValidFloat' -- this read 'Array.isArray(prevProps.aspect_ratio)'
            // and 'prevProps.aspect_ratio.length > 0', and aspect_ratio is a NUMBER, so
            // both tests were false for every value it could hold and the branch was
            // unreachable: the constructor's ratio was permanent.
            //
            // the same defect line-chart.jsx carried and was fixed for, copied from the
            // 'color' clause above -- where the array tests are correct, because that
            // prop IS one. Fixed here second because this chart is given an explicit
            // 'height' by the stream page, which wins over the ratio entirely, so the
            // stale value had nothing to show through.
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
        const x_axis_geometry = {
            ...(this.state.x_axis_height ? { height: this.state.x_axis_height } : {}),
            angle: this.state.x_axis_angle,
            textAnchor: this.state.x_axis_anchor
        };

        if (this.state.data) {
            var x_axis = (
                <XAxis
                    dataKey={this.state.data_key}
                    tickFormatter={d3.timeFormat(this.state.x_ticker_format)}
                    {...x_axis_geometry}
                />
            );
        } else {
            var x_axis = (
                <XAxis
                    dataKey={this.state.data_key}
                    tickFormatter={(value) => ''}
                    {...x_axis_geometry}
                />
            );
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
                    width={this.state.y_axis_width}
                />
            );
        }

        return (
            <ResponsiveContainer
                width='100%'
                {...(this.state.height
                    ? { height: this.state.height }
                    : { aspect: this.state.aspect_ratio }
                )}
            >
                <AreaChart
                    width='100%'
                    height={400}
                    data={this.state.data}
                    margin={{
                        top: 20,
                        right: 20,
                        left: this.state.y_tick_format ? -10 : -55,
                        // matches the barchart's bottom margin, so the two
                        // charts subtract the same total from their plot band
                        bottom: 8
                    }}
                >
                    <CartesianGrid strokeDasharray='3 3' />
                    {x_axis}
                    {y_axis}
                    {/*

                        an ingest count runs to seven digits, and a bare run of
                        numerals is read digit by digit rather than at a glance,
                        so the tooltip separates thousands the same way the
                        article listing beneath the chart does. anything that is
                        not a finite number passes through untouched

                    */}
                    <Tooltip
                        labelFormatter={d3.timeFormat(this.state.label_format)}
                        formatter={(value) => Number.isFinite(Number(value))
                            ? Number(value).toLocaleString()
                            : value
                        }
                    />

                    {
                        this.state.data_keys.map((v, i) => {
                            {/*

                                past the palette the series join the long tail:
                                one desaturated hue separated by lightness, the
                                same fold the distribution bars use. indexing
                                straight into the palette returned 'undefined'
                                here, which recharts renders as a black area

                            */}
                            const color = i < this.state.color.length
                                ? this.state.color[i]
                                : color_tail(
                                    i - this.state.color.length,
                                    Math.max(this.state.data_keys.length - this.state.color.length, 0)
                                );

                            {/*

                                recharts fills an area at 0.6 alpha by default,
                                which washes every hue toward white and reads as
                                a paler palette than the opaque distribution
                                bars. the areas are stacked rather than overlaid,
                                so nothing is hidden by making them solid

                            */}
                            return(
                                <Area
                                    key={i}
                                    type='monotone'
                                    dataKey={this.state.data_keys[i]}
                                    stackId='1'
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={1}
                                />
                            )
                        })
                    }
                </AreaChart>
            </ResponsiveContainer>
        )
    }
}

export default StackedAreaChart;
