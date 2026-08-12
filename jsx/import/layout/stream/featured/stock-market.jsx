/**
 * stock-market.jsx: featured card components
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import { isMobile } from 'react-device-detect';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import checkValidInt from '../../../validator/valid-int.js';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AliceCarousel from 'react-alice-carousel';
import InvertedHammer from '../../../svg/stock_market/inverted-hammer.jsx';
import ShootingStar from '../../../svg/stock_market/shooting-star.jsx';
import Hammer from '../../../svg/stock_market/hammer.jsx';
import HangingMan from '../../../svg/stock_market/hanging-man.jsx';
import Piercing from '../../../svg/stock_market/piercing.jsx';
import DarkCloudCover from '../../../svg/stock_market/dark-cloud-cover.jsx';
import MorningDojiStar from '../../../svg/stock_market/morning-doji-star.jsx';
import EveningDojiStar from '../../../svg/stock_market/evening-doji-star.jsx';
import BullishEngulfing from '../../../svg/stock_market/bullish-engulfing.jsx';
import BearishEngulfing from '../../../svg/stock_market/bearish-engulfing.jsx';
import DragonflyDoji from '../../../svg/stock_market/dragonfly-doji.jsx';
import GravestoneDoji from '../../../svg/stock_market/gravestone-doji.jsx';
import MorningStar from '../../../svg/stock_market/morning-star.jsx';
import EveningStar from '../../../svg/stock_market/evening-star.jsx';
import { Link } from 'react-router-dom';

class StockMarketFeatured extends Component {
    constructor() {
        super();

        const responsive = {
            0: { items: 1 },
            568: { items: 3 },
            1024: { items: 5 },
        };

        const card_height = '140';
        const stream_stock_market = 'StockMarket';

        this.state = {
            card_height: card_height,
            responsive: responsive,
            patterns: [],
            expanded_evening_star: false,
            arrow_style_previous: {
                position: 'absolute',
                left: 0,
                top: `${card_height}px`,
                fontSize: '2.5rem',
                backgroundColor: 'rgba(0,0,0,0.10)',
                padding:'0.2rem',
                cursor: 'pointer'
            },
            arrow_style_next: {
                position: 'absolute',
                right: 0,
                top: `${card_height}px`,
                fontSize: '2.5rem',
                backgroundColor: 'rgba(0,0,0,0.10)',
                padding:'0.2rem',
                cursor: 'pointer'
            },
            disable_dots_count: 8,
            stream_stock_market: stream_stock_market
        }
    }

    componentDidMount() {
        const patterns = [{
            'component': InvertedHammer,
            'cardmedia_title': 'inverted hammer',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Inverted Hammer',
            'signal': 'bullish reveral',
            'description': 'One candlestick pattern found after a downtrend.'
        }, {
            'component': ShootingStar,
            'cardmedia_title': 'shooting star',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Shooting Star',
            'signal': 'bearish reveral',
            'description': 'One candlestick pattern found after a uptrend.'
        }, {
            'component': Hammer,
            'cardmedia_title': 'hammer',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Hammer',
            'signal': 'bullish reveral',
            'description': 'One candlestick pattern found after a downtrend.',
        }, {
            'component': HangingMan,
            'cardmedia_title': 'hanging man',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Hanging Man',
            'signal': 'bearish reveral',
            'description': 'One candlestick pattern found after a uptrend.'
        }, {
            'component': Piercing,
            'cardmedia_title': 'piercing',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Piercing',
            'signal': 'bullish reversal',
            'description': 'Two candlestick sequence found after a downtrend.'
        }, {
            'component': DarkCloudCover,
            'cardmedia_title': 'dark cloud cover',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Dark Cover Cloud',
            'signal': 'bearish reveral',
            'description': 'Two candlestick sequence found after a uptrend.'
        }, {
            'component': MorningDojiStar,
            'cardmedia_title': 'morning doji star',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Morning Doji Star',
            'signal': 'bullish reversal',
            'description': 'Three candlestick sequence found after a downtrend.'
        }, {
            'component': EveningDojiStar,
            'cardmedia_title': 'evening doji star',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Evening Doji Star',
            'signal': 'bearish reversal',
            'description': 'Three candlestick sequence found after a uptrend.'
        }, {
            'component': BearishEngulfing,
            'cardmedia_title': 'bearish engulfing',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Bearish Engulfing',
            'signal': 'bearish reversal',
            'description': 'Two candlestick sequence found after a uptrend.'
        }, {
            'component': BullishEngulfing,
            'cardmedia_title': 'bullish engulfing',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Bullish Engulfing',
            'signal': 'bullish reversal',
            'description': 'Two candlestick sequence found after a downtrend.'
        }, {
            'component': DragonflyDoji,
            'cardmedia_title': 'dragonfly doji',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Dragonfly Doji',
            'signal': 'bullish reversal',
            'description': 'One candlestick sequence found after a downtrend.'
        }, {
            'component': GravestoneDoji,
            'cardmedia_title': 'gravestone doji',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Gravestone Doji',
            'signal': 'bearish reversal',
            'description': 'One candlestick sequence found after a uptrend.'
        }, {
            'component': MorningStar,
            'cardmedia_title': 'morning star',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Morning Star',
            'signal': 'bullish reversal',
            'description': 'Three candlestick sequence found after a downtrend.'
        }, {
            'component': EveningStar,
            'cardmedia_title': 'evening star',
            'max_width': '100%',
            'height': this.state.card_height,
            'title': 'Evening Star',
            'signal': 'bearish reversal',
            'description': 'Three candlestick sequence found after a uptrend.'
        }];

        this.setState({ patterns: patterns });
    }

    render() {
        const category = 'candlestick';
        const handleDragStart = (e) => e.preventDefault();
        const cards = this.state.patterns.map((v,i) => {
            return(
                <div data-value={`svg ${v.cardmedia_title}`}>
                    <Card
                        key={i}
                        sx={{ maxWidth: v.max_width }}
                        onDragStart={handleDragStart}
                        role='presentation'
                    >
                        <CardMedia
                            component={v.component}
                            title={v.cardmedia_title}
                            height={v.title}
                        />
                        <CardContent>
                            <Typography gutterBottom variant='h5' component='div'>
                                {v.title}
                            </Typography>
                            <Typography variant='body2' color='text.secondary'>
                                {v.description}
                            </Typography>
                        </CardContent>
                        <CardActions>
                            <Button size='small'>
                                <Link to={`/stream/${
                                    this.state.stream_stock_market.toLowerCase()
                                }/trigger?category=${category}&selected=${
                                    v.cardmedia_title.toLowerCase().replace(/\s+/g, '_')
                                }`}>
                                    Subscribe
                                </Link>
                            </Button>
                        </CardActions>
                    </Card>
                </div>
            )
        });

        const renderNextButton = ({ isDisabled }) => {
            return <ArrowForwardIosIcon style={this.state.arrow_style_next} />
        };

        const renderPrevButton = ({ isDisabled }) => {
            return <ArrowBackIosIcon style={this.state.arrow_style_previous} />
        };

        if (
            isMobile
            && checkValidInt(this.state.disable_dots_count)
            && this.state.disable_dots_count > 0
            && cards.length > this.state.disable_dots_count
        ) {
            var disable_dots_control =  true;
        } else {
            var disable_dots_control =  false;
        }

        return (
            <>
                <div className='row'>
                    <div className='col header-featured'>
                        <h4>Featured Triggers</h4>
                        <span className='title-count'>{this.state.patterns.length}</span>
                    </div>
                </div>
                <div className='featured-carousel-stock-market'>
                    <AliceCarousel
                        items={cards}
                        touchTracking={isMobile ? true : false}
                        touchMoveDefaultEvents={isMobile ? true : false}
                        responsive={this.state.responsive}
                        disableDotsControls={disable_dots_control}
                        renderPrevButton={renderPrevButton}
                        renderNextButton={renderNextButton}
                    />
                </div>
            </>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default StockMarketFeatured;
