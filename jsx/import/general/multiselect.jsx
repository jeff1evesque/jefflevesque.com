/**
 * multiselect.jsx: form control for multiselect
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import PropTypes from 'prop-types';
import checkValidObject from '../validator/valid-object.js';
import checkValidArray from '../validator/valid-array.js';
import checkValidString from '../validator/valid-string.js';
import checkValidBool from '../validator/valid-bool.js';

class MultiSelect extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        input_label: PropTypes.string,
        data: PropTypes.array,
        items: PropTypes.array,
        form_control_sx: PropTypes.object,
        select_box_sx: PropTypes.object,
        callback: PropTypes.func,
        menu_props: PropTypes.object,
        multi: PropTypes.bool,
    }

    constructor(props) {
        super(props);

        if ('input_label' in this.props && checkValidString('input_label', this.props)) {
            var input_label = this.props.input_label;
        } else {
            var input_label = [];
        }

        if ('data' in this.props && checkValidArray('data', this.props)) {
            var data = this.props.data;
        } else {
            var data = [];
        }

        if ('items' in this.props && checkValidArray('items', this.props)) {
            var items = this.props.items;
        } else {
            var items = [];
        }

        if ('form_control_sx' in this.props && checkValidObject('form_control_sx', this.props)) {
            var form_control_sx = this.props.form_control_sx;
        } else {
            var form_control_sx = { m: 1, width: 300 };
        }

        if ('select_box_sx' in this.props && checkValidObject('select_box_sx', this.props)) {
            var select_box_sx = this.props.select_box_sx;
        } else {
            var select_box_sx = { display: 'flex', flexWrap: 'wrap', gap: 0.5 };
        }

        if ('menu_props' in this.props && checkValidObject('menu_props', this.props)) {
            var menu_props = this.props.menu_props;
        } else {
            var menu_props = {
                PaperProps: {
                    style: {
                        maxHeight: 48 * 4.5 + 8,
                        width: 250,
                    },
                },
            };
        }

        if ('multi' in this.props && checkValidBool(this.props.multi)) {
            var multi = this.props.multi;
        } else {
            var multi = true;
        }

        this.state = {
            input_label: input_label,
            data: data,
            form_control_sx: form_control_sx,
            select_box_sx: select_box_sx,
            items: items,
            menu_props: menu_props,
            multi: multi
        };

        this.menuItems = this.menuItems.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    menuItems() {
        const menu_items = this.state.data.map((item) => {
            const words = item.split('_');
            for (let i = 0; i < words.length; i++) {
                words[i] = `${words[i][0].toUpperCase()}${words[i].substr(1)}`;
            }

            return (
                <MenuItem key={`${this.state.input_label}-${item}`} value={item}>
                    <Checkbox checked={this.state.items.indexOf(item) > -1} />
                    <ListItemText primary={words.join(' ')} />
                </MenuItem>
            )
        });
        return menu_items;
    }

    handleChange(event) {
        const target = event.target.value;
        if (checkValidArray(target) || checkValidString(target)) {
            const selected = checkValidString(target)
                ? target.split(',')
                : target;

            this.setState({ items: selected });
            if (
                'callback' in this.props
                && 'multi' in this.state
                && this.state.multi
            ) {
                this.props.callback({ selected: selected });
            } else {
                this.props.callback({ selected: selected.slice(-1) });
            }
        } else {
            this.setState({ items: [] });
            if ('callback' in this.props) {
                this.props.callback({ selected: [] });
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'input_label' in this.props
            && checkValidString(this.props.input_label)
            && 'input_label' in prevProps
            && this.props.input_label !== prevProps.input_label
        ) {
            this.setState({ input_label: this.props.input_label });
        }

        if (
            'data' in this.props
            && checkValidArray(this.props.data)
            && 'data' in prevProps
            && this.props.data !== prevProps.data
        ) {
            this.setState({ data: this.props.data });
        }

        if (
            'items' in this.props
            && checkValidArray(this.props.items)
            && 'items' in prevProps
            && this.props.items !== prevProps.items
        ) {
            this.setState({ items: this.props.items });
        }

        if (
            'form_control_sx' in this.props
            && checkValidObject('form_control_sx', this.props)
            && 'form_control_sx' in prevProps
            && this.props.form_control_sx !== prevProps.form_control_sx
        ) {
            this.setState({ form_control_sx: this.props.form_control_sx });
        }

        if (
            'select_box_sx' in this.props
            && checkValidObject('select_box_sx', this.props)
            && 'select_box_sx' in prevProps
            && this.props.select_box_sx !== prevProps.select_box_sx
        ) {
            this.setState({ select_box_sx: this.props.select_box_sx });
        }

        if (
            'menu_props' in this.props
            && checkValidObject('menu_props', this.props)
            && 'menu_props' in prevProps
            && this.props.menu_props !== prevProps.menu_props
        ) {
            this.setState({ menu_props: this.props.menu_props });
        }

        if (
            'multi' in this.props
            && 'multi' in prevProps
            && this.props.multi !== prevProps.multi
        ) {
            this.setState({ multi: this.props.multi });
        }
    }

    render() {
        const menu_items = this.menuItems();
        return (
            <FormControl sx={this.state.form_control_sx}>
                <InputLabel>{this.state.input_label}</InputLabel>
                <Select
                    labelId={`multiple-chip-${this.state.input_label}`}
                    multiple
                    value={this.state.items}
                    onChange={this.handleChange}
                    input={<OutlinedInput id={`select-multiple-chip-${this.state.input_label}`} label='Chip' />}
                    renderValue={(selected) => {
                        const render_selected = structuredClone(selected);
                        for (let h = 0; h < render_selected.length; h++) {
                            const words = render_selected[h].split('_');
                            for (let i = 0; i < words.length; i++) {
                                words[i] = `${words[i][0].toUpperCase()}${words[i].substr(1)}`;
                            }
                            render_selected[h] = words.join(' ');
                        }
                        return render_selected.join(', ');
                    }}
                    MenuProps={this.state.menu_props}
                >
                    {menu_items}
                </Select>
            </FormControl>
        )
    }
}

export default MultiSelect;
