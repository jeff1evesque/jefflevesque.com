/**
 * sliding.jsx: sliding window svg.
 *
 * @Sliding, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import checkValidString from '../../validator/valid-string.js';
import checkValidInt from '../../validator/valid-int.js';

class Sliding extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        image_id: PropTypes.string,
    }

    constructor(props) {
        super(props);

        if ('image_id' in this.props && checkValidString(this.props.image_id)) {
            var image_id = this.props.image_id;
        } else {
            var image_id = 'Sliding';
        }

        if ('x_increment' in this.props && checkValidInt(this.props.x_increment)) {
            var x_increment = this.props.x_increment;
        } else {
            var x_increment = 1;
        }

        if ('x_unit' in this.props && checkValidString(this.props.x_unit)) {
            var x_unit = this.props.x_unit;
        } else {
            var x_unit = 'min';
        }

        this.state = {
            image_id: image_id,
            x_increment: x_increment,
            x_unit: x_unit
        }
    }

    render() {
        const font_family = {
            fontFamily:'ArialMT, Arial, sans-serif',
            fontSize:'14px'
        };

        const font_family_smaller = {
            fontFamily:'ArialMT, Arial, sans-serif',
            fontSize:'10px'
        };

        const arrow_style = {
            fill:'none',
            stroke:'black',
            strokeWidth:'1px'
        }

        const vertical_lines = {
            fill:'none',
            stroke:'rgb(68,68,68)',
            strokeWidth:'1.5px'
        };
        const vertical_lines_25 = {...vertical_lines, strokeOpacity: '0.25'};

        const circle_style = {
            stroke:'rgb(5,5,5)',
            strokeWidth:'0.87px',
            strokeDasharray:'0.87,0.87'
        };
        const circle_style_purple = {...circle_style, fill:'rgb(112,34,130)'};
        const circle_style_orange = {...circle_style, fill:'rgb(247,99,12)'};
        const circle_style_green = {...circle_style, fill:'rgb(76,173,49)'};
        const circle_style_blue = {...circle_style, fill:'rgb(0,120,215)'};

        const rectangle_style = {
            stroke:'rgb(255,0,39)',
            strokeWidth:'3.33px'
        };
        const rectangle_style_25 = {...rectangle_style, fill:'rgb(247,99,12)', fillOpacity:'0.25', strokeOpacity:'0.25'};
        const rectangle_style_50 = {...rectangle_style, fill:'rgb(112,34,130)', fillOpacity:'0.25', strokeOpacity:'0.50'};
        const rectangle_style_75 = {...rectangle_style, fill:'rgb(76,173,49)', fillOpacity:'0.25', strokeOpacity:'0.75'};
        const rectangle_style_100 = {...rectangle_style, fill:'rgb(0,120,215)', fillOpacity:'0.25', strokeOpacity:'1.00'};

        const axis_style = {
            fill:'rgb(0,120,215)',
            stroke:'rgb(5,5,5)',
            strokeWidth:'3px',
        };

        return(
            <svg
                width='100%'
                height='100%'
                viewBox='0 0 612 301'
                version='1.1'
                xmlns='http://www.w3.org/2000/svg'
                xmlnsXlink='http://www.w3.org/1999/xlink'
                xmlSpace='preserve'
                xmlnsserif='http://www.serif.com/'
                style={{fillRule:'evenodd',clipRule:'evenodd',strokeLinecap:'round',strokeLinejoin:'round',strokeMiterlimit:1.5,padding:'0 1.25rem 0 1.25rem'}}
            >
                <g transform='matrix(1,0,0,1,-37.2721,-12.2721)'>
                    <g id='SlidingWindow' transform='matrix(1,0,0,1,-83,0)'>
                        <g id='VerticalLines' transform='matrix(1,0,0,1,183.155,10)'>
                            <g id='Fourth'>
                                <g id='RightBottom' transform='matrix(1.24964,-0.000388431,0.0035708,0.0998934,299.679,235.028)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                                <g id='RightTop' transform='matrix(1.24964,-0.000624472,0.0035708,0.160596,299.679,49.6369)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines_25}/>
                                </g>
                            </g>
                            <g id='Third'>
                                <g id='RightBottom1' serifid='RightBottom' transform='matrix(1.24964,-0.000805044,0.0035708,0.207034,199.679,180.431)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                                <g id='RightTop1' serifid='RightTop' transform='matrix(1.24964,-0.00104136,0.0035708,0.267809,199.679,-2.97102)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines_25}/>
                                </g>
                            </g>
                            <g id='Second'>
                                <g id='Left' transform='matrix(1.24964,-0.00124963,0.0035708,0.32137,-100.166,123.449)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                                <g id='Right' transform='matrix(1.24964,-0.00236042,0.0035708,0.607033,99.6787,-18.6677)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                            </g>
                            <g id='First' transform='matrix(1,0,0,1,-300,-2.84217e-14)'>
                                <g id='Right1' serifid='Right' transform='matrix(1.24964,-0.00166618,0.0035708,0.428494,299.679,70.5949)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                                <g id='Left1' serifid='Left' transform='matrix(1.24964,-0.00236042,0.0035708,0.607033,99.8337,-18.6677)'>
                                    <path d='M159.548,220.819L158.748,500.867' style={vertical_lines}/>
                                </g>
                            </g>
                        </g>
                        <g id='Window4' transform='matrix(1,0,0,1,449,-161)'>
                            <g id='WindowLabel' transform='matrix(1,0,0,1,-92.3498,-33.6598)'>
                                <g id='LeftArrow' transform='matrix(-1.01148,0.00137386,-0.00135826,-0.999999,427.112,323.554)'>
                                    <g transform='matrix(-0.988644,-0.00135826,0.00134284,-0.999999,655.799,117.523)'>
                                        <path d='M365.728,84.228L362.728,82.728L365.728,81.228L365.728,84.228Z'/>
                                        <path d='M427.728,82.728L365.128,82.728' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow' transform='matrix(1.01149,0,0,1,25.6338,255.446)'>
                                    <g transform='matrix(0.988645,-0,-0,1,-259.037,-48.5136)'>
                                        <path d='M559.73,81.312L562.728,82.816L559.726,84.312L559.73,81.312Z'/>
                                        <path d='M497.728,82.728C497.728,82.728 548.583,82.797 560.328,82.813' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text' transform='matrix(1,0,0,1,19.6904,254.92)'>
                                    <text x='175.849px' y='39.802px' style={font_family}>Window 4</text>
                                </g>
                            </g>
                            <g id='Box' transform='matrix(1,0,0,1,0,6)'>
                                <g id='Window' transform='matrix(1.07595,0,0,0.681026,-71.8721,26.9599)'>
                                    <rect x='98.399' y='395.051' width='185.882' height='183.547' style={rectangle_style_25}/>
                                </g>
                                <g id='Circle' transform='matrix(1,0,0,1,-122.333,-3.04582)'>
                                    <g id='Circle1' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                    <g id='Circle2' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                    <g id='Circle3' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                    <g id='Circle4' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                    <g id='Circle5' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                    <g id='Circle6' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_orange}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='Window3' transform='matrix(1,0,0,1,299,-161)'>
                            <g id='WindowLabel1' serifid='WindowLabel' transform='matrix(1,0,0,1,-39.9133,-66.6598)'>
                                <g id='LeftArrow1' serifid='LeftArrow' transform='matrix(-1.01148,0.00137386,-0.00135826,-0.999999,426.676,324.317)'>
                                    <g transform='matrix(-0.988644,-0.00135826,0.00134284,-0.999999,558.955,85.1527)'>
                                        <path d='M267.728,51.991L264.728,50.491L267.728,48.991L267.728,51.991Z'/>
                                        <path d='M329.728,50.491L267.128,50.491' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow1' serifid='RightArrow' transform='matrix(1.01149,0,0,1,23.1974,256.208)'>
                                    <g transform='matrix(0.988645,-0,-0,1,-160.172,-16.2764)'>
                                        <path d='M459.73,49.075L462.728,50.579L459.726,52.075L459.73,49.075Z'/>
                                        <path d='M397.728,50.491C397.728,50.491 448.583,50.56 460.328,50.576' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text1' serifid='Text' transform='matrix(1,0,0,1,19.6904,254.92)'>
                                    <text x='175.849px' y='39.802px' style={font_family}>Window 3</text>
                                </g>
                            </g>
                            <g id='Slide' transform='matrix(1,0,0,1,-147.78,217.478)'>
                                <g id='LeftArrow2' serifid='LeftArrow' transform='matrix(-0.311226,0.00137386,-0.000417925,-0.999999,325.322,241.699)'>
                                    <g transform='matrix(-3.2131,-0.00441434,0.00134284,-0.999999,1144.35,287.477)'>
                                        <path d='M266.728,253.51L263.728,252.01L266.728,250.51L266.728,253.51Z'/>
                                        <path d='M283.728,252.01L266.128,252.01' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow2' serifid='RightArrow' transform='matrix(0.311226,0,0,1,236.252,173.591)'>
                                    <g transform='matrix(3.2131,-0,-0,1,-858.539,-217.796)'>
                                        <path d='M356.735,250.586L359.728,252.099L356.721,253.586L356.735,250.586Z'/>
                                        <path d='M339.728,252.01C339.728,252.01 352.015,252.065 357.328,252.088' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text2' serifid='Text' transform='matrix(1,0,0,1,80.9818,171)'>
                                    <text x='175.849px' y='39.802px' style={font_family_smaller}>Slide Width</text>
                                </g>
                            </g>
                            <g id='Box1' serifid='Box' transform='matrix(1,0,0,1,0,-10)'>
                                <g id='Window1' serifid='Window' transform='matrix(1.07595,0,0,0.681026,-21.8721,11.9599)'>
                                    <rect x='98.399' y='395.051' width='185.882' height='183.547' style={rectangle_style_50}/>
                                </g>
                                <g id='Circle7' serifid='Circle' transform='matrix(1,0,0,1,-72.3326,-18.0458)'>
                                    <g id='Circle8' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                    <g id='Circle9' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                    <g id='Circle10' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                    <g id='Circle11' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                    <g id='Circle12' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                    <g id='Circle13' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_purple}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='Window2' transform='matrix(1,0,0,1,151,-161)'>
                            <g id='WindowLabel2' serifid='WindowLabel' transform='matrix(1,0,0,1,6.08667,176.34)'>
                                <g id='LeftArrow3' serifid='LeftArrow' transform='matrix(-1.01148,0.00137386,-0.00135826,-0.999999,426.676,323.554)'>
                                    <g transform='matrix(-0.988644,-0.00135826,0.00134284,-0.999999,457.788,327.251)'>
                                        <path d='M165.728,294.228L162.728,292.728L165.728,291.228L165.728,294.228Z'/>
                                        <path d='M227.728,292.728L165.128,292.728' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow3' serifid='RightArrow' transform='matrix(1.01149,0,0,1,23.1974,255.446)'>
                                    <g transform='matrix(0.988645,-0,-0,1,-59.3305,-258.514)'>
                                        <path d='M357.73,291.312L360.728,292.816L357.726,294.312L357.73,291.312Z'/>
                                        <path d='M295.728,292.728C295.728,292.728 346.583,292.797 358.328,292.813' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text3' serifid='Text' transform='matrix(1,0,0,1,19.6904,254.92)'>
                                    <text x='175.849px' y='39.802px' style={font_family}>Window 2</text>
                                </g>
                            </g>
                            <g id='Slide1' serifid='Slide' transform='matrix(1,0,0,1,-99.7798,187.478)'>
                                <g id='LeftArrow4' serifid='LeftArrow' transform='matrix(-0.311226,0.00137386,-0.000417925,-0.999999,325.322,241.699)'>
                                    <g transform='matrix(-3.2131,-0.00441434,0.00134284,-0.999999,823.077,257.036)'>
                                        <path d='M166.728,223.51L163.728,222.01L166.728,220.51L166.728,223.51Z'/>
                                        <path d='M183.728,222.01L166.128,222.01' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow4' serifid='RightArrow' transform='matrix(0.311226,0,0,1,236.252,173.591)'>
                                    <g transform='matrix(3.2131,-0,-0,1,-537.229,-187.796)'>
                                        <path d='M256.735,220.586L259.728,222.099L256.721,223.586L256.735,220.586Z'/>
                                        <path d='M239.728,222.01C239.728,222.01 252.015,222.065 257.328,222.088' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text4' serifid='Text' transform='matrix(1,0,0,1,80.9818,171)'>
                                    <text x='175.849px' y='39.802px' style={font_family_smaller}>Slide Width</text>
                                </g>
                            </g>
                            <g id='Box2' serifid='Box' transform='matrix(1,0,0,1,0,-25)'>
                                <g id='Window5' serifid='Window' transform='matrix(1.07595,0,0,0.681026,26.1279,-3.04006)'>
                                    <rect x='98.399' y='395.051' width='185.882' height='183.547' style={rectangle_style_75}/>
                                </g>
                                <g id='Circle14' serifid='Circle' transform='matrix(1,0,0,1,-24.3326,-34.0458)'>
                                    <g id='Circle15' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                    <g id='Circle16' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                    <g id='Circle17' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                    <g id='Circle18' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                    <g id='Circle19' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                    <g id='Circle20' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_green}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='Window11' serifid='Window1' transform='matrix(1,0,0,1,0,-161)'>
                            <g id='WindowLabel3' serifid='WindowLabel' transform='matrix(1,0,0,1,57.0867,-93.9198)'>
                                <g id='LeftArrow5' serifid='LeftArrow' transform='matrix(-1.01148,0.00137386,-0.00135826,-0.999999,426.676,323.814)'>
                                    <g transform='matrix(-0.988644,-0.00135826,0.00134284,-0.999999,359.286,57.1157)'>
                                        <path d='M65.728,24.228L62.728,22.728L65.728,21.228L65.728,24.228Z'/>
                                        <path d='M127.728,22.728L65.128,22.728' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow5' serifid='RightArrow' transform='matrix(1.01149,0,0,1,23.1974,255.706)'>
                                    <g transform='matrix(0.988645,-0,-0,1,39.5339,11.4864)'>
                                        <path d='M257.73,21.312L260.728,22.816L257.726,24.312L257.73,21.312Z'/>
                                        <path d='M195.728,22.728C195.728,22.728 246.583,22.797 258.328,22.813' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text5' serifid='Text' transform='matrix(1,0,0,1,19.6904,254.92)'>
                                    <g transform='matrix(14,0,0,14,237.318,39.8025)'>
                                    </g>
                                    <text x='175.849px' y='39.802px' style={font_family}>Window 1</text>
                                </g>
                            </g>
                            <g id='Slide2' serifid='Slide' transform='matrix(1,0,0,1,-47.7798,157.478)'>
                                <g id='LeftArrow6' serifid='LeftArrow' transform='matrix(-0.311226,0.00137386,-0.000417925,-0.999999,325.322,241.699)'>
                                    <g transform='matrix(-3.2131,-0.00441434,0.00134284,-0.999999,505.02,226.599)'>
                                        <path d='M67.728,193.51L64.728,192.01L67.728,190.51L67.728,193.51Z'/>
                                        <path d='M84.728,192.01L67.128,192.01' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='RightArrow6' serifid='RightArrow' transform='matrix(0.311226,0,0,1,236.252,173.591)'>
                                    <g transform='matrix(3.2131,-0,-0,1,-219.133,-157.796)'>
                                        <path d='M157.735,190.586L160.728,192.099L157.721,193.586L157.735,190.586Z'/>
                                        <path d='M140.728,192.01C140.728,192.01 153.015,192.065 158.328,192.088' style={arrow_style}/>
                                    </g>
                                </g>
                                <g id='Text6' serifid='Text' transform='matrix(1,0,0,1,80.9818,171)'>
                                    <text x='175.849px' y='39.802px' style={font_family_smaller}>Slide Width</text>
                                </g>
                            </g>
                            <g id='Box3' serifid='Box' transform='matrix(1,0,0,1,0,-40)'>
                                <g id='Box4' serifid='Box' transform='matrix(1.07595,0,0,0.681026,77.1279,-18.0401)'>
                                    <rect x='98.399' y='395.051' width='185.882' height='183.547' style={rectangle_style_100}/>
                                </g>
                                <g id='Circle21' serifid='Circle' transform='matrix(1,0,0,1,26.6674,-48.0458)'>
                                    <g id='Circle22' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                    <g id='Circle23' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                    <g id='Circle24' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,245.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                    <g id='Circle25' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,172.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                    <g id='Circle26' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,185.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                    <g id='Circle27' serifid='Circle' transform='matrix(1.04502,0,0,1.25584,125.979,112.969)'>
                                        <ellipse cx='67.322' cy='174.845' rx='14.354' ry='11.944' style={circle_style_blue}/>
                                    </g>
                                </g>
                            </g>
                        </g>
                        <g id='Axis'>
                            <g id='xAxis' transform='matrix(1.07819,-0.00272345,0.00300587,0.999996,23.0968,26.3567)'>
                                <g transform='matrix(0.927469,0.00252593,-0.00278786,0.999996,90.1663,-13.8391)'>
                                    <path d='M603.711,268.228L612.711,272.728L603.711,277.228L603.711,268.228Z'/>
                                    <path d='M12.728,272.728L605.511,272.728' style={axis_style}/>
                                </g>
                            </g>
                            <g id='yAxis' transform='matrix(1.24964,-0.00381833,0.0035708,0.981965,-50.1663,-191.227)'>
                                <g transform='matrix(0.80022,0.00311162,-0.00290991,1.01836,135.796,207.765)'>
                                    <path d='M34.228,21.728L29.728,12.728L25.228,21.728L34.228,21.728Z'/>
                                    <path d='M29.728,19.928L29.728,287.728' style={axis_style}/>
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
export default Sliding;
