/**
 * bullish-engulfing.jsx: render candlestick svg.
 *
 * @BullishEngulfing, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';

class BullishEngulfing extends Component {
    constructor() {
        super();
    }

    render() {
        const font_family = {
            fontFamily:'Arial-BoldMT, Arial, sans-serif',
            fontWeight:700,
            fontSize:'26.667px'
        };

        const font_family_smaller = {
            fontFamily:'Arial-BoldMT, Arial, sans-serif',
            fontWeight: 700,
            fontSize:'21.333px'
        };

        const arrow_style = {
            fill:'none',
            stroke:'rgb(128,128,128)',
            strokeWidth:'2.5px'
        };

        const supplement_text = {
            fontFamily:'ArialMT Arial sans-serif',
            fontSize:'16px',
            fill:'rgb(128,128,128)'
        }

        return(
            <svg
                width='100%'
                height='100%'
                viewBox='0 0 691 495'
                version='1.1'
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                xmlSpace='preserve'
                xmlnsserif='http://www.serif.com/'
                style={{fillRule:'evenodd',clipRule:'evenodd',strokeLinecap:'round',strokeLinejoin:'round',strokeMiterlimit:1.5,padding:'0 1.25rem 0 1.25rem'}}
            >
                <g transform='matrix(1,0,0,1,-165.86,-236.813)'>
                    <g id='BullishEngulfing'>
                        <g id='CenterCandleSticks' transform='matrix(0.956016,0,0,0.971814,178.545,26.457)'>
                            <g id='LeftVerticalLine' transform='matrix(-0.00256896,-4.07543,-1.2603,0.000768821,693.329,1018.96)'>
                                <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                            </g>
                            <g id='RightVerticalLine' transform='matrix(-0.00256896,-4.07543,-1.2603,0.000768821,889.979,1018.96)'>
                                <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                            </g>
                            <g id='LeftCandleStick' transform='matrix(1,0,0,3.57206,-19.8741,-1803.16)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(213,44,19)'}}/>
                            </g>
                            <g id='RightCandleStick' transform='matrix(1,0,0,5.2596,176.775,-2887.14)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(39,154,33)'}}/>
                            </g>
                            <g id='CloseOpen' transform='matrix(1.04601,0,0,1.029,401.924,-147.342)'>
                                <g transform='matrix(1,0,0,1,98.036,455.176)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                </g>
                                <g transform='matrix(1,0,0,1,98.036,754.176)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                </g>
                            </g>
                            <g id='OpenClose' transform='matrix(1.04601,0,0,1.029,27.9193,-150.531)'>
                                <g id='Open' transform='matrix(1,0,0,1,104.036,517.176)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                </g>
                                <g id='Close' transform='matrix(1,0,0,1,98.036,715.176)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                </g>
                            </g>
                            <g id='EngulfLines'>
                                <g id='TopEngulfingLIne' transform='matrix(0.540267,-0.00024164,-0.000100071,1.029,112.437,-143.204)'>
                                    <path d='M355.302,495.249L781.243,494.876' style={arrow_style}/>
                                </g>
                                <g id='BottomEngulfingLIne' transform='matrix(0.540267,-0.00024164,-0.000100071,1.029,112.437,77.0023)'>
                                    <path d='M355.302,495.249L781.243,494.876' style={arrow_style}/>
                                </g>
                                <g id='Text' transform='matrix(1.04601,-1.26834e-32,6.8045e-19,1.029,-192.152,-29.1231)'>
                                    <text x='665.264px' y='477.937px' style={supplement_text}>completely</text>
                                    <text x='665.264px' y='494.461px' style={supplement_text}>engulf previous</text>
                                    <text x='665.264px' y='510.984px' style={supplement_text}>candle body</text>
                                </g>
                                <g id='BottomArrow' transform='matrix(1.04601,0,0,0.857132,-186.76,171.93)'>
                                    <g transform='matrix(1,-0,-0,1.20052,184.687,99.1674)'>
                                        <path d='M487.407,307.578L491.148,315.083L494.907,307.587L487.407,307.578Z'/>
                                        <path d='M491.155,309.083L491.233,244.083' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='TopArrow' transform='matrix(1.04601,0,0,0.857132,-186.76,41.2465)'>
                                    <g transform='matrix(1,-0,-0,1.20052,184.687,251.633)'>
                                        <path d='M487.481,118.578L491.24,111.083L494.981,118.587L487.481,118.578Z'/>
                                        <path d='M491.155,182.083L491.233,117.083' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='TopLabels' transform='matrix(1,0,0,1,10,0)'>
                            <g transform='matrix(0.438035,-0.000336413,0.000767998,0.999998,276.462,24.1035)'>
                                <g id='TopRightArrow'>
                                    <g>
                                        <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                            <g transform='matrix(-0.438035,-0.00020616,0.000470651,-0.999998,723.179,553.001)'>
                                <g id='TopLeftArrow'>
                                    <g>
                                        <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                        <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                                    </g>
                                </g>
                            </g>
                            <g id='TopLeftArrow1' serifid='TopLeftArrow'>
                            </g>
                            <g transform='matrix(1,4.33681e-19,8.13152e-20,1,471.544,295.233)'>
                                <g id='High'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
                                </g>
                            </g>
                        </g>
                        <g id='BottomLabels' transform='matrix(1,0,0,1,231,-21)'>
                            <g transform='matrix(1,0,0,1,248.436,708.728)'>
                                <g id='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                            <g id='BottomRightArrow' transform='matrix(0.438035,-0.000336413,0.000767998,0.999998,55.462,438.104)'>
                                <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                            </g>
                            <g id='BottomLeftArrow' transform='matrix(-0.438035,4.59581e-17,5.23587e-09,-0.999998,502.301,967.879)'>
                                <path d='M690.663,270.488L702.673,264.507L690.683,258.488L690.663,270.488Z' style={{fill:'rgb(128,128,128)'}}/>
                                <path d='M693.073,264.492L593.149,264.33' style={arrow_style}/>
                            </g>
                        </g>
                        <g id='LeftCandleStick1' serifid='LeftCandleStick' transform='matrix(1,0,0,1,-46,0)'>
                            <g opacity='0.1'>
                                <g id='LeftVerticalLine1' serifid='LeftVerticalLine' transform='matrix(0.000482169,-3.9604,1.3028,0.000158613,-184.803,1016.4)'>
                                    <path d='M83.26,354.401C82.981,354.401 82.755,353.713 82.755,352.866C82.755,352.019 82.981,351.331 83.26,351.331C117.235,351.331 151.761,350.832 185.526,350.832C185.804,350.832 186.031,351.52 186.031,352.368C186.031,353.215 185.804,353.903 185.526,353.903C151.761,353.903 117.235,354.401 83.26,354.401Z'/>
                                </g>
                                <g id='LeftBox' transform='matrix(0.956016,0,0,2.32531,21.6187,-1097.02)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(128,128,128)'}}/>
                                </g>
                            </g>
                        </g>
                        <g id='RightCandleStick1' serifid='RightCandleStick' transform='matrix(1,0,0,1,46,0)'>
                            <g opacity='0.1'>
                                <g id='RightVerticalLine1' serifid='RightVerticalLine' transform='matrix(-0.00245597,-3.96056,-1.20487,0.000747151,1164.98,1015.48)'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                                <g id='RightBox' transform='matrix(0.956016,0,0,1.50786,484.146,-607.957)'>
                                    <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(128,128,128)'}}/>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        )
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default BullishEngulfing;
