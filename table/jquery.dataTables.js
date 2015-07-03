/*! DataTables 1.10.8-dev
 * ©2008-2014 SpryMedia Ltd - datatables.net/license
 */

/**
 * @summary     DataTables
 * @description Paginate, search and order HTML tables
 * @version     1.10.8-dev
 * @file        jquery.dataTables.js
 * @author      SpryMedia Ltd (www.sprymedia.co.uk)
 * @contact     www.sprymedia.co.uk/contact
 * @copyright   Copyright 2008-2014 SpryMedia Ltd.
 *
 * This source file is free software, available under the following license:
 *   MIT license - http://datatables.net/license
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the license files for details.
 *
 * For details please refer to: http://www.datatables.net
 */

(function (window, document, undefined) {

    (function (factory) {
        "use strict";

        if (typeof define === 'function' && define.amd) {
            // Define as an AMD module if possible.
            define('datatables', ['jquery'], factory);
        }
        else if (typeof exports === 'object') {
            // Node/CommonJS.
            module.exports = factory(require('jquery'));
        }
        else if (jQuery && !jQuery.fn.dataTable) {
            // Define using browser globals otherwise.
            // Prevent multiple instantiations if the script is loaded twice.
            factory(jQuery);
        }
    }
    (function ($) {
        "use strict";

        var DataTable;

        var _ext; // DataTable.ext.
        var _Api; // DataTable.Api.
        var _api_register; // DataTable.Api.register.
        var _api_registerPlural; // DataTable.Api.registerPlural.

        var _re_dic = {};
        var _re_new_lines = /[\r\n]/g;
        var _re_html = /<.*?>/g;
        var _re_date_start = /^[\w\+\-]/;
        var _re_date_end = /[\w\+\-]$/;

        // Escape regular expression special characters.
        var _re_escape_regex = new RegExp('(\\' + ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\', '$', '^', '-'].join('|\\') + ')', 'g');

        var _re_formatted_numeric = /[',$£€¥%\u2009\u202F\u20BD\u20a9\u20BArfk]/gi;

        var _empty = function (d) {
            return !d || d === true || d === '-' ? true : false;
        };

        var _intVal = function (s) {
            var integer = parseInt(s, 10);
            return !isNaN(integer) && isFinite(s) ? integer : null;
        };

        // Convert from a formatted number with characters other than `.` as the
        // decimal place, to a Javascript number.
        var _numToDecimal = function (num, decimalPoint) {
            // Cache created regular expressions for speed as this function is called often.
            if (!_re_dic[ decimalPoint ]) {
                _re_dic[ decimalPoint ] = new RegExp(_fnEscapeRegex(decimalPoint), 'g');
            }
            return typeof num === 'string' && decimalPoint !== '.' ?
                    num.replace(/\./g, '').replace(_re_dic[ decimalPoint ], '.') :
                    num;
        };

        var _isNumber = function (d, decimalPoint, formatted) {
            var strType = typeof d === 'string';

            // If empty return immediately so there must be a number if it is a
            // formatted string (this stops the string "k", or "kr", etc being detected
            // as a formatted number for currency.
            if (_empty(d)) {
                return true;
            }

            if (decimalPoint && strType) {
                d = _numToDecimal(d, decimalPoint);
            }

            if (formatted && strType) {
                d = d.replace(_re_formatted_numeric, '');
            }

            return !isNaN(parseFloat(d)) && isFinite(d);
        };

        // A string without HTML in it can be considered to be HTML still.
        var _isHtml = function (d) {
            return _empty(d) || typeof d === 'string';
        };

        var _htmlNumeric = function (d, decimalPoint, formatted) {
            if (_empty(d)) {
                return true;
            }

            var html = _isHtml(d);
            return !html ?
                    null :
                    _isNumber(_stripHtml(d), decimalPoint, formatted) ?
                    true :
                    null;
        };

        var _pluck = function (a, prop, prop2) {
            var out = [];
            var i = 0, ien = a.length;

            // Could have the test in the loop for slightly smaller code, but speed
            // is essential here.
            if (prop2 !== undefined) {
                for (; i < ien; i++) {
                    if (a[i] && a[i][ prop ]) {
                        out.push(a[i][ prop ][ prop2 ]);
                    }
                }
            }
            else {
                for (; i < ien; i++) {
                    if (a[i]) {
                        out.push(a[i][ prop ]);
                    }
                }
            }

            return out;
        };

        // Basically the same as _pluck, but rather than looping over `a` we use `order`
        // as the indexes to pick from `a`.
        var _pluck_order = function (a, order, prop, prop2)
        {
            var out = [];
            var i = 0, ien = order.length;

            // Could have the test in the loop for slightly smaller code, but speed
            // is essential here.
            if (prop2 !== undefined) {
                for (; i < ien; i++) {
                    if (a[ order[i] ][ prop ]) {
                        out.push(a[ order[i] ][ prop ][ prop2 ]);
                    }
                }
            }
            else {
                for (; i < ien; i++) {
                    out.push(a[ order[i] ][ prop ]);
                }
            }

            return out;
        };

        var _range = function (len, start)
        {
            var out = [];
            var end;

            if (start === undefined) {
                start = 0;
                end = len;
            }
            else {
                end = start;
                start = len;
            }

            for (var i = start; i < end; i++) {
                out.push(i);
            }

            return out;
        };

        var _removeEmpty = function (a)
        {
            var out = [];

            for (var i = 0, ien = a.length; i < ien; i++) {
                if (a[i]) { // careful - will remove all falsy values!
                    out.push(a[i]);
                }
            }

            return out;
        };

        var _stripHtml = function (d) {
            return d.replace(_re_html, '');
        };

        /**
         * Find the unique elements in a source array.
         *
         * @param  {array} src Source array
         * @return {array} Array of unique items
         * @ignore
         */
        var _unique = function (src) {
            // A faster unique method is to use object keys to identify used values,
            // but this doesn't work with arrays or objects, which we must also
            // consider. See jsperf.com/compare-array-unique-versions/4 for more
            // information.
            var
                    out = [],
                    val,
                    i, ien = src.length,
                    j, k = 0;

            again: for (i = 0; i < ien; i++) {
                val = src[i];

                for (j = 0; j < k; j++) {
                    if (out[j] === val) {
                        continue again;
                    }
                }

                out.push(val);
                k++;
            }

            return out;
        };

        /**
         * Create a mapping object that allows camel case parameters to be looked up
         * for their Hungarian counterparts. The mapping is stored in a private
         * parameter called `_hungarianMap` which can be accessed on the source object.
         *  @param {object} o
         *  @memberof DataTable#oApi
         */
        function _fnHungarianMap(o) {
            var
                    hungarian = 'a aa ai ao as b fn i m o s ',
                    match,
                    newKey,
                    map = {};

            $.each(o, function (key, val) {
                match = key.match(/^([^A-Z]+?)([A-Z])/);

                if (match && hungarian.indexOf(match[1] + ' ') !== -1)
                {
                    newKey = key.replace(match[0], match[2].toLowerCase());
                    map[ newKey ] = key;

                    if (match[1] === 'o')
                    {
                        _fnHungarianMap(o[key]);
                    }
                }
            });

            o._hungarianMap = map;
        }

        /**
         * Convert from camel case parameters to Hungarian, based on a Hungarian map
         * created by _fnHungarianMap.
         *  @param {object} src The model object which holds all parameters that can be
         *    mapped.
         *  @param {object} user The object to convert from camel case to Hungarian.
         *  @param {boolean} force When set to `true`, properties which already have a
         *    Hungarian value in the `user` object will be overwritten. Otherwise they
         *    won't be.
         *  @memberof DataTable#oApi
         */
        function _fnCamelToHungarian(src, user, force) {
            if (!src._hungarianMap) {
                _fnHungarianMap(src);
            }

            var hungarianKey;

            $.each(user, function (key, val) {
                hungarianKey = src._hungarianMap[ key ];

                if (hungarianKey !== undefined && (force || user[hungarianKey] === undefined))
                {
                    // For objects, we need to buzz down into the object to copy parameters.
                    if (hungarianKey.charAt(0) === 'o')
                    {
                        // Copy the camelCase options over to the hungarian.
                        if (!user[ hungarianKey ]) {
                            user[ hungarianKey ] = {};
                        }
                        $.extend(true, user[hungarianKey], user[key]);

                        _fnCamelToHungarian(src[hungarianKey], user[hungarianKey], force);
                    }
                    else {
                        user[hungarianKey] = user[ key ];
                    }
                }
            });
        }

        /**
         * Language compatibility - when certain options are given, and others aren't, we
         * need to duplicate the values over, in order to provide backwards compatibility
         * with older language files.
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnLanguageCompat(lang) {
            var defaults = DataTable.defaults.oLanguage;
            var zeroRecords = lang.sZeroRecords;

            /* Backwards compatibility - if there is no sEmptyTable given, then use the same as
             * sZeroRecords - assuming that is given.
             */
            if (!lang.sEmptyTable && zeroRecords &&
                    defaults.sEmptyTable === "No data available in table")
            {
                _fnMap(lang, lang, 'sZeroRecords', 'sEmptyTable');
            }

            /* Likewise with loading records */
            if (!lang.sLoadingRecords && zeroRecords &&
                    defaults.sLoadingRecords === "Loading...")
            {
                _fnMap(lang, lang, 'sZeroRecords', 'sLoadingRecords');
            }

            // Old parameter name of the thousands separator mapped onto the new.
            if (lang.sInfoThousands) {
                lang.sThousands = lang.sInfoThousands;
            }

            var decimal = lang.sDecimal;
            if (decimal) {
                _addNumericSort(decimal);
            }
        }

        /**
         * Map one parameter onto another
         *  @param {object} o Object to map
         *  @param {*} knew The new parameter name
         *  @param {*} old The old parameter name
         */
        var _fnCompatMap = function (o, knew, old) {
            if (o[ knew ] !== undefined) {
                o[ old ] = o[ knew ];
            }
        };

        /**
         * Provide backwards compatibility for the main DT options. Note that the new
         * options are mapped onto the old parameters, so this is an external interface
         * change only.
         *  @param {object} init Object to map
         */
        function _fnCompatOpts(init) {
            _fnCompatMap(init, 'ordering', 'bSort');
            _fnCompatMap(init, 'orderMulti', 'bSortMulti');
            _fnCompatMap(init, 'orderClasses', 'bSortClasses');
            _fnCompatMap(init, 'orderCellsTop', 'bSortCellsTop');
            _fnCompatMap(init, 'order', 'aaSorting');
            _fnCompatMap(init, 'orderFixed', 'aaSortingFixed');
            _fnCompatMap(init, 'paging', 'bPaginate');
            _fnCompatMap(init, 'pagingType', 'sPaginationType');
            _fnCompatMap(init, 'pageLength', 'iDisplayLength');
            _fnCompatMap(init, 'searching', 'bFilter');

            // Boolean initialisation of x-scrolling.
            if (typeof init.sScrollX === 'boolean') {
                init.sScrollX = init.sScrollX ? '100%' : '';
            }

            // Column search objects are in an array, so it needs to be converted
            // element by element.
            var searchCols = init.aoSearchCols;

            if (searchCols) {
                for (var i = 0, ien = searchCols.length; i < ien; i++) {
                    if (searchCols[i]) {
                        _fnCamelToHungarian(DataTable.models.oSearch, searchCols[i]);
                    }
                }
            }
        }

        /**
         * Provide backwards compatibility for column options. Note that the new options
         * are mapped onto the old parameters, so this is an external interface change
         * only.
         *  @param {object} init Object to map
         */
        function _fnCompatCols(init) {
            _fnCompatMap(init, 'orderable', 'bSortable');
            _fnCompatMap(init, 'orderData', 'aDataSort');
            _fnCompatMap(init, 'orderSequence', 'asSorting');
            _fnCompatMap(init, 'orderDataType', 'sortDataType');

            // The orderData can be given as an integer.
            var dataSort = init.aDataSort;
            if (dataSort && !$.isArray(dataSort)) {
                init.aDataSort = [dataSort];
            }
        }

        /**
         * Browser feature detection for capabilities, quirks
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnBrowserDetect(settings) {
            var browser = settings.oBrowser;

            // Scrolling feature / quirks detection.
            var n = $('<div/>')
                    .css({
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: 1,
                        width: 1,
                        overflow: 'hidden'
                    })
                    .append(
                            $('<div/>')
                            .css({
                                position: 'absolute',
                                top: 1,
                                left: 1,
                                width: 100,
                                overflow: 'scroll'
                            })
                            .append(
                                    $('<div class="test"/>')
                                    .css({
                                        width: '100%',
                                        height: 10
                                    })
                                    )
                            )
                    .appendTo('body');

            var test = n.find('.test');

            // IE6/7 will oversize a width 100% element inside a scrolling element, to
            // include the width of the scrollbar, while other browsers ensure the inner
            // element is contained without forcing scrolling.
            browser.bScrollOversize = test[0].offsetWidth === 100;

            // In rtl text layout, some browsers (most, but not all) will place the
            // scrollbar on the left, rather than the right.
            browser.bScrollbarLeft = Math.round(test.offset().left) !== 1;

            n.remove();
        }

        /**
         * Array.prototype reduce[Right] method, used for browsers which don't support
         * JS 1.6. Done this way to reduce code size, since we iterate either way
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnReduce(that, fn, init, start, end, inc) {
            var
                    i = start,
                    value,
                    isSet = false;

            if (init !== undefined) {
                value = init;
                isSet = true;
            }

            while (i !== end) {
                if (!that.hasOwnProperty(i)) {
                    continue;
                }

                value = isSet ?
                        fn(value, that[i], i, that) :
                        that[i];

                isSet = true;
                i += inc;
            }

            return value;
        }

        /**
         * Add a column to the list used for the table with default values
         *  @param {object} oSettings dataTables settings object
         *  @param {node} nTh The th element for this column
         *  @memberof DataTable#oApi
         */
        function _fnAddColumn(oSettings, nTh) {
            // Add column to aoColumns array.
            var oDefaults = DataTable.defaults.column;
            var iCol = oSettings.aoColumns.length;
            var oCol = $.extend({}, DataTable.models.oColumn, oDefaults, {
                "nTh": nTh ? nTh : document.createElement('th'),
                "sTitle": oDefaults.sTitle ? oDefaults.sTitle : nTh ? nTh.innerHTML : '',
                "aDataSort": oDefaults.aDataSort ? oDefaults.aDataSort : [iCol],
                "mData": oDefaults.mData ? oDefaults.mData : iCol,
                idx: iCol
            });
            oSettings.aoColumns.push(oCol);

            // Add search object for column specific search. Note that the `searchCols[ iCol ]`
            // passed into extend can be undefined. This allows the user to give a default
            // with only some of the parameters defined, and also not give a default.
            var searchCols = oSettings.aoPreSearchCols;
            searchCols[ iCol ] = $.extend({}, DataTable.models.oSearch, searchCols[ iCol ]);

            // Use the default column options function to initialise classes etc.
            _fnColumnOptions(oSettings, iCol, $(nTh).data());
        }

        /**
         * Apply options for a column
         *  @param {object} oSettings dataTables settings object
         *  @param {int} iCol column index to consider
         *  @param {object} oOptions object with sType, bVisible and bSearchable etc
         *  @memberof DataTable#oApi
         */
        function _fnColumnOptions(oSettings, iCol, oOptions) {
            var oCol = oSettings.aoColumns[ iCol ];
            var oClasses = oSettings.oClasses;
            var th = $(oCol.nTh);

            // Try to get width information from the DOM. We can't get it from CSS
            // as we'd need to parse the CSS stylesheet. `width` option can override.
            if (!oCol.sWidthOrig) {
                // Width attribute.
                oCol.sWidthOrig = th.attr('width') || null;

                // Style attribute.
                var t = (th.attr('style') || '').match(/width:\s*(\d+[pxem%]+)/);
                if (t) {
                    oCol.sWidthOrig = t[1];
                }
            }

            /* User specified column options */
            if (oOptions !== undefined && oOptions !== null) {
                // Backwards compatibility.
                _fnCompatCols(oOptions);

                // Map camel case parameters to their Hungarian counterparts.
                _fnCamelToHungarian(DataTable.defaults.column, oOptions);

                /* Backwards compatibility for mDataProp */
                if (oOptions.mDataProp !== undefined && !oOptions.mData) {
                    oOptions.mData = oOptions.mDataProp;
                }

                if (oOptions.sType) {
                    oCol._sManualType = oOptions.sType;
                }

                // The `class` is a reserved word in Javascript, so we need to provide
                // the ability to use a valid name for the camel case input.
                if (oOptions.className && !oOptions.sClass)
                {
                    oOptions.sClass = oOptions.className;
                }

                $.extend(oCol, oOptions);
                _fnMap(oCol, oOptions, "sWidth", "sWidthOrig");

                /* iDataSort to be applied (backwards compatibility), but aDataSort will take
                 * priority if defined
                 */
                if (oOptions.iDataSort !== undefined) {
                    oCol.aDataSort = [oOptions.iDataSort];
                }
                _fnMap(oCol, oOptions, "aDataSort");
            }

            /* Cache the data get and set functions for speed */
            var mDataSrc = oCol.mData;
            var mData = _fnGetObjectDataFn(mDataSrc);
            var mRender = oCol.mRender ? _fnGetObjectDataFn(oCol.mRender) : null;

            var attrTest = function (src) {
                return typeof src === 'string' && src.indexOf('@') !== -1;
            };
            oCol._bAttrSrc = $.isPlainObject(mDataSrc) && (
                    attrTest(mDataSrc.sort) || attrTest(mDataSrc.type) || attrTest(mDataSrc.filter)
                    );

            oCol.fnGetData = function (rowData, type, meta) {
                var innerData = mData(rowData, type, undefined, meta);

                return mRender && type ?
                        mRender(innerData, type, rowData, meta) :
                        innerData;
            };
            oCol.fnSetData = function (rowData, val, meta) {
                return _fnSetObjectDataFn(mDataSrc)(rowData, val, meta);
            };

            // Indicate if DataTables should read DOM data as an object or array
            // Used in _fnGetRowElements.
            if (typeof mDataSrc !== 'number') {
                oSettings._rowReadObject = true;
            }

            /* Feature sorting overrides column specific when off */
            if (!oSettings.oFeatures.bSort) {
                oCol.bSortable = false;
                th.addClass(oClasses.sSortableNone); // Have to add class here as order event isn't called.
            }

            /* Check that the class assignment is correct for sorting */
            var bAsc = $.inArray('asc', oCol.asSorting) !== -1;
            var bDesc = $.inArray('desc', oCol.asSorting) !== -1;
            if (!oCol.bSortable || (!bAsc && !bDesc)) {
                oCol.sSortingClass = oClasses.sSortableNone;
                oCol.sSortingClassJUI = "";
            } else if (bAsc && !bDesc) {
                oCol.sSortingClass = oClasses.sSortableAsc;
                oCol.sSortingClassJUI = oClasses.sSortJUIAscAllowed;
            } else if (!bAsc && bDesc) {
                oCol.sSortingClass = oClasses.sSortableDesc;
                oCol.sSortingClassJUI = oClasses.sSortJUIDescAllowed;
            } else {
                oCol.sSortingClass = oClasses.sSortable;
                oCol.sSortingClassJUI = oClasses.sSortJUI;
            }
        }

        /**
         * Adjust the table column widths for new data. Note: you would probably want to
         * do a redraw after calling this function!
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnAdjustColumnSizing(settings) {
            /* Not interested in doing column width calculation if auto-width is disabled */
            if (settings.oFeatures.bAutoWidth !== false) {
                var columns = settings.aoColumns;

                _fnCalculateColumnWidths(settings);
                for (var i = 0, iLen = columns.length; i < iLen; i++) {
                    columns[i].nTh.style.width = columns[i].sWidth;
                }
            }

            var scroll = settings.oScroll;
            if (scroll.sY !== '' || scroll.sX !== '') {
                _fnScrollDraw(settings);
            }

            _fnCallbackFire(settings, null, 'column-sizing', [settings]);
        }

        /**
         * Covert the index of a visible column to the index in the data array (take account
         * of hidden columns)
         *  @param {object} oSettings dataTables settings object
         *  @param {int} iMatch Visible column index to lookup
         *  @returns {int} i the data index
         *  @memberof DataTable#oApi
         */
        function _fnVisibleToColumnIndex(oSettings, iMatch) {
            var aiVis = _fnGetColumns(oSettings, 'bVisible');

            return typeof aiVis[iMatch] === 'number' ?
                    aiVis[iMatch] :
                    null;
        }

        /**
         * Covert the index of an index in the data array and convert it to the visible
         *   column index (take account of hidden columns)
         *  @param {int} iMatch Column index to lookup
         *  @param {object} oSettings dataTables settings object
         *  @returns {int} i the data index
         *  @memberof DataTable#oApi
         */
        function _fnColumnIndexToVisible(oSettings, iMatch) {
            var aiVis = _fnGetColumns(oSettings, 'bVisible');
            var iPos = $.inArray(iMatch, aiVis);

            return iPos !== -1 ? iPos : null;
        }

        /**
         * Get the number of visible columns
         *  @param {object} oSettings dataTables settings object
         *  @returns {int} i the number of visible columns
         *  @memberof DataTable#oApi
         */
        function _fnVisbleColumns(oSettings) {
            return _fnGetColumns(oSettings, 'bVisible').length;
        }

        /**
         * Get an array of column indexes that match a given property
         *  @param {object} oSettings dataTables settings object
         *  @param {string} sParam Parameter in aoColumns to look for - typically
         *    bVisible or bSearchable
         *  @returns {array} Array of indexes with matched properties
         *  @memberof DataTable#oApi
         */
        function _fnGetColumns(oSettings, sParam) {
            var a = [];

            $.map(oSettings.aoColumns, function (val, i) {
                if (val[sParam]) {
                    a.push(i);
                }
            });

            return a;
        }

        /**
         * Calculate the 'type' of a column
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnColumnTypes(settings) {
            var columns = settings.aoColumns;
            var data = settings.aoData;
            var types = DataTable.ext.type.detect;
            var i, ien, j, jen, k, ken;
            var col, cell, detectedType, cache;

            // For each column, spin over the.
            for (i = 0, ien = columns.length; i < ien; i++) {
                col = columns[i];
                cache = [];

                if (!col.sType && col._sManualType) {
                    col.sType = col._sManualType;
                }
                else if (!col.sType) {
                    for (j = 0, jen = types.length; j < jen; j++) {
                        for (k = 0, ken = data.length; k < ken; k++) {
                            // Use a cache array so we only need to get the type data
                            // from the formatter once (when using multiple detectors).
                            if (cache[k] === undefined) {
                                cache[k] = _fnGetCellData(settings, k, i, 'type');
                            }

                            detectedType = types[j](cache[k], settings);

                            // If null, then this type can't apply to this column, so
                            // rather than testing all cells, break out. There is an
                            // exception for the last type which is `html`. We need to
                            // scan all rows since it is possible to mix string and HTML
                            // types.
                            if (!detectedType && j !== types.length - 1) {
                                break;
                            }

                            // Only a single match is needed for html type since it is
                            // bottom of the pile and very similar to string.
                            if (detectedType === 'html') {
                                break;
                            }
                        }

                        // Type is valid for all data points in the column - use this type.
                        if (detectedType) {
                            col.sType = detectedType;
                            break;
                        }
                    }

                    // Fall back - if no type was detected, always use string.
                    if (!col.sType) {
                        col.sType = 'string';
                    }
                }
            }
        }

        /**
         * Take the column definitions and static columns arrays and calculate how
         * they relate to column indexes. The callback function will then apply the
         * definition found for a column to a suitable configuration object.
         *  @param {object} oSettings dataTables settings object
         *  @param {array} aoColDefs The aoColumnDefs array that is to be applied
         *  @param {array} aoCols The aoColumns array that defines columns individually
         *  @param {function} fn Callback function - takes two parameters, the calculated
         *    column index and the definition for that column.
         *  @memberof DataTable#oApi
         */
        function _fnApplyColumnDefs(oSettings, aoColDefs, aoCols, fn) {
            var i, iLen, j, jLen, k, kLen, def;
            var columns = oSettings.aoColumns;

            // Column definitions with aTargets.
            if (aoColDefs) {
                /* Loop over the definitions array - loop in reverse so first instance has priority */
                for (i = aoColDefs.length - 1; i >= 0; i--) {
                    def = aoColDefs[i];

                    /* Each definition can target multiple columns, as it is an array */
                    var aTargets = def.targets !== undefined ?
                            def.targets :
                            def.aTargets;

                    if (!$.isArray(aTargets)) {
                        aTargets = [aTargets];
                    }

                    for (j = 0, jLen = aTargets.length; j < jLen; j++) {
                        if (typeof aTargets[j] === 'number' && aTargets[j] >= 0) {
                            /* Add columns that we don't yet know about */
                            while (columns.length <= aTargets[j]) {
                                _fnAddColumn(oSettings);
                            }

                            /* Integer, basic index */
                            fn(aTargets[j], def);
                        } else if (typeof aTargets[j] === 'number' && aTargets[j] < 0) {
                            /* Negative integer, right to left column counting */
                            fn(columns.length + aTargets[j], def);
                        } else if (typeof aTargets[j] === 'string') {
                            /* Class name matching on TH element */
                            for (k = 0, kLen = columns.length; k < kLen; k++) {
                                if (aTargets[j] == "_all" || $(columns[k].nTh).hasClass(aTargets[j])) {
                                    fn(k, def);
                                }
                            }
                        }
                    }
                }
            }

            // Statically defined columns array.
            if (aoCols) {
                for (i = 0, iLen = aoCols.length; i < iLen; i++) {
                    fn(i, aoCols[i]);
                }
            }
        }

        /**
         * Add a data array to the table, creating DOM node etc. This is the parallel to
         * _fnGatherData, but for adding rows from a Javascript source, rather than a
         * DOM source.
         *  @param {object} oSettings dataTables settings object
         *  @param {array} aData data array to be added
         *  @param {node} [nTr] TR element to add to the table - optional. If not given,
         *    DataTables will create a row automatically
         *  @param {array} [anTds] Array of TD|TH elements for the row - must be given
         *    if nTr is.
         *  @returns {int} >=0 if successful (index of new aoData entry), -1 if failed
         *  @memberof DataTable#oApi
         */
        function _fnAddData(oSettings, aDataIn, nTr, anTds) {
            /* Create the object for storing information about this new row */
            var iRow = oSettings.aoData.length;
            var oData = $.extend(true, {}, DataTable.models.oRow, {
                src: nTr ? 'dom' : 'data'
            });

            oData._aData = aDataIn;
            oSettings.aoData.push(oData);

            /* Create the cells */
            var nTd, sThisType;
            var columns = oSettings.aoColumns;
            for (var i = 0, iLen = columns.length; i < iLen; i++) {
                // When working with a row, the data source object must be populated. In
                // all other cases, the data source object is already populated, so we
                // don't overwrite it, which might break bindings etc.
                if (nTr) {
                    _fnSetCellData(oSettings, iRow, i, _fnGetCellData(oSettings, iRow, i));
                }
                columns[i].sType = null;
            }

            /* Add to the display array */
            oSettings.aiDisplayMaster.push(iRow);

            /* Create the DOM information, or register it if already present */
            if (nTr || !oSettings.oFeatures.bDeferRender) {
                _fnCreateTr(oSettings, iRow, nTr, anTds);
            }

            return iRow;
        }

        /**
         * Add one or more TR elements to the table. Generally we'd expect to
         * use this for reading data from a DOM sourced table, but it could be
         * used for an TR element. Note that if a TR is given, it is used (i.e.
         * it is not cloned).
         *  @param {object} settings dataTables settings object
         *  @param {array|node|jQuery} trs The TR element(s) to add to the table
         *  @returns {array} Array of indexes for the added rows
         *  @memberof DataTable#oApi
         */
        function _fnAddTr(settings, trs) {
            var row;

            // Allow an individual node to be passed in.
            if (!(trs instanceof $)) {
                trs = $(trs);
            }

            return trs.map(function (i, el) {
                row = _fnGetRowElements(settings, el);
                return _fnAddData(settings, row.data, el, row.cells);
            });
        }

        /**
         * Take a TR element and convert it to an index in aoData
         *  @param {object} oSettings dataTables settings object
         *  @param {node} n the TR element to find
         *  @returns {int} index if the node is found, null if not
         *  @memberof DataTable#oApi
         */
        function _fnNodeToDataIndex(oSettings, n) {
            return (n._DT_RowIndex !== undefined) ? n._DT_RowIndex : null;
        }

        /**
         * Take a TD element and convert it into a column data index (not the visible index)
         *  @param {object} oSettings dataTables settings object
         *  @param {int} iRow The row number the TD/TH can be found in
         *  @param {node} n The TD/TH element to find
         *  @returns {int} index if the node is found, -1 if not
         *  @memberof DataTable#oApi
         */
        function _fnNodeToColumnIndex(oSettings, iRow, n) {
            return $.inArray(n, oSettings.aoData[ iRow ].anCells);
        }

        /**
         * Get the data for a given cell from the internal cache, taking into account data mapping
         *  @param {object} settings dataTables settings object
         *  @param {int} rowIdx aoData row id
         *  @param {int} colIdx Column index
         *  @param {string} type data get type ('display', 'type' 'filter' 'sort')
         *  @returns {*} Cell data
         *  @memberof DataTable#oApi
         */
        function _fnGetCellData(settings, rowIdx, colIdx, type) {
            var draw = settings.iDraw;
            var col = settings.aoColumns[colIdx];
            var rowData = settings.aoData[rowIdx]._aData;
            var defaultContent = col.sDefaultContent;
            var cellData = col.fnGetData(rowData, type, {
                settings: settings,
                row: rowIdx,
                col: colIdx
            });

            if (cellData === undefined) {
                if (settings.iDrawError != draw && defaultContent === null) {
                    _fnLog(settings, 0, "Requested unknown parameter " +
                            (typeof col.mData == 'function' ? '{function}' : "'" + col.mData + "'") +
                            " for row " + rowIdx, 4);
                    settings.iDrawError = draw;
                }
                return defaultContent;
            }

            /* When the data source is null, we can use default column data */
            if ((cellData === rowData || cellData === null) && defaultContent !== null) {
                cellData = defaultContent;
            } else if (typeof cellData === 'function') {
                // If the data source is a function, then we run it and use the return,
                // executing in the scope of the data object (for instances).
                return cellData.call(rowData);
            }

            if (cellData === null && type == 'display') {
                return '';
            }
            return cellData;
        }

        /**
         * Set the value for a specific cell, into the internal data cache
         *  @param {object} settings dataTables settings object
         *  @param {int} rowIdx aoData row id
         *  @param {int} colIdx Column index
         *  @param {*} val Value to set
         *  @memberof DataTable#oApi
         */
        function _fnSetCellData(settings, rowIdx, colIdx, val) {
            var col = settings.aoColumns[colIdx];
            var rowData = settings.aoData[rowIdx]._aData;

            col.fnSetData(rowData, val, {
                settings: settings,
                row: rowIdx,
                col: colIdx
            });
        }

        // Private variable that is used to match action syntax in the data property object.
        var __reArray = /\[.*?\]$/;
        var __reFn = /\(\)$/;

        /**
         * Split string on periods, taking into account escaped periods
         * @param  {string} str String to split
         * @return {array} Split string
         */
        function _fnSplitObjNotation(str) {
            return $.map(str.match(/(\\.|[^\.])+/g) || [''], function (s) {
                return s.replace(/\\./g, '.');
            });
        }

        /**
         * Return a function that can be used to get data from a source object, taking
         * into account the ability to use nested objects as a source
         *  @param {string|int|function} mSource The data source for the object
         *  @returns {function} Data get function
         *  @memberof DataTable#oApi
         */
        function _fnGetObjectDataFn(mSource) {
            if ($.isPlainObject(mSource)) {
                /* Build an object of get functions, and wrap them in a single call */
                var o = {};
                $.each(mSource, function (key, val) {
                    if (val) {
                        o[key] = _fnGetObjectDataFn(val);
                    }
                });

                return function (data, type, row, meta) {
                    var t = o[type] || o._;
                    return t !== undefined ?
                            t(data, type, row, meta) :
                            data;
                };
            } else if (mSource === null) {
                /* Give an empty string for rendering / sorting etc */
                return function (data) { // type, row and meta also passed, but not used.
                    return data;
                };
            } else if (typeof mSource === 'function') {
                return function (data, type, row, meta) {
                    return mSource(data, type, row, meta);
                };
            } else if (typeof mSource === 'string' && (mSource.indexOf('.') !== -1 ||
                    mSource.indexOf('[') !== -1 || mSource.indexOf('(') !== -1)) {

                /* If there is a . in the source string then the data source is in a
                 * nested object so we loop over the data for each level to get the next
                 * level down. On each loop we test for undefined, and if found immediately
                 * return. This allows entire objects to be missing and sDefaultContent to
                 * be used if defined, rather than throwing an error
                 */
                var fetchData = function (data, type, src) {
                    var arrayNotation, funcNotation, out, innerSrc;

                    if (src !== "") {
                        var a = _fnSplitObjNotation(src);

                        for (var i = 0, iLen = a.length; i < iLen; i++) {
                            // Check if we are dealing with special notation.
                            arrayNotation = a[i].match(__reArray);
                            funcNotation = a[i].match(__reFn);

                            if (arrayNotation) {
                                // Array notation.
                                a[i] = a[i].replace(__reArray, '');

                                // Condition allows simply [] to be passed in.
                                if (a[i] !== "") {
                                    data = data[ a[i] ];
                                }
                                out = [];

                                // Get the remainder of the nested object to get.
                                a.splice(0, i + 1);
                                innerSrc = a.join('.');

                                // Traverse each entry in the array getting the properties requested.
                                for (var j = 0, jLen = data.length; j < jLen; j++) {
                                    out.push(fetchData(data[j], type, innerSrc));
                                }

                                // If a string is given in between the array notation indicators, that
                                // is used to join the strings together, otherwise an array is returned.
                                var join = arrayNotation[0].substring(1, arrayNotation[0].length - 1);
                                data = (join === "") ? out : out.join(join);

                                // The inner call to fetchData has already traversed through the remainder
                                // of the source requested, so we exit from the loop.
                                break;
                            } else if (funcNotation) {
                                // Function call.
                                a[i] = a[i].replace(__reFn, '');
                                data = data[ a[i] ]();
                                continue;
                            }

                            if (data === null || data[ a[i] ] === undefined) {
                                return undefined;
                            }
                            data = data[ a[i] ];
                        }
                    }

                    return data;
                };

                return function (data, type) { // Row and meta also passed, but not used.
                    return fetchData(data, type, mSource);
                };
            } else {
                /* Array or flat object mapping */
                return function (data, type) { // Row and meta also passed, but not used.
                    return data[mSource];
                };
            }
        }

        /**
         * Return a function that can be used to set data from a source object, taking
         * into account the ability to use nested objects as a source
         *  @param {string|int|function} mSource The data source for the object
         *  @returns {function} Data set function
         *  @memberof DataTable#oApi
         */
        function _fnSetObjectDataFn(mSource) {
            if ($.isPlainObject(mSource)) {
                /* Unlike get, only the underscore (global) option is used for for
                 * setting data since we don't know the type here. This is why an object
                 * option is not documented for `mData` (which is read/write), but it is
                 * for `mRender` which is read only.
                 */
                return _fnSetObjectDataFn(mSource._);
            } else if (mSource === null) {
                /* Nothing to do when the data source is null */
                return function () {
                };
            } else if (typeof mSource === 'function') {
                return function (data, val, meta) {
                    mSource(data, 'set', val, meta);
                };
            } else if (typeof mSource === 'string' && (mSource.indexOf('.') !== -1 ||
                    mSource.indexOf('[') !== -1 || mSource.indexOf('(') !== -1)) {
                /* Like the get, we need to get data from a nested object */
                var setData = function (data, val, src) {
                    var a = _fnSplitObjNotation(src), b;
                    var aLast = a[a.length - 1];
                    var arrayNotation, funcNotation, o, innerSrc;

                    for (var i = 0, iLen = a.length - 1; i < iLen; i++) {
                        // Check if we are dealing with an array notation request.
                        arrayNotation = a[i].match(__reArray);
                        funcNotation = a[i].match(__reFn);

                        if (arrayNotation) {
                            a[i] = a[i].replace(__reArray, '');
                            data[ a[i] ] = [];

                            // Get the remainder of the nested object to set so we can recurse.
                            b = a.slice();
                            b.splice(0, i + 1);
                            innerSrc = b.join('.');

                            // Traverse each entry in the array setting the properties requested.
                            for (var j = 0, jLen = val.length; j < jLen; j++) {
                                o = {};
                                setData(o, val[j], innerSrc);
                                data[ a[i] ].push(o);
                            }

                            // The inner call to setData has already traversed through the remainder
                            // of the source and has set the data, thus we can exit here.
                            return;
                        } else if (funcNotation) {
                            // Function call.
                            a[i] = a[i].replace(__reFn, '');
                            data = data[ a[i] ](val);
                        }

                        // If the nested object doesn't currently exist - since we are
                        // trying to set the value - create it.
                        if (data[ a[i] ] === null || data[ a[i] ] === undefined) {
                            data[ a[i] ] = {};
                        }
                        data = data[ a[i] ];
                    }

                    // Last item in the input - i.e, the actual set.
                    if (aLast.match(__reFn)) {
                        // Function call.
                        data = data[ aLast.replace(__reFn, '') ](val);
                    } else {
                        // If array notation is used, we just want to strip it and use the property name
                        // and assign the value. If it isn't used, then we get the result we want anyway.
                        data[ aLast.replace(__reArray, '') ] = val;
                    }
                };

                return function (data, val) { // Meta is also passed in, but not used.
                    return setData(data, val, mSource);
                };
            } else {
                /* Array or flat object mapping */
                return function (data, val) { // Meta is also passed in, but not used.
                    data[mSource] = val;
                };
            }
        }

        /**
         * Return an array with the full table data
         *  @param {object} oSettings dataTables settings object
         *  @returns array {array} aData Master data array
         *  @memberof DataTable#oApi
         */
        function _fnGetDataMaster(settings) {
            return _pluck(settings.aoData, '_aData');
        }

        /**
         * Nuke the table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnClearTable(settings) {
            settings.aoData.length = 0;
            settings.aiDisplayMaster.length = 0;
            settings.aiDisplay.length = 0;
        }

        /**
         * Take an array of integers (index array) and remove a target integer (value - not
         * the key!)
         *  @param {array} a Index array to target
         *  @param {int} iTarget value to find
         *  @memberof DataTable#oApi
         */
        function _fnDeleteIndex(a, iTarget, splice) {
            var iTargetIndex = -1;

            for (var i = 0, iLen = a.length; i < iLen; i++) {
                if (a[i] == iTarget) {
                    iTargetIndex = i;
                } else if (a[i] > iTarget) {
                    a[i]--;
                }
            }

            if (iTargetIndex != -1 && splice === undefined) {
                a.splice(iTargetIndex, 1);
            }
        }

        /**
         * Mark cached data as invalid such that a re-read of the data will occur when
         * the cached data is next requested. Also update from the data source object.
         *
         * @param {object} settings DataTables settings object
         * @param {int}    rowIdx   Row index to invalidate
         * @param {string} [src]    Source to invalidate from: undefined, 'auto', 'dom'
         *     or 'data'
         * @param {int}    [colIdx] Column index to invalidate. If undefined the whole
         *     row will be invalidated
         * @memberof DataTable#oApi
         *
         * @todo For the modularisation of v1.11 this will need to become a callback, so
         *   the sort and filter methods can subscribe to it. That will required
         *   initialisation options for sorting, which is why it is not already baked in
         */
        function _fnInvalidate(settings, rowIdx, src, colIdx) {
            var row = settings.aoData[ rowIdx ];
            var i, ien;
            var cellWrite = function (cell, col) {
                // This is very frustrating, but in IE if you just write directly
                // to innerHTML, and elements that are overwritten are GC'ed,
                // even if there is a reference to them elsewhere.
                while (cell.childNodes.length) {
                    cell.removeChild(cell.firstChild);
                }

                cell.innerHTML = _fnGetCellData(settings, rowIdx, col, 'display');
            };

            // Are we reading last data from DOM or the data object?
            if (src === 'dom' || ((!src || src === 'auto') && row.src === 'dom')) {
                // Read the data from the DOM.
                row._aData = _fnGetRowElements(
                        settings, row, colIdx, colIdx === undefined ? undefined : row._aData
                        )
                        .data;
            } else {
                // Reading from data object, update the DOM.
                var cells = row.anCells;

                if (cells) {
                    if (colIdx !== undefined) {
                        cellWrite(cells[colIdx], colIdx);
                    } else {
                        for (i = 0, ien = cells.length; i < ien; i++) {
                            cellWrite(cells[i], i);
                        }
                    }
                }
            }

            // For both row and cell invalidation, the cached data for sorting and
            // filtering is nulled out.
            row._aSortData = null;
            row._aFilterData = null;

            // Invalidate the type for a specific column (if given) or all columns since
            // the data might have changed.
            var cols = settings.aoColumns;
            if (colIdx !== undefined) {
                cols[ colIdx ].sType = null;
            } else {
                for (i = 0, ien = cols.length; i < ien; i++) {
                    cols[i].sType = null;
                }

                // Update DataTables special `DT_*` attributes for the row.
                _fnRowAttributes(settings, row);
            }
        }

        /**
         * Build a data source object from an HTML row, reading the contents of the
         * cells that are in the row.
         *
         * @param {object} settings DataTables settings object
         * @param {node|object} TR element from which to read data or existing row
         *   object from which to re-read the data from the cells
         * @param {int} [colIdx] Optional column index
         * @param {array|object} [d] Data source object. If `colIdx` is given then this
         *   parameter should also be given and will be used to write the data into.
         *   Only the column in question will be written
         * @returns {object} Object with two parameters: `data` the data read, in
         *   document order, and `cells` and array of nodes (they can be useful to the
         *   caller, so rather than needing a second traversal to get them, just return
         *   them from here).
         * @memberof DataTable#oApi
         */
        function _fnGetRowElements(settings, row, colIdx, d) {
            var
                    tds = [],
                    td = row.firstChild,
                    name, col, o, i = 0, contents,
                    columns = settings.aoColumns,
                    objectRead = settings._rowReadObject;

            // Allow the data object to be passed in, or construct.
            d = d || objectRead ? {} : [];

            var attr = function (str, td) {
                if (typeof str === 'string') {
                    var idx = str.indexOf('@');

                    if (idx !== -1) {
                        var attr = str.substring(idx + 1);
                        var setter = _fnSetObjectDataFn(str);
                        setter(d, td.getAttribute(attr));
                    }
                }
            };

            // Read data from a cell and store into the data object.
            var cellProcess = function (cell) {
                if (colIdx === undefined || colIdx === i) {
                    col = columns[i];
                    contents = $.trim(cell.innerHTML);

                    if (col && col._bAttrSrc) {
                        var setter = _fnSetObjectDataFn(col.mData._);
                        setter(d, contents);

                        attr(col.mData.sort, cell);
                        attr(col.mData.type, cell);
                        attr(col.mData.filter, cell);
                    } else {
                        // Depending on the `data` option for the columns the data can
                        // be read to either an object or an array.
                        if (objectRead) {
                            if (!col._setter) {
                                // Cache the setter function.
                                col._setter = _fnSetObjectDataFn(col.mData);
                            }
                            col._setter(d, contents);
                        } else {
                            d[i] = contents;
                        }
                    }
                }

                i++;
            };

            if (td) {
                // The `tr` element was passed in.
                while (td) {
                    name = td.nodeName.toUpperCase();

                    if (name == "TD" || name == "TH") {
                        cellProcess(td);
                        tds.push(td);
                    }

                    td = td.nextSibling;
                }
            } else {
                // Existing row object passed in.
                tds = row.anCells;

                for (var j = 0, jen = tds.length; j < jen; j++) {
                    cellProcess(tds[j]);
                }
            }

            return {
                data: d,
                cells: tds
            };
        }

        /**
         * Create a new TR element (and it's TD children) for a row
         *  @param {object} oSettings dataTables settings object
         *  @param {int} iRow Row to consider
         *  @param {node} [nTrIn] TR element to add to the table - optional. If not given,
         *    DataTables will create a row automatically
         *  @param {array} [anTds] Array of TD|TH elements for the row - must be given
         *    if nTr is.
         *  @memberof DataTable#oApi
         */
        function _fnCreateTr(oSettings, iRow, nTrIn, anTds) {
            var
                    row = oSettings.aoData[iRow],
                    rowData = row._aData,
                    cells = [],
                    nTr, nTd, oCol,
                    i, iLen;

            if (row.nTr === null) {
                nTr = nTrIn || document.createElement('tr');

                row.nTr = nTr;
                row.anCells = cells;

                /* Use a private property on the node to allow reserve mapping from the node
                 * to the aoData array for fast look up
                 */
                nTr._DT_RowIndex = iRow;

                /* Special parameters can be given by the data source to be used on the row */
                _fnRowAttributes(oSettings, row);

                /* Process each column */
                for (i = 0, iLen = oSettings.aoColumns.length; i < iLen; i++) {
                    oCol = oSettings.aoColumns[i];

                    nTd = nTrIn ? anTds[i] : document.createElement(oCol.sCellType);
                    cells.push(nTd);

                    // Need to create the HTML if new, or if a rendering function is defined.
                    if (!nTrIn || oCol.mRender || oCol.mData !== i) {
                        nTd.innerHTML = _fnGetCellData(oSettings, iRow, i, 'display');
                    }

                    /* Add user defined class */
                    if (oCol.sClass) {
                        nTd.className += ' ' + oCol.sClass;
                    }

                    // Visibility - add or remove as required.
                    if (oCol.bVisible && !nTrIn) {
                        nTr.appendChild(nTd);
                    } else if (!oCol.bVisible && nTrIn) {
                        nTd.parentNode.removeChild(nTd);
                    }

                    if (oCol.fnCreatedCell) {
                        oCol.fnCreatedCell.call(oSettings.oInstance,
                                nTd, _fnGetCellData(oSettings, iRow, i), rowData, iRow, i
                                );
                    }
                }

                _fnCallbackFire(oSettings, 'aoRowCreatedCallback', null, [nTr, rowData, iRow]);
            }

            // Remove once webkit bug 131819 and Chromium bug 365619 have been resolved and deployed.
            row.nTr.setAttribute('role', 'row');
        }

        /**
         * Add attributes to a row based on the special `DT_*` parameters in a data
         * source object.
         *  @param {object} settings DataTables settings object
         *  @param {object} DataTables row object for the row to be modified
         *  @memberof DataTable#oApi
         */
        function _fnRowAttributes(settings, row) {
            var tr = row.nTr;
            var data = row._aData;

            if (tr) {
                var id = settings.rowId(data);

                if (id) {
                    tr.id = id;
                }

                if (data.DT_RowClass) {
                    // Remove any classes added by DT_RowClass before.
                    var a = data.DT_RowClass.split(' ');
                    row.__rowc = row.__rowc ?
                            _unique(row.__rowc.concat(a)) :
                            a;

                    $(tr)
                            .removeClass(row.__rowc.join(' '))
                            .addClass(data.DT_RowClass);
                }

                if (data.DT_RowAttr) {
                    $(tr).attr(data.DT_RowAttr);
                }

                if (data.DT_RowData) {
                    $(tr).data(data.DT_RowData);
                }
            }
        }

        /**
         * Create the HTML header for the table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnBuildHead(oSettings) {
            var i, ien, cell, row, column;
            var thead = oSettings.nTHead;
            var tfoot = oSettings.nTFoot;
            var createHeader = $('th, td', thead).length === 0;
            var classes = oSettings.oClasses;
            var columns = oSettings.aoColumns;

            if (createHeader) {
                row = $('<tr/>').appendTo(thead);
            }

            for (i = 0, ien = columns.length; i < ien; i++) {
                column = columns[i];
                cell = $(column.nTh).addClass(column.sClass);

                if (createHeader) {
                    cell.appendTo(row);
                }

                // 1.11 move into sorting.
                if (oSettings.oFeatures.bSort) {
                    cell.addClass(column.sSortingClass);

                    if (column.bSortable !== false) {
                        cell
                                .attr('tabindex', oSettings.iTabIndex)
                                .attr('aria-controls', oSettings.sTableId);

                        _fnSortAttachListener(oSettings, column.nTh, i);
                    }
                }

                if (column.sTitle != cell[0].innerHTML) {
                    cell.html(column.sTitle);
                }

                _fnRenderer(oSettings, 'header')(
                        oSettings, cell, column, classes
                        );
            }

            if (createHeader) {
                _fnDetectHeader(oSettings.aoHeader, thead);
            }

            /* ARIA role for the rows */
            $(thead).find('>tr').attr('role', 'row');

            /* Deal with the footer - add classes if required */
            $(thead).find('>tr>th, >tr>td').addClass(classes.sHeaderTH);
            $(tfoot).find('>tr>th, >tr>td').addClass(classes.sFooterTH);

            // Cache the footer cells. Note that we only take the cells from the first
            // row in the footer. If there is more than one row the user wants to
            // interact with, they need to use the table().foot() method. Note also this
            // allows cells to be used for multiple columns using colspan.
            if (tfoot !== null) {
                var cells = oSettings.aoFooter[0];

                for (i = 0, ien = cells.length; i < ien; i++) {
                    column = columns[i];
                    column.nTf = cells[i].cell;

                    if (column.sClass) {
                        $(column.nTf).addClass(column.sClass);
                    }
                }
            }
        }

        /**
         * Draw the header (or footer) element based on the column visibility states. The
         * methodology here is to use the layout array from _fnDetectHeader, modified for
         * the instantaneous column visibility, to construct the new layout. The grid is
         * traversed over cell at a time in a rows x columns grid fashion, although each
         * cell insert can cover multiple elements in the grid - which is tracks using the
         * aApplied array. Cell inserts in the grid will only occur where there isn't
         * already a cell in that position.
         *  @param {object} oSettings dataTables settings object
         *  @param array {objects} aoSource Layout array from _fnDetectHeader
         *  @param {boolean} [bIncludeHidden=false] If true then include the hidden columns in the calc,
         *  @memberof DataTable#oApi
         */
        function _fnDrawHead(oSettings, aoSource, bIncludeHidden) {
            var i, iLen, j, jLen, k, kLen, n, nLocalTr;
            var aoLocal = [];
            var aApplied = [];
            var iColumns = oSettings.aoColumns.length;
            var iRowspan, iColspan;

            if (!aoSource) {
                return;
            }

            if (bIncludeHidden === undefined) {
                bIncludeHidden = false;
            }

            /* Make a copy of the master layout array, but without the visible columns in it */
            for (i = 0, iLen = aoSource.length; i < iLen; i++) {
                aoLocal[i] = aoSource[i].slice();
                aoLocal[i].nTr = aoSource[i].nTr;

                /* Remove any columns which are currently hidden */
                for (j = iColumns - 1; j >= 0; j--) {
                    if (!oSettings.aoColumns[j].bVisible && !bIncludeHidden)
                    {
                        aoLocal[i].splice(j, 1);
                    }
                }

                /* Prep the applied array - it needs an element for each row */
                aApplied.push([]);
            }

            for (i = 0, iLen = aoLocal.length; i < iLen; i++) {
                nLocalTr = aoLocal[i].nTr;

                /* All cells are going to be replaced, so empty out the row */
                if (nLocalTr) {
                    while ((n = nLocalTr.firstChild)) {
                        nLocalTr.removeChild(n);
                    }
                }

                for (j = 0, jLen = aoLocal[i].length; j < jLen; j++) {
                    iRowspan = 1;
                    iColspan = 1;

                    /* Check to see if there is already a cell (row/colspan) covering our target
                     * insert point. If there is, then there is nothing to do.
                     */
                    if (aApplied[i][j] === undefined) {
                        nLocalTr.appendChild(aoLocal[i][j].cell);
                        aApplied[i][j] = 1;

                        /* Expand the cell to cover as many rows as needed */
                        while (aoLocal[i + iRowspan] !== undefined &&
                                aoLocal[i][j].cell == aoLocal[i + iRowspan][j].cell) {
                            aApplied[i + iRowspan][j] = 1;
                            iRowspan++;
                        }

                        /* Expand the cell to cover as many columns as needed */
                        while (aoLocal[i][j + iColspan] !== undefined &&
                                aoLocal[i][j].cell == aoLocal[i][j + iColspan].cell) {
                            /* Must update the applied array over the rows for the columns */
                            for (k = 0; k < iRowspan; k++) {
                                aApplied[i + k][j + iColspan] = 1;
                            }
                            iColspan++;
                        }

                        /* Do the actual expansion in the DOM */
                        $(aoLocal[i][j].cell)
                                .attr('rowspan', iRowspan)
                                .attr('colspan', iColspan);
                    }
                }
            }
        }

        /**
         * Insert the required TR nodes into the table for display
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnDraw(oSettings) {
            /* Provide a pre-callback function which can be used to cancel the draw is false is returned */
            var aPreDraw = _fnCallbackFire(oSettings, 'aoPreDrawCallback', 'preDraw', [oSettings]);
            if ($.inArray(false, aPreDraw) !== -1) {
                _fnProcessingDisplay(oSettings, false);
                return;
            }

            var i, iLen, n;
            var anRows = [];
            var iRowCount = 0;
            var asStripeClasses = oSettings.asStripeClasses;
            var iStripes = asStripeClasses.length;
            var iOpenRows = oSettings.aoOpenRows.length;
            var oLang = oSettings.oLanguage;
            var iInitDisplayStart = oSettings.iInitDisplayStart;
            var bServerSide = _fnDataSource(oSettings) == 'ssp';
            var aiDisplay = oSettings.aiDisplay;

            oSettings.bDrawing = true;

            /* Check and see if we have an initial draw position from state saving */
            if (iInitDisplayStart !== undefined && iInitDisplayStart !== -1) {
                oSettings._iDisplayStart = bServerSide ?
                        iInitDisplayStart :
                        iInitDisplayStart >= oSettings.fnRecordsDisplay() ?
                        0 :
                        iInitDisplayStart;

                oSettings.iInitDisplayStart = -1;
            }

            var iDisplayStart = oSettings._iDisplayStart;
            var iDisplayEnd = oSettings.fnDisplayEnd();

            /* Server-side processing draw intercept */
            if (oSettings.bDeferLoading) {
                oSettings.bDeferLoading = false;
                oSettings.iDraw++;
                _fnProcessingDisplay(oSettings, false);
            } else if (!bServerSide) {
                oSettings.iDraw++;
            } else if (!oSettings.bDestroying && !_fnAjaxUpdate(oSettings)) {
                return;
            }

            if (aiDisplay.length !== 0) {
                var iStart = bServerSide ? 0 : iDisplayStart;
                var iEnd = bServerSide ? oSettings.aoData.length : iDisplayEnd;

                for (var j = iStart; j < iEnd; j++) {
                    var iDataIndex = aiDisplay[j];
                    var aoData = oSettings.aoData[ iDataIndex ];
                    if (aoData.nTr === null) {
                        _fnCreateTr(oSettings, iDataIndex);
                    }

                    var nRow = aoData.nTr;

                    /* Remove the old striping classes and then add the new one */
                    if (iStripes !== 0) {
                        var sStripe = asStripeClasses[ iRowCount % iStripes ];
                        if (aoData._sRowStripe != sStripe) {
                            $(nRow).removeClass(aoData._sRowStripe).addClass(sStripe);
                            aoData._sRowStripe = sStripe;
                        }
                    }

                    // Row callback functions - might want to manipulate the row
                    // iRowCount and j are not currently documented. Are they at all
                    // useful?
                    _fnCallbackFire(oSettings, 'aoRowCallback', null,
                            [nRow, aoData._aData, iRowCount, j]);

                    anRows.push(nRow);
                    iRowCount++;
                }
            } else {
                /* Table is empty - create a row with an empty message in it */
                var sZero = oLang.sZeroRecords;
                if (oSettings.iDraw == 1 && _fnDataSource(oSettings) == 'ajax') {
                    sZero = oLang.sLoadingRecords;
                } else if (oLang.sEmptyTable && oSettings.fnRecordsTotal() === 0) {
                    sZero = oLang.sEmptyTable;
                }

                anRows[ 0 ] = $('<tr/>', {'class': iStripes ? asStripeClasses[0] : ''})
                        .append($('<td />', {
                            'valign': 'top',
                            'colSpan': _fnVisbleColumns(oSettings),
                            'class': oSettings.oClasses.sRowEmpty
                        }).html(sZero))[0];
            }

            /* Header and footer callbacks */
            _fnCallbackFire(oSettings, 'aoHeaderCallback', 'header', [$(oSettings.nTHead).children('tr')[0],
                _fnGetDataMaster(oSettings), iDisplayStart, iDisplayEnd, aiDisplay]);

            _fnCallbackFire(oSettings, 'aoFooterCallback', 'footer', [$(oSettings.nTFoot).children('tr')[0],
                _fnGetDataMaster(oSettings), iDisplayStart, iDisplayEnd, aiDisplay]);

            var body = $(oSettings.nTBody);

            body.children().detach();
            body.append($(anRows));

            /* Call all required callback functions for the end of a draw */
            _fnCallbackFire(oSettings, 'aoDrawCallback', 'draw', [oSettings]);

            /* Draw is complete, sorting and filtering must be as well */
            oSettings.bSorted = false;
            oSettings.bFiltered = false;
            oSettings.bDrawing = false;
        }

        /**
         * Redraw the table - taking account of the various features which are enabled
         *  @param {object} oSettings dataTables settings object
         *  @param {boolean} [holdPosition] Keep the current paging position. By default
         *    the paging is reset to the first page
         *  @memberof DataTable#oApi
         */
        function _fnReDraw(settings, holdPosition) {
            var
                    features = settings.oFeatures,
                    sort = features.bSort,
                    filter = features.bFilter;

            if (sort) {
                _fnSort(settings);
            }

            if (filter) {
                _fnFilterComplete(settings, settings.oPreviousSearch);
            } else {
                // No filtering, so we want to just use the display master.
                settings.aiDisplay = settings.aiDisplayMaster.slice();
            }

            if (holdPosition !== true) {
                settings._iDisplayStart = 0;
            }

            // Let any modules know about the draw hold position state (used by
            // scrolling internally).
            settings._drawHold = holdPosition;

            _fnDraw(settings);

            settings._drawHold = false;
        }

        /**
         * Add the options to the page HTML for the table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnAddOptionsHtml(oSettings) {
            var classes = oSettings.oClasses;
            var table = $(oSettings.nTable);
            var holding = $('<div/>').insertBefore(table); // Holding element for speed
            var features = oSettings.oFeatures;

            // All DataTables are wrapped in a div
            var insert = $('<div/>', {
                id: oSettings.sTableId + '_wrapper',
                'class': classes.sWrapper + (oSettings.nTFoot ? '' : ' ' + classes.sNoFooter)
            });

            oSettings.nHolding = holding[0];
            oSettings.nTableWrapper = insert[0];
            oSettings.nTableReinsertBefore = oSettings.nTable.nextSibling;

            /* Loop over the user set positioning and place the elements as needed */
            var aDom = oSettings.sDom.split('');
            var featureNode, cOption, nNewNode, cNext, sAttr, j;
            for (var i = 0; i < aDom.length; i++) {
                featureNode = null;
                cOption = aDom[i];

                if (cOption == '<') {
                    /* New container div */
                    nNewNode = $('<div/>')[0];

                    /* Check to see if we should append an id and/or a class name to the container */
                    cNext = aDom[i + 1];
                    if (cNext == "'" || cNext == '"') {
                        sAttr = "";
                        j = 2;
                        while (aDom[i + j] != cNext) {
                            sAttr += aDom[i + j];
                            j++;
                        }

                        /* Replace jQuery UI constants @todo depreciated */
                        if (sAttr == "H") {
                            sAttr = classes.sJUIHeader;
                        } else if (sAttr == "F") {
                            sAttr = classes.sJUIFooter;
                        }

                        /* The attribute can be in the format of "#id.class", "#id" or "class" This logic
                         * breaks the string into parts and applies them as needed
                         */
                        if (sAttr.indexOf('.') != -1) {
                            var aSplit = sAttr.split('.');
                            nNewNode.id = aSplit[0].substr(1, aSplit[0].length - 1);
                            nNewNode.className = aSplit[1];
                        } else if (sAttr.charAt(0) == "#") {
                            nNewNode.id = sAttr.substr(1, sAttr.length - 1);
                        } else {
                            nNewNode.className = sAttr;
                        }

                        i += j; /* Move along the position array */
                    }

                    insert.append(nNewNode);
                    insert = $(nNewNode);
                } else if (cOption == '>') {
                    /* End container div */
                    insert = insert.parent();
                } else if (cOption == 'l' && features.bPaginate && features.bLengthChange) {
                    /* Length */
                    featureNode = _fnFeatureHtmlLength(oSettings);
                } else if (cOption == 'f' && features.bFilter) {
                    /* Filter */
                    featureNode = _fnFeatureHtmlFilter(oSettings);
                } else if (cOption == 'r' && features.bProcessing) {
                    /* pRocessing */
                    featureNode = _fnFeatureHtmlProcessing(oSettings);
                } else if (cOption == 't') {
                    /* Table */
                    featureNode = _fnFeatureHtmlTable(oSettings);
                } else if (cOption == 'i' && features.bInfo) {
                    /* Info */
                    featureNode = _fnFeatureHtmlInfo(oSettings);
                } else if (cOption == 'p' && features.bPaginate) {
                    /* Pagination */
                    featureNode = _fnFeatureHtmlPaginate(oSettings);
                } else if (DataTable.ext.feature.length !== 0) {
                    /* Plug-in features */
                    var aoFeatures = DataTable.ext.feature;
                    for (var k = 0, kLen = aoFeatures.length; k < kLen; k++) {
                        if (cOption == aoFeatures[k].cFeature) {
                            featureNode = aoFeatures[k].fnInit(oSettings);
                            break;
                        }
                    }
                }

                /* Add to the 2D features array */
                if (featureNode) {
                    var aanFeatures = oSettings.aanFeatures;

                    if (!aanFeatures[cOption]) {
                        aanFeatures[cOption] = [];
                    }

                    aanFeatures[cOption].push(featureNode);
                    insert.append(featureNode);
                }
            }

            /* Built our DOM structure - replace the holding div with what we want */
            holding.replaceWith(insert);
            oSettings.nHolding = null;
        }

        /**
         * Use the DOM source to create up an array of header cells. The idea here is to
         * create a layout grid (array) of rows x columns, which contains a reference
         * to the cell that that point in the grid (regardless of col/rowspan), such that
         * any column / row could be removed and the new grid constructed
         *  @param array {object} aLayout Array to store the calculated layout in
         *  @param {node} nThead The header/footer element for the table
         *  @memberof DataTable#oApi
         */
        function _fnDetectHeader(aLayout, nThead) {
            var nTrs = $(nThead).children('tr');
            var nTr, nCell;
            var i, k, l, iLen, jLen, iColShifted, iColumn, iColspan, iRowspan;
            var bUnique;
            var fnShiftCol = function (a, i, j) {
                var k = a[i];
                while (k[j]) {
                    j++;
                }
                return j;
            };

            aLayout.splice(0, aLayout.length);

            /* We know how many rows there are in the layout - so prep it */
            for (i = 0, iLen = nTrs.length; i < iLen; i++) {
                aLayout.push([]);
            }

            /* Calculate a layout array */
            for (i = 0, iLen = nTrs.length; i < iLen; i++) {
                nTr = nTrs[i];
                iColumn = 0;

                /* For every cell in the row... */
                nCell = nTr.firstChild;
                while (nCell) {
                    if (nCell.nodeName.toUpperCase() == "TD" || nCell.nodeName.toUpperCase() == "TH") {
                        /* Get the col and rowspan attributes from the DOM and sanitise them */
                        iColspan = nCell.getAttribute('colspan') * 1;
                        iRowspan = nCell.getAttribute('rowspan') * 1;
                        iColspan = (!iColspan || iColspan === 0 || iColspan === 1) ? 1 : iColspan;
                        iRowspan = (!iRowspan || iRowspan === 0 || iRowspan === 1) ? 1 : iRowspan;

                        /* There might be colspan cells already in this row, so shift our target
                         * accordingly
                         */
                        iColShifted = fnShiftCol(aLayout, i, iColumn);

                        /* Cache calculation for unique columns */
                        bUnique = iColspan === 1 ? true : false;

                        /* If there is col / rowspan, copy the information into the layout grid */
                        for (l = 0; l < iColspan; l++) {
                            for (k = 0; k < iRowspan; k++) {
                                aLayout[i + k][iColShifted + l] = {
                                    "cell": nCell,
                                    "unique": bUnique
                                };
                                aLayout[i + k].nTr = nTr;
                            }
                        }
                    }
                    nCell = nCell.nextSibling;
                }
            }
        }

        /**
         * Get an array of unique th elements, one for each column
         *  @param {object} oSettings dataTables settings object
         *  @param {node} nHeader automatically detect the layout from this node - optional
         *  @param {array} aLayout thead/tfoot layout from _fnDetectHeader - optional
         *  @returns array {node} aReturn list of unique th's
         *  @memberof DataTable#oApi
         */
        function _fnGetUniqueThs(oSettings, nHeader, aLayout) {
            var aReturn = [];
            if (!aLayout) {
                aLayout = oSettings.aoHeader;
                if (nHeader) {
                    aLayout = [];
                    _fnDetectHeader(aLayout, nHeader);
                }
            }

            for (var i = 0, iLen = aLayout.length; i < iLen; i++) {
                for (var j = 0, jLen = aLayout[i].length; j < jLen; j++) {
                    if (aLayout[i][j].unique && (!aReturn[j] || !oSettings.bSortCellsTop)) {
                        aReturn[j] = aLayout[i][j].cell;
                    }
                }
            }

            return aReturn;
        }

        /**
         * Create an Ajax call based on the table's settings, taking into account that
         * parameters can have multiple forms, and backwards compatibility.
         *
         * @param {object} oSettings dataTables settings object
         * @param {array} data Data to send to the server, required by
         *     DataTables - may be augmented by developer callbacks
         * @param {function} fn Callback function to run when data is obtained
         */
        function _fnBuildAjax(oSettings, data, fn) {
            // Compatibility with 1.9-, allow fnServerData and event to manipulate.
            _fnCallbackFire(oSettings, 'aoServerParams', 'serverParams', [data]);

            // Convert to object based for 1.10+ if using the old array scheme which can
            // come from server-side processing or serverParams.
            if (data && $.isArray(data)) {
                var tmp = {};
                var rbracket = /(.*?)\[\]$/;

                $.each(data, function (key, val) {
                    var match = val.name.match(rbracket);

                    if (match) {
                        // Support for arrays
                        var name = match[0];

                        if (!tmp[ name ]) {
                            tmp[ name ] = [];
                        }
                        tmp[ name ].push(val.value);
                    }
                    else {
                        tmp[val.name] = val.value;
                    }
                });
                data = tmp;
            }

            var ajaxData;
            var ajax = oSettings.ajax;
            var instance = oSettings.oInstance;
            var callback = function (json) {
                _fnCallbackFire(oSettings, null, 'xhr', [oSettings, json, oSettings.jqXHR]);
                fn(json);
            };

            if ($.isPlainObject(ajax) && ajax.data) {
                ajaxData = ajax.data;

                var newData = $.isFunction(ajaxData) ?
                        ajaxData(data, oSettings) : // fn can manipulate data or return.
                        ajaxData;                   // an object object or array to merge.

                // If the function returned something, use that alone.
                data = $.isFunction(ajaxData) && newData ?
                        newData :
                        $.extend(true, data, newData);

                // Remove the data property as we've resolved it already and don't want
                // jQuery to do it again (it is restored at the end of the function).
                delete ajax.data;
            }

            var baseAjax = {
                "data": data,
                "success": function (json) {
                    var error = json.error || json.sError;
                    if (error) {
                        _fnLog(oSettings, 0, error);
                    }

                    oSettings.json = json;
                    callback(json);
                },
                "dataType": "json",
                "cache": false,
                "type": oSettings.sServerMethod,
                "error": function (xhr, error, thrown) {
                    var ret = _fnCallbackFire(oSettings, null, 'xhr', [oSettings, null, oSettings.jqXHR]);

                    if ($.inArray(true, ret) === -1) {
                        if (error == "parsererror") {
                            _fnLog(oSettings, 0, 'Invalid JSON response', 1);
                        }
                        else if (xhr.readyState === 4) {
                            _fnLog(oSettings, 0, 'Ajax error', 7);
                        }
                    }

                    _fnProcessingDisplay(oSettings, false);
                }
            };

            // Store the data submitted for the API.
            oSettings.oAjaxData = data;

            // Allow plug-ins and external processes to modify the data.
            _fnCallbackFire(oSettings, null, 'preXhr', [oSettings, data]);

            if (oSettings.fnServerData) {
                // DataTables 1.9- compatibility.
                oSettings.fnServerData.call(instance,
                        oSettings.sAjaxSource,
                        $.map(data, function (val, key) { // Need to convert back to 1.9 trad format.
                            return {name: key, value: val};
                        }),
                        callback,
                        oSettings
                        );
            }
            else if (oSettings.sAjaxSource || typeof ajax === 'string') {
                // DataTables 1.9- compatibility.
                oSettings.jqXHR = $.ajax($.extend(baseAjax, {
                    url: ajax || oSettings.sAjaxSource
                }));
            }
            else if ($.isFunction(ajax)) {
                // Is a function - let the caller define what needs to be done.
                oSettings.jqXHR = ajax.call(instance, data, callback, oSettings);
            } else {
                // Object to extend the base settings.
                oSettings.jqXHR = $.ajax($.extend(baseAjax, ajax));

                // Restore for next time around.
                ajax.data = ajaxData;
            }
        }

        /**
         * Update the table using an Ajax call
         *  @param {object} settings dataTables settings object
         *  @returns {boolean} Block the table drawing or not
         *  @memberof DataTable#oApi
         */
        function _fnAjaxUpdate(settings) {
            if (settings.bAjaxDataGet) {
                settings.iDraw++;
                _fnProcessingDisplay(settings, true);

                _fnBuildAjax(
                        settings,
                        _fnAjaxParameters(settings),
                        function (json) {
                            _fnAjaxUpdateDraw(settings, json);
                        }
                );

                return false;
            }
            return true;
        }

        /**
         * Build up the parameters in an object needed for a server-side processing
         * request. Note that this is basically done twice, is different ways - a modern
         * method which is used by default in DataTables 1.10 which uses objects and
         * arrays, or the 1.9- method with is name / value pairs. 1.9 method is used if
         * the sAjaxSource option is used in the initialisation, or the legacyAjax
         * option is set.
         *  @param {object} oSettings dataTables settings object
         *  @returns {bool} block the table drawing or not
         *  @memberof DataTable#oApi
         */
        function _fnAjaxParameters(settings) {
            var
                    columns = settings.aoColumns,
                    columnCount = columns.length,
                    features = settings.oFeatures,
                    preSearch = settings.oPreviousSearch,
                    preColSearch = settings.aoPreSearchCols,
                    i, data = [], dataProp, column, columnSearch,
                    sort = _fnSortFlatten(settings),
                    displayStart = settings._iDisplayStart,
                    displayLength = features.bPaginate !== false ?
                    settings._iDisplayLength :
                    -1;

            var param = function (name, value) {
                data.push({'name': name, 'value': value});
            };

            // DataTables 1.9- compatible method.
            param('sEcho', settings.iDraw);
            param('iColumns', columnCount);
            param('sColumns', _pluck(columns, 'sName').join(','));
            param('iDisplayStart', displayStart);
            param('iDisplayLength', displayLength);

            // DataTables 1.10+ method.
            var d = {
                draw: settings.iDraw,
                columns: [],
                order: [],
                start: displayStart,
                length: displayLength,
                search: {
                    value: preSearch.sSearch,
                    regex: preSearch.bRegex
                }
            };

            for (i = 0; i < columnCount; i++) {
                column = columns[i];
                columnSearch = preColSearch[i];
                dataProp = typeof column.mData == "function" ? 'function' : column.mData;

                d.columns.push({
                    data: dataProp,
                    name: column.sName,
                    searchable: column.bSearchable,
                    orderable: column.bSortable,
                    search: {
                        value: columnSearch.sSearch,
                        regex: columnSearch.bRegex
                    }
                });

                param("mDataProp_" + i, dataProp);

                if (features.bFilter) {
                    param('sSearch_' + i, columnSearch.sSearch);
                    param('bRegex_' + i, columnSearch.bRegex);
                    param('bSearchable_' + i, column.bSearchable);
                }

                if (features.bSort) {
                    param('bSortable_' + i, column.bSortable);
                }
            }

            if (features.bFilter) {
                param('sSearch', preSearch.sSearch);
                param('bRegex', preSearch.bRegex);
            }

            if (features.bSort) {
                $.each(sort, function (i, val) {
                    d.order.push({column: val.col, dir: val.dir});

                    param('iSortCol_' + i, val.col);
                    param('sSortDir_' + i, val.dir);
                });

                param('iSortingCols', sort.length);
            }

            // If the legacy.ajax parameter is null, then we automatically decide which
            // form to use, based on sAjaxSource.
            var legacy = DataTable.ext.legacy.ajax;
            if (legacy === null) {
                return settings.sAjaxSource ? data : d;
            }

            // Otherwise, if legacy has been specified then we use that to decide on the form.
            return legacy ? data : d;
        }

        /**
         * Data the data from the server (nuking the old) and redraw the table
         *  @param {object} oSettings dataTables settings object
         *  @param {object} json json data return from the server.
         *  @param {string} json.sEcho Tracking flag for DataTables to match requests
         *  @param {int} json.iTotalRecords Number of records in the data set, not accounting for filtering
         *  @param {int} json.iTotalDisplayRecords Number of records in the data set, accounting for filtering
         *  @param {array} json.aaData The data to display on this page
         *  @param {string} [json.sColumns] Column ordering (sName, comma separated)
         *  @memberof DataTable#oApi
         */
        function _fnAjaxUpdateDraw(settings, json) {
            // v1.10 uses camelCase variables, while 1.9 uses Hungarian notation.
            // Support both.
            var compat = function (old, modern) {
                return json[old] !== undefined ? json[old] : json[modern];
            };

            var data = _fnAjaxDataSrc(settings, json);
            var draw = compat('sEcho', 'draw');
            var recordsTotal = compat('iTotalRecords', 'recordsTotal');
            var recordsFiltered = compat('iTotalDisplayRecords', 'recordsFiltered');

            if (draw) {
                // Protect against out of sequence returns.
                if (draw * 1 < settings.iDraw) {
                    return;
                }
                settings.iDraw = draw * 1;
            }

            _fnClearTable(settings);
            settings._iRecordsTotal = parseInt(recordsTotal, 10);
            settings._iRecordsDisplay = parseInt(recordsFiltered, 10);

            for (var i = 0, ien = data.length; i < ien; i++) {
                _fnAddData(settings, data[i]);
            }
            settings.aiDisplay = settings.aiDisplayMaster.slice();

            settings.bAjaxDataGet = false;
            _fnDraw(settings);

            if (!settings._bInitComplete) {
                _fnInitComplete(settings, json);
            }

            settings.bAjaxDataGet = true;
            _fnProcessingDisplay(settings, false);
        }

        /**
         * Get the data from the JSON data source to use for drawing a table. Using
         * `_fnGetObjectDataFn` allows the data to be sourced from a property of the
         * source object, or from a processing function.
         *  @param {object} oSettings dataTables settings object
         *  @param  {object} json Data source object / array from the server
         *  @return {array} Array of data to use
         */
        function _fnAjaxDataSrc(oSettings, json) {
            var dataSrc = $.isPlainObject(oSettings.ajax) && oSettings.ajax.dataSrc !== undefined ?
                    oSettings.ajax.dataSrc :
                    oSettings.sAjaxDataProp; // Compatibility with 1.9-.

            // Compatibility with 1.9-. In order to read from aaData, check if the
            // default has been changed, if not, check for aaData.
            if (dataSrc === 'data') {
                return json.aaData || json[dataSrc];
            }

            return dataSrc !== "" ?
                    _fnGetObjectDataFn(dataSrc)(json) :
                    json;
        }

        /**
         * Generate the node required for filtering text
         *  @returns {node} Filter control element
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlFilter(settings) {
            var classes = settings.oClasses;
            var tableId = settings.sTableId;
            var language = settings.oLanguage;
            var previousSearch = settings.oPreviousSearch;
            var features = settings.aanFeatures;
            var input = '<input type="search" class="' + classes.sFilterInput + '"/>';

            var str = language.sSearch;
            str = str.match(/_INPUT_/) ?
                    str.replace('_INPUT_', input) :
                    str + input;

            var filter = $('<div/>', {
                'id': !features.f ? tableId + '_filter' : null,
                'class': classes.sFilter
            })
                    .append($('<label/>').append(str));

            var searchFn = function () {
                /* Update all other filter input elements for the new display */
                var n = features.f;
                var val = !this.value ? "" : this.value; // Mental IE8 fix.

                /* Now do the filter */
                if (val != previousSearch.sSearch) {
                    _fnFilterComplete(settings, {
                        "sSearch": val,
                        "bRegex": previousSearch.bRegex,
                        "bSmart": previousSearch.bSmart,
                        "bCaseInsensitive": previousSearch.bCaseInsensitive
                    });

                    // Need to redraw, without resorting.
                    settings._iDisplayStart = 0;
                    _fnDraw(settings);
                }
            };

            var searchDelay = settings.searchDelay !== null ?
                    settings.searchDelay :
                    _fnDataSource(settings) === 'ssp' ?
                    400 :
                    0;

            var jqFilter = $('input', filter)
                    .val(previousSearch.sSearch)
                    .attr('placeholder', language.sSearchPlaceholder)
                    .bind(
                            'keyup.DT search.DT input.DT paste.DT cut.DT',
                            searchDelay ?
                            _fnThrottle(searchFn, searchDelay) :
                            searchFn
                            )
                    .bind('keypress.DT', function (e) {
                        /* Prevent form submission */
                        if (e.keyCode == 13) {
                            return false;
                        }
                    })
                    .attr('aria-controls', tableId);

            // Update the input elements whenever the table is filtered.
            $(settings.nTable).on('search.dt.DT', function (ev, s) {
                if (settings === s) {
                    // IE9 throws an 'unknown error' if document.activeElement is used
                    // inside an iframe or frame...
                    try {
                        if (jqFilter[0] !== document.activeElement) {
                            jqFilter.val(previousSearch.sSearch);
                        }
                    }
                    catch (e) {
                    }
                }
            });

            return filter[0];
        }

        /**
         * Filter the table using both the global filter and column based filtering
         *  @param {object} oSettings dataTables settings object
         *  @param {object} oSearch search information
         *  @param {int} [iForce] force a research of the master array (1) or not (undefined or 0)
         *  @memberof DataTable#oApi
         */
        function _fnFilterComplete(oSettings, oInput, iForce) {
            var oPrevSearch = oSettings.oPreviousSearch;
            var aoPrevSearch = oSettings.aoPreSearchCols;
            var fnSaveFilter = function (oFilter) {
                /* Save the filtering values */
                oPrevSearch.sSearch = oFilter.sSearch;
                oPrevSearch.bRegex = oFilter.bRegex;
                oPrevSearch.bSmart = oFilter.bSmart;
                oPrevSearch.bCaseInsensitive = oFilter.bCaseInsensitive;
            };
            var fnRegex = function (o) {
                // Backwards compatibility with the bEscapeRegex option.
                return o.bEscapeRegex !== undefined ? !o.bEscapeRegex : o.bRegex;
            };

            // Resolve any column types that are unknown due to addition or invalidation
            // @todo As per sort - can this be moved into an event handler?
            _fnColumnTypes(oSettings);

            /* In server-side processing all filtering is done by the server, so no point hanging around here */
            if (_fnDataSource(oSettings) != 'ssp') {
                /* Global filter */
                _fnFilter(oSettings, oInput.sSearch, iForce, fnRegex(oInput), oInput.bSmart, oInput.bCaseInsensitive);
                fnSaveFilter(oInput);

                /* Now do the individual column filter */
                for (var i = 0; i < aoPrevSearch.length; i++) {
                    _fnFilterColumn(oSettings, aoPrevSearch[i].sSearch, i, fnRegex(aoPrevSearch[i]),
                            aoPrevSearch[i].bSmart, aoPrevSearch[i].bCaseInsensitive);
                }

                /* Custom filtering */
                _fnFilterCustom(oSettings);
            } else {
                fnSaveFilter(oInput);
            }

            /* Tell the draw function we have been filtering */
            oSettings.bFiltered = true;
            _fnCallbackFire(oSettings, null, 'search', [oSettings]);
        }

        /**
         * Apply custom filtering functions
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnFilterCustom(settings) {
            var filters = DataTable.ext.search;
            var displayRows = settings.aiDisplay;
            var row, rowIdx;

            for (var i = 0, ien = filters.length; i < ien; i++) {
                var rows = [];

                // Loop over each row and see if it should be included.
                for (var j = 0, jen = displayRows.length; j < jen; j++) {
                    rowIdx = displayRows[ j ];
                    row = settings.aoData[ rowIdx ];

                    if (filters[i](settings, row._aFilterData, rowIdx, row._aData, j)) {
                        rows.push(rowIdx);
                    }
                }

                // So the array reference doesn't break set the results into the existing array.
                displayRows.length = 0;
                displayRows.push.apply(displayRows, rows);
            }
        }

        /**
         * Filter the table on a per-column basis
         *  @param {object} oSettings dataTables settings object
         *  @param {string} sInput string to filter on
         *  @param {int} iColumn column to filter
         *  @param {bool} bRegex treat search string as a regular expression or not
         *  @param {bool} bSmart use smart filtering or not
         *  @param {bool} bCaseInsensitive Do case insenstive matching or not
         *  @memberof DataTable#oApi
         */
        function _fnFilterColumn(settings, searchStr, colIdx, regex, smart, caseInsensitive) {
            if (searchStr === '') {
                return;
            }

            var data;
            var display = settings.aiDisplay;
            var rpSearch = _fnFilterCreateSearch(searchStr, regex, smart, caseInsensitive);

            for (var i = display.length - 1; i >= 0; i--) {
                data = settings.aoData[ display[i] ]._aFilterData[ colIdx ];

                if (!rpSearch.test(data)) {
                    display.splice(i, 1);
                }
            }
        }

        /**
         * Filter the data table based on user input and draw the table
         *  @param {object} settings dataTables settings object
         *  @param {string} input string to filter on
         *  @param {int} force optional - force a research of the master array (1) or not (undefined or 0)
         *  @param {bool} regex treat as a regular expression or not
         *  @param {bool} smart perform smart filtering or not
         *  @param {bool} caseInsensitive Do case insenstive matching or not
         *  @memberof DataTable#oApi
         */
        function _fnFilter(settings, input, force, regex, smart, caseInsensitive) {
            var rpSearch = _fnFilterCreateSearch(input, regex, smart, caseInsensitive);
            var prevSearch = settings.oPreviousSearch.sSearch;
            var displayMaster = settings.aiDisplayMaster;
            var display, invalidated, i;

            // Need to take account of custom filtering functions - always filter.
            if (DataTable.ext.search.length !== 0) {
                force = true;
            }

            // Check if any of the rows were invalidated.
            invalidated = _fnFilterData(settings);

            // If the input is blank - we just want the full data set.
            if (input.length <= 0) {
                settings.aiDisplay = displayMaster.slice();
            }
            else {
                // New search - start from the master array.
                if (invalidated ||
                        force ||
                        prevSearch.length > input.length ||
                        input.indexOf(prevSearch) !== 0 ||
                        settings.bSorted
                        // On resort, the display master needs to be re-filtered since indexes will have changed.
                        ) {
                    settings.aiDisplay = displayMaster.slice();
                }

                // Search the display array.
                display = settings.aiDisplay;

                for (i = display.length - 1; i >= 0; i--) {
                    if (!rpSearch.test(settings.aoData[ display[i] ]._sFilterRow)) {
                        display.splice(i, 1);
                    }
                }
            }
        }

        /**
         * Build a regular expression object suitable for searching a table
         *  @param {string} sSearch string to search for
         *  @param {bool} bRegex treat as a regular expression or not
         *  @param {bool} bSmart perform smart filtering or not
         *  @param {bool} bCaseInsensitive Do case insensitive matching or not
         *  @returns {RegExp} constructed object
         *  @memberof DataTable#oApi
         */
        function _fnFilterCreateSearch(search, regex, smart, caseInsensitive) {
            search = regex ?
                    search :
                    _fnEscapeRegex(search);

            if (smart) {
                /* For smart filtering we want to allow the search to work regardless of
                 * word order. We also want double quoted text to be preserved, so word
                 * order is important - a la google. So this is what we want to
                 * generate:
                 * ^(?=.*?\bone\b)(?=.*?\btwo three\b)(?=.*?\bfour\b).*$
                 */
                var a = $.map(search.match(/"[^"]+"|[^ ]+/g) || [''], function (word) {
                    if (word.charAt(0) === '"') {
                        var m = word.match(/^"(.*)"$/);
                        word = m ? m[1] : word;
                    }

                    return word.replace('"', '');
                });

                search = '^(?=.*?' + a.join(')(?=.*?') + ').*$';
            }

            return new RegExp(search, caseInsensitive ? 'i' : '');
        }

        /**
         * Escape a string such that it can be used in a regular expression
         *  @param {string} sVal string to escape
         *  @returns {string} escaped string
         *  @memberof DataTable#oApi
         */
        function _fnEscapeRegex(sVal) {
            return sVal.replace(_re_escape_regex, '\\$1');
        }

        var __filter_div = $('<div>')[0];
        var __filter_div_textContent = __filter_div.textContent !== undefined;

        // Update the filtering data for each row if needed (by invalidation or first run).
        function _fnFilterData(settings) {
            var columns = settings.aoColumns;
            var column;
            var i, j, ien, jen, filterData, cellData, row;
            var fomatters = DataTable.ext.type.search;
            var wasInvalidated = false;

            for (i = 0, ien = settings.aoData.length; i < ien; i++) {
                row = settings.aoData[i];

                if (!row._aFilterData) {
                    filterData = [];

                    for (j = 0, jen = columns.length; j < jen; j++) {
                        column = columns[j];

                        if (column.bSearchable) {
                            cellData = _fnGetCellData(settings, i, j, 'filter');

                            if (fomatters[ column.sType ]) {
                                cellData = fomatters[ column.sType ](cellData);
                            }

                            // Search in DataTables 1.10 is string based. In 1.11 this
                            // should be altered to also allow strict type checking.
                            if (cellData === null) {
                                cellData = '';
                            }

                            if (typeof cellData !== 'string' && cellData.toString) {
                                cellData = cellData.toString();
                            }
                        }
                        else {
                            cellData = '';
                        }

                        // If it looks like there is an HTML entity in the string,
                        // attempt to decode it so sorting works as expected. Note that
                        // we could use a single line of jQuery to do this, but the DOM
                        // method used here is much faster <http://jsperf.com/html-decode>.
                        if (cellData.indexOf && cellData.indexOf('&') !== -1) {
                            __filter_div.innerHTML = cellData;
                            cellData = __filter_div_textContent ?
                                    __filter_div.textContent :
                                    __filter_div.innerText;
                        }

                        if (cellData.replace) {
                            cellData = cellData.replace(/[\r\n]/g, '');
                        }

                        filterData.push(cellData);
                    }

                    row._aFilterData = filterData;
                    row._sFilterRow = filterData.join('  ');
                    wasInvalidated = true;
                }
            }

            return wasInvalidated;
        }

        /**
         * Convert from the internal Hungarian notation to camelCase for external
         * interaction
         *  @param {object} obj Object to convert
         *  @returns {object} Inverted object
         *  @memberof DataTable#oApi
         */
        function _fnSearchToCamel(obj) {
            return {
                search: obj.sSearch,
                smart: obj.bSmart,
                regex: obj.bRegex,
                caseInsensitive: obj.bCaseInsensitive
            };
        }

        /**
         * Convert from camelCase notation to the internal Hungarian. We could use the
         * Hungarian convert function here, but this is cleaner
         *  @param {object} obj Object to convert
         *  @returns {object} Inverted object
         *  @memberof DataTable#oApi
         */
        function _fnSearchToHung(obj) {
            return {
                sSearch: obj.search,
                bSmart: obj.smart,
                bRegex: obj.regex,
                bCaseInsensitive: obj.caseInsensitive
            };
        }

        /**
         * Generate the node required for the info display
         *  @param {object} oSettings dataTables settings object
         *  @returns {node} Information element
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlInfo(settings) {
            var
                    tid = settings.sTableId,
                    nodes = settings.aanFeatures.i,
                    n = $('<div/>', {
                        'class': settings.oClasses.sInfo,
                        'id': !nodes ? tid + '_info' : null
                    });

            if (!nodes) {
                // Update display on each draw.
                settings.aoDrawCallback.push({
                    "fn": _fnUpdateInfo,
                    "sName": "information"
                });

                n
                        .attr('role', 'status')
                        .attr('aria-live', 'polite');

                // Table is described by our info div.
                $(settings.nTable).attr('aria-describedby', tid + '_info');
            }

            return n[0];
        }

        /**
         * Update the information elements in the display
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnUpdateInfo(settings) {
            /* Show information about the table */
            var nodes = settings.aanFeatures.i;
            if (nodes.length === 0) {
                return;
            }

            var
                    lang = settings.oLanguage,
                    start = settings._iDisplayStart + 1,
                    end = settings.fnDisplayEnd(),
                    max = settings.fnRecordsTotal(),
                    total = settings.fnRecordsDisplay(),
                    out = total ?
                    lang.sInfo :
                    lang.sInfoEmpty;

            if (total !== max) {
                /* Record set after filtering */
                out += ' ' + lang.sInfoFiltered;
            }

            // Convert the macros.
            out += lang.sInfoPostFix;
            out = _fnInfoMacros(settings, out);

            var callback = lang.fnInfoCallback;
            if (callback !== null) {
                out = callback.call(settings.oInstance,
                        settings, start, end, max, total, out
                        );
            }

            $(nodes).html(out);
        }

        function _fnInfoMacros(settings, str) {
            // When infinite scrolling, we are always starting at 1. _iDisplayStart is used only internally.
            var
                    formatter = settings.fnFormatNumber,
                    start = settings._iDisplayStart + 1,
                    len = settings._iDisplayLength,
                    vis = settings.fnRecordsDisplay(),
                    all = len === -1;

            return str.
                    replace(/_START_/g, formatter.call(settings, start)).
                    replace(/_END_/g, formatter.call(settings, settings.fnDisplayEnd())).
                    replace(/_MAX_/g, formatter.call(settings, settings.fnRecordsTotal())).
                    replace(/_TOTAL_/g, formatter.call(settings, vis)).
                    replace(/_PAGE_/g, formatter.call(settings, all ? 1 : Math.ceil(start / len))).
                    replace(/_PAGES_/g, formatter.call(settings, all ? 1 : Math.ceil(vis / len)));
        }

        /**
         * Draw the table for the first time, adding all required features
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnInitialise(settings) {
            var i, iLen, iAjaxStart = settings.iInitDisplayStart;
            var columns = settings.aoColumns, column;
            var features = settings.oFeatures;

            /* Ensure that the table data is fully initialised */
            if (!settings.bInitialised) {
                setTimeout(function () {
                    _fnInitialise(settings);
                }, 200);
                return;
            }

            /* Show the display HTML options */
            _fnAddOptionsHtml(settings);

            /* Build and draw the header / footer for the table */
            _fnBuildHead(settings);
            _fnDrawHead(settings, settings.aoHeader);
            _fnDrawHead(settings, settings.aoFooter);

            /* Okay to show that something is going on now */
            _fnProcessingDisplay(settings, true);

            /* Calculate sizes for columns */
            if (features.bAutoWidth) {
                _fnCalculateColumnWidths(settings);
            }

            for (i = 0, iLen = columns.length; i < iLen; i++) {
                column = columns[i];

                if (column.sWidth) {
                    column.nTh.style.width = _fnStringToCss(column.sWidth);
                }
            }

            _fnCallbackFire(settings, null, 'preInit', [settings]);

            // If there is default sorting required - let's do it. The sort function
            // will do the drawing for us. Otherwise we draw the table regardless of the
            // Ajax source - this allows the table to look initialised for Ajax sourcing
            // data (show 'loading' message possibly).
            _fnReDraw(settings);

            // Server-side processing init complete is done by _fnAjaxUpdateDraw.
            var dataSrc = _fnDataSource(settings);
            if (dataSrc != 'ssp') {
                // If there is an ajax source load the data.
                if (dataSrc == 'ajax') {
                    _fnBuildAjax(settings, [], function (json) {
                        var aData = _fnAjaxDataSrc(settings, json);

                        // Got the data - add it to the table.
                        for (i = 0; i < aData.length; i++) {
                            _fnAddData(settings, aData[i]);
                        }

                        // Reset the init display for cookie saving. We've already done
                        // a filter, and therefore cleared it before. So we need to make
                        // it appear 'fresh'.
                        settings.iInitDisplayStart = iAjaxStart;

                        _fnReDraw(settings);

                        _fnProcessingDisplay(settings, false);
                        _fnInitComplete(settings, json);
                    }, settings);
                }
                else {
                    _fnProcessingDisplay(settings, false);
                    _fnInitComplete(settings);
                }
            }
        }

        /**
         * Draw the table for the first time, adding all required features
         *  @param {object} oSettings dataTables settings object
         *  @param {object} [json] JSON from the server that completed the table, if using Ajax source
         *    with client-side processing (optional)
         *  @memberof DataTable#oApi
         */
        function _fnInitComplete(settings, json) {
            settings._bInitComplete = true;

            // On an Ajax load we now have data and therefore want to apply the column sizing.
            if (json) {
                _fnAdjustColumnSizing(settings);
            }

            _fnCallbackFire(settings, 'aoInitComplete', 'init', [settings, json]);
        }

        function _fnLengthChange(settings, val) {
            var len = parseInt(val, 10);
            settings._iDisplayLength = len;

            _fnLengthOverflow(settings);

            // Fire length change event.
            _fnCallbackFire(settings, null, 'length', [settings, len]);
        }

        /**
         * Generate the node required for user display length changing
         *  @param {object} settings dataTables settings object
         *  @returns {node} Display length feature node
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlLength(settings) {
            var
                    classes = settings.oClasses,
                    tableId = settings.sTableId,
                    menu = settings.aLengthMenu,
                    d2 = $.isArray(menu[0]),
                    lengths = d2 ? menu[0] : menu,
                    language = d2 ? menu[1] : menu;

            var select = $('<select/>', {
                'name': tableId + '_length',
                'aria-controls': tableId,
                'class': classes.sLengthSelect
            });

            for (var i = 0, ien = lengths.length; i < ien; i++) {
                select[0][ i ] = new Option(language[i], lengths[i]);
            }

            var div = $('<div><label/></div>').addClass(classes.sLength);
            if (!settings.aanFeatures.l) {
                div[0].id = tableId + '_length';
            }

            div.children().append(settings.oLanguage.sLengthMenu.replace('_MENU_', select[0].outerHTML));

            // Can't use `select` variable as user might provide their own and the
            // reference is broken by the use of outerHTML.
            $('select', div)
                    .val(settings._iDisplayLength)
                    .bind('change.DT', function (e) {
                        _fnLengthChange(settings, $(this).val());
                        _fnDraw(settings);
                    });

            // Update node value whenever anything changes the table's length.
            $(settings.nTable).bind('length.dt.DT', function (e, s, len) {
                if (settings === s) {
                    $('select', div).val(len);
                }
            });

            return div[0];
        }

        /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
         * Note that most of the paging logic is done in
         * DataTable.ext.pager
         */

        /**
         * Generate the node required for default pagination
         *  @param {object} oSettings dataTables settings object
         *  @returns {node} Pagination feature node
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlPaginate(settings) {
            var
                    type = settings.sPaginationType,
                    plugin = DataTable.ext.pager[ type ],
                    modern = typeof plugin === 'function',
                    redraw = function (settings) {
                        _fnDraw(settings);
                    },
                    node = $('<div/>').addClass(settings.oClasses.sPaging + type)[0],
                    features = settings.aanFeatures;

            if (!modern) {
                plugin.fnInit(settings, node, redraw);
            }

            /* Add a draw callback for the pagination on first instance, to update the paging display */
            if (!features.p) {
                node.id = settings.sTableId + '_paginate';

                settings.aoDrawCallback.push({
                    "fn": function (settings) {
                        if (modern) {
                            var
                                    start = settings._iDisplayStart,
                                    len = settings._iDisplayLength,
                                    visRecords = settings.fnRecordsDisplay(),
                                    all = len === -1,
                                    page = all ? 0 : Math.ceil(start / len),
                                    pages = all ? 1 : Math.ceil(visRecords / len),
                                    buttons = plugin(page, pages),
                                    i, ien;

                            for (i = 0, ien = features.p.length; i < ien; i++) {
                                _fnRenderer(settings, 'pageButton')(
                                        settings, features.p[i], i, buttons, page, pages
                                        );
                            }
                        }
                        else {
                            plugin.fnUpdate(settings, redraw);
                        }
                    },
                    "sName": "pagination"
                });
            }

            return node;
        }

        /**
         * Alter the display settings to change the page
         *  @param {object} settings DataTables settings object
         *  @param {string|int} action Paging action to take: "first", "previous",
         *    "next" or "last" or page number to jump to (integer)
         *  @param [bool] redraw Automatically draw the update or not
         *  @returns {bool} true page has changed, false - no change
         *  @memberof DataTable#oApi
         */
        function _fnPageChange(settings, action, redraw) {
            var
                    start = settings._iDisplayStart,
                    len = settings._iDisplayLength,
                    records = settings.fnRecordsDisplay();

            if (records === 0 || len === -1) {
                start = 0;
            }
            else if (typeof action === "number") {
                start = action * len;

                if (start > records) {
                    start = 0;
                }
            }
            else if (action == "first") {
                start = 0;
            }
            else if (action == "previous") {
                start = len >= 0 ?
                        start - len :
                        0;

                if (start < 0) {
                    start = 0;
                }
            }
            else if (action == "next") {
                if (start + len < records) {
                    start += len;
                }
            }
            else if (action == "last") {
                start = Math.floor((records - 1) / len) * len;
            }
            else {
                _fnLog(settings, 0, "Unknown paging action: " + action, 5);
            }

            var changed = settings._iDisplayStart !== start;
            settings._iDisplayStart = start;

            if (changed) {
                _fnCallbackFire(settings, null, 'page', [settings]);
                if (redraw) {
                    _fnDraw(settings);
                }
            }

            return changed;
        }

        /**
         * Generate the node required for the processing node
         *  @param {object} settings dataTables settings object
         *  @returns {node} Processing element
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlProcessing(settings) {
            return $('<div/>', {
                'id': !settings.aanFeatures.r ? settings.sTableId + '_processing' : null,
                'class': settings.oClasses.sProcessing
            })
                    .html(settings.oLanguage.sProcessing)
                    .insertBefore(settings.nTable)[0];
        }

        /**
         * Display or hide the processing indicator
         *  @param {object} settings dataTables settings object
         *  @param {bool} show Show the processing indicator (true) or not (false)
         *  @memberof DataTable#oApi
         */
        function _fnProcessingDisplay(settings, show) {
            if (settings.oFeatures.bProcessing) {
                $(settings.aanFeatures.r).css('display', show ? 'block' : 'none');
            }

            _fnCallbackFire(settings, null, 'processing', [settings, show]);
        }

        /**
         * Add any control elements for the table - specifically scrolling
         *  @param {object} settings dataTables settings object
         *  @returns {node} Node to add to the DOM
         *  @memberof DataTable#oApi
         */
        function _fnFeatureHtmlTable(settings) {
            var table = $(settings.nTable);

            // Add the ARIA grid role to the table
            table.attr('role', 'grid');

            // Scrolling from here on in
            var scroll = settings.oScroll;

            if (scroll.sX === '' && scroll.sY === '') {
                return settings.nTable;
            }

            var scrollX = scroll.sX;
            var scrollY = scroll.sY;
            var classes = settings.oClasses;
            var caption = table.children('caption');
            var captionSide = caption.length ? caption[0]._captionSide : null;
            var headerClone = $(table[0].cloneNode(false));
            var footerClone = $(table[0].cloneNode(false));
            var footer = table.children('tfoot');
            var _div = '<div/>';
            var size = function (s) {
                return !s ? null : _fnStringToCss(s);
            };

            // This is fairly messy, but with x scrolling enabled, if the table has a
            // width attribute, regardless of any width applied using the column width
            // options, the browser will shrink or grow the table as needed to fit into
            // that 100%. That would make the width options useless. So we remove it.
            // This is okay, under the assumption that width:100% is applied to the
            // table in CSS (it is in the default stylesheet) which will set the table
            // width as appropriate (the attribute and css behave differently...).
            if (scroll.sX && table.attr('width') === '100%') {
                table.removeAttr('width');
            }

            if (!footer.length) {
                footer = null;
            }

            /*
             * The HTML structure that we want to generate in this function is:
             *  div - scroller
             *    div - scroll head
             *      div - scroll head inner
             *        table - scroll head table
             *          thead - thead
             *    div - scroll body
             *      table - table (master table)
             *        thead - thead clone for sizing
             *        tbody - tbody
             *    div - scroll foot
             *      div - scroll foot inner
             *        table - scroll foot table
             *          tfoot - tfoot
             */
            var scroller = $(_div, {'class': classes.sScrollWrapper})
                    .append(
                            $(_div, {'class': classes.sScrollHead})
                            .css({
                                overflow: 'hidden',
                                position: 'relative',
                                border: 0,
                                width: scrollX ? size(scrollX) : '100%'
                            })
                            .append(
                                    $(_div, {'class': classes.sScrollHeadInner})
                                    .css({
                                        'box-sizing': 'content-box',
                                        width: scroll.sXInner || '100%'
                                    })
                                    .append(
                                            headerClone
                                            .removeAttr('id')
                                            .css('margin-left', 0)
                                            .append(captionSide === 'top' ? caption : null)
                                            .append(
                                                    table.children('thead')
                                                    )
                                            )
                                    )
                            )
                    .append(
                            $(_div, {'class': classes.sScrollBody})
                            .css({
                                overflow: 'auto',
                                height: size(scrollY),
                                width: size(scrollX)
                            })
                            .append(table)
                            );

            if (footer) {
                scroller.append(
                        $(_div, {'class': classes.sScrollFoot})
                        .css({
                            overflow: 'hidden',
                            border: 0,
                            width: scrollX ? size(scrollX) : '100%'
                        })
                        .append(
                                $(_div, {'class': classes.sScrollFootInner})
                                .append(
                                        footerClone
                                        .removeAttr('id')
                                        .css('margin-left', 0)
                                        .append(captionSide === 'bottom' ? caption : null)
                                        .append(
                                                table.children('tfoot')
                                                )
                                        )
                                )
                        );
            }

            var children = scroller.children();
            var scrollHead = children[0];
            var scrollBody = children[1];
            var scrollFoot = footer ? children[2] : null;

            // When the body is scrolled, then we also want to scroll the headers.
            if (scrollX) {
                $(scrollBody).on('scroll.DT', function (e) {
                    var scrollLeft = this.scrollLeft;

                    scrollHead.scrollLeft = scrollLeft;

                    if (footer) {
                        scrollFoot.scrollLeft = scrollLeft;
                    }
                });
            }

            settings.nScrollHead = scrollHead;
            settings.nScrollBody = scrollBody;
            settings.nScrollFoot = scrollFoot;

            // On redraw - align columns.
            settings.aoDrawCallback.push({
                "fn": _fnScrollDraw,
                "sName": "scrolling"
            });

            return scroller[0];
        }

        /**
         * Update the header, footer and body tables for resizing - i.e. column
         * alignment.
         *
         * Welcome to the most horrible function DataTables. The process that this
         * function follows is basically:
         *   1. Re-create the table inside the scrolling div
         *   2. Take live measurements from the DOM
         *   3. Apply the measurements to align the columns
         *   4. Clean up
         *
         *  @param {object} settings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnScrollDraw(settings) {
            // Given that this is such a monster function, a lot of variables are use
            // to try and keep the minimised size as small as possible.
            var
                    scroll = settings.oScroll,
                    scrollX = scroll.sX,
                    scrollXInner = scroll.sXInner,
                    scrollY = scroll.sY,
                    barWidth = scroll.iBarWidth,
                    divHeader = $(settings.nScrollHead),
                    divHeaderStyle = divHeader[0].style,
                    divHeaderInner = divHeader.children('div'),
                    divHeaderInnerStyle = divHeaderInner[0].style,
                    divHeaderTable = divHeaderInner.children('table'),
                    divBodyEl = settings.nScrollBody,
                    divBody = $(divBodyEl),
                    divBodyStyle = divBodyEl.style,
                    divFooter = $(settings.nScrollFoot),
                    divFooterInner = divFooter.children('div'),
                    divFooterTable = divFooterInner.children('table'),
                    header = $(settings.nTHead),
                    table = $(settings.nTable),
                    tableEl = table[0],
                    tableStyle = tableEl.style,
                    footer = settings.nTFoot ? $(settings.nTFoot) : null,
                    browser = settings.oBrowser,
                    ie67 = browser.bScrollOversize,
                    headerTrgEls, footerTrgEls,
                    headerSrcEls, footerSrcEls,
                    headerCopy, footerCopy,
                    headerWidths = [], footerWidths = [],
                    headerContent = [],
                    idx, correction, sanityWidth,
                    zeroOut = function (nSizer) {
                        var style = nSizer.style;
                        style.paddingTop = "0";
                        style.paddingBottom = "0";
                        style.borderTopWidth = "0";
                        style.borderBottomWidth = "0";
                        style.height = 0;
                    };

            /*
             * 1. Re-create the table inside the scrolling div
             */

            // Remove the old minimised thead and tfoot elements in the inner table.
            table.children('thead, tfoot').remove();

            // Clone the current header and footer elements and then place it into the inner table.
            headerCopy = header.clone().prependTo(table);
            headerTrgEls = header.find('tr'); // Original header is in its own table/
            headerSrcEls = headerCopy.find('tr');
            headerCopy.find('th, td').removeAttr('tabindex');

            if (footer) {
                footerCopy = footer.clone().prependTo(table);
                footerTrgEls = footer.find('tr'); // The original tfoot is in its own table and must be sized.
                footerSrcEls = footerCopy.find('tr');
            }

            /*
             * 2. Take live measurements from the DOM - do not alter the DOM itself!
             */

            // Remove old sizing and apply the calculated column widths
            // Get the unique column headers in the newly created (cloned) header. We want to apply the
            // calculated sizes to this header
            if (!scrollX) {
                divBodyStyle.width = '100%';
                divHeader[0].style.width = '100%';
            }

            $.each(_fnGetUniqueThs(settings, headerCopy), function (i, el) {
                idx = _fnVisibleToColumnIndex(settings, i);
                el.style.width = settings.aoColumns[idx].sWidth;
            });

            if (footer) {
                _fnApplyToChildren(function (n) {
                    n.style.width = "";
                }, footerSrcEls);
            }

            // If scroll collapse is enabled, when we put the headers back into the body for sizing, we
            // will end up forcing the scrollbar to appear, making our measurements wrong for when we
            // then hide it (end of this function), so add the header height to the body scroller.
            if (scroll.bCollapse && scrollY !== "") {
                divBodyStyle.height = (divBody[0].offsetHeight + header[0].offsetHeight) + "px";
            }

            // Size the table as a whole.
            sanityWidth = table.outerWidth();
            if (scrollX === "") {
                // No x scrolling.
                tableStyle.width = "100%";

                // IE7 will make the width of the table when 100% include the scrollbar
                // - which is shouldn't. When there is a scrollbar we need to take this
                // into account.
                if (ie67 && (table.find('tbody').height() > divBodyEl.offsetHeight ||
                        divBody.css('overflow-y') == "scroll")
                        ) {
                    tableStyle.width = _fnStringToCss(table.outerWidth() - barWidth);
                }
            } else {
                // X scrolling.
                if (scrollXInner !== "") {
                    // X scroll inner has been given - use it.
                    tableStyle.width = _fnStringToCss(scrollXInner);
                }
                else if (sanityWidth == divBody.width() && divBody.height() < table.height()) {
                    // There is y-scrolling - try to take account of the y scroll bar.
                    tableStyle.width = _fnStringToCss(sanityWidth - barWidth);
                    if (table.outerWidth() > sanityWidth - barWidth) {
                        // Not possible to take account of it.
                        tableStyle.width = _fnStringToCss(sanityWidth);
                    }
                }
                else {
                    // When all else fails.
                    tableStyle.width = _fnStringToCss(sanityWidth);
                }
            }

            // Recalculate the sanity width - now that we've applied the required width,
            // before it was a temporary variable. This is required because the column
            // width calculation is done before this table DOM is created.
            sanityWidth = table.outerWidth();

            // Hidden header should have zero height, so remove padding and borders. Then
            // set the width based on the real headers.

            // Apply all styles in one pass.
            _fnApplyToChildren(zeroOut, headerSrcEls);

            // Read all widths in next pass.
            _fnApplyToChildren(function (nSizer) {
                headerContent.push(nSizer.innerHTML);
                headerWidths.push(_fnStringToCss($(nSizer).css('width')));
            }, headerSrcEls);

            // Apply all widths in final pass.
            _fnApplyToChildren(function (nToSize, i) {
                nToSize.style.width = headerWidths[i];
            }, headerTrgEls);

            $(headerSrcEls).height(0);

            /* Same again with the footer if we have one */
            if (footer) {
                _fnApplyToChildren(zeroOut, footerSrcEls);

                _fnApplyToChildren(function (nSizer) {
                    footerWidths.push(_fnStringToCss($(nSizer).css('width')));
                }, footerSrcEls);

                _fnApplyToChildren(function (nToSize, i) {
                    nToSize.style.width = footerWidths[i];
                }, footerTrgEls);

                $(footerSrcEls).height(0);
            }

            /*
             * 3. Apply the measurements
             */
            // Hide the header and footer that we used for the sizing. We need to keep
            // the content of the cell so that the width applied to the header and body
            // both match, but we want to hide it completely. We want to also fix their
            // width to what they currently are.
            _fnApplyToChildren(function (nSizer, i) {
                nSizer.innerHTML = '<div class="dataTables_sizing" style="height:0;overflow:hidden;">' + headerContent[i] + '</div>';
                nSizer.style.width = headerWidths[i];
            }, headerSrcEls);

            if (footer) {
                _fnApplyToChildren(function (nSizer, i) {
                    nSizer.innerHTML = "";
                    nSizer.style.width = footerWidths[i];
                }, footerSrcEls);
            }

            // Sanity check that the table is of a sensible width. If not then we are going to get
            // misalignment - try to prevent this by not allowing the table to shrink below its min width.
            if (table.outerWidth() < sanityWidth)
            {
                // The min width depends upon if we have a vertical scrollbar visible or not.
                correction = ((divBodyEl.scrollHeight > divBodyEl.offsetHeight ||
                        divBody.css('overflow-y') == "scroll")) ?
                        sanityWidth + barWidth :
                        sanityWidth;

                // IE6/7 are a law unto themselves...
                if (ie67 && (divBodyEl.scrollHeight >
                        divBodyEl.offsetHeight || divBody.css('overflow-y') == "scroll")
                        ) {
                    tableStyle.width = _fnStringToCss(correction - barWidth);
                }

                // And give the user a warning that we've stopped the table getting too small.
                if (scrollX === "" || scrollXInner !== "") {
                    _fnLog(settings, 1, 'Possible column misalignment', 6);
                }
            }
            else
            {
                correction = '100%';
            }

            // Apply to the container elements.
            divBodyStyle.width = _fnStringToCss(correction);
            divHeaderStyle.width = _fnStringToCss(correction);

            if (footer) {
                settings.nScrollFoot.style.width = _fnStringToCss(correction);
            }

            /*
             * 4. Clean up
             */
            if (!scrollY) {
                /* IE7< puts a vertical scrollbar in place (when it shouldn't be) due to subtracting
                 * the scrollbar height from the visible display, rather than adding it on. We need to
                 * set the height in order to sort this. Don't want to do it in any other browsers.
                 */
                if (ie67) {
                    divBodyStyle.height = _fnStringToCss(tableEl.offsetHeight + barWidth);
                }
            }

            if (scrollY && scroll.bCollapse) {
                divBodyStyle.height = _fnStringToCss(scrollY);

                var iExtra = (scrollX && tableEl.offsetWidth > divBodyEl.offsetWidth) ?
                        barWidth :
                        0;

                if (tableEl.offsetHeight < divBodyEl.offsetHeight) {
                    divBodyStyle.height = _fnStringToCss(tableEl.offsetHeight + iExtra);
                }
            }

            /* Finally set the width's of the header and footer tables */
            var iOuterWidth = table.outerWidth();
            divHeaderTable[0].style.width = _fnStringToCss(iOuterWidth);
            divHeaderInnerStyle.width = _fnStringToCss(iOuterWidth);

            // Figure out if there are scrollbar present - if so then we need a the header and footer to
            // provide a bit more space to allow "overflow" scrolling (i.e. past the scrollbar).
            var bScrolling = table.height() > divBodyEl.clientHeight || divBody.css('overflow-y') == "scroll";
            var padding = 'padding' + (browser.bScrollbarLeft ? 'Left' : 'Right');
            divHeaderInnerStyle[ padding ] = bScrolling ? barWidth + "px" : "0px";

            if (footer) {
                divFooterTable[0].style.width = _fnStringToCss(iOuterWidth);
                divFooterInner[0].style.width = _fnStringToCss(iOuterWidth);
                divFooterInner[0].style[padding] = bScrolling ? barWidth + "px" : "0px";
            }

            /* Adjust the position of the header in case we loose the y-scrollbar */
            divBody.scroll();

            // If sorting or filtering has occurred, jump the scrolling back to the top
            // only if we aren't holding the position.
            if ((settings.bSorted || settings.bFiltered) && !settings._drawHold) {
                divBodyEl.scrollTop = 0;
            }
        }

        /**
         * Apply a given function to the display child nodes of an element array (typically
         * TD children of TR rows
         *  @param {function} fn Method to apply to the objects
         *  @param array {nodes} an1 List of elements to look through for display children
         *  @param array {nodes} an2 Another list (identical structure to the first) - optional
         *  @memberof DataTable#oApi
         */
        function _fnApplyToChildren(fn, an1, an2) {
            var index = 0, i = 0, iLen = an1.length;
            var nNode1, nNode2;

            while (i < iLen) {
                nNode1 = an1[i].firstChild;
                nNode2 = an2 ? an2[i].firstChild : null;

                while (nNode1) {
                    if (nNode1.nodeType === 1) {
                        if (an2) {
                            fn(nNode1, nNode2, index);
                        }
                        else {
                            fn(nNode1, index);
                        }

                        index++;
                    }

                    nNode1 = nNode1.nextSibling;
                    nNode2 = an2 ? nNode2.nextSibling : null;
                }

                i++;
            }
        }

        var __re_html_remove = /<.*?>/g;

        /**
         * Calculate the width of columns for the table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnCalculateColumnWidths(oSettings)
        {
            var
                    table = oSettings.nTable,
                    columns = oSettings.aoColumns,
                    scroll = oSettings.oScroll,
                    scrollY = scroll.sY,
                    scrollX = scroll.sX,
                    scrollXInner = scroll.sXInner,
                    columnCount = columns.length,
                    visibleColumns = _fnGetColumns(oSettings, 'bVisible'),
                    headerCells = $('th', oSettings.nTHead),
                    tableWidthAttr = table.getAttribute('width'), // from DOM element
                    tableContainer = table.parentNode,
                    userInputs = false,
                    i, column, columnIdx, width, outerWidth,
                    ie67 = oSettings.oBrowser.bScrollOversize;

            var styleWidth = table.style.width;
            if (styleWidth && styleWidth.indexOf('%') !== -1) {
                tableWidthAttr = styleWidth;
            }

            /* Convert any user input sizes into pixel sizes */
            for (i = 0; i < visibleColumns.length; i++) {
                column = columns[ visibleColumns[i] ];

                if (column.sWidth !== null) {
                    column.sWidth = _fnConvertToWidth(column.sWidthOrig, tableContainer);

                    userInputs = true;
                }
            }

            /* If the number of columns in the DOM equals the number that we have to
             * process in DataTables, then we can use the offsets that are created by
             * the web- browser. No custom sizes can be set in order for this to happen,
             * nor scrolling used
             */
            if (ie67 || (
                    !userInputs && !scrollX && !scrollY &&
                    columnCount == _fnVisbleColumns(oSettings) &&
                    columnCount == headerCells.length
                    )
                    ) {
                for (i = 0; i < columnCount; i++) {
                    columns[i].sWidth = _fnStringToCss(headerCells.eq(i).width());
                }
            } else {
                // Otherwise construct a single row, worst case, table with the widest
                // node in the data, assign any user defined widths, then insert it into
                // the DOM and allow the browser to do all the hard work of calculating
                // table widths.
                var tmpTable = $(table).clone() // don't use cloneNode - IE8 will remove events on the main table
                        .css('visibility', 'hidden')
                        .removeAttr('id');

                // Clean up the table body.
                tmpTable.find('tbody tr').remove();
                var tr = $('<tr/>').appendTo(tmpTable.find('tbody'));

                // Clone the table header and footer - we can't use the header / footer
                // from the cloned table, since if scrolling is active, the table's
                // real header and footer are contained in different table tags.
                tmpTable.find('thead, tfoot').remove();
                tmpTable
                        .append($(oSettings.nTHead).clone())
                        .append($(oSettings.nTFoot).clone());

                // Remove any assigned widths from the footer (from scrolling).
                tmpTable.find('tfoot th, tfoot td').css('width', '');

                // Apply custom sizing to the cloned header.
                headerCells = _fnGetUniqueThs(oSettings, tmpTable.find('thead')[0]);

                for (i = 0; i < visibleColumns.length; i++) {
                    column = columns[ visibleColumns[i] ];

                    headerCells[i].style.width = column.sWidthOrig !== null && column.sWidthOrig !== '' ?
                            _fnStringToCss(column.sWidthOrig) :
                            '';
                }

                // Find the widest cell for each column and put it into the table.
                if (oSettings.aoData.length) {
                    for (i = 0; i < visibleColumns.length; i++) {
                        columnIdx = visibleColumns[i];
                        column = columns[ columnIdx ];

                        $(_fnGetWidestNode(oSettings, columnIdx))
                                .clone(false)
                                .append(column.sContentPadding)
                                .appendTo(tr);
                    }
                }

                // Table has been built, attach to the document so we can work with it.
                tmpTable.appendTo(tableContainer);

                // When scrolling (X or Y) we want to set the width of the table as appropriate.
                // However, when not scrolling leave the table width as is.
                // This results in slightly different, but I think correct behaviour.
                if (scrollX && scrollXInner) {
                    tmpTable.width(scrollXInner);
                }
                else if (scrollX) {
                    tmpTable.css('width', 'auto');

                    if (tmpTable.width() < tableContainer.offsetWidth) {
                        tmpTable.width(tableContainer.offsetWidth);
                    }
                }
                else if (scrollY) {
                    tmpTable.width(tableContainer.offsetWidth);
                }
                else if (tableWidthAttr) {
                    tmpTable.width(tableWidthAttr);
                }

                // Take into account the y scrollbar.
                _fnScrollingWidthAdjust(oSettings, tmpTable[0]);

                // Browsers need a bit of a hand when a width is assigned to any columns
                // when x-scrolling as they tend to collapse the table to the min-width,
                // even if we sent the column widths. So we need to keep track of what
                // the table width should be by summing the user given values, and the
                // automatic values.
                if (scrollX)
                {
                    var total = 0;

                    for (i = 0; i < visibleColumns.length; i++) {
                        column = columns[ visibleColumns[i] ];
                        outerWidth = $(headerCells[i]).outerWidth();

                        total += column.sWidthOrig === null ?
                                outerWidth :
                                parseInt(column.sWidth, 10) + outerWidth - $(headerCells[i]).width();
                    }

                    tmpTable.width(_fnStringToCss(total));
                    table.style.width = _fnStringToCss(total);
                }

                // Get the width of each column in the constructed table.
                for (i = 0; i < visibleColumns.length; i++) {
                    column = columns[ visibleColumns[i] ];
                    width = $(headerCells[i]).width();

                    if (width) {
                        column.sWidth = _fnStringToCss(width);
                    }
                }

                table.style.width = _fnStringToCss(tmpTable.css('width'));

                // Finished with the table - ditch it.
                tmpTable.remove();
            }

            // If there is a width attr, we want to attach an event listener which
            // allows the table sizing to automatically adjust when the window is
            // resized. Use the width attr rather than CSS, since we can't know if the
            // CSS is a relative value or absolute - DOM read is always px.
            if (tableWidthAttr) {
                table.style.width = _fnStringToCss(tableWidthAttr);
            }

            if ((tableWidthAttr || scrollX) && !oSettings._reszEvt) {
                var bindResize = function () {
                    $(window).bind('resize.DT-' + oSettings.sInstance, _fnThrottle(function () {
                        _fnAdjustColumnSizing(oSettings);
                    }));
                };

                // IE6/7 will crash if we bind a resize event handler on page load.
                // To be removed in 1.11 which drops IE6/7 support.
                if (ie67) {
                    setTimeout(bindResize, 1000);
                }
                else {
                    bindResize();
                }

                oSettings._reszEvt = true;
            }
        }

        /**
         * Throttle the calls to a function. Arguments and context are maintained for
         * the throttled function
         *  @param {function} fn Function to be called
         *  @param {int} [freq=200] call frequency in mS
         *  @returns {function} wrapped function
         *  @memberof DataTable#oApi
         */
        function _fnThrottle(fn, freq) {
            var
                    frequency = freq !== undefined ? freq : 200,
                    last,
                    timer;

            return function () {
                var
                        that = this,
                        now = + new Date(),
                        args = arguments;

                if (last && now < last + frequency) {
                    clearTimeout(timer);

                    timer = setTimeout(function () {
                        last = undefined;
                        fn.apply(that, args);
                    }, frequency);
                }
                else {
                    last = now;
                    fn.apply(that, args);
                }
            };
        }

        /**
         * Convert a CSS unit width to pixels (e.g. 2em)
         *  @param {string} width width to be converted
         *  @param {node} parent parent to get the with for (required for relative widths) - optional
         *  @returns {int} width in pixels
         *  @memberof DataTable#oApi
         */
        function _fnConvertToWidth(width, parent) {
            if (!width) {
                return 0;
            }

            var n = $('<div/>')
                    .css('width', _fnStringToCss(width))
                    .appendTo(parent || document.body);

            var val = n[0].offsetWidth;
            n.remove();

            return val;
        }

        /**
         * Adjust a table's width to take account of vertical scroll bar
         *  @param {object} oSettings dataTables settings object
         *  @param {node} n table node
         *  @memberof DataTable#oApi
         */
        function _fnScrollingWidthAdjust(settings, n) {
            var scroll = settings.oScroll;

            if (scroll.sX || scroll.sY) {
                // When y-scrolling only, we want to remove the width of the scroll bar
                // so the table + scroll bar will fit into the area available, otherwise
                // we fix the table at its current size with no adjustment.
                var correction = !scroll.sX ? scroll.iBarWidth : 0;
                n.style.width = _fnStringToCss($(n).outerWidth() - correction);
            }
        }

        /**
         * Get the widest node
         *  @param {object} settings dataTables settings object
         *  @param {int} colIdx column of interest
         *  @returns {node} widest table node
         *  @memberof DataTable#oApi
         */
        function _fnGetWidestNode(settings, colIdx) {
            var idx = _fnGetMaxLenString(settings, colIdx);
            if (idx < 0) {
                return null;
            }

            var data = settings.aoData[ idx ];
            return !data.nTr ? // Might not have been created when deferred rendering.
                    $('<td/>').html(_fnGetCellData(settings, idx, colIdx, 'display'))[0] :
                    data.anCells[ colIdx ];
        }

        /**
         * Get the maximum strlen for each data column
         *  @param {object} settings dataTables settings object
         *  @param {int} colIdx column of interest
         *  @returns {string} max string length for each column
         *  @memberof DataTable#oApi
         */
        function _fnGetMaxLenString(settings, colIdx) {
            var s, max = -1, maxIdx = -1;

            for (var i = 0, ien = settings.aoData.length; i < ien; i++) {
                s = _fnGetCellData(settings, i, colIdx, 'display') + '';
                s = s.replace(__re_html_remove, '');

                if (s.length > max) {
                    max = s.length;
                    maxIdx = i;
                }
            }

            return maxIdx;
        }

        /**
         * Append a CSS unit (only if required) to a string
         *  @param {string} value to css-ify
         *  @returns {string} value with css unit
         *  @memberof DataTable#oApi
         */
        function _fnStringToCss(s) {
            if (s === null) {
                return '0px';
            }

            if (typeof s == 'number') {
                return s < 0 ?
                        '0px' :
                        s + 'px';
            }

            // Check it has a unit character already
            return s;
        }

        /**
         * Get the width of a scroll bar in this browser being used
         *  @returns {int} width in pixels
         *  @memberof DataTable#oApi
         */
        function _fnScrollBarWidth() {
            // On first run a static variable is set, since this is only needed once.
            // Subsequent runs will just use the previously calculated value
            var width = DataTable.__scrollbarWidth;

            if (width === undefined) {
                var sizer = $('<p/>').css({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 150,
                    padding: 0,
                    overflow: 'scroll',
                    visibility: 'hidden'
                })
                        .appendTo('body');

                width = sizer[0].offsetWidth - sizer[0].clientWidth;
                DataTable.__scrollbarWidth = width;

                sizer.remove();
            }

            return width;
        }

        function _fnSortFlatten(settings)
        {
            var
                    i, iLen, k, kLen,
                    aSort = [],
                    aiOrig = [],
                    aoColumns = settings.aoColumns,
                    aDataSort, iCol, sType, srcCol,
                    fixed = settings.aaSortingFixed,
                    fixedObj = $.isPlainObject(fixed),
                    nestedSort = [],
                    add = function (a) {
                        if (a.length && !$.isArray(a[0])) {
                            // 1D array
                            nestedSort.push(a);
                        }
                        else {
                            // 2D array
                            nestedSort.push.apply(nestedSort, a);
                        }
                    };

            // Build the sort array, with pre-fix and post-fix options if they have been
            // specified
            if ($.isArray(fixed)) {
                add(fixed);
            }

            if (fixedObj && fixed.pre) {
                add(fixed.pre);
            }

            add(settings.aaSorting);

            if (fixedObj && fixed.post) {
                add(fixed.post);
            }

            for (i = 0; i < nestedSort.length; i++)
            {
                srcCol = nestedSort[i][0];
                aDataSort = aoColumns[ srcCol ].aDataSort;

                for (k = 0, kLen = aDataSort.length; k < kLen; k++)
                {
                    iCol = aDataSort[k];
                    sType = aoColumns[ iCol ].sType || 'string';

                    if (nestedSort[i]._idx === undefined) {
                        nestedSort[i]._idx = $.inArray(nestedSort[i][1], aoColumns[iCol].asSorting);
                    }

                    aSort.push({
                        src: srcCol,
                        col: iCol,
                        dir: nestedSort[i][1],
                        index: nestedSort[i]._idx,
                        type: sType,
                        formatter: DataTable.ext.type.order[ sType + "-pre" ]
                    });
                }
            }

            return aSort;
        }

        /**
         * Change the order of the table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         *  @todo This really needs split up!
         */
        function _fnSort(oSettings) {
            var
                    i, ien, iLen, j, jLen, k, kLen,
                    sDataType, nTh,
                    aiOrig = [],
                    oExtSort = DataTable.ext.type.order,
                    aoData = oSettings.aoData,
                    aoColumns = oSettings.aoColumns,
                    aDataSort, data, iCol, sType, oSort,
                    formatters = 0,
                    sortCol,
                    displayMaster = oSettings.aiDisplayMaster,
                    aSort;

            // Resolve any column types that are unknown due to addition or invalidation
            // @todo Can this be moved into a 'data-ready' handler which is called when
            //   data is going to be used in the table?
            _fnColumnTypes(oSettings);

            aSort = _fnSortFlatten(oSettings);

            for (i = 0, ien = aSort.length; i < ien; i++) {
                sortCol = aSort[i];

                // Track if we can use the fast sort algorithm
                if (sortCol.formatter) {
                    formatters++;
                }

                // Load the data needed for the sort, for each cell
                _fnSortData(oSettings, sortCol.col);
            }

            /* No sorting required if server-side or no sorting array */
            if (_fnDataSource(oSettings) != 'ssp' && aSort.length !== 0)
            {
                // Create a value - key array of the current row positions such that we can use their
                // current position during the sort, if values match, in order to perform stable sorting
                for (i = 0, iLen = displayMaster.length; i < iLen; i++) {
                    aiOrig[ displayMaster[i] ] = i;
                }

                /* Do the sort - here we want multi-column sorting based on a given data source (column)
                 * and sorting function (from oSort) in a certain direction. It's reasonably complex to
                 * follow on it's own, but this is what we want (example two column sorting):
                 *  fnLocalSorting = function(a,b) {
                 *    var iTest;
                 *    iTest = oSort['string-asc']('data11', 'data12');
                 *      if (iTest !== 0)
                 *        return iTest;
                 *    iTest = oSort['numeric-desc']('data21', 'data22');
                 *    if (iTest !== 0)
                 *      return iTest;
                 *    return oSort['numeric-asc']( aiOrig[a], aiOrig[b] );
                 *  }
                 * Basically we have a test for each sorting column, if the data in that column is equal,
                 * test the next column. If all columns match, then we use a numeric sort on the row
                 * positions in the original data array to provide a stable sort.
                 *
                 * Note - I know it seems excessive to have two sorting methods, but the first is around
                 * 15% faster, so the second is only maintained for backwards compatibility with sorting
                 * methods which do not have a pre-sort formatting function.
                 */
                if (formatters === aSort.length) {
                    // All sort types have formatting functions
                    displayMaster.sort(function (a, b) {
                        var
                                x, y, k, test, sort,
                                len = aSort.length,
                                dataA = aoData[a]._aSortData,
                                dataB = aoData[b]._aSortData;

                        for (k = 0; k < len; k++) {
                            sort = aSort[k];

                            x = dataA[ sort.col ];
                            y = dataB[ sort.col ];

                            test = x < y ? -1 : x > y ? 1 : 0;
                            if (test !== 0) {
                                return sort.dir === 'asc' ? test : -test;
                            }
                        }

                        x = aiOrig[a];
                        y = aiOrig[b];
                        return x < y ? -1 : x > y ? 1 : 0;
                    });
                }
                else {
                    // Depreciated - remove in 1.11 (providing a plug-in option)
                    // Not all sort types have formatting methods, so we have to call their sorting
                    // methods.
                    displayMaster.sort(function (a, b) {
                        var
                                x, y, k, l, test, sort, fn,
                                len = aSort.length,
                                dataA = aoData[a]._aSortData,
                                dataB = aoData[b]._aSortData;

                        for (k = 0; k < len; k++) {
                            sort = aSort[k];

                            x = dataA[ sort.col ];
                            y = dataB[ sort.col ];

                            fn = oExtSort[ sort.type + "-" + sort.dir ] || oExtSort[ "string-" + sort.dir ];
                            test = fn(x, y);
                            if (test !== 0) {
                                return test;
                            }
                        }

                        x = aiOrig[a];
                        y = aiOrig[b];
                        return x < y ? -1 : x > y ? 1 : 0;
                    });
                }
            }

            /* Tell the draw function that we have sorted the data */
            oSettings.bSorted = true;
        }

        function _fnSortAria(settings)
        {
            var label;
            var nextSort;
            var columns = settings.aoColumns;
            var aSort = _fnSortFlatten(settings);
            var oAria = settings.oLanguage.oAria;

            // ARIA attributes - need to loop all columns, to update all (removing old
            // attributes as needed)
            for (var i = 0, iLen = columns.length; i < iLen; i++)
            {
                var col = columns[i];
                var asSorting = col.asSorting;
                var sTitle = col.sTitle.replace(/<.*?>/g, "");
                var th = col.nTh;

                // IE7 is throwing an error when setting these properties with jQuery's
                // attr() and removeAttr() methods...
                th.removeAttribute('aria-sort');

                /* In ARIA only the first sorting column can be marked as sorting - no multi-sort option */
                if (col.bSortable) {
                    if (aSort.length > 0 && aSort[0].col == i) {
                        th.setAttribute('aria-sort', aSort[0].dir == "asc" ? "ascending" : "descending");
                        nextSort = asSorting[ aSort[0].index + 1 ] || asSorting[0];
                    }
                    else {
                        nextSort = asSorting[0];
                    }

                    label = sTitle + (nextSort === "asc" ?
                            oAria.sSortAscending :
                            oAria.sSortDescending
                            );
                }
                else {
                    label = sTitle;
                }

                th.setAttribute('aria-label', label);
            }
        }

        /**
         * Function to run on user sort request
         *  @param {object} settings dataTables settings object
         *  @param {node} attachTo node to attach the handler to
         *  @param {int} colIdx column sorting index
         *  @param {boolean} [append=false] Append the requested sort to the existing
         *    sort if true (i.e. multi-column sort)
         *  @param {function} [callback] callback function
         *  @memberof DataTable#oApi
         */
        function _fnSortListener(settings, colIdx, append, callback) {
            var col = settings.aoColumns[ colIdx ];
            var sorting = settings.aaSorting;
            var asSorting = col.asSorting;
            var nextSortIdx;
            var next = function (a, overflow) {
                var idx = a._idx;
                if (idx === undefined) {
                    idx = $.inArray(a[1], asSorting);
                }

                return idx + 1 < asSorting.length ?
                        idx + 1 :
                        overflow ?
                        null :
                        0;
            };

            // Convert to 2D array if needed
            if (typeof sorting[0] === 'number') {
                sorting = settings.aaSorting = [sorting];
            }

            // If appending the sort then we are multi-column sorting
            if (append && settings.oFeatures.bSortMulti) {
                // Are we already doing some kind of sort on this column?
                var sortIdx = $.inArray(colIdx, _pluck(sorting, '0'));

                if (sortIdx !== -1) {
                    // Yes, modify the sort
                    nextSortIdx = next(sorting[sortIdx], true);

                    if (nextSortIdx === null && sorting.length === 1) {
                        nextSortIdx = 0; // can't remove sorting completely
                    }

                    if (nextSortIdx === null) {
                        sorting.splice(sortIdx, 1);
                    }
                    else {
                        sorting[sortIdx][1] = asSorting[ nextSortIdx ];
                        sorting[sortIdx]._idx = nextSortIdx;
                    }
                }
                else {
                    // No sort on this column yet
                    sorting.push([colIdx, asSorting[0], 0]);
                    sorting[sorting.length - 1]._idx = 0;
                }
            }
            else if (sorting.length && sorting[0][0] == colIdx) {
                // Single column - already sorting on this column, modify the sort
                nextSortIdx = next(sorting[0]);

                sorting.length = 1;
                sorting[0][1] = asSorting[ nextSortIdx ];
                sorting[0]._idx = nextSortIdx;
            }
            else {
                // Single column - sort only on this column
                sorting.length = 0;
                sorting.push([colIdx, asSorting[0]]);
                sorting[0]._idx = 0;
            }

            // Run the sort by calling a full redraw
            _fnReDraw(settings);

            // callback used for async user interaction
            if (typeof callback == 'function') {
                callback(settings);
            }
        }

        /**
         * Attach a sort handler (click) to a node
         *  @param {object} settings dataTables settings object
         *  @param {node} attachTo node to attach the handler to
         *  @param {int} colIdx column sorting index
         *  @param {function} [callback] callback function
         *  @memberof DataTable#oApi
         */
        function _fnSortAttachListener(settings, attachTo, colIdx, callback) {
            var col = settings.aoColumns[ colIdx ];

            _fnBindAction(attachTo, {}, function (e) {
                /* If the column is not sortable - don't to anything */
                if (col.bSortable === false) {
                    return;
                }

                // If processing is enabled use a timeout to allow the processing
                // display to be shown - otherwise to it synchronously
                if (settings.oFeatures.bProcessing) {
                    _fnProcessingDisplay(settings, true);

                    setTimeout(function () {
                        _fnSortListener(settings, colIdx, e.shiftKey, callback);

                        // In server-side processing, the draw callback will remove the
                        // processing display
                        if (_fnDataSource(settings) !== 'ssp') {
                            _fnProcessingDisplay(settings, false);
                        }
                    }, 0);
                }
                else {
                    _fnSortListener(settings, colIdx, e.shiftKey, callback);
                }
            });
        }

        /**
         * Set the sorting classes on table's body, Note: it is safe to call this function
         * when bSort and bSortClasses are false
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnSortingClasses(settings) {
            var oldSort = settings.aLastSort;
            var sortClass = settings.oClasses.sSortColumn;
            var sort = _fnSortFlatten(settings);
            var features = settings.oFeatures;
            var i, ien, colIdx;

            if (features.bSort && features.bSortClasses) {
                // Remove old sorting classes
                for (i = 0, ien = oldSort.length; i < ien; i++) {
                    colIdx = oldSort[i].src;

                    // Remove column sorting
                    $(_pluck(settings.aoData, 'anCells', colIdx))
                            .removeClass(sortClass + (i < 2 ? i + 1 : 3));
                }

                // Add new column sorting
                for (i = 0, ien = sort.length; i < ien; i++) {
                    colIdx = sort[i].src;

                    $(_pluck(settings.aoData, 'anCells', colIdx))
                            .addClass(sortClass + (i < 2 ? i + 1 : 3));
                }
            }

            settings.aLastSort = sort;
        }

        // Get the data to sort a column, be it from cache, fresh (populating the
        // cache), or from a sort formatter
        function _fnSortData(settings, idx)
        {
            // Custom sorting function - provided by the sort data type
            var column = settings.aoColumns[ idx ];
            var customSort = DataTable.ext.order[ column.sSortDataType ];
            var customData;

            if (customSort) {
                customData = customSort.call(settings.oInstance, settings, idx,
                        _fnColumnIndexToVisible(settings, idx)
                        );
            }

            // Use / populate cache
            var row, cellData;
            var formatter = DataTable.ext.type.order[ column.sType + "-pre" ];

            for (var i = 0, ien = settings.aoData.length; i < ien; i++) {
                row = settings.aoData[i];

                if (!row._aSortData) {
                    row._aSortData = [];
                }

                if (!row._aSortData[idx] || customSort) {
                    cellData = customSort ?
                            customData[i] : // If there was a custom sort function, use data from there
                            _fnGetCellData(settings, i, idx, 'sort');

                    row._aSortData[ idx ] = formatter ?
                            formatter(cellData) :
                            cellData;
                }
            }
        }

        /**
         * Save the state of a table
         *  @param {object} oSettings dataTables settings object
         *  @memberof DataTable#oApi
         */
        function _fnSaveState(settings) {
            if (!settings.oFeatures.bStateSave || settings.bDestroying){
                return;
            }

            /* Store the interesting variables */
            var state = {
                time: + new Date(),
                start: settings._iDisplayStart,
                length: settings._iDisplayLength,
                order: $.extend(true, [], settings.aaSorting),
                search: _fnSearchToCamel(settings.oPreviousSearch),
                columns: $.map(settings.aoColumns, function (col, i) {
                    return {
                        visible: col.bVisible,
                        search: _fnSearchToCamel(settings.aoPreSearchCols[i])
                    };
                })
            };

            _fnCallbackFire(settings, "aoStateSaveParams", 'stateSaveParams', [settings, state]);

            settings.oSavedState = state;
            settings.fnStateSaveCallback.call(settings.oInstance, settings, state);
        }

        /**
         * Attempt to load a saved table state
         *  @param {object} oSettings dataTables settings object
         *  @param {object} oInit DataTables init object so we can override settings
         *  @memberof DataTable#oApi
         */
        function _fnLoadState(settings, oInit) {
            var i, ien;
            var columns = settings.aoColumns;

            if (!settings.oFeatures.bStateSave) {
                return;
            }

            var state = settings.fnStateLoadCallback.call(settings.oInstance, settings);
            if (!state || !state.time) {
                return;
            }

            /* Allow custom and plug-in manipulation functions to alter the saved data set and
             * cancelling of loading by returning false
             */
            var abStateLoad = _fnCallbackFire(settings, 'aoStateLoadParams', 'stateLoadParams', [settings, state]);
            if ($.inArray(false, abStateLoad) !== -1) {
                return;
            }

            /* Reject old data */
            var duration = settings.iStateDuration;
            if (duration > 0 && state.time < + new Date() - (duration * 1000)) {
                return;
            }

            // Number of columns have changed - all bets are off, no restore of settings
            if (columns.length !== state.columns.length) {
                return;
            }

            // Store the saved state so it might be accessed at any time
            settings.oLoadedState = $.extend(true, {}, state);

            // Restore key features - todo - for 1.11 this needs to be done by
            // subscribed events
            if (state.start !== undefined) {
                settings._iDisplayStart = state.start;
                settings.iInitDisplayStart = state.start;
            }
            if (state.length !== undefined) {
                settings._iDisplayLength = state.length;
            }

            // Order
            if (state.order !== undefined) {
                settings.aaSorting = [];
                $.each(state.order, function (i, col) {
                    settings.aaSorting.push(col[0] >= columns.length ?
                            [0, col[1]] :
                            col
                            );
                });
            }

            // Search
            if (state.search !== undefined) {
                $.extend(settings.oPreviousSearch, _fnSearchToHung(state.search));
            }

            // Columns
            for (i = 0, ien = state.columns.length; i < ien; i++) {
                var col = state.columns[i];

                // Visibility
                if (col.visible !== undefined) {
                    columns[i].bVisible = col.visible;
                }

                // Search
                if (col.search !== undefined) {
                    $.extend(settings.aoPreSearchCols[i], _fnSearchToHung(col.search));
                }
            }

            _fnCallbackFire(settings, 'aoStateLoaded', 'stateLoaded', [settings, state]);
        }

        /**
         * Return the settings object for a particular table
         *  @param {node} table table we are using as a dataTable
         *  @returns {object} Settings object - or null if not found
         *  @memberof DataTable#oApi
         */
        function _fnSettingsFromNode(table) {
            var settings = DataTable.settings;
            var idx = $.inArray(table, _pluck(settings, 'nTable'));

            return idx !== -1 ?
                    settings[ idx ] :
                    null;
        }

        /**
         * Log an error message
         *  @param {object} settings dataTables settings object
         *  @param {int} level log error messages, or display them to the user
         *  @param {string} msg error message
         *  @param {int} tn Technical note id to get more information about the error.
         *  @memberof DataTable#oApi
         */
        function _fnLog(settings, level, msg, tn) {
            msg = 'DataTables warning: ' +
                    (settings ? 'table id=' + settings.sTableId + ' - ' : '') + msg;

            if (tn) {
                msg += '. For more information about this error, please see ' +
                        'http://datatables.net/tn/' + tn;
            }

            if (!level) {
                // Backwards compatibility pre 1.10
                var ext = DataTable.ext;
                var type = ext.sErrMode || ext.errMode;

                if (settings) {
                    _fnCallbackFire(settings, null, 'error', [settings, tn, msg]);
                }

                if (type == 'alert') {
                    alert(msg);
                }
                else if (type == 'throw') {
                    throw new Error(msg);
                }
                else if (typeof type == 'function') {
                    type(settings, tn, msg);
                }
            }
            else if (window.console && console.log) {
                console.log(msg);
            }
        }

        /**
         * See if a property is defined on one object, if so assign it to the other object
         *  @param {object} ret target object
         *  @param {object} src source object
         *  @param {string} name property
         *  @param {string} [mappedName] name to map too - optional, name used if not given
         *  @memberof DataTable#oApi
         */
        function _fnMap(ret, src, name, mappedName) {
            if ($.isArray(name)) {
                $.each(name, function (i, val) {
                    if ($.isArray(val)) {
                        _fnMap(ret, src, val[0], val[1]);
                    }
                    else {
                        _fnMap(ret, src, val);
                    }
                });

                return;
            }

            if (mappedName === undefined) {
                mappedName = name;
            }

            if (src[name] !== undefined) {
                ret[mappedName] = src[name];
            }
        }

        /**
         * Extend objects - very similar to jQuery.extend, but deep copy objects, and
         * shallow copy arrays. The reason we need to do this, is that we don't want to
         * deep copy array init values (such as aaSorting) since the dev wouldn't be
         * able to override them, but we do want to deep copy arrays.
         *  @param {object} out Object to extend
         *  @param {object} extender Object from which the properties will be applied to
         *      out
         *  @param {boolean} breakRefs If true, then arrays will be sliced to take an
         *      independent copy with the exception of the `data` or `aaData` parameters
         *      if they are present. This is so you can pass in a collection to
         *      DataTables and have that used as your data source without breaking the
         *      references
         *  @returns {object} out Reference, just for convenience - out === the return.
         *  @memberof DataTable#oApi
         *  @todo This doesn't take account of arrays inside the deep copied objects.
         */
        function _fnExtend(out, extender, breakRefs) {
            var val;

            for (var prop in extender) {
                if (extender.hasOwnProperty(prop)) {
                    val = extender[prop];

                    if ($.isPlainObject(val)) {
                        if (!$.isPlainObject(out[prop])) {
                            out[prop] = {};
                        }
                        $.extend(true, out[prop], val);
                    }
                    else if (breakRefs && prop !== 'data' && prop !== 'aaData' && $.isArray(val)) {
                        out[prop] = val.slice();
                    }
                    else {
                        out[prop] = val;
                    }
                }
            }

            return out;
        }

        /**
         * Bind an event handers to allow a click or return key to activate the callback.
         * This is good for accessibility since a return on the keyboard will have the
         * same effect as a click, if the element has focus.
         *  @param {element} n Element to bind the action to
         *  @param {object} oData Data object to pass to the triggered function
         *  @param {function} fn Callback function for when the event is triggered
         *  @memberof DataTable#oApi
         */
        function _fnBindAction(n, oData, fn) {
            $(n)
                    .bind('click.DT', oData, function (e) {
                        n.blur(); // Remove focus outline for mouse users
                        fn(e);
                    })
                    .bind('keypress.DT', oData, function (e) {
                        if (e.which === 13) {
                            e.preventDefault();
                            fn(e);
                        }
                    })
                    .bind('selectstart.DT', function () {
                        /* Take the brutal approach to cancelling text selection */
                        return false;
                    });
        }

        /**
         * Register a callback function. Easily allows a callback function to be added to
         * an array store of callback functions that can then all be called together.
         *  @param {object} oSettings dataTables settings object
         *  @param {string} sStore Name of the array storage for the callbacks in oSettings
         *  @param {function} fn Function to be called back
         *  @param {string} sName Identifying name for the callback (i.e. a label)
         *  @memberof DataTable#oApi
         */
        function _fnCallbackReg(oSettings, sStore, fn, sName) {
            if (fn) {
                oSettings[sStore].push({
                    "fn": fn,
                    "sName": sName
                });
            }
        }

        /**
         * Fire callback functions and trigger events. Note that the loop over the
         * callback array store is done backwards! Further note that you do not want to
         * fire off triggers in time sensitive applications (for example cell creation)
         * as its slow.
         *  @param {object} settings dataTables settings object
         *  @param {string} callbackArr Name of the array storage for the callbacks in
         *      oSettings
         *  @param {string} eventName Name of the jQuery custom event to trigger. If
         *      null no trigger is fired
         *  @param {array} args Array of arguments to pass to the callback function /
         *      trigger
         *  @memberof DataTable#oApi
         */
        function _fnCallbackFire(settings, callbackArr, eventName, args) {
            var ret = [];

            if (callbackArr) {
                ret = $.map(settings[callbackArr].slice().reverse(), function (val, i) {
                    return val.fn.apply(settings.oInstance, args);
                });
            }

            if (eventName !== null) {
                var e = $.Event(eventName + '.dt');

                $(settings.nTable).trigger(e, args);

                ret.push(e.result);
            }

            return ret;
        }

        function _fnLengthOverflow(settings)
        {
            var
                    start = settings._iDisplayStart,
                    end = settings.fnDisplayEnd(),
                    len = settings._iDisplayLength;

            /* If we have space to show extra rows (backing up from the end point - then do so */
            if (start >= end)
            {
                start = end - len;
            }

            // Keep the start record on the current page
            start -= (start % len);

            if (len === -1 || start < 0)
            {
                start = 0;
            }

            settings._iDisplayStart = start;
        }

        function _fnRenderer(settings, type)
        {
            var renderer = settings.renderer;
            var host = DataTable.ext.renderer[type];

            if ($.isPlainObject(renderer) && renderer[type]) {
                // Specific renderer for this type. If available use it, otherwise use
                // the default.
                return host[renderer[type]] || host._;
            }
            else if (typeof renderer === 'string') {
                // Common renderer - if there is one available for this type use it,
                // otherwise use the default
                return host[renderer] || host._;
            }

            // Use the default
            return host._;
        }

        /**
         * Detect the data source being used for the table. Used to simplify the code
         * a little (ajax) and to make it compress a little smaller.
         *
         *  @param {object} settings dataTables settings object
         *  @returns {string} Data source
         *  @memberof DataTable#oApi
         */
        function _fnDataSource(settings) {
            if (settings.oFeatures.bServerSide) {
                return 'ssp';
            } else if (settings.ajax || settings.sAjaxSource) {
                return 'ajax';
            }
            return 'dom';
        }

        DataTable = function (options) {
            this.$ = function (sSelector, oOpts) {
                return this.api(true).$(sSelector, oOpts);
            };

            this._ = function (sSelector, oOpts) {
                return this.api(true).rows(sSelector, oOpts).data();
            };

            this.api = function (traditional) {
                return traditional ?
                        new _Api(
                                _fnSettingsFromNode(this[ _ext.iApiIndex ])
                                ) :
                        new _Api(this);
            };

            this.fnAddData = function (data, redraw) {
                var api = this.api(true);

                /* Check if we want to add multiple rows or not */
                var rows = $.isArray(data) && ($.isArray(data[0]) || $.isPlainObject(data[0])) ?
                        api.rows.add(data) :
                        api.row.add(data);

                if (redraw === undefined || redraw) {
                    api.draw();
                }

                return rows.flatten().toArray();
            };

            this.fnAdjustColumnSizing = function (bRedraw) {
                var api = this.api(true).columns.adjust();
                var settings = api.settings()[0];
                var scroll = settings.oScroll;

                if (bRedraw === undefined || bRedraw) {
                    api.draw(false);
                }
                else if (scroll.sX !== "" || scroll.sY !== "") {
                    /* If not redrawing, but scrolling, we want to apply the new column sizes anyway */
                    _fnScrollDraw(settings);
                }
            };

            this.fnClearTable = function (bRedraw) {
                var api = this.api(true).clear();

                if (bRedraw === undefined || bRedraw) {
                    api.draw();
                }
            };

            this.fnClose = function (nTr) {
                this.api(true).row(nTr).child.hide();
            };

            this.fnDeleteRow = function (target, callback, redraw) {
                var api = this.api(true);
                var rows = api.rows(target);
                var settings = rows.settings()[0];
                var data = settings.aoData[ rows[0][0] ];

                rows.remove();

                if (callback) {
                    callback.call(this, settings, data);
                }

                if (redraw === undefined || redraw) {
                    api.draw();
                }

                return data;
            };

            this.fnDestroy = function (remove) {
                this.api(true).destroy(remove);
            };

            this.fnDraw = function (complete) {
                // Note that this isn't an exact match to the old call to _fnDraw - it takes
                // into account the new data, but can hold position.
                this.api(true).draw(complete);
            };

            this.fnFilter = function (sInput, iColumn, bRegex, bSmart, bShowGlobal, bCaseInsensitive) {
                var api = this.api(true);

                if (iColumn === null || iColumn === undefined) {
                    api.search(sInput, bRegex, bSmart, bCaseInsensitive);
                } else {
                    api.column(iColumn).search(sInput, bRegex, bSmart, bCaseInsensitive);
                }

                api.draw();
            };

            this.fnGetData = function (src, col) {
                var api = this.api(true);

                if (src !== undefined) {
                    var type = src.nodeName ? src.nodeName.toLowerCase() : '';

                    return col !== undefined || type == 'td' || type == 'th' ?
                            api.cell(src, col).data() :
                            api.row(src).data() || null;
                }

                return api.data().toArray();
            };

            this.fnGetNodes = function (iRow) {
                var api = this.api(true);

                return iRow !== undefined ?
                        api.row(iRow).node() :
                        api.rows().nodes().flatten().toArray();
            };

            this.fnGetPosition = function (node) {
                var api = this.api(true);
                var nodeName = node.nodeName.toUpperCase();

                if (nodeName == 'TR') {
                    return api.row(node).index();
                }
                else if (nodeName == 'TD' || nodeName == 'TH') {
                    var cell = api.cell(node).index();

                    return [
                        cell.row,
                        cell.columnVisible,
                        cell.column
                    ];
                }
                return null;
            };

            this.fnIsOpen = function (nTr) {
                return this.api(true).row(nTr).child.isShown();
            };

            this.fnOpen = function (nTr, mHtml, sClass) {
                return this.api(true)
                        .row(nTr)
                        .child(mHtml, sClass)
                        .show()
                        .child()[0];
            };

            this.fnPageChange = function (mAction, bRedraw) {
                var api = this.api(true).page(mAction);

                if (bRedraw === undefined || bRedraw) {
                    api.draw(false);
                }
            };

            this.fnSetColumnVis = function (iCol, bShow, bRedraw) {
                var api = this.api(true).column(iCol).visible(bShow);

                if (bRedraw === undefined || bRedraw) {
                    api.columns.adjust().draw();
                }
            };

            this.fnSettings = function () {
                return _fnSettingsFromNode(this[_ext.iApiIndex]);
            };

            this.fnSort = function (aaSort) {
                this.api(true).order(aaSort).draw();
            };

            this.fnSortListener = function (nNode, iColumn, fnCallback) {
                this.api(true).order.listener(nNode, iColumn, fnCallback);
            };

            this.fnUpdate = function (mData, mRow, iColumn, bRedraw, bAction) {
                var api = this.api(true);

                if (iColumn === undefined || iColumn === null) {
                    api.row(mRow).data(mData);
                }
                else {
                    api.cell(mRow, iColumn).data(mData);
                }

                if (bAction === undefined || bAction) {
                    api.columns.adjust();
                }

                if (bRedraw === undefined || bRedraw) {
                    api.draw();
                }
                return 0;
            };

            this.fnVersionCheck = _ext.fnVersionCheck;

            var _that = this;
            var emptyInit = options === undefined;
            var len = this.length;

            if (emptyInit) {
                options = {};
            }

            this.oApi = this.internal = _ext.internal;

            // Extend with old style plug-in API methods
            for (var fn in DataTable.ext.internal) {
                if (fn) {
                    this[fn] = _fnExternApiFunc(fn);
                }
            }

            this.each(function () {
                // For each initialisation we want to give it a clean initialisation
                // object that can be bashed around
                var o = {};
                var oInit = len > 1 ? // optimisation for single table case
                        _fnExtend(o, options, true) :
                        options;

                /*global oInit,_that,emptyInit*/
                var i = 0, iLen, j, jLen, k, kLen;
                var sId = this.getAttribute('id');
                var bInitHandedOff = false;
                var defaults = DataTable.defaults;
                var $this = $(this);

                /* Sanity check */
                if (this.nodeName.toLowerCase() != 'table')
                {
                    _fnLog(null, 0, 'Non-table node initialisation (' + this.nodeName + ')', 2);
                    return;
                }

                /* Backwards compatibility for the defaults */
                _fnCompatOpts(defaults);
                _fnCompatCols(defaults.column);

                /* Convert the camel-case defaults to Hungarian */
                _fnCamelToHungarian(defaults, defaults, true);
                _fnCamelToHungarian(defaults.column, defaults.column, true);

                /* Setting up the initialisation object */
                _fnCamelToHungarian(defaults, $.extend(oInit, $this.data()));

                /* Check to see if we are re-initialising a table */
                var allSettings = DataTable.settings;
                for (i = 0, iLen = allSettings.length; i < iLen; i++) {
                    var s = allSettings[i];

                    /* Base check on table node */
                    if (s.nTable == this || s.nTHead.parentNode == this || (s.nTFoot && s.nTFoot.parentNode == this)) {
                        var bRetrieve = oInit.bRetrieve !== undefined ? oInit.bRetrieve : defaults.bRetrieve;
                        var bDestroy = oInit.bDestroy !== undefined ? oInit.bDestroy : defaults.bDestroy;

                        if (emptyInit || bRetrieve) {
                            return s.oInstance;
                        } else if (bDestroy) {
                            s.oInstance.fnDestroy();
                            break;
                        } else {
                            _fnLog(s, 0, 'Cannot reinitialise DataTable', 3);
                            return;
                        }
                    }

                    /* If the element we are initialising has the same ID as a table which was previously
                     * initialised, but the table nodes don't match (from before) then we destroy the old
                     * instance by simply deleting it. This is under the assumption that the table has been
                     * destroyed by other methods. Anyone using non-id selectors will need to do this manually
                     */
                    if (s.sTableId == this.id) {
                        allSettings.splice(i, 1);
                        break;
                    }
                }

                /* Ensure the table has an ID - required for accessibility */
                if (sId === null || sId === "") {
                    sId = "DataTables_Table_" + (DataTable.ext._unique++);
                    this.id = sId;
                }

                /* Create the settings object for this table and set some of the default parameters */
                var oSettings = $.extend(true, {}, DataTable.models.oSettings, {
                    "sDestroyWidth": $this[0].style.width,
                    "sInstance": sId,
                    "sTableId": sId
                });
                oSettings.nTable = this;
                oSettings.oApi = _that.internal;
                oSettings.oInit = oInit;

                allSettings.push(oSettings);

                // Need to add the instance after the instance after the settings object has been added
                // to the settings array, so we can self reference the table instance if more than one
                oSettings.oInstance = (_that.length === 1) ? _that : $this.dataTable();

                // Backwards compatibility, before we apply all the defaults
                _fnCompatOpts(oInit);

                if (oInit.oLanguage) {
                    _fnLanguageCompat(oInit.oLanguage);
                }

                // If the length menu is given, but the init display length is not, use the length menu
                if (oInit.aLengthMenu && !oInit.iDisplayLength) {
                    oInit.iDisplayLength = $.isArray(oInit.aLengthMenu[0]) ?
                            oInit.aLengthMenu[0][0] : oInit.aLengthMenu[0];
                }

                // Apply the defaults and init options to make a single init object will all
                // options defined from defaults and instance options.
                oInit = _fnExtend($.extend(true, {}, defaults), oInit);

                // Map the initialisation options onto the settings object
                _fnMap(oSettings.oFeatures, oInit, [
                    "bPaginate",
                    "bLengthChange",
                    "bFilter",
                    "bSort",
                    "bSortMulti",
                    "bInfo",
                    "bProcessing",
                    "bAutoWidth",
                    "bSortClasses",
                    "bServerSide",
                    "bDeferRender"
                ]);
                _fnMap(oSettings, oInit, [
                    "asStripeClasses",
                    "ajax",
                    "fnServerData",
                    "fnFormatNumber",
                    "sServerMethod",
                    "aaSorting",
                    "aaSortingFixed",
                    "aLengthMenu",
                    "sPaginationType",
                    "sAjaxSource",
                    "sAjaxDataProp",
                    "iStateDuration",
                    "sDom",
                    "bSortCellsTop",
                    "iTabIndex",
                    "fnStateLoadCallback",
                    "fnStateSaveCallback",
                    "renderer",
                    "searchDelay",
                    ["iCookieDuration", "iStateDuration"], // backwards compat
                    ["oSearch", "oPreviousSearch"],
                    ["aoSearchCols", "aoPreSearchCols"],
                    ["iDisplayLength", "_iDisplayLength"],
                    ["bJQueryUI", "bJUI"]
                ]);
                _fnMap(oSettings.oScroll, oInit, [
                    ["sScrollX", "sX"],
                    ["sScrollXInner", "sXInner"],
                    ["sScrollY", "sY"],
                    ["bScrollCollapse", "bCollapse"]
                ]);
                _fnMap(oSettings.oLanguage, oInit, "fnInfoCallback");

                /* Callback functions which are array driven */
                _fnCallbackReg(oSettings, 'aoDrawCallback', oInit.fnDrawCallback, 'user');
                _fnCallbackReg(oSettings, 'aoServerParams', oInit.fnServerParams, 'user');
                _fnCallbackReg(oSettings, 'aoStateSaveParams', oInit.fnStateSaveParams, 'user');
                _fnCallbackReg(oSettings, 'aoStateLoadParams', oInit.fnStateLoadParams, 'user');
                _fnCallbackReg(oSettings, 'aoStateLoaded', oInit.fnStateLoaded, 'user');
                _fnCallbackReg(oSettings, 'aoRowCallback', oInit.fnRowCallback, 'user');
                _fnCallbackReg(oSettings, 'aoRowCreatedCallback', oInit.fnCreatedRow, 'user');
                _fnCallbackReg(oSettings, 'aoHeaderCallback', oInit.fnHeaderCallback, 'user');
                _fnCallbackReg(oSettings, 'aoFooterCallback', oInit.fnFooterCallback, 'user');
                _fnCallbackReg(oSettings, 'aoInitComplete', oInit.fnInitComplete, 'user');
                _fnCallbackReg(oSettings, 'aoPreDrawCallback', oInit.fnPreDrawCallback, 'user');

                oSettings.rowId = _fnGetObjectDataFn(oInit.rowId);

                var oClasses = oSettings.oClasses;

                // @todo Remove in 1.11
                if (oInit.bJQueryUI) {
                    /* Use the JUI classes object for display. You could clone the oStdClasses object if
                     * you want to have multiple tables with multiple independent classes
                     */
                    $.extend(oClasses, DataTable.ext.oJUIClasses, oInit.oClasses);

                    if (oInit.sDom === defaults.sDom && defaults.sDom === "lfrtip")
                    {
                        /* Set the DOM to use a layout suitable for jQuery UI's theming */
                        oSettings.sDom = '<"H"lfr>t<"F"ip>';
                    }

                    if (!oSettings.renderer) {
                        oSettings.renderer = 'jqueryui';
                    } else if ($.isPlainObject(oSettings.renderer) && !oSettings.renderer.header) {
                        oSettings.renderer.header = 'jqueryui';
                    }
                } else {
                    $.extend(oClasses, DataTable.ext.classes, oInit.oClasses);
                }
                $this.addClass(oClasses.sTable);

                /* Calculate the scroll bar width and cache it for use later on */
                if (oSettings.oScroll.sX !== "" || oSettings.oScroll.sY !== "") {
                    oSettings.oScroll.iBarWidth = _fnScrollBarWidth();
                }

                if (oSettings.iInitDisplayStart === undefined) {
                    /* Display start point, taking into account the save saving */
                    oSettings.iInitDisplayStart = oInit.iDisplayStart;
                    oSettings._iDisplayStart = oInit.iDisplayStart;
                }

                if (oInit.iDeferLoading !== null) {
                    oSettings.bDeferLoading = true;
                    var tmp = $.isArray(oInit.iDeferLoading);
                    oSettings._iRecordsDisplay = tmp ? oInit.iDeferLoading[0] : oInit.iDeferLoading;
                    oSettings._iRecordsTotal = tmp ? oInit.iDeferLoading[1] : oInit.iDeferLoading;
                }

                /* Language definitions */
                var oLanguage = oSettings.oLanguage;
                $.extend(true, oLanguage, oInit.oLanguage);

                if (oLanguage.sUrl !== "") {
                    /* Get the language definitions from a file - because this Ajax call makes the language
                     * get async to the remainder of this function we use bInitHandedOff to indicate that
                     * _fnInitialise will be fired by the returned Ajax handler, rather than the constructor
                     */
                    $.ajax({
                        dataType: 'json',
                        url: oLanguage.sUrl,
                        success: function (json) {
                            _fnLanguageCompat(json);
                            _fnCamelToHungarian(defaults.oLanguage, json);
                            $.extend(true, oLanguage, json);
                            _fnInitialise(oSettings);
                        },
                        error: function () {
                            // Error occurred loading language file, continue on as best we can
                            _fnInitialise(oSettings);
                        }
                    });
                    bInitHandedOff = true;
                }

                /*
                 * Stripes
                 */
                if (oInit.asStripeClasses === null) {
                    oSettings.asStripeClasses = [
                        oClasses.sStripeOdd,
                        oClasses.sStripeEven
                    ];
                }

                /* Remove row stripe classes if they are already on the table row */
                var stripeClasses = oSettings.asStripeClasses;
                var rowOne = $this.children('tbody').find('tr').eq(0);
                if ($.inArray(true, $.map(stripeClasses, function (el, i) {
                    return rowOne.hasClass(el);
                })) !== -1) {
                    $('tbody tr', this).removeClass(stripeClasses.join(' '));
                    oSettings.asDestroyStripes = stripeClasses.slice();
                }

                /*
                 * Columns
                 * See if we should load columns automatically or use defined ones
                 */
                var anThs = [];
                var aoColumnsInit;
                var nThead = this.getElementsByTagName('thead');
                if (nThead.length !== 0) {
                    _fnDetectHeader(oSettings.aoHeader, nThead[0]);
                    anThs = _fnGetUniqueThs(oSettings);
                }

                /* If not given a column array, generate one with nulls */
                if (oInit.aoColumns === null) {
                    aoColumnsInit = [];
                    for (i = 0, iLen = anThs.length; i < iLen; i++) {
                        aoColumnsInit.push(null);
                    }
                } else {
                    aoColumnsInit = oInit.aoColumns;
                }

                /* Add the columns */
                for (i = 0, iLen = aoColumnsInit.length; i < iLen; i++) {
                    _fnAddColumn(oSettings, anThs ? anThs[i] : null);
                }

                /* Apply the column definitions */
                _fnApplyColumnDefs(oSettings, oInit.aoColumnDefs, aoColumnsInit, function (iCol, oDef) {
                    _fnColumnOptions(oSettings, iCol, oDef);
                });

                /* HTML5 attribute detection - build an mData object automatically if the
                 * attributes are found
                 */
                if (rowOne.length) {
                    var a = function (cell, name) {
                        return cell.getAttribute('data-' + name) !== null ? name : null;
                    };

                    $.each(_fnGetRowElements(oSettings, rowOne[0]).cells, function (i, cell) {
                        var col = oSettings.aoColumns[i];

                        if (col.mData === i) {
                            var sort = a(cell, 'sort') || a(cell, 'order');
                            var filter = a(cell, 'filter') || a(cell, 'search');

                            if (sort !== null || filter !== null) {
                                col.mData = {
                                    _: i + '.display',
                                    sort: sort !== null ? i + '.@data-' + sort : undefined,
                                    type: sort !== null ? i + '.@data-' + sort : undefined,
                                    filter: filter !== null ? i + '.@data-' + filter : undefined
                                };

                                _fnColumnOptions(oSettings, i);
                            }
                        }
                    });
                }

                var features = oSettings.oFeatures;

                /* Must be done after everything which can be overridden by the state saving! */
                if (oInit.bStateSave) {
                    features.bStateSave = true;
                    _fnLoadState(oSettings, oInit);
                    _fnCallbackReg(oSettings, 'aoDrawCallback', _fnSaveState, 'state_save');
                }

                /*
                 * Sorting
                 * @todo For modularisation (1.11) this needs to do into a sort start up handler
                 */

                // If aaSorting is not defined, then we use the first indicator in asSorting
                // in case that has been altered, so the default sort reflects that option
                if (oInit.aaSorting === undefined) {
                    var sorting = oSettings.aaSorting;
                    for (i = 0, iLen = sorting.length; i < iLen; i++)
                    {
                        sorting[i][1] = oSettings.aoColumns[ i ].asSorting[0];
                    }
                }

                /* Do a first pass on the sorting classes (allows any size changes to be taken into
                 * account, and also will apply sorting disabled classes if disabled
                 */
                _fnSortingClasses(oSettings);

                if (features.bSort) {
                    _fnCallbackReg(oSettings, 'aoDrawCallback', function () {
                        if (oSettings.bSorted) {
                            var aSort = _fnSortFlatten(oSettings);
                            var sortedColumns = {};

                            $.each(aSort, function (i, val) {
                                sortedColumns[ val.src ] = val.dir;
                            });

                            _fnCallbackFire(oSettings, null, 'order', [oSettings, aSort, sortedColumns]);
                            _fnSortAria(oSettings);
                        }
                    });
                }

                _fnCallbackReg(oSettings, 'aoDrawCallback', function () {
                    if (oSettings.bSorted || _fnDataSource(oSettings) === 'ssp' || features.bDeferRender) {
                        _fnSortingClasses(oSettings);
                    }
                }, 'sc');

                /*
                 * Final init
                 * Cache the header, body and footer as required, creating them if needed
                 */

                /* Browser support detection */
                _fnBrowserDetect(oSettings);

                // Work around for Webkit bug 83867 - store the caption-side before removing from doc
                var captions = $this.children('caption').each(function () {
                    this._captionSide = $this.css('caption-side');
                });

                var thead = $this.children('thead');
                if (thead.length === 0) {
                    thead = $('<thead/>').appendTo(this);
                }
                oSettings.nTHead = thead[0];

                var tbody = $this.children('tbody');
                if (tbody.length === 0) {
                    tbody = $('<tbody/>').appendTo(this);
                }
                oSettings.nTBody = tbody[0];

                var tfoot = $this.children('tfoot');
                if (tfoot.length === 0 && captions.length > 0 && (oSettings.oScroll.sX !== "" || oSettings.oScroll.sY !== "")) {
                    // If we are a scrolling table, and no footer has been given, then we need to create
                    // a tfoot element for the caption element to be appended to
                    tfoot = $('<tfoot/>').appendTo(this);
                }

                if (tfoot.length === 0 || tfoot.children().length === 0) {
                    $this.addClass(oClasses.sNoFooter);
                } else if (tfoot.length > 0) {
                    oSettings.nTFoot = tfoot[0];
                    _fnDetectHeader(oSettings.aoFooter, oSettings.nTFoot);
                }

                /* Check if there is data passing into the constructor */
                if (oInit.aaData) {
                    for (i = 0; i < oInit.aaData.length; i++)
                    {
                        _fnAddData(oSettings, oInit.aaData[ i ]);
                    }
                } else if (oSettings.bDeferLoading || _fnDataSource(oSettings) == 'dom') {
                    /* Grab the data from the page - only do this when deferred loading or no Ajax
                     * source since there is no point in reading the DOM data if we are then going
                     * to replace it with Ajax data
                     */
                    _fnAddTr(oSettings, $(oSettings.nTBody).children('tr'));
                }

                /* Copy the data index array */
                oSettings.aiDisplay = oSettings.aiDisplayMaster.slice();

                /* Initialisation complete - table can be drawn */
                oSettings.bInitialised = true;

                /* Check if we need to initialise the table (it might not have been handed off to the
                 * language processor)
                 */
                if (bInitHandedOff === false) {
                    _fnInitialise(oSettings);
                }
            });
            _that = null;
            return this;
        };

        var __apiStruct = [];
        var __arrayProto = Array.prototype;
        var _toSettings = function (mixed) {
            var idx, jq;
            var settings = DataTable.settings;
            var tables = $.map(settings, function (el, i) {
                return el.nTable;
            });

            if (!mixed) {
                return [];
            } else if (mixed.nTable && mixed.oApi) {
                // DataTables settings object
                return [mixed];
            } else if (mixed.nodeName && mixed.nodeName.toLowerCase() === 'table') {
                // Table node
                idx = $.inArray(mixed, tables);
                return idx !== -1 ? [settings[idx]] : null;
            } else if (mixed && typeof mixed.settings === 'function') {
                return mixed.settings().toArray();
            } else if (typeof mixed === 'string') {
                // jQuery selector
                jq = $(mixed);
            } else if (mixed instanceof $) {
                // jQuery object (also DataTables instance)
                jq = mixed;
            }

            if (jq) {
                return jq.map(function (i) {
                    idx = $.inArray(this, tables);
                    return idx !== -1 ? settings[idx] : null;
                }).toArray();
            }
        };

        _Api = function (context, data) {
            if (!(this instanceof _Api)) {
                return new _Api(context, data);
            }

            var settings = [];
            var ctxSettings = function (o) {
                var a = _toSettings(o);
                if (a) {
                    settings.push.apply(settings, a);
                }
            };

            if ($.isArray(context)) {
                for (var i = 0, ien = context.length; i < ien; i++) {
                    ctxSettings(context[i]);
                }
            } else {
                ctxSettings(context);
            }

            // Remove duplicates
            this.context = _unique(settings);

            // Initial data
            if (data) {
                this.push.apply(this, data.toArray ? data.toArray() : data);
            }

            // selector
            this.selector = {
                rows: null,
                cols: null,
                opts: null
            };

            _Api.extend(this, this, __apiStruct);
        };

        DataTable.Api = _Api;

        _Api.prototype = /** @lends DataTables.Api */{
            any: function ()  {
                return this.count() !== 0;
            },
            concat: __arrayProto.concat,
            context: [], // array of table settings objects

            count: function () {
                return this.flatten().length;
            },
            each: function (fn) {
                for (var i = 0, ien = this.length; i < ien; i++) {
                    fn.call(this, this[i], i, this);
                }

                return this;
            },
            eq: function (idx) {
                var ctx = this.context;

                return ctx.length > idx ?
                        new _Api(ctx[idx], this[idx]) :
                        null;
            },
            filter: function (fn) {
                var a = [];

                if (__arrayProto.filter) {
                    a = __arrayProto.filter.call(this, fn, this);
                }
                else {
                    // Compatibility for browsers without EMCA-252-5 (JS 1.6)
                    for (var i = 0, ien = this.length; i < ien; i++) {
                        if (fn.call(this, this[i], i, this)) {
                            a.push(this[i]);
                        }
                    }
                }

                return new _Api(this.context, a);
            },
            flatten: function () {
                var a = [];
                return new _Api(this.context, a.concat.apply(a, this.toArray()));
            },
            join: __arrayProto.join,
            indexOf: __arrayProto.indexOf || function (obj, start) {
                for (var i = (start || 0), ien = this.length; i < ien; i++) {
                    if (this[i] === obj) {
                        return i;
                    }
                }
                return -1;
            },
            iterator: function (flatten, type, fn, alwaysNew) {
                var
                        a = [], ret,
                        i, ien, j, jen,
                        context = this.context,
                        rows, items, item,
                        selector = this.selector;

                // Argument shifting
                if (typeof flatten === 'string') {
                    alwaysNew = fn;
                    fn = type;
                    type = flatten;
                    flatten = false;
                }

                for (i = 0, ien = context.length; i < ien; i++) {
                    var apiInst = new _Api(context[i]);

                    if (type === 'table') {
                        ret = fn.call(apiInst, context[i], i);

                        if (ret !== undefined) {
                            a.push(ret);
                        }
                    } else if (type === 'columns' || type === 'rows') {
                        // this has same length as context - one entry for each table
                        ret = fn.call(apiInst, context[i], this[i], i);

                        if (ret !== undefined) {
                            a.push(ret);
                        }
                    } else if (type === 'column' || type === 'column-rows' || type === 'row' || type === 'cell') {
                        // columns and rows share the same structure.
                        // 'this' is an array of column indexes for each context
                        items = this[i];

                        if (type === 'column-rows') {
                            rows = _selector_row_indexes(context[i], selector.opts);
                        }

                        for (j = 0, jen = items.length; j < jen; j++) {
                            item = items[j];

                            if (type === 'cell') {
                                ret = fn.call(apiInst, context[i], item.row, item.column, i, j);
                            } else {
                                ret = fn.call(apiInst, context[i], item, i, j, rows);
                            }

                            if (ret !== undefined) {
                                a.push(ret);
                            }
                        }
                    }
                }

                if (a.length || alwaysNew) {
                    var api = new _Api(context, flatten ? a.concat.apply([], a) : a);
                    var apiSelector = api.selector;
                    apiSelector.rows = selector.rows;
                    apiSelector.cols = selector.cols;
                    apiSelector.opts = selector.opts;
                    return api;
                }
                return this;
            },
            lastIndexOf: __arrayProto.lastIndexOf || function (obj, start) {
                // Bit cheeky...
                return this.indexOf.apply(this.toArray.reverse(), arguments);
            },
            length:0,
            map: function (fn) {
                var a = [];

                if (__arrayProto.map) {
                    a = __arrayProto.map.call(this, fn, this);
                } else {
                    // Compatibility for browsers without EMCA-252-5 (JS 1.6)
                    for (var i = 0, ien = this.length; i < ien; i++) {
                        a.push(fn.call(this, this[i], i));
                    }
                }

                return new _Api(this.context, a);
            },
            pluck: function (prop) {
                return this.map(function (el) {
                    return el[ prop ];
                });
            },
            pop: __arrayProto.pop,
            push: __arrayProto.push,
            // Does not return an API instance
            reduce: __arrayProto.reduce || function (fn, init) {
                return _fnReduce(this, fn, init, 0, this.length, 1);
            },
            reduceRight: __arrayProto.reduceRight || function (fn, init) {
                return _fnReduce(this, fn, init, this.length - 1, -1, -1);
            },
            reverse: __arrayProto.reverse,
            // Object with rows, columns and opts
            selector: null,
            shift: __arrayProto.shift,
            sort: __arrayProto.sort, // ? name - order?

            splice: __arrayProto.splice,
            toArray: function () {
                return __arrayProto.slice.call(this);
            },
            to$: function () {
                return $(this);
            },
            toJQuery: function () {
                return $(this);
            },
            unique: function () {
                return new _Api(this.context, _unique(this));
            },
            unshift: __arrayProto.unshift
        };

        _Api.extend = function (scope, obj, ext) {
            // Only extend API instances and static properties of the API
            if (!ext.length || !obj || (!(obj instanceof _Api) && !obj.__dt_wrapper)) {
                return;
            }

            var
                    i, ien,
                    j, jen,
                    struct, inner,
                    methodScoping = function (scope, fn, struc) {
                        return function () {
                            var ret = fn.apply(scope, arguments);

                            // Method extension
                            _Api.extend(ret, ret, struc.methodExt);
                            return ret;
                        };
                    };

            for (i = 0, ien = ext.length; i < ien; i++) {
                struct = ext[i];

                // Value
                obj[ struct.name ] = typeof struct.val === 'function' ?
                        methodScoping(scope, struct.val, struct) :
                        $.isPlainObject(struct.val) ?
                        {} :
                        struct.val;

                obj[ struct.name ].__dt_wrapper = true;

                // Property extension
                _Api.extend(scope, obj[ struct.name ], struct.propExt);
            }
        };

        _Api.register = _api_register = function (name, val) {
            if ($.isArray(name)) {
                for (var j = 0, jen = name.length; j < jen; j++) {
                    _Api.register(name[j], val);
                }
                return;
            }

            var
                    i, ien,
                    heir = name.split('.'),
                    struct = __apiStruct,
                    key, method;

            var find = function (src, name) {
                for (var i = 0, ien = src.length; i < ien; i++) {
                    if (src[i].name === name) {
                        return src[i];
                    }
                }
                return null;
            };

            for (i = 0, ien = heir.length; i < ien; i++) {
                method = heir[i].indexOf('()') !== -1;
                key = method ?
                        heir[i].replace('()', '') :
                        heir[i];

                var src = find(struct, key);
                if (!src) {
                    src = {
                        name: key,
                        val: {},
                        methodExt: [],
                        propExt: []
                    };
                    struct.push(src);
                }

                if (i === ien - 1) {
                    src.val = val;
                } else {
                    struct = method ?
                            src.methodExt :
                            src.propExt;
                }
            }
        };

        _Api.registerPlural = _api_registerPlural = function (pluralName, singularName, val) {
            _Api.register(pluralName, val);

            _Api.register(singularName, function () {
                var ret = val.apply(this, arguments);

                if (ret === this) {
                    // Returned item is the API instance that was passed in, return it
                    return this;
                } else if (ret instanceof _Api) {
                    // New API instance returned, want the value from the first item
                    // in the returned array for the singular result.
                    return ret.length ?
                            $.isArray(ret[0]) ?
                            new _Api(ret.context, ret[0]) : // Array results are 'enhanced'
                            ret[0] :
                            undefined;
                }

                // Non-API return - just fire it back
                return ret;
            });
        };

        /**
         * Selector for HTML tables. Apply the given selector to the give array of
         * DataTables settings objects.
         *
         * @param {string|integer} [selector] jQuery selector string or integer
         * @param  {array} Array of DataTables settings objects to be filtered
         * @return {array}
         * @ignore
         */
        var __table_selector = function (selector, a) {
            // Integer is used to pick out a table by index
            if (typeof selector === 'number') {
                return [a[ selector ]];
            }

            // Perform a jQuery selector on the table nodes
            var nodes = $.map(a, function (el, i) {
                return el.nTable;
            });

            return $(nodes)
                    .filter(selector)
                    .map(function (i) {
                        // Need to translate back from the table node to the settings
                        var idx = $.inArray(this, nodes);
                        return a[ idx ];
                    })
                    .toArray();
        };

        /**
         * Context selector for the API's context (i.e. the tables the API instance
         * refers to.
         *
         * @name    DataTable.Api#tables
         * @param {string|integer} [selector] Selector to pick which tables the iterator
         *   should operate on. If not given, all tables in the current context are
         *   used. This can be given as a jQuery selector (for example `':gt(0)'`) to
         *   select multiple tables or as an integer to select a single table.
         * @returns {DataTable.Api} Returns a new API instance if a selector is given.
         */
        _api_register('tables()', function (selector) {
            // A new instance is created if there was a selector specified
            return selector ?
                    new _Api(__table_selector(selector, this.context)) :
                    this;
        });

        _api_register('table()', function (selector) {
            var tables = this.tables(selector);
            var ctx = tables.context;

            // Truncate to the first matched table
            return ctx.length ?
                    new _Api(ctx[0]) :
                    tables;
        });

        _api_registerPlural('tables().nodes()', 'table().node()', function () {
            return this.iterator('table', function (ctx) {
                return ctx.nTable;
            }, 1);
        });

        _api_registerPlural('tables().body()', 'table().body()', function () {
            return this.iterator('table', function (ctx) {
                return ctx.nTBody;
            }, 1);
        });

        _api_registerPlural('tables().header()', 'table().header()', function () {
            return this.iterator('table', function (ctx) {
                return ctx.nTHead;
            }, 1);
        });

        _api_registerPlural('tables().footer()', 'table().footer()', function () {
            return this.iterator('table', function (ctx) {
                return ctx.nTFoot;
            }, 1);
        });

        _api_registerPlural('tables().containers()', 'table().container()', function () {
            return this.iterator('table', function (ctx) {
                return ctx.nTableWrapper;
            }, 1);
        });

        /**
         * Redraw the tables in the current context.
         *
         * @param {boolean} [reset=true] Reset (default) or hold the current paging
         *   position. A full re-sort and re-filter is performed when this method is
         *   called, which is why the pagination reset is the default action.
         * @returns {DataTables.Api} this
         */
        _api_register('draw()', function (resetPaging) {
            return this.iterator('table', function (settings) {
                _fnReDraw(settings, resetPaging === false);
            });
        });

        _api_register('page()', function (action) {
            if (action === undefined) {
                return this.page.info().page; // not an expensive call
            }

            // else, have an action to take on all tables
            return this.iterator('table', function (settings) {
                _fnPageChange(settings, action);
            });
        });

        _api_register('page.info()', function (action) {
            if (this.context.length === 0) {
                return undefined;
            }

            var
                    settings = this.context[0],
                    start = settings._iDisplayStart,
                    len = settings._iDisplayLength,
                    visRecords = settings.fnRecordsDisplay(),
                    all = len === -1;

            return {
                "page": all ? 0 : Math.floor(start / len),
                "pages": all ? 1 : Math.ceil(visRecords / len),
                "start": start,
                "end": settings.fnDisplayEnd(),
                "length": len,
                "recordsTotal": settings.fnRecordsTotal(),
                "recordsDisplay": visRecords
            };
        });

        _api_register('page.len()', function (len) {
            // Note that we can't call this function 'length()' because `length`
            // is a Javascript property of functions which defines how many arguments
            // the function expects.
            if (len === undefined) {
                return this.context.length !== 0 ?
                        this.context[0]._iDisplayLength :
                        undefined;
            }

            // else, set the page length
            return this.iterator('table', function (settings) {
                _fnLengthChange(settings, len);
            });
        });

        var __reload = function (settings, holdPosition, callback) {
            // Use the draw event to trigger a callback
            if (callback) {
                var api = new _Api(settings);

                api.one('draw', function () {
                    callback(api.ajax.json());
                });
            }

            if (_fnDataSource(settings) == 'ssp') {
                _fnReDraw(settings, holdPosition);
            } else {
                _fnProcessingDisplay(settings, true);

                // Cancel an existing request
                var xhr = settings.jqXHR;
                if (xhr && xhr.readyState !== 4) {
                    xhr.abort();
                }

                // Trigger xhr
                _fnBuildAjax(settings, [], function (json) {
                    _fnClearTable(settings);

                    var data = _fnAjaxDataSrc(settings, json);
                    for (var i = 0, ien = data.length; i < ien; i++) {
                        _fnAddData(settings, data[i]);
                    }

                    _fnReDraw(settings, holdPosition);
                    _fnProcessingDisplay(settings, false);
                });
            }
        };

        _api_register('ajax.json()', function () {
            var ctx = this.context;

            if (ctx.length > 0) {
                return ctx[0].json;
            }

            // else return undefined;
        });

        _api_register('ajax.params()', function () {
            var ctx = this.context;

            if (ctx.length > 0) {
                return ctx[0].oAjaxData;
            }

            // else return undefined;
        });

        _api_register('ajax.reload()', function (callback, resetPaging) {
            return this.iterator('table', function (settings) {
                __reload(settings, resetPaging === false, callback);
            });
        });

        _api_register('ajax.url()', function (url) {
            var ctx = this.context;

            if (url === undefined) {
                // get
                if (ctx.length === 0) {
                    return undefined;
                }
                ctx = ctx[0];

                return ctx.ajax ?
                        $.isPlainObject(ctx.ajax) ?
                        ctx.ajax.url :
                        ctx.ajax :
                        ctx.sAjaxSource;
            }

            // set
            return this.iterator('table', function (settings) {
                if ($.isPlainObject(settings.ajax)) {
                    settings.ajax.url = url;
                }
                else {
                    settings.ajax = url;
                }
                // No need to consider sAjaxSource here since DataTables gives priority
                // to `ajax` over `sAjaxSource`. So setting `ajax` here, renders any
                // value of `sAjaxSource` redundant.
            });
        });

        _api_register('ajax.url().load()', function (callback, resetPaging) {
            // Same as a reload, but makes sense to present it for easy access after a
            // url change
            return this.iterator('table', function (ctx) {
                __reload(ctx, resetPaging === false, callback);
            });
        });

        var _selector_run = function (type, selector, selectFn, settings, opts) {
            var
                    out = [], res,
                    a, i, ien, j, jen,
                    selectorType = typeof selector;

            // Can't just check for isArray here, as an API or jQuery instance might be
            // given with their array like look
            if (!selector || selectorType === 'string' || selectorType === 'function' || selector.length === undefined) {
                selector = [selector];
            }

            for (i = 0, ien = selector.length; i < ien; i++) {
                a = selector[i] && selector[i].split ?
                        selector[i].split(',') :
                        [selector[i]];

                for (j = 0, jen = a.length; j < jen; j++) {
                    res = selectFn(typeof a[j] === 'string' ? $.trim(a[j]) : a[j]);

                    if (res && res.length) {
                        out.push.apply(out, res);
                    }
                }
            }

            // selector extensions
            var ext = _ext.selector[ type ];
            if (ext.length) {
                for (i = 0, ien = ext.length; i < ien; i++) {
                    out = ext[i](settings, opts, out);
                }
            }

            return out;
        };

        var _selector_opts = function (opts) {
            if (!opts) {
                opts = {};
            }

            // Backwards compatibility for 1.9- which used the terminology filter rather
            // than search
            if (opts.filter && opts.search === undefined) {
                opts.search = opts.filter;
            }

            return $.extend({
                search: 'none',
                order: 'current',
                page: 'all'
            }, opts);
        };

        var _selector_first = function (inst) {
            // Reduce the API instance to the first item found
            for (var i = 0, ien = inst.length; i < ien; i++) {
                if (inst[i].length > 0) {
                    // Assign the first element to the first item in the instance
                    // and truncate the instance and context
                    inst[0] = inst[i];
                    inst[0].length = 1;
                    inst.length = 1;
                    inst.context = [inst.context[i]];

                    return inst;
                }
            }

            // Not found - return an empty instance
            inst.length = 0;
            return inst;
        };

        var _selector_row_indexes = function (settings, opts) {
            var
                    i, ien, tmp, a = [],
                    displayFiltered = settings.aiDisplay,
                    displayMaster = settings.aiDisplayMaster;

            var
                    search = opts.search, // none, applied, removed
                    order = opts.order, // applied, current, index (original - compatibility with 1.9)
                    page = opts.page;    // all, current

            if (_fnDataSource(settings) == 'ssp') {
                // In server-side processing mode, most options are irrelevant since
                // rows not shown don't exist and the index order is the applied order
                // Removed is a special case - for consistency just return an empty
                // array
                return search === 'removed' ?
                        [] :
                        _range(0, displayMaster.length);
            } else if (page == 'current') {
                // Current page implies that order=current and fitler=applied, since it is
                // fairly senseless otherwise, regardless of what order and search actually
                // are
                for (i = settings._iDisplayStart, ien = settings.fnDisplayEnd(); i < ien; i++) {
                    a.push(displayFiltered[i]);
                }
            } else if (order == 'current' || order == 'applied') {
                a = search == 'none' ?
                        displayMaster.slice() : // no search
                        search == 'applied' ?
                        displayFiltered.slice() : // applied search
                        $.map(displayMaster, function (el, i) { // removed search
                            return $.inArray(el, displayFiltered) === -1 ? el : null;
                        });
            } else if (order == 'index' || order == 'original') {
                for (i = 0, ien = settings.aoData.length; i < ien; i++) {
                    if (search == 'none') {
                        a.push(i);
                    } else { // applied | removed
                        tmp = $.inArray(i, displayFiltered);

                        if ((tmp === -1 && search == 'removed') || (tmp >= 0 && search == 'applied')) {
                            a.push(i);
                        }
                    }
                }
            }

            return a;
        };

        var __row_selector = function (settings, selector, opts) {
            var run = function (sel) {
                var selInt = _intVal(sel);
                var i, ien;

                // Short cut - selector is a number and no options provided (default is
                // all records, so no need to check if the index is in there, since it
                // must be - dev error if the index doesn't exist).
                if (selInt !== null && !opts) {
                    return [selInt];
                }

                var rows = _selector_row_indexes(settings, opts);

                if (selInt !== null && $.inArray(selInt, rows) !== -1) {
                    // Selector - integer
                    return [selInt];
                }
                else if (!sel) {
                    // Selector - none
                    return rows;
                }

                // Selector - function
                if (typeof sel === 'function') {
                    return $.map(rows, function (idx) {
                        var row = settings.aoData[ idx ];
                        return sel(idx, row._aData, row.nTr) ? idx : null;
                    });
                }

                // Get nodes in the order from the `rows` array with null values removed
                var nodes = _removeEmpty(
                        _pluck_order(settings.aoData, rows, 'nTr')
                        );

                // Selector - node
                if (sel.nodeName) {
                    if ($.inArray(sel, nodes) !== -1) {
                        return [sel._DT_RowIndex]; // sel is a TR node that is in the table
                        // and DataTables adds a prop for fast lookup
                    }
                }

                // Selector - jQuery selector string, array of nodes or jQuery object/
                // As jQuery's .filter() allows jQuery objects to be passed in filter,
                // it also allows arrays, so this will cope with all three options
                return $(nodes)
                        .filter(sel)
                        .map(function () {
                            return this._DT_RowIndex;
                        })
                        .toArray();
            };

            return _selector_run('row', selector, run, settings, opts);
        };

        _api_register('rows()', function (selector, opts) {
            // argument shifting
            if (selector === undefined) {
                selector = '';
            }
            else if ($.isPlainObject(selector)) {
                opts = selector;
                selector = '';
            }

            opts = _selector_opts(opts);

            var inst = this.iterator('table', function (settings) {
                return __row_selector(settings, selector, opts);
            }, 1);

            // Want argument shifting here and in __row_selector?
            inst.selector.rows = selector;
            inst.selector.opts = opts;

            return inst;
        });

        _api_register('rows().nodes()', function () {
            return this.iterator('row', function (settings, row) {
                return settings.aoData[ row ].nTr || undefined;
            }, 1);
        });

        _api_register('rows().data()', function () {
            return this.iterator(true, 'rows', function (settings, rows) {
                return _pluck_order(settings.aoData, rows, '_aData');
            }, 1);
        });

        _api_registerPlural('rows().cache()', 'row().cache()', function (type) {
            return this.iterator('row', function (settings, row) {
                var r = settings.aoData[ row ];
                return type === 'search' ? r._aFilterData : r._aSortData;
            }, 1);
        });

        _api_registerPlural('rows().invalidate()', 'row().invalidate()', function (src) {
            return this.iterator('row', function (settings, row) {
                _fnInvalidate(settings, row, src);
            });
        });

        _api_registerPlural('rows().indexes()', 'row().index()', function () {
            return this.iterator('row', function (settings, row) {
                return row;
            }, 1);
        });

        _api_registerPlural('rows().ids()', 'row().id()', function (hash) {
            return this.iterator('row', function (settings, row) {
                return (hash ? '#' : '') + settings.rowId(settings.aoData[ row ]._aData);
            }, 1);
        });

        _api_registerPlural('rows().remove()', 'row().remove()', function () {
            var that = this;

            return this.iterator('row', function (settings, row, thatIdx) {
                var data = settings.aoData;

                data.splice(row, 1);

                // Update the _DT_RowIndex parameter on all rows in the table
                for (var i = 0, ien = data.length; i < ien; i++) {
                    if (data[i].nTr !== null) {
                        data[i].nTr._DT_RowIndex = i;
                    }
                }

                // Remove the target row from the search array
                var displayIndex = $.inArray(row, settings.aiDisplay);

                // Delete from the display arrays
                _fnDeleteIndex(settings.aiDisplayMaster, row);
                _fnDeleteIndex(settings.aiDisplay, row);
                _fnDeleteIndex(that[ thatIdx ], row, false); // maintain local indexes

                // Check for an 'overflow' they case for displaying the table
                _fnLengthOverflow(settings);
            });
        });

        _api_register('rows.add()', function (rows) {
            var newRows = this.iterator('table', function (settings) {
                var row, i, ien;
                var out = [];

                for (i = 0, ien = rows.length; i < ien; i++) {
                    row = rows[i];

                    if (row.nodeName && row.nodeName.toUpperCase() === 'TR') {
                        out.push(_fnAddTr(settings, row)[0]);
                    }
                    else {
                        out.push(_fnAddData(settings, row));
                    }
                }

                return out;
            }, 1);

            // Return an Api.rows() extended instance, so rows().nodes() etc can be used
            var modRows = this.rows(-1);
            modRows.pop();
            modRows.push.apply(modRows, newRows.toArray());

            return modRows;
        });

        /**
         *
         */
        _api_register('row()', function (selector, opts) {
            return _selector_first(this.rows(selector, opts));
        });

        _api_register('row().data()', function (data) {
            var ctx = this.context;

            if (data === undefined) {
                // Get
                return ctx.length && this.length ?
                        ctx[0].aoData[ this[0] ]._aData :
                        undefined;
            }

            // Set
            ctx[0].aoData[ this[0] ]._aData = data;

            // Automatically invalidate
            _fnInvalidate(ctx[0], this[0], 'data');

            return this;
        });

        _api_register('row().node()', function () {
            var ctx = this.context;

            return ctx.length && this.length ?
                    ctx[0].aoData[ this[0] ].nTr || null :
                    null;
        });

        _api_register('row.add()', function (row) {
            // Allow a jQuery object to be passed in - only a single row is added from
            // it though - the first element in the set
            if (row instanceof $ && row.length) {
                row = row[0];
            }

            var rows = this.iterator('table', function (settings) {
                if (row.nodeName && row.nodeName.toUpperCase() === 'TR') {
                    return _fnAddTr(settings, row)[0];
                }
                return _fnAddData(settings, row);
            });

            // Return an Api.rows() extended instance, with the newly added row selected
            return this.row(rows[0]);
        });

        var __details_add = function (ctx, row, data, klass) {
            // Convert to array of TR elements
            var rows = [];
            var addRow = function (r, k) {
                // Recursion to allow for arrays of jQuery objects
                if ($.isArray(r) || r instanceof $) {
                    for (var i = 0, ien = r.length; i < ien; i++) {
                        addRow(r[i], k);
                    }
                    return;
                }

                // If we get a TR element, then just add it directly - up to the dev
                // to add the correct number of columns etc
                if (r.nodeName && r.nodeName.toLowerCase() === 'tr') {
                    rows.push(r);
                }
                else {
                    // Otherwise create a row with a wrapper
                    var created = $('<tr><td/></tr>').addClass(k);
                    $('td', created)
                            .addClass(k)
                            .html(r)
                            [0].colSpan = _fnVisbleColumns(ctx);

                    rows.push(created[0]);
                }
            };

            addRow(data, klass);

            if (row._details) {
                row._details.remove();
            }

            row._details = $(rows);

            // If the children were already shown, that state should be retained
            if (row._detailsShow) {
                row._details.insertAfter(row.nTr);
            }
        };

        var __details_remove = function (api, idx) {
            var ctx = api.context;

            if (ctx.length) {
                var row = ctx[0].aoData[ idx !== undefined ? idx : api[0] ];

                if (row._details) {
                    row._details.remove();

                    row._detailsShow = undefined;
                    row._details = undefined;
                }
            }
        };

        var __details_display = function (api, show) {
            var ctx = api.context;

            if (ctx.length && api.length) {
                var row = ctx[0].aoData[ api[0] ];

                if (row._details) {
                    row._detailsShow = show;

                    if (show) {
                        row._details.insertAfter(row.nTr);
                    }
                    else {
                        row._details.detach();
                    }

                    __details_events(ctx[0]);
                }
            }
        };

        var __details_events = function (settings) {
            var api = new _Api(settings);
            var namespace = '.dt.DT_details';
            var drawEvent = 'draw' + namespace;
            var colvisEvent = 'column-visibility' + namespace;
            var destroyEvent = 'destroy' + namespace;
            var data = settings.aoData;

            api.off(drawEvent + ' ' + colvisEvent + ' ' + destroyEvent);

            if (_pluck(data, '_details').length > 0) {
                // On each draw, insert the required elements into the document
                api.on(drawEvent, function (e, ctx) {
                    if (settings !== ctx) {
                        return;
                    }

                    api.rows({page: 'current'}).eq(0).each(function (idx) {
                        // Internal data grab
                        var row = data[ idx ];

                        if (row._detailsShow) {
                            row._details.insertAfter(row.nTr);
                        }
                    });
                });

                // Column visibility change - update the colspan
                api.on(colvisEvent, function (e, ctx, idx, vis) {
                    if (settings !== ctx) {
                        return;
                    }

                    // Update the colspan for the details rows (note, only if it already has
                    // a colspan)
                    var row, visible = _fnVisbleColumns(ctx);

                    for (var i = 0, ien = data.length; i < ien; i++) {
                        row = data[i];

                        if (row._details) {
                            row._details.children('td[colspan]').attr('colspan', visible);
                        }
                    }
                });

                // Table destroyed - nuke any child rows
                api.on(destroyEvent, function (e, ctx) {
                    if (settings !== ctx) {
                        return;
                    }

                    for (var i = 0, ien = data.length; i < ien; i++) {
                        if (data[i]._details) {
                            __details_remove(api, i);
                        }
                    }
                });
            }
        };

        // Strings for the method names to help minification
        var _emp = '';
        var _child_obj = _emp + 'row().child';
        var _child_mth = _child_obj + '()';

        // data can be:
        //  tr
        //  string
        //  jQuery or array of any of the above
        _api_register(_child_mth, function (data, klass) {
            var ctx = this.context;

            if (data === undefined) {
                // get
                return ctx.length && this.length ?
                        ctx[0].aoData[ this[0] ]._details :
                        undefined;
            } else if (data === true) {
                // show
                this.child.show();
            } else if (data === false) {
                // remove
                __details_remove(this);
            } else if (ctx.length && this.length) {
                // set
                __details_add(ctx[0], ctx[0].aoData[ this[0] ], data, klass);
            }

            return this;
        });

        _api_register([
            _child_obj + '.show()',
            _child_mth + '.show()' // only when `child()` was called with parameters (without
        ], function (show) {   // it returns an object and this method is not executed)
            __details_display(this, true);
            return this;
        });

        _api_register([
            _child_obj + '.hide()',
            _child_mth + '.hide()' // only when `child()` was called with parameters (without
        ], function () {         // it returns an object and this method is not executed)
            __details_display(this, false);
            return this;
        });

        _api_register([
            _child_obj + '.remove()',
            _child_mth + '.remove()' // only when `child()` was called with parameters (without
        ], function () {           // it returns an object and this method is not executed)
            __details_remove(this);
            return this;
        });

        _api_register(_child_obj + '.isShown()', function () {
            var ctx = this.context;

            if (ctx.length && this.length) {
                // _detailsShown as false or undefined will fall through to return false
                return ctx[0].aoData[ this[0] ]._detailsShow || false;
            }
            return false;
        });

        var __re_column_selector = /^(.+):(name|visIdx|visible)$/;

        // r1 and r2 are redundant - but it means that the parameters match for the
        // iterator callback in columns().data()
        var __columnData = function (settings, column, r1, r2, rows) {
            var a = [];
            for (var row = 0, ien = rows.length; row < ien; row++) {
                a.push(_fnGetCellData(settings, rows[row], column));
            }
            return a;
        };

        var __column_selector = function (settings, selector, opts) {
            var
                    columns = settings.aoColumns,
                    names = _pluck(columns, 'sName'),
                    nodes = _pluck(columns, 'nTh');

            var run = function (s) {
                var selInt = _intVal(s);

                // Selector - all
                if (s === '') {
                    return _range(columns.length);
                }

                // Selector - index
                if (selInt !== null) {
                    return [selInt >= 0 ?
                                selInt : // Count from left
                                columns.length + selInt // Count from right (+ because its a negative value)
                    ];
                }

                // Selector = function
                if (typeof s === 'function') {
                    var rows = _selector_row_indexes(settings, opts);

                    return $.map(columns, function (col, idx) {
                        return s(
                                idx,
                                __columnData(settings, idx, 0, 0, rows),
                                nodes[ idx ]
                                ) ? idx : null;
                    });
                }

                // jQuery or string selector
                var match = typeof s === 'string' ?
                        s.match(__re_column_selector) :
                        '';

                if (match) {
                    switch (match[2]) {
                        case 'visIdx':
                        case 'visible':
                            var idx = parseInt(match[1], 10);
                            // Visible index given, convert to column index
                            if (idx < 0) {
                                // Counting from the right
                                var visColumns = $.map(columns, function (col, i) {
                                    return col.bVisible ? i : null;
                                });
                                return [visColumns[ visColumns.length + idx ]];
                            }
                            // Counting from the left
                            return [_fnVisibleToColumnIndex(settings, idx)];

                        case 'name':
                            // match by name. `names` is column index complete and in order
                            return $.map(names, function (name, i) {
                                return name === match[1] ? i : null;
                            });
                    }
                }
                else {
                    // jQuery selector on the TH elements for the columns
                    return $(nodes)
                            .filter(s)
                            .map(function () {
                                return $.inArray(this, nodes); // `nodes` is column index complete and in order
                            })
                            .toArray();
                }
            };

            return _selector_run('column', selector, run, settings, opts);
        };

        var __setColumnVis = function (settings, column, vis, recalc) {
            var
                    cols = settings.aoColumns,
                    col = cols[ column ],
                    data = settings.aoData,
                    row, cells, i, ien, tr;

            // Get
            if (vis === undefined) {
                return col.bVisible;
            }

            // Set
            // No change
            if (col.bVisible === vis) {
                return;
            }

            if (vis) {
                // Insert column
                // Need to decide if we should use appendChild or insertBefore
                var insertBefore = $.inArray(true, _pluck(cols, 'bVisible'), column + 1);

                for (i = 0, ien = data.length; i < ien; i++) {
                    tr = data[i].nTr;
                    cells = data[i].anCells;

                    if (tr) {
                        // insertBefore can act like appendChild if 2nd arg is null
                        tr.insertBefore(cells[ column ], cells[ insertBefore ] || null);
                    }
                }
            }
            else {
                // Remove column
                $(_pluck(settings.aoData, 'anCells', column)).detach();
            }

            // Common actions
            col.bVisible = vis;
            _fnDrawHead(settings, settings.aoHeader);
            _fnDrawHead(settings, settings.aoFooter);

            if (recalc === undefined || recalc) {
                // Automatically adjust column sizing
                _fnAdjustColumnSizing(settings);

                // Realign columns for scrolling
                if (settings.oScroll.sX || settings.oScroll.sY) {
                    _fnScrollDraw(settings);
                }
            }

            _fnCallbackFire(settings, null, 'column-visibility', [settings, column, vis]);

            _fnSaveState(settings);
        };

        _api_register('columns()', function (selector, opts) {
            // argument shifting
            if (selector === undefined) {
                selector = '';
            } else if ($.isPlainObject(selector)) {
                opts = selector;
                selector = '';
            }

            opts = _selector_opts(opts);

            var inst = this.iterator('table', function (settings) {
                return __column_selector(settings, selector, opts);
            }, 1);

            // Want argument shifting here and in _row_selector?
            inst.selector.cols = selector;
            inst.selector.opts = opts;

            return inst;
        });

        _api_registerPlural('columns().header()', 'column().header()', function (selector, opts) {
            return this.iterator('column', function (settings, column) {
                return settings.aoColumns[column].nTh;
            }, 1);
        });

        _api_registerPlural('columns().footer()', 'column().footer()', function (selector, opts) {
            return this.iterator('column', function (settings, column) {
                return settings.aoColumns[column].nTf;
            }, 1);
        });

        _api_registerPlural('columns().data()', 'column().data()', function () {
            return this.iterator('column-rows', __columnData, 1);
        });

        _api_registerPlural('columns().dataSrc()', 'column().dataSrc()', function () {
            return this.iterator('column', function (settings, column) {
                return settings.aoColumns[column].mData;
            }, 1);
        });

        _api_registerPlural('columns().cache()', 'column().cache()', function (type) {
            return this.iterator('column-rows', function (settings, column, i, j, rows) {
                return _pluck_order(settings.aoData, rows,
                        type === 'search' ? '_aFilterData' : '_aSortData', column
                        );
            }, 1);
        });

        _api_registerPlural('columns().nodes()', 'column().nodes()', function () {
            return this.iterator('column-rows', function (settings, column, i, j, rows) {
                return _pluck_order(settings.aoData, rows, 'anCells', column);
            }, 1);
        });

        _api_registerPlural('columns().visible()', 'column().visible()', function (vis, calc) {
            return this.iterator('column', function (settings, column) {
                if (vis === undefined) {
                    return settings.aoColumns[ column ].bVisible;
                } // else
                __setColumnVis(settings, column, vis, calc);
            });
        });

        _api_registerPlural('columns().indexes()', 'column().index()', function (type) {
            return this.iterator('column', function (settings, column) {
                return type === 'visible' ?
                        _fnColumnIndexToVisible(settings, column) :
                        column;
            }, 1);
        });

        _api_register('columns.adjust()', function () {
            return this.iterator('table', function (settings) {
                _fnAdjustColumnSizing(settings);
            }, 1);
        });

        _api_register('column.index()', function (type, idx) {
            if (this.context.length !== 0) {
                var ctx = this.context[0];

                if (type === 'fromVisible' || type === 'toData') {
                    return _fnVisibleToColumnIndex(ctx, idx);
                }
                else if (type === 'fromData' || type === 'toVisible') {
                    return _fnColumnIndexToVisible(ctx, idx);
                }
            }
        });

        _api_register('column()', function (selector, opts) {
            return _selector_first(this.columns(selector, opts));
        });

        var __cell_selector = function (settings, selector, opts) {
            var data = settings.aoData;
            var rows = _selector_row_indexes(settings, opts);
            var cells = _removeEmpty(_pluck_order(data, rows, 'anCells'));
            var allCells = $([].concat.apply([], cells));
            var row;
            var columns = settings.aoColumns.length;
            var a, i, ien, j, o, host;

            var run = function (s) {
                var fnSelector = typeof s === 'function';

                if (s === null || s === undefined || fnSelector) {
                    // All cells and function selectors
                    a = [];

                    for (i = 0, ien = rows.length; i < ien; i++) {
                        row = rows[i];

                        for (j = 0; j < columns; j++) {
                            o = {
                                row: row,
                                column: j
                            };

                            if (fnSelector) {
                                // Selector - function
                                host = settings.aoData[ row ];

                                if (s(o, _fnGetCellData(settings, row, j), host.anCells ? host.anCells[j] : null)) {
                                    a.push(o);
                                }
                            } else {
                                // Selector - all
                                a.push(o);
                            }
                        }
                    }

                    return a;
                }

                // Selector - index
                if ($.isPlainObject(s)) {
                    return [s];
                }

                // Selector - jQuery filtered cells
                return allCells
                        .filter(s)
                        .map(function (i, el) {
                            row = el.parentNode._DT_RowIndex;

                            return {
                                row: row,
                                column: $.inArray(el, data[ row ].anCells)
                            };
                        })
                        .toArray();
            };

            return _selector_run('cell', selector, run, settings, opts);
        };

        _api_register('cells()', function (rowSelector, columnSelector, opts) {
            // Argument shifting
            if ($.isPlainObject(rowSelector)) {
                // Indexes
                if (rowSelector.row === undefined) {
                    // Selector options in first parameter
                    opts = rowSelector;
                    rowSelector = null;
                } else {
                    // Cell index objects in first parameter
                    opts = columnSelector;
                    columnSelector = null;
                }
            }
            if ($.isPlainObject(columnSelector)) {
                opts = columnSelector;
                columnSelector = null;
            }

            // Cell selector
            if (columnSelector === null || columnSelector === undefined) {
                return this.iterator('table', function (settings) {
                    return __cell_selector(settings, rowSelector, _selector_opts(opts));
                });
            }

            // Row + column selector
            var columns = this.columns(columnSelector, opts);
            var rows = this.rows(rowSelector, opts);
            var a, i, ien, j, jen;

            var cells = this.iterator('table', function (settings, idx) {
                a = [];

                for (i = 0, ien = rows[idx].length; i < ien; i++) {
                    for (j = 0, jen = columns[idx].length; j < jen; j++) {
                        a.push({
                            row: rows[idx][i],
                            column: columns[idx][j]
                        });
                    }
                }

                return a;
            }, 1);

            $.extend(cells.selector, {
                cols: columnSelector,
                rows: rowSelector,
                opts: opts
            });

            return cells;
        });

        _api_registerPlural('cells().nodes()', 'cell().node()', function () {
            return this.iterator('cell', function (settings, row, column) {
                var cells = settings.aoData[ row ].anCells;
                return cells ?
                        cells[ column ] :
                        undefined;
            }, 1);
        });

        _api_register('cells().data()', function () {
            return this.iterator('cell', function (settings, row, column) {
                return _fnGetCellData(settings, row, column);
            }, 1);
        });

        _api_registerPlural('cells().cache()', 'cell().cache()', function (type) {
            type = type === 'search' ? '_aFilterData' : '_aSortData';

            return this.iterator('cell', function (settings, row, column) {
                return settings.aoData[ row ][ type ][ column ];
            }, 1);
        });

        _api_registerPlural('cells().render()', 'cell().render()', function (type) {
            return this.iterator('cell', function (settings, row, column) {
                return _fnGetCellData(settings, row, column, type);
            }, 1);
        });

        _api_registerPlural('cells().indexes()', 'cell().index()', function () {
            return this.iterator('cell', function (settings, row, column) {
                return {
                    row: row,
                    column: column,
                    columnVisible: _fnColumnIndexToVisible(settings, column)
                };
            }, 1);
        });

        _api_registerPlural('cells().invalidate()', 'cell().invalidate()', function (src) {
            return this.iterator('cell', function (settings, row, column) {
                _fnInvalidate(settings, row, src, column);
            });
        });

        _api_register('cell()', function (rowSelector, columnSelector, opts) {
            return _selector_first(this.cells(rowSelector, columnSelector, opts));
        });

        _api_register('cell().data()', function (data) {
            var ctx = this.context;
            var cell = this[0];

            if (data === undefined) {
                // Get
                return ctx.length && cell.length ?
                        _fnGetCellData(ctx[0], cell[0].row, cell[0].column) :
                        undefined;
            }

            // Set
            _fnSetCellData(ctx[0], cell[0].row, cell[0].column, data);
            _fnInvalidate(ctx[0], cell[0].row, 'data', cell[0].column);

            return this;
        });

        _api_register('order()', function (order, dir) {
            var ctx = this.context;

            if (order === undefined) {
                // get
                return ctx.length !== 0 ?
                        ctx[0].aaSorting :
                        undefined;
            }

            // set
            if (typeof order === 'number') {
                // Simple column / direction passed in
                order = [[order, dir]];
            }
            else if (!$.isArray(order[0])) {
                // Arguments passed in (list of 1D arrays)
                order = Array.prototype.slice.call(arguments);
            }
            // otherwise a 2D array was passed in

            return this.iterator('table', function (settings) {
                settings.aaSorting = order.slice();
            });
        });

        _api_register('order.listener()', function (node, column, callback) {
            return this.iterator('table', function (settings) {
                _fnSortAttachListener(settings, node, column, callback);
            });
        });

        // Order by the selected column(s)
        _api_register([
            'columns().order()',
            'column().order()'
        ], function (dir) {
            var that = this;

            return this.iterator('table', function (settings, i) {
                var sort = [];

                $.each(that[i], function (j, col) {
                    sort.push([col, dir]);
                });

                settings.aaSorting = sort;
            });
        });

        _api_register('search()', function (input, regex, smart, caseInsen) {
            var ctx = this.context;

            if (input === undefined) {
                // get
                return ctx.length !== 0 ?
                        ctx[0].oPreviousSearch.sSearch :
                        undefined;
            }

            // set
            return this.iterator('table', function (settings) {
                if (!settings.oFeatures.bFilter) {
                    return;
                }

                _fnFilterComplete(settings, $.extend({}, settings.oPreviousSearch, {
                    "sSearch": input + "",
                    "bRegex": regex === null ? false : regex,
                    "bSmart": smart === null ? true : smart,
                    "bCaseInsensitive": caseInsen === null ? true : caseInsen
                }), 1);
            });
        });

        _api_registerPlural(
                'columns().search()',
                'column().search()',
                function (input, regex, smart, caseInsen) {
                    return this.iterator('column', function (settings, column) {
                        var preSearch = settings.aoPreSearchCols;

                        if (input === undefined) {
                            // get
                            return preSearch[ column ].sSearch;
                        }

                        // set
                        if (!settings.oFeatures.bFilter) {
                            return;
                        }

                        $.extend(preSearch[ column ], {
                            "sSearch": input + "",
                            "bRegex": regex === null ? false : regex,
                            "bSmart": smart === null ? true : smart,
                            "bCaseInsensitive": caseInsen === null ? true : caseInsen
                        });

                        _fnFilterComplete(settings, settings.oPreviousSearch, 1);
                    });
                }
        );

        /*
         * State API methods
         */

        _api_register('state()', function () {
            return this.context.length ?
                    this.context[0].oSavedState :
                    null;
        });

        _api_register('state.clear()', function () {
            return this.iterator('table', function (settings) {
                // Save an empty object
                settings.fnStateSaveCallback.call(settings.oInstance, settings, {});
            });
        });

        _api_register('state.loaded()', function () {
            return this.context.length ?
                    this.context[0].oLoadedState :
                    null;
        });

        _api_register('state.save()', function () {
            return this.iterator('table', function (settings) {
                _fnSaveState(settings);
            });
        });

        DataTable.versionCheck = DataTable.fnVersionCheck = function (version) {
            var aThis = DataTable.version.split('.');
            var aThat = version.split('.');
            var iThis, iThat;

            for (var i = 0, iLen = aThat.length; i < iLen; i++) {
                iThis = parseInt(aThis[i], 10) || 0;
                iThat = parseInt(aThat[i], 10) || 0;

                // Parts are the same, keep comparing
                if (iThis === iThat) {
                    continue;
                }

                // Parts are different, return immediately
                return iThis > iThat;
            }

            return true;
        };

        DataTable.isDataTable = DataTable.fnIsDataTable = function (table) {
            var t = $(table).get(0);
            var is = false;

            $.each(DataTable.settings, function (i, o) {
                var head = o.nScrollHead ? $('table', o.nScrollHead)[0] : null;
                var foot = o.nScrollFoot ? $('table', o.nScrollFoot)[0] : null;

                if (o.nTable === t || head === t || foot === t) {
                    is = true;
                }
            });

            return is;
        };

        DataTable.tables = DataTable.fnTables = function (visible) {
            return $.map(DataTable.settings, function (o) {
                if (!visible || (visible && $(o.nTable).is(':visible'))) {
                    return o.nTable;
                }
            });
        };

        DataTable.util = {
            /**
             * Throttle the calls to a function. Arguments and context are maintained
             * for the throttled function.
             *
             * @param {function} fn Function to be called
             * @param {integer} freq Call frequency in mS
             * @return {function} Wrapped function
             */
            throttle: _fnThrottle,
            /**
             * Escape a string such that it can be used in a regular expression
             *
             *  @param {string} sVal string to escape
             *  @returns {string} escaped string
             */
            escapeRegex: _fnEscapeRegex
        };

        DataTable.camelToHungarian = _fnCamelToHungarian;

        _api_register('$()', function (selector, opts) {
            var
                    rows = this.rows(opts).nodes(), // Get all rows
                    jqRows = $(rows);

            return $([].concat(
                    jqRows.filter(selector).toArray(),
                    jqRows.find(selector).toArray()
                    ));
        });

        // jQuery functions to operate on the tables
        $.each(['on', 'one', 'off'], function (i, key) {
            _api_register(key + '()', function ( /* event, handler */ ) {
                var args = Array.prototype.slice.call(arguments);

                // Add the `dt` namespace automatically if it isn't already present
                if (!args[0].match(/\.dt\b/)) {
                    args[0] += '.dt';
                }

                var inst = $(this.tables().nodes());
                inst[key].apply(inst, args);
                return this;
            });
        });

        _api_register('clear()', function () {
            return this.iterator('table', function (settings) {
                _fnClearTable(settings);
            });
        });

        _api_register('settings()', function () {
            return new _Api(this.context, this.context);
        });

        _api_register('init()', function () {
            var ctx = this.context;
            return ctx.length ? ctx[0].oInit : null;
        });

        _api_register('data()', function () {
            return this.iterator('table', function (settings) {
                return _pluck(settings.aoData, '_aData');
            }).flatten();
        });

        _api_register('destroy()', function (remove) {
            remove = remove || false;

            return this.iterator('table', function (settings) {
                var orig = settings.nTableWrapper.parentNode;
                var classes = settings.oClasses;
                var table = settings.nTable;
                var tbody = settings.nTBody;
                var thead = settings.nTHead;
                var tfoot = settings.nTFoot;
                var jqTable = $(table);
                var jqTbody = $(tbody);
                var jqWrapper = $(settings.nTableWrapper);
                var rows = $.map(settings.aoData, function (r) {
                    return r.nTr;
                });
                var i, ien;

                // Flag to note that the table is currently being destroyed - no action
                // should be taken
                settings.bDestroying = true;

                // Fire off the destroy callbacks for plug-ins etc
                _fnCallbackFire(settings, "aoDestroyCallback", "destroy", [settings]);

                // If not being removed from the document, make all columns visible
                if (!remove) {
                    new _Api(settings).columns().visible(true);
                }

                // Blitz all `DT` namespaced events (these are internal events, the
                // lowercase, `dt` events are user subscribed and they are responsible
                // for removing them
                jqWrapper.unbind('.DT').find(':not(tbody *)').unbind('.DT');
                $(window).unbind('.DT-' + settings.sInstance);

                // When scrolling we had to break the table up - restore it
                if (table != thead.parentNode) {
                    jqTable.children('thead').detach();
                    jqTable.append(thead);
                }

                if (tfoot && table != tfoot.parentNode) {
                    jqTable.children('tfoot').detach();
                    jqTable.append(tfoot);
                }

                // Remove the DataTables generated nodes, events and classes
                jqTable.detach();
                jqWrapper.detach();

                settings.aaSorting = [];
                settings.aaSortingFixed = [];
                _fnSortingClasses(settings);

                $(rows).removeClass(settings.asStripeClasses.join(' '));

                $('th, td', thead).removeClass(classes.sSortable + ' ' +
                        classes.sSortableAsc + ' ' + classes.sSortableDesc + ' ' + classes.sSortableNone
                        );

                if (settings.bJUI) {
                    $('th span.' + classes.sSortIcon + ', td span.' + classes.sSortIcon, thead).detach();
                    $('th, td', thead).each(function () {
                        var wrapper = $('div.' + classes.sSortJUIWrapper, this);
                        $(this).append(wrapper.contents());
                        wrapper.detach();
                    });
                }

                if (!remove && orig) {
                    // insertBefore acts like appendChild if !arg[1]
                    orig.insertBefore(table, settings.nTableReinsertBefore);
                }

                // Add the TR elements back into the table in their original order
                jqTbody.children().detach();
                jqTbody.append(rows);

                // Restore the width of the original table - was read from the style property,
                // so we can restore directly to that
                jqTable
                        .css('width', settings.sDestroyWidth)
                        .removeClass(classes.sTable);

                // If the were originally stripe classes - then we add them back here.
                // Note this is not fool proof (for example if not all rows had stripe
                // classes - but it's a good effort without getting carried away
                ien = settings.asDestroyStripes.length;

                if (ien) {
                    jqTbody.children().each(function (i) {
                        $(this).addClass(settings.asDestroyStripes[i % ien]);
                    });
                }

                /* Remove the settings object from the settings array */
                var idx = $.inArray(settings, DataTable.settings);
                if (idx !== -1) {
                    DataTable.settings.splice(idx, 1);
                }
            });
        });

        // Add the `every()` method for rows, columns and cells in a compact form
        $.each(['column', 'row', 'cell'], function (i, type) {
            _api_register(type + 's().every()', function (fn) {
                return this.iterator(type, function (settings, arg1, arg2, arg3, arg4) {
                    // Rows and columns:
                    //  arg1 - index
                    //  arg2 - table counter
                    //  arg3 - loop counter
                    //  arg4 - undefined
                    // Cells:
                    //  arg1 - row index
                    //  arg2 - column index
                    //  arg3 - table counter
                    //  arg4 - loop counter
                    fn.call(
                            new _Api(settings)[ type ](arg1, type === 'cell' ? arg2 : undefined),
                            arg1, arg2, arg3, arg4
                            );
                });
            });
        });

        // i18n method for extensions to be able to use the language object from the
        // DataTable
        _api_register('i18n()', function (token, def, plural) {
            var ctx = this.context[0];
            var resolved = _fnGetObjectDataFn(token)(ctx.oLanguage);

            if (resolved === undefined) {
                resolved = def;
            }

            if (plural !== undefined && $.isPlainObject(resolved)) {
                resolved = resolved[ plural ] !== undefined ?
                        resolved[ plural ] :
                        resolved._;
            }

            return resolved.replace('%d', plural); // nb: plural might be undefined,
        });

        DataTable.version = "1.10.8-dev";

        DataTable.settings = [];

        DataTable.models = {};

        DataTable.models.oSearch = {
            "bCaseInsensitive": true,
            "sSearch": "",
            "bRegex": false,
            "bSmart": true
        };

        DataTable.models.oRow = {
            "nTr": null,
            "anCells": null,
            "_aData": [],
            "_aSortData": null,
            "_aFilterData": null,
            "_sFilterRow": null,
            "_sRowStripe": "",
            "src": null
        };

        DataTable.models.oColumn = {
            "idx": null,
            "aDataSort": null,
            "asSorting": null,
            "bSearchable": null,
            "bSortable": null,
            "bVisible": null,
            "_sManualType": null,
            "_bAttrSrc": false,
            "fnCreatedCell": null,
            "fnGetData": null,
            "fnSetData": null,
            "mData": null,
            "mRender": null,
            "nTh": null,
            "nTf": null,
            "sClass": null,
            "sContentPadding": null,
            "sDefaultContent": null,
            "sName": null,
            "sSortDataType": 'std',
            "sSortingClass": null,
            "sSortingClassJUI": null,
            "sTitle": null,
            "sType": null,
            "sWidth": null,
            "sWidthOrig": null
        };

        DataTable.defaults = {
            "aaData": null,
            "aaSorting": [[0, 'asc']],
            "aaSortingFixed": [],
            "ajax": null,
            "aLengthMenu": [10, 25, 50, 100],
            "aoColumns": null,
            "aoColumnDefs": null,
            "aoSearchCols": [],
            "asStripeClasses": null,
            "bAutoWidth": true,
            "bDeferRender": false,
            "bDestroy": false,
            "bFilter": true,
            "bInfo": true,
            "bJQueryUI": false,
            "bLengthChange": true,
            "bPaginate": true,
            "bProcessing": false,
            "bRetrieve": false,
            "bScrollCollapse": false,
            "bServerSide": false,
            "bSort": true,
            "bSortMulti": true,
            "bSortCellsTop": false,
            "bSortClasses": true,
            "bStateSave": false,
            "fnCreatedRow": null,
            "fnDrawCallback": null,
            "fnFooterCallback": null,
            "fnFormatNumber": function (toFormat) {
                return toFormat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, this.oLanguage.sThousands);
            },
            "fnHeaderCallback": null,
            "fnInfoCallback": null,
            "fnInitComplete": null,
            "fnPreDrawCallback": null,
            "fnRowCallback": null,
            "fnServerData": null,
            "fnServerParams": null,
            "fnStateLoadCallback": function (settings) {
                try {
                    return JSON.parse(
                            (settings.iStateDuration === -1 ? sessionStorage : localStorage).getItem(
                            'DataTables_' + settings.sInstance + '_' + location.pathname
                            )
                            );
                } catch (e) {
                }
            },
            "fnStateLoadParams": null,
            "fnStateLoaded": null,
            "fnStateSaveCallback": function (settings, data) {
                try {
                    (settings.iStateDuration === -1 ? sessionStorage : localStorage).setItem(
                            'DataTables_' + settings.sInstance + '_' + location.pathname,
                            JSON.stringify(data)
                            );
                } catch (e) {
                }
            },
            "fnStateSaveParams": null,
            "iStateDuration": 7200,
            "iDeferLoading": null,
            "iDisplayLength": 10,
            "iDisplayStart":0,
            "iTabIndex":0,
            "oClasses": {},
            "oLanguage": {
                "oAria": {
                    "sSortAscending": ": activate to sort column ascending",
                    "sSortDescending": ": activate to sort column descending"
                },
                "oPaginate": {
                    "sFirst": "First",
                    "sLast": "Last",
                    "sNext": "Next",
                    "sPrevious": "Previous"
                },
                "sEmptyTable": "No data available in table",
                "sInfo": "Showing _START_ to _END_ of _TOTAL_ entries",
                "sInfoEmpty": "Showing 0 to 0 of 0 entries",
                "sInfoFiltered": "(filtered from _MAX_ total entries)",
                "sInfoPostFix": "",
                "sDecimal": "",
                "sThousands": ",",
                "sLengthMenu": "Show _MENU_ entries",
                "sLoadingRecords": "Loading...",
                "sProcessing": "Processing...",
                "sSearch": "Search:",
                "sSearchPlaceholder": "",
                "sUrl": "",
                "sZeroRecords": "No matching records found"
           },
            "oSearch": $.extend({}, DataTable.models.oSearch),
            "sAjaxDataProp": "data",
            "sAjaxSource": null,
            "sDom": "lfrtip",
            "searchDelay": null,
            "sPaginationType": "simple_numbers",
            "sScrollX": "",
            "sScrollXInner": "",
            "sScrollY": "",
            "sServerMethod": "GET",
            "renderer": null,
            "rowId": "DT_RowId"
        };

        _fnHungarianMap(DataTable.defaults);

        /*
         * Developer note - See note in model.defaults.js about the use of Hungarian
         * notation and camel case.
         */

        /**
         * Column options that can be given to DataTables at initialisation time.
         *  @namespace
         */
        DataTable.defaults.column = {
            "aDataSort": null,
            "iDataSort": -1,
            "asSorting": ['asc', 'desc'],
            "bSearchable": true,
            "bSortable": true,
            "bVisible": true,
            "fnCreatedCell": null,
            "mData": null,
            "mRender": null,
            "sCellType": "td",
            "sClass": "",
            "sContentPadding": "",
            "sDefaultContent": null,
            "sName": "",
            "sSortDataType": "std",
            "sTitle": null,
            "sType": null,
            "sWidth": null
        };

        _fnHungarianMap(DataTable.defaults.column);

        /**
         * DataTables settings object - this holds all the information needed for a
         * given table, including configuration, data and current application of the
         * table options. DataTables does not have a single instance for each DataTable
         * with the settings attached to that instance, but rather instances of the
         * DataTable "class" are created on-the-fly as needed (typically by a
         * $().dataTable() call) and the settings object is then applied to that
         * instance.
         *
         * Note that this object is related to {@link DataTable.defaults} but this
         * one is the internal data store for DataTables's cache of columns. It should
         * NOT be manipulated outside of DataTables. Any configuration should be done
         * through the initialisation options.
         *  @namespace
         *  @todo Really should attach the settings object to individual instances so we
         *    don't need to create new instances on each $().dataTable() call (if the
         *    table already exists). It would also save passing oSettings around and
         *    into every single function. However, this is a very significant
         *    architecture change for DataTables and will almost certainly break
         *    backwards compatibility with older installations. This is something that
         *    will be done in 2.0.
         */
        DataTable.models.oSettings = {
            "oFeatures": {
                "bAutoWidth": null,
                "bDeferRender": null,
                "bFilter": null,
                "bInfo": null,
                "bLengthChange": null,
                "bPaginate": null,
                "bProcessing": null,
                "bServerSide": null,
                "bSort": null,
                "bSortMulti": null,
                "bSortClasses": null,
                "bStateSave": null
            },
            "oScroll": {
                "bCollapse": null,
                "iBarWidth": 0,
                "sX": null,
                "sXInner": null,
                "sY": null
            },
            "oLanguage": {
                "fnInfoCallback": null
            },
            "oBrowser": {
                "bScrollOversize": false,
                "bScrollbarLeft": false
            },
            "ajax": null,
            "aanFeatures": [],
            "aoData": [],
            "aiDisplay": [],
            "aiDisplayMaster": [],
            "aoColumns": [],
            "aoHeader": [],
            "aoFooter": [],
            "oPreviousSearch": {},
            "aoPreSearchCols": [],
            "aaSorting": null,
            "aaSortingFixed": [],
            "asStripeClasses": null,
            "asDestroyStripes": [],
            "sDestroyWidth": 0,
            "aoRowCallback": [],
            "aoHeaderCallback": [],
            "aoFooterCallback": [],
            "aoDrawCallback": [],
            "aoRowCreatedCallback": [],
            "aoPreDrawCallback": [],
            "aoInitComplete": [],
            "aoStateSaveParams": [],
            "aoStateLoadParams": [],
            "aoStateLoaded": [],
            "sTableId": "",
            "nTable": null,
            "nTHead": null,
            "nTFoot": null,
            "nTBody": null,
            "nTableWrapper": null,
            "bDeferLoading": false,
            "bInitialised": false,
            "aoOpenRows": [],
            "sDom": null,
            "searchDelay": null,
            "sPaginationType": "two_button",
            "iStateDuration": 0,
            "aoStateSave": [],
            "aoStateLoad": [],
            "oSavedState": null,
            "oLoadedState": null,
            "sAjaxSource": null,
            "sAjaxDataProp": null,
            "bAjaxDataGet": true,
            "jqXHR": null,
            "json": undefined,
            "oAjaxData": undefined,
            "fnServerData": null,
            "aoServerParams": [],
            "sServerMethod": null,
            "fnFormatNumber": null,
            "aLengthMenu": null,
            "iDraw": 0,
            "bDrawing": false,
            "iDrawError": -1,
            "_iDisplayLength": 10,
            "_iDisplayStart": 0,
            "_iRecordsTotal": 0,
            "_iRecordsDisplay": 0,
            "bJUI": null,
            "oClasses": {},
            "bFiltered": false,
            "bSorted": false,
            "bSortCellsTop": null,
            "oInit": null,
            "aoDestroyCallback": [],
            "fnRecordsTotal": function () {
                return _fnDataSource(this) == 'ssp' ? this._iRecordsTotal * 1 : this.aiDisplayMaster.length;
            },
            "fnRecordsDisplay": function () {
                return _fnDataSource(this) == 'ssp' ? this._iRecordsDisplay * 1 : this.aiDisplay.length;
            },
            "fnDisplayEnd": function () {
                var
                        len = this._iDisplayLength,
                        start = this._iDisplayStart,
                        calc = start + len,
                        records = this.aiDisplay.length,
                        features = this.oFeatures,
                        paginate = features.bPaginate;

                if (features.bServerSide) {
                    return paginate === false || len === -1 ? start + records : Math.min(start + len, this._iRecordsDisplay);
                } else {
                    return !paginate || calc > records || len === -1 ? records : calc;
                }
            },
            "oInstance": null,
            "sInstance": null,
            "iTabIndex": 0,
            "nScrollHead": null,
            "nScrollFoot": null,
            "aLastSort": [],
            "oPlugins": {},
            "rowId": null
        };

        /**
         * Extension object for DataTables that is used to provide all extension
         * options.
         *
         * Note that the `DataTable.ext` object is available through
         * `jQuery.fn.dataTable.ext` where it may be accessed and manipulated. It is
         * also aliased to `jQuery.fn.dataTableExt` for historic reasons.
         *  @namespace
         *  @extends DataTable.models.ext
         */

        /**
         * DataTables extensions
         *
         * This namespace acts as a collection area for plug-ins that can be used to
         * extend DataTables capabilities. Indeed many of the build in methods
         * use this method to provide their own capabilities (sorting methods for
         * example).
         *
         * Note that this namespace is aliased to `jQuery.fn.dataTableExt` for legacy
         * reasons
         *
         *  @namespace
         */
        DataTable.ext = _ext = {
            buttons: {},
            classes: {},
            errMode: "alert",
            feature: [],
            search: [],
            selector: {
                cell: [],
                column: [],
                row: []
            },
            internal: {},
            legacy: {
                ajax: null
            },
            pager: {},
            renderer: {
                pageButton: {},
                header: {}
            },
            order: {},
            type: {
                detect: [],
                search: {},
                order: {}
            },
            _unique:0,
            fnVersionCheck: DataTable.fnVersionCheck,
            iApiIndex:0,
            oJUIClasses: {},
            sVersion: DataTable.version
        };

        //
        // Backwards compatibility. Alias to pre 1.10 Hungarian notation counter parts
        //
        $.extend(_ext, {
            afnFiltering: _ext.search,
            aTypes: _ext.type.detect,
            ofnSearch: _ext.type.search,
            oSort: _ext.type.order,
            afnSortData: _ext.order,
            aoFeatures: _ext.feature,
            oApi: _ext.internal,
            oStdClasses: _ext.classes,
            oPagination: _ext.pager
        });

        $.extend(DataTable.ext.classes, {
            "sTable": "dataTable",
            "sNoFooter": "no-footer",
            /* Paging buttons */
            "sPageButton": "paginate_button",
            "sPageButtonActive": "current",
            "sPageButtonDisabled": "disabled",
            /* Striping classes */
            "sStripeOdd": "odd",
            "sStripeEven": "even",
            /* Empty row */
            "sRowEmpty": "dataTables_empty",
            /* Features */
            "sWrapper": "dataTables_wrapper",
            "sFilter": "dataTables_filter",
            "sInfo": "dataTables_info",
            "sPaging": "dataTables_paginate paging_", /* Note that the type is postfixed */
            "sLength": "dataTables_length",
            "sProcessing": "dataTables_processing",
            /* Sorting */
            "sSortAsc": "sorting_asc",
            "sSortDesc": "sorting_desc",
            "sSortable": "sorting", /* Sortable in both directions */
            "sSortableAsc": "sorting_asc_disabled",
            "sSortableDesc": "sorting_desc_disabled",
            "sSortableNone": "sorting_disabled",
            "sSortColumn": "sorting_", /* Note that an int is postfixed for the sorting order */

            /* Filtering */
            "sFilterInput": "",
            /* Page length */
            "sLengthSelect": "",
            /* Scrolling */
            "sScrollWrapper": "dataTables_scroll",
            "sScrollHead": "dataTables_scrollHead",
            "sScrollHeadInner": "dataTables_scrollHeadInner",
            "sScrollBody": "dataTables_scrollBody",
            "sScrollFoot": "dataTables_scrollFoot",
            "sScrollFootInner": "dataTables_scrollFootInner",
            /* Misc */
            "sHeaderTH": "",
            "sFooterTH": "",
            // Deprecated
            "sSortJUIAsc": "",
            "sSortJUIDesc": "",
            "sSortJUI": "",
            "sSortJUIAscAllowed": "",
            "sSortJUIDescAllowed": "",
            "sSortJUIWrapper": "",
            "sSortIcon": "",
            "sJUIHeader": "",
            "sJUIFooter": ""
        });

        (function () {

            // Reused strings for better compression. Closure compiler appears to have a
            // weird edge case where it is trying to expand strings rather than use the
            // variable version. This results in about 200 bytes being added, for very
            // little preference benefit since it this run on script load only.
            var _empty = '';
            _empty = '';

            var _stateDefault = _empty + 'ui-state-default';
            var _sortIcon = _empty + 'css_right ui-icon ui-icon-';
            var _headerFooter = _empty + 'fg-toolbar ui-toolbar ui-widget-header ui-helper-clearfix';

            $.extend(DataTable.ext.oJUIClasses, DataTable.ext.classes, {
                /* Full numbers paging buttons */
                "sPageButton": "fg-button ui-button " + _stateDefault,
                "sPageButtonActive": "ui-state-disabled",
                "sPageButtonDisabled": "ui-state-disabled",
                /* Features */
                "sPaging": "dataTables_paginate fg-buttonset ui-buttonset fg-buttonset-multi " +
                        "ui-buttonset-multi paging_", /* Note that the type is postfixed */

                /* Sorting */
                "sSortAsc": _stateDefault + " sorting_asc",
                "sSortDesc": _stateDefault + " sorting_desc",
                "sSortable": _stateDefault + " sorting",
                "sSortableAsc": _stateDefault + " sorting_asc_disabled",
                "sSortableDesc": _stateDefault + " sorting_desc_disabled",
                "sSortableNone": _stateDefault + " sorting_disabled",
                "sSortJUIAsc": _sortIcon + "triangle-1-n",
                "sSortJUIDesc": _sortIcon + "triangle-1-s",
                "sSortJUI": _sortIcon + "carat-2-n-s",
                "sSortJUIAscAllowed": _sortIcon + "carat-1-n",
                "sSortJUIDescAllowed": _sortIcon + "carat-1-s",
                "sSortJUIWrapper": "DataTables_sort_wrapper",
                "sSortIcon": "DataTables_sort_icon",
                /* Scrolling */
                "sScrollHead": "dataTables_scrollHead " + _stateDefault,
                "sScrollFoot": "dataTables_scrollFoot " + _stateDefault,
                /* Misc */
                "sHeaderTH": _stateDefault,
                "sFooterTH": _stateDefault,
                "sJUIHeader": _headerFooter + " ui-corner-tl ui-corner-tr",
                "sJUIFooter": _headerFooter + " ui-corner-bl ui-corner-br"
            });

        }());

        var extPagination = DataTable.ext.pager;

        function _numbers(page, pages) {
            var
                    numbers = [],
                    buttons = extPagination.numbers_length,
                    half = Math.floor(buttons / 2),
                    i = 1;

            if (pages <= buttons) {
                numbers = _range(0, pages);
            }
            else if (page <= half) {
                numbers = _range(0, buttons - 2);
                numbers.push('ellipsis');
                numbers.push(pages - 1);
            }
            else if (page >= pages - 1 - half) {
                numbers = _range(pages - (buttons - 2), pages);
                numbers.splice(0, 0, 'ellipsis'); // No unshift in IE6.
                numbers.splice(0, 0, 0);
            }
            else {
                numbers = _range(page - half + 2, page + half - 1);
                numbers.push('ellipsis');
                numbers.push(pages - 1);
                numbers.splice(0, 0, 'ellipsis');
                numbers.splice(0, 0, 0);
            }

            numbers.DT_el = 'span';
            return numbers;
        }

        $.extend(extPagination, {
            simple: function (page, pages) {
                return ['previous', 'next'];
            },
            full: function (page, pages) {
                return ['first', 'previous', 'next', 'last'];
            },
            numbers: function (page, pages) {
                return [_numbers(page, pages)];
            },
            simple_numbers: function (page, pages) {
                return ['previous', _numbers(page, pages), 'next'];
            },
            full_numbers: function (page, pages) {
                return ['first', 'previous', _numbers(page, pages), 'next', 'last'];
            },
            // For testing and plug-ins to use.
            _numbers: _numbers,
            // Number of number buttons (including ellipsis) to show. _Must be odd!_.
            numbers_length: 7
        });

        $.extend(true, DataTable.ext.renderer, {
            pageButton: {
                _: function (settings, host, idx, buttons, page, pages) {
                    var classes = settings.oClasses;
                    var lang = settings.oLanguage.oPaginate;
                    var btnDisplay, btnClass, counter = 0;

                    var attach = function (container, buttons) {
                        var i, ien, node, button;
                        var clickHandler = function (e) {
                            _fnPageChange(settings, e.data.action, true);
                        };

                        for (i = 0, ien = buttons.length; i < ien; i++) {
                            button = buttons[i];

                            if ($.isArray(button)) {
                                var inner = $('<' + (button.DT_el || 'div') + '/>')
                                        .appendTo(container);
                                attach(inner, button);
                            }
                            else {
                                btnDisplay = null;
                                btnClass = '';

                                switch (button) {
                                    case 'ellipsis':
                                        container.append('<span class="ellipsis">&#x2026;</span>');
                                        break;

                                    case 'first':
                                        btnDisplay = lang.sFirst;
                                        btnClass = button + (page > 0 ?
                                                '' : ' ' + classes.sPageButtonDisabled);
                                        break;

                                    case 'previous':
                                        btnDisplay = lang.sPrevious;
                                        btnClass = button + (page > 0 ?
                                                '' : ' ' + classes.sPageButtonDisabled);
                                        break;

                                    case 'next':
                                        btnDisplay = lang.sNext;
                                        btnClass = button + (page < pages - 1 ?
                                                '' : ' ' + classes.sPageButtonDisabled);
                                        break;

                                    case 'last':
                                        btnDisplay = lang.sLast;
                                        btnClass = button + (page < pages - 1 ?
                                                '' : ' ' + classes.sPageButtonDisabled);
                                        break;

                                    default:
                                        btnDisplay = button + 1;
                                        btnClass = page === button ?
                                                classes.sPageButtonActive : '';
                                        break;
                                }

                                if (btnDisplay !== null) {
                                    node = $('<a>', {
                                        'class': classes.sPageButton + ' ' + btnClass,
                                        'aria-controls': settings.sTableId,
                                        'data-dt-idx': counter,
                                        'tabindex': settings.iTabIndex,
                                        'id': idx === 0 && typeof button === 'string' ?
                                                settings.sTableId + '_' + button :
                                                null
                                    })
                                            .html(btnDisplay)
                                            .appendTo(container);

                                    _fnBindAction(
                                            node, {action: button}, clickHandler
                                            );

                                    counter++;
                                }
                            }
                        }
                    };

                    // IE9 throws an 'unknown error' if document.activeElement is used
                    // inside an iframe or frame. Try / catch the error. Not good for
                    // accessibility, but neither are frames.
                    var activeEl;

                    try {
                        // Because this approach is destroying and recreating the paging elements,
                        // focus is lost on the select button which is bad for accessibility.
                        // So we want to restore focus once the draw has completed.
                        activeEl = $(document.activeElement).data('dt-idx');
                    }
                    catch (e) {
                    }

                    attach($(host).empty(), buttons);

                    if (activeEl) {
                        $(host).find('[data-dt-idx=' + activeEl + ']').focus();
                    }
                }
            }
        });

        // Built in type detection. See model.ext.aTypes for information about
        // what is required from this methods.
        $.extend(DataTable.ext.type.detect, [
            // Plain numbers - first since V8 detects some plain numbers as dates
            // e.g. Date.parse('55') (but not all, e.g. Date.parse('22')...).
            function (d, settings)
            {
                var decimal = settings.oLanguage.sDecimal;
                return _isNumber(d, decimal) ? 'num' + decimal : null;
            },
            // Dates (only those recognised by the browser's Date.parse).
            function (d, settings)
            {
                // V8 will remove any unknown characters at the start and end of the
                // expression, leading to false matches such as `$245.12` or `10%` being
                // a valid date. See forum thread 18941 for detail.
                if (d && !(d instanceof Date) && (!_re_date_start.test(d) || !_re_date_end.test(d))) {
                    return null;
                }
                var parsed = Date.parse(d);
                return (parsed !== null && !isNaN(parsed)) || _empty(d) ? 'date' : null;
            },
            // Formatted numbers.
            function (d, settings)
            {
                var decimal = settings.oLanguage.sDecimal;
                return _isNumber(d, decimal, true) ? 'num-fmt' + decimal : null;
            },
            // HTML numeric.
            function (d, settings)
            {
                var decimal = settings.oLanguage.sDecimal;
                return _htmlNumeric(d, decimal) ? 'html-num' + decimal : null;
            },
            // HTML numeric, formatted.
            function (d, settings)
            {
                var decimal = settings.oLanguage.sDecimal;
                return _htmlNumeric(d, decimal, true) ? 'html-num-fmt' + decimal : null;
            },
            // HTML (this is strict checking - there must be html).
            function (d, settings)
            {
                return _empty(d) || (typeof d === 'string' && d.indexOf('<') !== -1) ?
                        'html' : null;
            }
        ]);

        // Filter formatting functions. See model.ext.ofnSearch for information about
        // what is required from these methods.
        // Note that additional search methods are added for the html numbers and
        // html formatted numbers by `_addNumericSort()` when we know what the decimal
        // place is.
        $.extend(DataTable.ext.type.search, {
            html: function (data) {
                return _empty(data) ?
                        data :
                        typeof data === 'string' ?
                        data
                        .replace(_re_new_lines, " ")
                        .replace(_re_html, "") :
                        '';
            },
            string: function (data) {
                return _empty(data) ?
                        data :
                        typeof data === 'string' ?
                        data.replace(_re_new_lines, " ") :
                        data;
            }
        });

        var __numericReplace = function (d, decimalPlace, re1, re2) {
            if (d !== 0 && (!d || d === '-')) {
                return -Infinity;
            }

            // If a decimal place other than `.` is used, it needs to be given to the
            // function so we can detect it and replace with a `.` which is the only
            // decimal place Javascript recognises - it is not locale aware.
            if (decimalPlace) {
                d = _numToDecimal(d, decimalPlace);
            }

            if (d.replace) {
                if (re1) {
                    d = d.replace(re1, '');
                }

                if (re2) {
                    d = d.replace(re2, '');
                }
            }

            return d * 1;
        };

        // Add the numeric 'deformatting' functions for sorting and search. This is done
        // in a function to provide an easy ability for the language options to add
        // additional methods if a non-period decimal place is used.
        function _addNumericSort(decimalPlace) {
            $.each(
                    {
                        // Plain numbers.
                        "num": function (d) {
                            return __numericReplace(d, decimalPlace);
                        },
                        // Formatted numbers.
                        "num-fmt": function (d) {
                            return __numericReplace(d, decimalPlace, _re_formatted_numeric);
                        },
                        // HTML numeric.
                        "html-num": function (d) {
                            return __numericReplace(d, decimalPlace, _re_html);
                        },
                        // HTML numeric, formatted.
                        "html-num-fmt": function (d) {
                            return __numericReplace(d, decimalPlace, _re_html, _re_formatted_numeric);
                        }
                    },
            function (key, fn) {
                // Add the ordering method.
                _ext.type.order[ key + decimalPlace + '-pre' ] = fn;

                // For HTML types add a search formatter that will strip the HTML.
                if (key.match(/^html\-/)) {
                    _ext.type.search[ key + decimalPlace ] = _ext.type.search.html;
                }
            }
            );
        }

        // Default sort methods.
        $.extend(_ext.type.order, {
            // Dates.
            "date-pre": function (d) {
                return Date.parse(d) || 0;
            },
            // HTML.
            "html-pre": function (a) {
                return _empty(a) ?
                        '' :
                        a.replace ?
                        a.replace(/<.*?>/g, "").toLowerCase() :
                        a + '';
            },
            // String.
            "string-pre": function (a) {
                // This is a little complex, but faster than always calling toString,
                // http://jsperf.com/tostring-v-check
                return _empty(a) ?
                        '' :
                        typeof a === 'string' ?
                        a.toLowerCase() :
                        !a.toString ?
                        '' :
                        a.toString();
            },
            // String-asc and -desc are retained only for compatibility with the old sort methods.
            "string-asc": function (x, y) {
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            },
            "string-desc": function (x, y) {
                return ((x < y) ? 1 : ((x > y) ? -1 : 0));
            }
        });

        // Numeric sorting types - order doesn't matter here.
        _addNumericSort('');

        $.extend(true, DataTable.ext.renderer, {
            header: {
                _: function (settings, cell, column, classes) {
                    // No additional mark-up required
                    // Attach a sort listener to update on sort - note that using the
                    // `DT` namespace will allow the event to be removed automatically
                    // on destroy, while the `dt` namespaced event is the one we are
                    // listening for.
                    $(settings.nTable).on('order.dt.DT', function (e, ctx, sorting, columns) {
                        if (settings !== ctx) { // Need to check this this is the host table, not a nested one.
                            return;
                        }

                        var colIdx = column.idx;

                        cell
                                .removeClass(
                                        column.sSortingClass + ' ' +
                                        classes.sSortAsc + ' ' +
                                        classes.sSortDesc
                                        )
                                .addClass(columns[ colIdx ] == 'asc' ?
                                        classes.sSortAsc : columns[ colIdx ] == 'desc' ?
                                        classes.sSortDesc :
                                        column.sSortingClass
                                        );
                    });
                },
                jqueryui: function (settings, cell, column, classes) {
                    $('<div/>')
                            .addClass(classes.sSortJUIWrapper)
                            .append(cell.contents())
                            .append($('<span/>')
                                    .addClass(classes.sSortIcon + ' ' + column.sSortingClassJUI)
                                    )
                            .appendTo(cell);

                    // Attach a sort listener to update on sort.
                    $(settings.nTable).on('order.dt.DT', function (e, ctx, sorting, columns) {
                        if (settings !== ctx) {
                            return;
                        }

                        var colIdx = column.idx;

                        cell
                                .removeClass(classes.sSortAsc + " " + classes.sSortDesc)
                                .addClass(columns[ colIdx ] == 'asc' ?
                                        classes.sSortAsc : columns[ colIdx ] == 'desc' ?
                                        classes.sSortDesc :
                                        column.sSortingClass
                                        );

                        cell
                                .find('span.' + classes.sSortIcon)
                                .removeClass(
                                        classes.sSortJUIAsc + " " +
                                        classes.sSortJUIDesc + " " +
                                        classes.sSortJUI + " " +
                                        classes.sSortJUIAscAllowed + " " +
                                        classes.sSortJUIDescAllowed
                                        )
                                .addClass(columns[ colIdx ] == 'asc' ?
                                        classes.sSortJUIAsc : columns[ colIdx ] == 'desc' ?
                                        classes.sSortJUIDesc :
                                        column.sSortingClassJUI
                                        );
                    });
                }
            }
        });

        /*
         * Public helper functions. These aren't used internally by DataTables, or
         * called by any of the options passed into DataTables, but they can be used
         * externally by developers working with DataTables. They are helper functions
         * to make working with DataTables a little bit easier.
         */

        /**
         * Helpers for `columns.render`.
         *
         * The options defined here can be used with the `columns.render` initialisation
         * option to provide a display renderer. The following functions are defined:
         *
         * * `number` - Will format numeric data (defined by `columns.data`) for
         *   display, retaining the original unformatted data for sorting and filtering.
         *   It takes 5 parameters:
         *   * `string` - Thousands grouping separator
         *   * `string` - Decimal point indicator
         *   * `integer` - Number of decimal points to show
         *   * `string` (optional) - Prefix.
         *   * `string` (optional) - Postfix (/suffix).
         *
         * @example
         *   // Column definition using the number renderer
         *   {
         *     data: "salary",
         *     render: $.fn.dataTable.render.number( '\'', '.', 0, '$' )
         *   }
         *
         * @namespace
         */
        DataTable.render = {
            number: function (thousands, decimal, precision, prefix, postfix) {
                return {
                    display: function (d) {
                        if (typeof d !== 'number' && typeof d !== 'string') {
                            return d;
                        }

                        var negative = d < 0 ? '-' : '';
                        d = Math.abs(parseFloat(d));

                        var intPart = parseInt(d, 10);
                        var floatPart = precision ?
                                decimal + (d - intPart).toFixed(precision).substring(2) :
                                '';

                        return negative + (prefix || '') +
                                intPart.toString().replace(
                                /\B(?=(\d{3})+(?!\d))/g, thousands
                                ) +
                                floatPart +
                                (postfix || '');
                    }
                };
            }
        };

        /*
         * This is really a good bit rubbish this method of exposing the internal methods
         * publicly... - To be fixed in 2.0 using methods on the prototype
         */

        /**
         * Create a wrapper function for exporting an internal functions to an external API.
         *  @param {string} fn API function name
         *  @returns {function} wrapped function
         *  @memberof DataTable#internal
         */
        function _fnExternApiFunc(fn)
        {
            return function () {
                var args = [_fnSettingsFromNode(this[DataTable.ext.iApiIndex])].concat(
                        Array.prototype.slice.call(arguments)
                        );
                return DataTable.ext.internal[fn].apply(this, args);
            };
        }

        /**
         * Reference to internal functions for use by plug-in developers. Note that
         * these methods are references to internal functions and are considered to be
         * private. If you use these methods, be aware that they are liable to change
         * between versions.
         *  @namespace
         */
        $.extend(DataTable.ext.internal, {
            _fnExternApiFunc: _fnExternApiFunc,
            _fnBuildAjax: _fnBuildAjax,
            _fnAjaxUpdate: _fnAjaxUpdate,
            _fnAjaxParameters: _fnAjaxParameters,
            _fnAjaxUpdateDraw: _fnAjaxUpdateDraw,
            _fnAjaxDataSrc: _fnAjaxDataSrc,
            _fnAddColumn: _fnAddColumn,
            _fnColumnOptions: _fnColumnOptions,
            _fnAdjustColumnSizing: _fnAdjustColumnSizing,
            _fnVisibleToColumnIndex: _fnVisibleToColumnIndex,
            _fnColumnIndexToVisible: _fnColumnIndexToVisible,
            _fnVisbleColumns: _fnVisbleColumns,
            _fnGetColumns: _fnGetColumns,
            _fnColumnTypes: _fnColumnTypes,
            _fnApplyColumnDefs: _fnApplyColumnDefs,
            _fnHungarianMap: _fnHungarianMap,
            _fnCamelToHungarian: _fnCamelToHungarian,
            _fnLanguageCompat: _fnLanguageCompat,
            _fnBrowserDetect: _fnBrowserDetect,
            _fnAddData: _fnAddData,
            _fnAddTr: _fnAddTr,
            _fnNodeToDataIndex: _fnNodeToDataIndex,
            _fnNodeToColumnIndex: _fnNodeToColumnIndex,
            _fnGetCellData: _fnGetCellData,
            _fnSetCellData: _fnSetCellData,
            _fnSplitObjNotation: _fnSplitObjNotation,
            _fnGetObjectDataFn: _fnGetObjectDataFn,
            _fnSetObjectDataFn: _fnSetObjectDataFn,
            _fnGetDataMaster: _fnGetDataMaster,
            _fnClearTable: _fnClearTable,
            _fnDeleteIndex: _fnDeleteIndex,
            _fnInvalidate: _fnInvalidate,
            _fnGetRowElements: _fnGetRowElements,
            _fnCreateTr: _fnCreateTr,
            _fnBuildHead: _fnBuildHead,
            _fnDrawHead: _fnDrawHead,
            _fnDraw: _fnDraw,
            _fnReDraw: _fnReDraw,
            _fnAddOptionsHtml: _fnAddOptionsHtml,
            _fnDetectHeader: _fnDetectHeader,
            _fnGetUniqueThs: _fnGetUniqueThs,
            _fnFeatureHtmlFilter: _fnFeatureHtmlFilter,
            _fnFilterComplete: _fnFilterComplete,
            _fnFilterCustom: _fnFilterCustom,
            _fnFilterColumn: _fnFilterColumn,
            _fnFilter: _fnFilter,
            _fnFilterCreateSearch: _fnFilterCreateSearch,
            _fnEscapeRegex: _fnEscapeRegex,
            _fnFilterData: _fnFilterData,
            _fnFeatureHtmlInfo: _fnFeatureHtmlInfo,
            _fnUpdateInfo: _fnUpdateInfo,
            _fnInfoMacros: _fnInfoMacros,
            _fnInitialise: _fnInitialise,
            _fnInitComplete: _fnInitComplete,
            _fnLengthChange: _fnLengthChange,
            _fnFeatureHtmlLength: _fnFeatureHtmlLength,
            _fnFeatureHtmlPaginate: _fnFeatureHtmlPaginate,
            _fnPageChange: _fnPageChange,
            _fnFeatureHtmlProcessing: _fnFeatureHtmlProcessing,
            _fnProcessingDisplay: _fnProcessingDisplay,
            _fnFeatureHtmlTable: _fnFeatureHtmlTable,
            _fnScrollDraw: _fnScrollDraw,
            _fnApplyToChildren: _fnApplyToChildren,
            _fnCalculateColumnWidths: _fnCalculateColumnWidths,
            _fnThrottle: _fnThrottle,
            _fnConvertToWidth: _fnConvertToWidth,
            _fnScrollingWidthAdjust: _fnScrollingWidthAdjust,
            _fnGetWidestNode: _fnGetWidestNode,
            _fnGetMaxLenString: _fnGetMaxLenString,
            _fnStringToCss: _fnStringToCss,
            _fnScrollBarWidth: _fnScrollBarWidth,
            _fnSortFlatten: _fnSortFlatten,
            _fnSort: _fnSort,
            _fnSortAria: _fnSortAria,
            _fnSortListener: _fnSortListener,
            _fnSortAttachListener: _fnSortAttachListener,
            _fnSortingClasses: _fnSortingClasses,
            _fnSortData: _fnSortData,
            _fnSaveState: _fnSaveState,
            _fnLoadState: _fnLoadState,
            _fnSettingsFromNode: _fnSettingsFromNode,
            _fnLog: _fnLog,
            _fnMap: _fnMap,
            _fnBindAction: _fnBindAction,
            _fnCallbackReg: _fnCallbackReg,
            _fnCallbackFire: _fnCallbackFire,
            _fnLengthOverflow: _fnLengthOverflow,
            _fnRenderer: _fnRenderer,
            _fnDataSource: _fnDataSource,
            _fnRowAttributes: _fnRowAttributes,
            _fnCalculateEnd: function () {
            }
            // Used by a lot of plug-ins, but redundant in 1.10,
            // so this dead-end function is added to prevent errors.
        });

        // jQuery access
        $.fn.dataTable = DataTable;

        // Legacy aliases
        $.fn.dataTableSettings = DataTable.settings;
        $.fn.dataTableExt = DataTable.ext;

        // With a capital `D` we return a DataTables API instance rather than a jQuery object.
        $.fn.DataTable = function (opts) {
            return $(this).dataTable(opts).api();
        };

        // All properties that are available to $.fn.dataTable should also be available on $.fn.DataTable.
        $.each(DataTable, function (prop, val) {
            $.fn.DataTable[ prop ] = val;
        });

        return $.fn.dataTable;
    }));
}(window, document));