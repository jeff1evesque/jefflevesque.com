/**
 *  summary-trigger.jsx: summarize content
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { isMobile } from 'react-device-detect';
import checkValidObject from '../validator/valid-object.js';
import checkValidString from '../validator/valid-string.js';
import checkValidArray from '../validator/valid-array.js';
import checkValidInt from '../validator/valid-int.js';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { styled } from '@mui/material/styles';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import MuiAccordion from '@mui/material/Accordion';
import MuiAccordionSummary, {
} from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

class SummaryTrigger extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        header: PropTypes.string,
        header_summary: PropTypes.string,
        header_integration: PropTypes.string,
        summary: PropTypes.element,
        summary_below: PropTypes.element,
        summary_integration: PropTypes.element,
        footer: PropTypes.string,
        trigger_table: PropTypes.array,
        trigger_table_labels: PropTypes.array,
        page: PropTypes.number,
        rows_per_page: PropTypes.number,
        rows_per_page_option: PropTypes.array,
        accordion_summary: PropTypes.array,
        accordion_integration: PropTypes.array
    }

    constructor(props) {
        super(props);

        if ('header' in this.props && checkValidString(this.props.header)) {
            var header = this.props.header;
        } else {
            var header = null;
        }

        if ('header_summary' in this.props && checkValidString(this.props.header_summary)) {
            var header_summary = this.props.header_summary;
        } else {
            var header_summary = 'Trigger Summary';
        }

        if (
            'header_integration' in this.props
            && checkValidString(this.props.header_integration)
        ) {
            var header_integration = this.props.header_integration;
        } else {
            var header_integration = 'Trigger Integration';
        }

        if ('summary' in this.props && this.props.summary) {
            var summary = this.props.summary;
        } else {
            var summary = null;
        }

        if ('summary_below' in this.props && this.props.summary_below) {
            var summary_below = this.props.summary_below;
        } else {
            var summary_below = null;
        }

        if (
            'summary_integration' in this.props && this.props.summary_integration
        ) {
            var summary_integration = this.props.summary_integration;
        } else {
            var summary_integration = null;
        }

        if ('footer' in this.props && checkValidString(this.props.footer)) {
            var footer = this.props.footer;
        } else {
            var footer = null;
        }

        if ('trigger_table' in this.props && checkValidArray(this.props.trigger_table)) {
            var trigger_table = this.props.trigger_table;
        } else {
            var trigger_table = [];
        }

        if (
            'trigger_table_labels' in this.props
            && checkValidArray(this.props.trigger_table_labels)
        ) {
            var trigger_table_labels = this.props.trigger_table_labels;
        } else {
            var trigger_table_labels = [];
        }

        if ('page' in this.props && checkValidInt(this.props.page)) {
            var page = this.props.page;
        } else {
            var page = 0;
        }

        if ('rows_per_page' in this.props && checkValidInt(this.props.rows_per_page)) {
            var rows_per_page = this.props.rows_per_page;
        } else {
            var rows_per_page = 10;
        }

        if (
            'rows_per_page_option' in this.props
            && checkValidArray(this.props.rows_per_page_option)
        ) {
            var rows_per_page_option = this.props.rows_per_page_option;
        } else {
            var rows_per_page_option = [10, 25, 100];
        }

        if (
            'accordion_summary' in this.props
            && checkValidObject('accordion_summary', this.props)
        ) {
            var accordion_summary = this.props.accordion_summary;
        } else {
            var accordion_summary = [];
        }

        if (
            'accordion_integration' in this.props
            && checkValidObject('accordion_integration', this.props)
        ) {
            var accordion_integration = this.props.accordion_integration;
        } else {
            var accordion_integration = [];
        }

        this.state = {
            header: header,
            header_summary: header_summary,
            header_integration: header_integration,
            summary: summary,
            summary_below: summary_below,
            summary_integration: summary_integration,
            footer: footer,
            trigger_table: trigger_table,
            trigger_table_labels: trigger_table_labels,
            page: page,
            rows_per_page: rows_per_page,
            rows_per_page_option: rows_per_page_option,
            hover_hash_summary: false,
            accordion_summary: accordion_summary,
            accordion_integration: accordion_integration,
            accordion_summary_current: false,
            accordion_integration_current: false
        };

        this.handleChangePage = this.handleChangePage.bind(this);
        this.handleChangeRowsPerPage = this.handleChangeRowsPerPage.bind(this);
        this.renderTable = this.renderTable.bind(this);
        this.setHoverHash = this.setHoverHash.bind(this);
        this.handleChangeSummaryAccordion = this.handleChangeSummaryAccordion.bind(this);
        this.handleChangeIntegrationAccordion = this.handleChangeIntegrationAccordion.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'trigger_table' in prevProps
            && 'trigger_table' in this.props
            && checkValidArray(this.props.trigger_table)
            && prevProps.trigger_table !== this.props.trigger_table
        ) {
            this.setState({ trigger_table: this.props.trigger_table });
        }

        if (
            'trigger_table_labels' in prevProps
            && 'trigger_table_labels' in this.props
            && checkValidArray(this.props.trigger_table_labels)
            && prevProps.trigger_table_labels !== this.props.trigger_table_labels
        ) {
            this.setState({ trigger_table_labels: this.props.trigger_table_labels });
        }

        if (
            'summary' in prevProps
            && 'summary' in this.props
            && prevProps.summary !== this.props.summary
        ) {
            this.setState({ summary: this.props.summary });
        }

        if (
            'accordion_summary' in prevProps
            && 'accordion_summary' in this.props
            && prevProps.accordion_summary !== this.props.accordion_summary
        ) {
        } else {
        }
    }

    handleChangePage(event, new_page) {
        this.setState({ page: new_page });
    }

    handleChangeRowsPerPage(event) {
        this.setState({ rows_per_page: +event.target.value });
    }

    setHoverHash(id, bool) {
        this.setState({ [id]: bool });
    }

    handleChangeSummaryAccordion(panel_name) {
        if (panel_name === this.state.accordion_summary_current) {
            this.setState({ accordion_summary_current: false });
        } else {
            this.setState({ accordion_summary_current: panel_name });
        }
    }

    handleChangeIntegrationAccordion(panel_name) {
        if (panel_name === this.state.accordion_integration_current) {
            this.setState({ accordion_integration_current: false });
        } else {
            this.setState({ accordion_integration_current: panel_name });
        }
    }

    renderTable() {



        return(
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader aria-label='sticky table'>
                        <TableHead>
                            <TableRow>{
                                this.state.trigger_table_labels.map((column) => (
                                    <TableCell
                                        key={column.id.replace(/\s+/g, '-').toLowerCase()}
                                        align={column.align}
                                        style={{ minWidth: column.minWidth }}
                                    >
                                        {column.label}
                                    </TableCell>
                                ))
                            }</TableRow>
                        </TableHead>
                        <TableBody>{
                            this.state.trigger_table
                            .slice(
                                this.state.page * this.state.rows_per_page,
                                this.state.page * this.state.rows_per_page + this.state.rows_per_page
                            )
                            .map((row) => {
                                return (
                                    <TableRow
                                        hover
                                        role='checkbox'
                                        tabIndex={-1}
                                        key={row.pattern.replace(/\s+/g, '-').toLowerCase()}
                                    >{
                                        this.state.trigger_table_labels.map((column) => {
                                            const value = row[column.id];
                                            return (
                                                <TableCell
                                                    key={column.id.replace(/\s+/g, '-').toLowerCase()}
                                                    align={column.align}
                                                >{
                                                    column.format && typeof value === 'number'
                                                        ? column.format(value)
                                                        : value
                                                }</TableCell>
                                            );
                                        })
                                    }</TableRow>
                                );
                            })
                        }</TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={this.state.rows_per_page_option}
                    component='div'
                    count={this.state.trigger_table.length}
                    rowsPerPage={this.state.rows_per_page}
                    page={this.state.page}
                    onPageChange={this.handleChangePage}
                    onRowsPerPageChange={this.handleChangeRowsPerPage}
                />
            </Paper>
        );
    }

    render() {
        const table = this.state.trigger_table.length > 0 && this.state.trigger_table_labels.length > 0
            ? this.renderTable()
            : null;

        const id_header_summary = this.state.header_summary.replace(/\s+/g, '-').toLowerCase();
        const anchor_hash_summary = this.state.hover_hash_summary
            ? (
                <Link
                    className='anchor-hash'
                    to={`${window.location.pathname}#${id_header_summary}`}
                    onClick={() =>
                        document.querySelector(`#${id_header_summary}`).scrollIntoView({behavior: 'smooth'})
                    }
                >
                    #
                </Link>
            ) : null;

        const id_header_integration = this.state.header_integration.replace(/\s+/g, '-').toLowerCase();
        const anchor_hash_integration = this.state.hover_hash_integration
            ? (
                <Link
                    className='anchor-hash'
                    to={`${window.location.pathname}#${id_header_integration}`}
                    onClick={() =>
                        document.querySelector(`#${id_header_integration}`).scrollIntoView({behavior: 'smooth'})
                    }
                >
                    #
                </Link>
            ) : null

        const Accordion = styled((props) => (
            <MuiAccordion disableGutters elevation={0} square {...props} />
        ))(({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            '&:not(:last-child)': {
                borderBottom: 0,
            },
            '&:before': {
                display: 'none',
            },
        }));

        const AccordionSummary = styled((props) => (
            <MuiAccordionSummary
                expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />}
                {...props}
            />
        ))(({ theme }) => ({
            backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, .05)'
                : 'rgba(0, 0, 0, .03)',
            flexDirection: 'row',
            '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
                transform: 'rotate(90deg)',
            },
            '& .MuiAccordionSummary-content': {
                marginLeft: theme.spacing(1),
            },
        }));

        const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
            padding: theme.spacing(2),
            borderTop: '1px solid rgba(0, 0, 0, .125)',
        }));

        const summary_item = isMobile ? 'summary-item summary-item-mobile' : 'summary-item';
        const header = this.state.header ? <h4>{this.state.header}</h4> : null;
        return (
            <div className='summary'>
                <div className='summary-content'>
                    {header}
                    <h5
                        id={id_header_summary}
                        onMouseEnter={() => this.setHoverHash('hover_hash_summary', true)}
                        onMouseLeave={() => this.setHoverHash('hover_hash_summary', false)}
                    >
                        {this.state.header_summary}{anchor_hash_summary}
                    </h5>
                    <div className='summary-block'>
                        <div className={summary_item}>{this.state.summary}</div>
                        <div className={summary_item}>{
                            this.state.accordion_summary.map((a) => {
                                return(
                                    <Accordion
                                        expanded={this.state.accordion_summary_current === a.id}
                                        onChange={() => this.handleChangeSummaryAccordion(a.id)}
                                        key={a.id.replace(/\s+/g, '-').toLowerCase()}
                                    >
                                        <AccordionSummary aria-controls={`${a.id}-content`} id={`${a.id}-header`}>
                                            <Typography component={'div'}>{a.title}</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Typography component={'div'}>{a.content}</Typography>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })
                        }</div>
                        <div className={summary_item}>{this.state.summary_below}</div>
                        <div className={summary_item}>{table}</div>
                    </div>
                    <h5
                        id={id_header_integration}
                        onMouseEnter={() => this.setHoverHash('hover_hash_integration', true)}
                        onMouseLeave={() => this.setHoverHash('hover_hash_integration', false)}
                    >
                        {this.state.header_integration}{anchor_hash_integration}
                    </h5>
                    <div className='summary-block'>
                        <div className={summary_item}>{this.state.summary_integration}</div>
                        <div className={summary_item}>{
                            this.state.accordion_integration.map((a) => {
                                return(
                                    <Accordion
                                        expanded={this.state.accordion_integration_current === a.id}
                                        onChange={() => this.handleChangeIntegrationAccordion(a.id)}
                                        key={a.id.replace(/\s+/g, '-').toLowerCase()}
                                    >
                                        <AccordionSummary aria-controls={`${a.id}-content`} id={`${a.id}-header`}>
                                            <Typography component={'div'}>{a.title}</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Typography component={'div'}>{a.content}</Typography>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })
                        }</div>
                    </div>
                </div>
                <div className='summary-footer'>{this.state.footer}</div>
            </div>
        )
    }
}

export default SummaryTrigger;
