/**
 * model.jsx: model article listing page
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import ArticleListing from '../general/article-listing.jsx';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../formatter/boundary-error.jsx';

class ModelLayout extends Component {
    constructor() {
        super();
        this.state = {
            display_filter_button: true,
            display_apply_filter_button: false,
            display_performance: true,
            hide_all: false
        }

        this.listing = this.listing.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
        this.togglePerformance = this.togglePerformance.bind(this);
    }

    filterColumn(style='default', btn=false) {
        if (btn && this.state.display_filter_button) {
            var button_filter = (
                <div className='d-block d-md-none filter'>
                    <button className='btn' type='button' onClick={() =>
                        this.setState({
                            display_filter_button: false,
                            display_apply_filter_button: true,
                            hide_all: true
                        })
                    }>Category</button>
                </div>
            );
            var filter = null;
            var apply_filter = null;
        } else {
            const class_parent = style === 'default'
                ? 'col-md-3 d-none d-md-block checkbox-vertical checkbox-vertical-default'
                : 'checkbox-vertical checkbox-vertical-expanded';
            const class_date_label = 'col-lg-12 col-md-12 col-sm-4 col-xs-4';

            var filter = (
                <div className={class_parent}>
                    <div className='row'>
                        <label className={class_date_label}>
                            <input
                                type='checkbox'
                                checked={this.state.display_performance}
                                onChange={() => this.togglePerformance()}
                            />
                            StockMarket
                        </label>
                    </div>
                </div>
            );

            if (this.state.display_apply_filter_button) {
                var button_filter = <h5>Edit Content Filter</h5>;
                var apply_filter = (
                    <div className='apply-filter'>
                        <button className='btn' type='button' onClick={() =>
                            this.setState({
                                display_filter_button: true,
                                display_apply_filter_button: false,
                                hide_all: false
                            })
                        }>Apply Filter</button>
                    </div>
                );
            } else {
                var button_filter = null;
            }
        }

        return(
            <>
                {button_filter}
                {filter}
                {apply_filter}
            </>
        )
    }

    listing() {
        return (
            <div className='col listing'>
                <ArticleListing
                    title='Models'
                    left_column={false}
                    list_drop={[]}
                    list_article={['']}
                />
            </div>
        )
    }

    togglePerformance() {
        const display_performance  = ! this.state.display_performance;
        this.setState({
            display_performance: display_performance
        });
    }

    render() {
        const left_column = ! this.state.hide_all
            ? this.filterColumn()
            : null;

        const listing = ! this.state.hide_all
            ? this.listing()
            : null;

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container'>
                    <div className='row listing-graphic'>
                        graphics
                    </div>
                    <div className='row listing-general'>
                        {left_column}
                        {listing}
                    </div>
                </div>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ModelLayout;
