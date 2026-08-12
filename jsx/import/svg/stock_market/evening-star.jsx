/**
 * evening-star.jsx: render candlestick svg.
 *
 * @EveningStar, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';

class EveningStar extends Component {
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
                    <g id='EveningStar'>
                        <g id='CenterCandleSticks' transform='matrix(1,0,0,1,0,-359)'>
                            <g transform='matrix(-0.000600436,-0.968279,-1.20487,0.000747149,930.833,786.093)'>
                                <g id='VerticalLine'>
                                    <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                                </g>
                            </g>
                            <g id='Box' transform='matrix(0.956016,0,0,0.426574,249.146,408.69)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787'/>
                            </g>
                            <g id='CloseText' transform='matrix(1,-1.2326e-32,6.50521e-19,1,-149.782,180.64)'>
                                <text x='665.264px' y='477.937px' style={supplement_text}>bullish or bearish</text>
                            </g>
                            <g id='SmallBody' transform='matrix(1,-1.2326e-32,6.50521e-19,1,-151.26,161.569)'>
                                <text x='665.264px' y='477.937px' style={font_family_smaller}>Small Body</text>
                            </g>
                        </g>
                        <g id='BodyWhiskerRatio' transform='matrix(1,0,0,1,10,170)'>
                            <g transform='matrix(1,4.33681e-19,8.13152e-20,1,399.284,404.241)'>
                                <g id='Ratio'>
                                    <g id='Text'>
                                        <text x='25.38px' y='0px' style={font_family_smaller}>Body-Whisker</text>
                                        <text x='36.921px' y='21.333px' style={font_family_smaller}>Ratio &gt; 70%</text>
                                    </g>
                                </g>
                            </g>
                            <g id='LeftArrow' transform='matrix(0.384884,0,0,1,255.514,0)'>
                                <g transform='matrix(2.59819,-0,-0,1,-71.9088,76.9561)'>
                                    <path d='M170.249,335.092L162.812,331.217L170.373,327.593L170.249,335.092Z'/>
                                    <path d='M193.811,331.733L168.811,331.317' style={arrow_style}/>
                                </g>
                            </g>
                            <g id='RightArrow' transform='matrix(0.351217,0,0,1,368.645,0)'>
                                <g transform='matrix(2.84724,-0,-0,1,-400.911,76.9561)'>
                                    <path d='M369.325,328.061L376.785,331.889L369.246,335.56L369.325,328.061Z'/>
                                    <path d='M345.785,331.564L370.785,331.826' style={arrow_style}/>
                                </g>
                            </g>
                        </g>
                        <g id='RightCandleStick' transform='matrix(1,0,0,1,296,-29)'>
                            <g id='VerticalLine1' serifid='VerticalLine' transform='matrix(-0.00186135,-3.00166,-1.03848,0.00064397,736.314,929.834)'>
                                <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                            </g>
                            <g id='Box1' serifid='Box' transform='matrix(0.956016,0,0,4.09113,113.545,-2076.53)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(213,44,19)'}}/>
                            </g>
                            <g id='OpenClose' transform='matrix(1,0,0,1,125,23)'>
                                <g id='Open' transform='matrix(1,0,0,1,303.273,397.345)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                </g>
                                <g id='Close' transform='matrix(1,0,0,1,303.273,635.345)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                </g>
                                <g id='CloseText1' serifid='CloseText' transform='matrix(1,-1.2326e-32,6.50521e-19,1,-361.793,179.535)'>
                                    <text x='665.264px' y='477.937px' style={supplement_text}>below preceding</text>
                                    <text x='665.264px' y='494.461px' style={supplement_text}>midline, more bearish</text>
                                    <text x='665.264px' y='510.984px' style={supplement_text}>when lower close</text>
                                </g>
                            </g>
                            <g transform='matrix(1,0,0,1,341.797,705.617)'>
                                <g id='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                            <g transform='matrix(1,0,0,1,341.444,358.707)'>
                                <g id='High'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
                                </g>
                            </g>
                        </g>
                        <g id='LeftCandleStick' transform='matrix(1,0,0,1,-73,0)'>
                            <g id='VerticalLine2' serifid='VerticalLine' transform='matrix(-0.00225164,-3.63105,-1.20487,0.000747151,847.34,952.859)'>
                                <path d='M83.26,351.206C82.981,351.206 82.755,351.95 82.755,352.866C82.755,353.782 82.981,354.526 83.26,354.526C117.235,354.526 151.761,354.028 185.526,354.028C185.804,354.028 186.031,353.284 186.031,352.368C186.031,351.452 185.804,350.708 185.526,350.708C151.761,350.708 117.235,351.206 83.26,351.206Z'/>
                            </g>
                            <g id='Box2' serifid='Box' transform='matrix(0.956016,0,0,4.78153,165.545,-2559.43)'>
                                <rect x='218.687' y='606.666' width='100.615' height='62.787' style={{fill:'rgb(39,154,33)'}}/>
                            </g>
                            <g id='CloseOpen' transform='matrix(1,0,0,1,-412,-4)'>
                                <g id='Close1' serifid='Close' transform='matrix(1,0,0,1,721.827,362.444)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Close</text>
                                </g>
                                <g id='Open1' serifid='Open' transform='matrix(1,0,0,1,722.827,644.444)'>
                                    <text x='0px' y='0px' style={font_family_smaller}>Open</text>
                                </g>
                            </g>
                            <g id='_50PercentLine' serifid='50PercentLine' transform='matrix(1.02831,-0.000234829,-0.000190469,1,-4.03653,-3.81664)'>
                                <path d='M355.302,495.249L781.243,494.876' style={arrow_style}/>
                            </g>
                            <g id='_50PercentLabel' serifid='50PercentLabel' transform='matrix(1,0,0,1,-2.28764,15.4383)'>
                                <text x='317.943px' y='481.621px' style={font_family_smaller}>50%</text>
                            </g>
                            <g transform='matrix(1,0,0,1,394.412,677.088)'>
                                <g id='Low1' serifid='Low'>
                                    <text x='0px' y='0px' style={font_family}>Low</text>
                                </g>
                            </g>
                            <g transform='matrix(1,0,0,1,392.06,266.045)'>
                                <g id='High1' serifid='High'>
                                    <text x='0px' y='0px' style={font_family}>High</text>
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
export default EveningStar;
