/**
 *
 * This component takes a JSON data object and draws a D3 object
 * The expected JSON format is specified under the option 'json' of the HeatmapViewer options.
 *
 * Please remember to use jQuery in <a href="http://docs.jquery.com/Using_jQuery_with_Other_Libraries">compatibility mode</a>, particularly a good idea if you use other libraries.
 *
 * @author <a href="mailto:gyachdav@rostlab.org">Guy Yachdav</a>
 * @version 1.0.0
 * @category 0
 *
 * @requires <a href='http://code.jquery.com/jquery-1.9.1.min.js'>jQuery Core 1.9.1</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.9.1.min.js"></script>
 *
 * @requires <a href='http://d3js.org/d3.v3.min.js'>D3 Version 3</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/d3.v3.min.js"></script>
 *
 * @param {Object} options An object with the options for HeatmapViewer component.
 *
 * @option {string} targetDiv
 *    Identifier of the DIV tag where the component should be displayed.
 *
 * @option {string} jsonData
 *    The jsonData object contains the data to be displayed
 *    The jsonData object must follow this format:
 *
 *	[{
 *	 col: int,   // columns position
 *	 row: int,   // row position
 *	 label: string, // column label
 *	 score: float, // cell's score
 *	 row_label: string // row label
 *	}]
 *
 * Example 4 items grid
 *  <pre class="brush: js" title="Configuration object">
 *    		[{
 *		    "col": 0,
 *		    "row": 0,
 *		    "label": "M",
 *		    "score": 27,
 *		    "row_label": "A"
 *		}, {
 *		    "col": 0,
 *		    "row": 1,
 *		    "label": "M",
 *		    "score": 5,
 *		    "row_label": "C"
 *		}, {
 *		    "col": 1,
 *		    "row": 0,
 *		    "label": "M",
 *		    "score": 43,
 *		    "row_label": "D"
 *		}, {
 *		    "col": 1,
 *		    "row": 1,
 *		    "label": "M",
 *		    "score": 58,
 *		    "row_label": "E"
 *		}]
 *	</pre>
 *
 * @optional {Onject} user_defined_config
 *     Configuration options for the component
 *
 * @optional {Onject} show_zoom_panel
 *      Display the zoom panel. default: true
 *
 * @optional {Onject} showScale
 *      Display the scale object. default: true
 *
 * @example
 * var painter = new Biojs.HeatmapViewer({
 *						jsonData: data,
 *						user_defined_config: {
 *							colorLow: 'blue',
 *							colorMed: 'white',
 *							colorHigh: 'red'
 *						},
 *						targetDiv: 'heatmapContainer',
 *				});
 *
 *
 *
 *
 * @class
 * @extends Biojs
 */

Biojs.HeatmapViewer = Biojs.extend({
    /** @lends Biojs.HeatmapViewer */
    /**
     * public variables
     */
    targetDiv: undefined,
    main_heatmap_cfg: {},
    zoom_heatmap_cfg: {},
    slider_cfg: {
        start_pos: 0,
        end_pos: 0,

    },

    /**
     * private variables
     */
    _MAIN_HEAT_MAP_DIV: 'main_heatmap_div',
    _ZOOM_HEAT_MAP_DIV: 'zoom_heatmap_div',
    _SLIDER_DIV: 'slider_heatmap_div',
    _SCALE_DIV: 'scale_div',
    _RIGHT_MARGIN: 30,
    _LEFT_MARGIN: 30,
    _TOP_MARGIN: 30,
    _BOTTOM_MARGIN: 30,

    // Boundaries
    _MIN_CELL_WIDTH: 2,
    _MAX_CELL_WIDTH: 100,
    _MIN_FONT_SIZE: 11,
    _MAX_FONT_SIZE: 20,


    //Defaults
    _DEFAULT_FRAME_SIZE: 60,
    _origData: undefined,
    _zoomedData: undefined,

    color_scheme: {
        colorLow: 'green',
        colorMed: 'white',
        colorHigh: 'red',
    },

    constructor: function(options) {
        this._origData = this.opt.jsonData;
        this.targetDiv = this.opt.targetDiv;
        this._init();
        this._draw();
    },
    /**
     * Private: intialize the viewer. overrides defaults with user defined options
     * @ignore
     */
    _init: function() {
        var tmpCfg = this.color_scheme;

        // read in user defined _config
        if (this.opt.user_defined_config != 'undefined') {
            var _tmpUserCfg = this.opt.user_defined_config;
            ['colorLow', 'configolorHigh', 'colorMed'].forEach(function(entry) {
                if (tmpCfg[entry])
                    tmpCfg[entry] = _tmpUserCfg[entry];
            });
        }

    },
    /**
     * Private: renders the viewer object
     * @ignore
     */
    _draw: function() {
        // setup canvas
        var $hmDiv = jQuery("#" + this.opt.targetDiv);
        [this._MAIN_HEAT_MAP_DIV, this._SCALE_DIV, this._ZOOM_HEAT_MAP_DIV].forEach(function(entry) {
            $hmDiv.append(jQuery('<div>')
                .attr('id', entry)
                .css('width', '95%')
                .css('margin', '25px'));
        });

        // Set up and draw main div 
        this.main_heatmap_cfg = this._getHeatMapCfg(this._origData, this._MAIN_HEAT_MAP_DIV);
        this._heatmap(this.main_heatmap_cfg, this._origData, this._MAIN_HEAT_MAP_DIV);
        // Set up scale
        if (this.opt.showScale)
            this.SCALE.init({
                colorLow: this.main_heatmap_cfg.colorLow,
                colorMid: this.main_heatmap_cfg.colorMed,
                colorHigh: this.main_heatmap_cfg.colorHigh,
                scoreLow: this.main_heatmap_cfg.scoreLow,
                scoreMid: this.main_heatmap_cfg.scoreMed,
                scoreHigh: this.main_heatmap_cfg.scoreHigh,
                targetDiv: this._SCALE_DIV
            });

        // Enable zoom div if labels cannot be shown on the main heatmap
        if (this.main_heatmap_cfg.dimensions.cell_width < this._MIN_FONT_SIZE) {
            if (this.opt.show_zoom_panel) { // zoom panel can be forced away by user
                // show sliding window on main heatmap
                var $zoom_div_width = jQuery("#" + this._ZOOM_HEAT_MAP_DIV).width();
                var num_cols_in_zoom = Math.ceil($zoom_div_width / this._MAX_FONT_SIZE);
                this._zoomedData = this._getZoomedHeatMapData({
                        start: 0,
                        end: num_cols_in_zoom
                    },
                    this.main_heatmap_cfg.dimensions.row_count
                );
                this.zoom_heatmap_cfg = this._getHeatMapCfg(this._zoomedData, this._ZOOM_HEAT_MAP_DIV);
                this.slider_cfg = jQuery.extend(this.slider_cfg, this._getSliderCfg(this.main_heatmap_cfg, num_cols_in_zoom));
                this._show_sliding_window(this.slider_cfg);
                this._heatmap(this.zoom_heatmap_cfg, this._zoomedData, this._ZOOM_HEAT_MAP_DIV);
            }
        }
    },


    opt: {
        /**
         * Default values for the options:
         * targetDIV: "YourOwnDivId",
         * jsonData: {},
         * showScale: true,
         * showExportToImageButton: false,
         * @name Biojs.HeatmapViewer-opt
         */
        targetDiv: 'YourOwnDivId',
        jsonData: {},
        showScale: true,
        showExportToImageButton: false,
        show_zoom_panel: true
    },

    eventTypes: [

        /* Event Names
       The parent class Biojs build the event handlers automatically
       with the names defined here. Use this.raiseEvent(<eventName>,
       <eventData>) for triggering an event from this component. Where,
       <eventName> is a string (defined in eventTypes) and <eventData> is
       an object which should be passed to the registered listeners.
       
       Define your event names following the syntax:
         “<eventName1>”,
         “<eventName2>”,
            :
            .
         “<eventNameN>”
     */
    ],

    SCALE: (function($) {
        var data_array = [];
        var my = {};
        var dataLow, dataMid, dataHigh;
        var colorLow, colorMid, colorHigh;
        var targetDiv;
        var svg;
        var d, i;

        var drag = d3.behavior.drag()
            .on("drag", function(d, i) {
                d.x += d3.event.dx
                d3.select(this).attr("transform", function(d, i) {
                    return "translate(" + [d.x] + ",20)"
                })
            });

        /**
         * [init description]
         * @param  {[type]} _config [description]
         * @return {[type]}         [description]
         */
        my.init = function(_config) {
            var scoreLow = _config.scoreLow;
            var scoreMid = _config.scoreMid;
            var scoreHigh = _config.scoreHigh;
            var colorLow = _config.colorLow;
            var colorMid = _config.colorMid;
            var colorHigh = _config.colorHigh;
            var targetDiv = _config.targetDiv;

            for (var idx = scoreLow; idx <= scoreHigh; idx++)
                data_array.push(idx);

            var width = 960,
                height = 200;

            var colorScale = d3.scale.linear()
                .domain([scoreLow, scoreMid, scoreHigh])
                .range([colorLow, colorMid, colorHigh]);

            var x = 50,
                y = 20;

            var svg = d3.select("#" + targetDiv)
                .append("svg").attr("id", targetDiv + "_svg")
                .attr("width", "100%")
            // .attr("width", heatmapviewer_config.heatmap_config.dimensions.canvas_width + heatmapviewer_config.heatmap_config.canvas_margin.right + heatmapviewer_config.heatmap_config.canvas_margin.left)
            .attr("height", "40");

            var g = svg.append("g")
                .data([{
                    "x": x,
                    "y": y
                }])
                .attr("transform", "translate(" + x + ",20)")
                .call(drag);

            g.selectAll("lines")
                .data(data_array)
                .enter().append("svg:line")
                .attr("x1", function(d, i) {
                    return i;
                })
                .attr("y1", 0)
                .attr("x2", function(d, i) {
                    return i;
                })
                .attr("y1", 20)
                .style("stroke", function(d) {
                    return (colorScale(d));
                })
                .style("stroke-width", 5);

            g.append("text")
                .attr("y", -5)
                .attr("x", -15)
                .text(scoreLow)
                .attr("transform", "translate(0, 0 )");

            var midPt = data_array.length / 2;
            g.append("text")
                .attr("class", "caption")
                .attr("y", -5)
                .attr("x", midPt - 2)
                .text(scoreMid);
            var maxPt = data_array.length;

            g.append("text")
                .attr("class", "caption")
                .attr("y", -5)
                .attr("x", maxPt - 2)
                .text(scoreHigh);
        }
        return my;
    }(jQuery)),

    /**
     * Public module that renders a heatmap
     * @param  {[type]} $ [description]
     * @return {[type]}   [description]
     */
    _heatmap: function(_config, _data, _targteDiv) {
        var svg;
        var max_font_size = this._MAX_FONT_SIZE,
            min_font_size = this._MIN_FONT_SIZE;
        var config = _config;
        var targetDiv = _targteDiv;
        var data = _data;
        var myself = this;

        var axis_line_stroke_color = "black",
            axis_line_stroke = 2;

        var _draw_axis = function() {
            var d, i;
            var font_size = Math.min((config.dimensions.cell_width - 10), max_font_size);
            var myHorizontalAxisLine = svg.append("svg:line")
                .attr("x1", 0)
                .attr("y1", 0 - 3)
                .attr("x2", config.dimensions.cell_width * (config.dimensions.cell_count + 1))
                .attr("y2", 0 - 3)
                .style("stroke", axis_line_stroke_color)
                .style("stroke-width", axis_line_stroke);


            var myVerticalAxisLine = svg.append("svg:line")
                .attr("x1", 0 - 5)
                .attr("y1", 0)
                .attr("x2", 0 - 5)
                .attr("y2", config.dimensions.canvas_height)
                .style("stroke", axis_line_stroke_color)
                .style("stroke-width", axis_line_stroke);


            svg.selectAll("x_axis").data(config.x_axis).enter().append("text").style("font-size", font_size).text(function(d) {
                return d;
            }).attr("x", function(d, i) {
                return i * config.dimensions.cell_width;
            }).attr("y", function(d) {
                return -15;
            });

            // TODO rework positioning 
            svg.selectAll("y_axis").data(config.y_axis).enter().append("text").style("font-size", font_size).text(function(d) {
                return d;
            }).attr("x", function(d) {
                return -1 * myself._RIGHT_MARGIN;
            }).attr("y", function(d, i) {
                return i * config.dimensions.cell_width + config.dimensions.cell_width;
            });
        };


        jQuery("#" + targetDiv).empty();
        svg = d3.select("#" + targetDiv)
            .append("svg").attr("id", targetDiv + "_svg")
            .attr("width", config.dimensions.canvas_width + this._RIGHT_MARGIN + this._LEFT_MARGIN)
            .attr("height", config.dimensions.canvas_height + this._TOP_MARGIN + this._BOTTOM_MARGIN)
            .append("g")
            .attr("transform", "translate(" + this._RIGHT_MARGIN + "," + this._TOP_MARGIN + ")");

        var colorScale = d3.scale.linear()
            .domain([config.scoreLow, config.scoreMed, config.scoreHigh])
            .range([config.colorLow, config.colorMed, config.colorHigh]);
        svg.selectAll(".heatmapDiv")
            .data(data, function(d) {
                return d.col + ': ' + d.row;
            })
            .enter().append("svg:rect")
            .attr("x", function(d) {
                return ((d.col - myself.slider_cfg.start_pos) * config.dimensions.cell_width);
            })
            .attr("y", function(d) {
                return d.row * config.dimensions.cell_height;
            })
            .attr("width", function(d) {
                return config.dimensions.cell_width;
            })
            .attr("height", function(d) {
                return config.dimensions.cell_height;
            })
            .style("fill", function(d) {
                if (d.label == d.row_label) return ('black ');
                else return colorScale(d.score);
            })
            .append("svg:title")
            .text(function(d) {
                return d.label + d.col + d.row_label + " Score: " + d.score;
            });

        if (config.dimensions.cell_width > min_font_size)
            _draw_axis();

    },
    /**
     * Private: renders a sliding frame on top of main matrix to show zoomed in area
     * @param  {Object} _config viewer's configuration
     * @ignore
     */
    _show_sliding_window: function(_config) {
        var myself = this;
        var svg = _config.svg;
        var svg_length = svg.style("width")
        var drag_stop = _config.drag_stop;
        var x = y = 0;
        var d, i;
        var drag = d3.behavior.drag()
            .on("dragend", function(d, i) {
                if (d.x < 0)
                    d.x = 0;
                if (d.x > svg_length)
                    d.x = svg_length;
                myself._reDrawZoomDiv(d);
                d3.select(this).style('cursor', '-webkit-grab');
                d3.select(this).style('cursor', '-moz-grab');
            })
            .on("drag", function(d, i) {
                d.x += d3.event.dx;
                d.y += d3.event.dy;
                d3.select(this).attr("transform", function(d, i) {
                    if (d.x < 0)
                        return "translate(0)";
                    if (d.x > drag_stop - _config.frame_width)
                        return "translate(" + (drag_stop - _config.frame_width + 10) + ")";

                    d3.select(this).style('cursor', '-webkit-grabbing');
                    d3.select(this).style('cursor', '-moz-grabbing');
                    return "translate(" + [d.x] + ")";
                })
            });

        svg.append("svg:rect")
            .attr("x", -1 * (_config.cell_width))
            .attr("y", -5)
            .attr("width", _config.frame_width)
            .attr("height", _config.frame_height + 15)
            .style("fill-opacity", 0)
            .style("stroke", "blue")
            .style("stroke-width", 4)
            .style("cursor", "-webkit-grab")
            .style("cursor", "-moz-grab")
            .data([{
                "x": x,
            }])
            .attr("transform", "translate(" + x + "," + y + ")")
            .call(drag);
    },


    _getHeatMapCfg: function(_data, _targetDiv) {
        var _heatmap_cfg = {
            dimensions: {}
        };

        // Get Axis data
        tmpObj = this._getAxis(_data);
        _heatmap_cfg.y_axis = tmpObj.y_axis;
        _heatmap_cfg.x_axis = tmpObj.x_axis;

        // get minimum and maximum score to be used for the scale
        tmpObj = this._getMinMaxDataPoints(_data);
        _heatmap_cfg.scoreLow = tmpObj.min;
        _heatmap_cfg.scoreHigh = tmpObj.max;
        _heatmap_cfg.scoreMed = tmpObj.med;
        tmpObj = this._countRowsColumns(_data);

        _heatmap_cfg.dimensions.cell_count = tmpObj.num_cols;
        _heatmap_cfg.dimensions.row_count = tmpObj.num_rows;
        _heatmap_cfg.dimensions = jQuery.extend(_heatmap_cfg.dimensions, this._calculateHeatmapDimensions(_targetDiv,
            _heatmap_cfg.dimensions.cell_count, _heatmap_cfg.dimensions.row_count));
        _heatmap_cfg = jQuery.extend(_heatmap_cfg, this.color_scheme);
        // _heatmap_cfg.offset = 0;
        console.log(_heatmap_cfg);
        return (_heatmap_cfg)
    },
    _getSliderCfg: function(config, num_cols_in_zoom) {
        var svg = d3.select("#" + this._MAIN_HEAT_MAP_DIV + "_svg > g"); // find width of zoom map -- 
        //  base case cell width should equal _MIN_FONT_SIZE
        var frame_width = Math.ceil(num_cols_in_zoom * this.main_heatmap_cfg.dimensions.cell_width);

        return {
            cell_count: config.dimensions.cell_count,
            cell_width: config.dimensions.cell_width,
            frame_width: frame_width,
            frame_height: config.dimensions.row_count * config.dimensions.cell_width,
            drag_stop: config.dimensions.cell_count * config.dimensions.cell_width,
            svg: svg
        };
    },
    /**
     * Private: renders a secondary heatmap for a selected region in the data
     * @param  {Object} d {x:<int>, y:<int> } defines the data range to display
     * @ignore
     */
    _reDrawZoomDiv: function(d) {
        var start = 0;
        if (typeof this.main_heatmap_cfg.dimensions.cell_width == 'undefined')
            throw ('Missing main heatmap cell widh');

        var cell_width = this.main_heatmap_cfg.dimensions.cell_width;
        if (typeof d !== 'undefined')
            start = Math.ceil(d.x / cell_width);
        var end = Math.ceil((d.x + this.slider_cfg.frame_width) / cell_width);

        this.slider_cfg.start_pos = start;
        this.slider_cfg.end_pos = end;

        this._zoomedData = this._getZoomedHeatMapData({
                start: start,
                end: end
            },
            this.main_heatmap_cfg.dimensions.row_count
        );
        this.zoom_heatmap_cfg = this._getHeatMapCfg(this._zoomedData, this._ZOOM_HEAT_MAP_DIV);
        this._heatmap(this.zoom_heatmap_cfg, this._zoomedData, this._ZOOM_HEAT_MAP_DIV);
    },
    /**
     * Private: automatically calculates:
     * @return {[Object]}
     */
    _calculateHeatmapDimensions: function(_curr_canvas, _cell_count, _row_count) {
        var _tmp_canvas_width = jQuery("#" + _curr_canvas).width();
        var _tmpComputedCellSize = (_tmp_canvas_width - this._RIGHT_MARGIN - this._LEFT_MARGIN) / (_cell_count + 1);
        _tmpComputedCellSize = Math.max(Math.min(_tmpComputedCellSize, this._MAX_CELL_WIDTH), this._MIN_CELL_WIDTH);
        return {
            cell_height: _tmpComputedCellSize,
            cell_width: _tmpComputedCellSize,
            canvas_height: (_row_count + 1) * _tmpComputedCellSize,
            canvas_width: _tmp_canvas_width
        };
    },

    /**
     * Private: counts number of rows,cells in the data
     * @ignore
     */
    _countRowsColumns: function(_data) {
        var k, v;
        var tmpMinCol = _data[0].col;
        var tmpMaxCol = _data[0].col;
        var tmpRow = 0;
        jQuery.each(_data, function(k, v) {
            if (v.row == 0) {
                if (v.col > tmpMaxCol)
                    tmpMaxCol = v.col;
                if (v.col < tmpMinCol)
                    tmpMinCol = v.col;
            }
            if (v.row > tmpRow)
                tmpRow = v.row;
        });
        return {
            num_cols: tmpMaxCol - tmpMinCol,
            num_rows: tmpRow
        };
    },
    _getAxis: function(_data) {
        var myself = this;
        var x_axis = [],
            y_axis = [];

        jQuery.each(_data, function(k, v) {
            if (v.row == 0)
                x_axis.push(v.label);
            if ((v.col - myself.slider_cfg.start_pos) == 0)
                y_axis.push(v.row_label);
        });
        return ({
            x_axis: x_axis,
            y_axis: y_axis
        });
    },
    _getZoomedHeatMapData: function(rangeObj) {
        var row_count = this.main_heatmap_cfg.dimensions.row_count;

        return (this._origData.slice(rangeObj.start * (row_count + 1),
            rangeObj.end * (row_count + 1)));
    },
    _getMinMaxDataPoints: function(_data) {
        var min = 0,
            max = 0;
        var score_list = new Array();
        jQuery.each(_data, function(k, v) {
            if ((v.row == 0) && (v.col == 0)) {
                min = max = v.score;
            }
            if (v.score > max)
                max = v.score;
            if (v.score < min)
                min = v.score;
            score_list.push(v.score);
        });
        var sum = score_list.reduce(function(a, b) {
            return a + b
        });
        var avg = Math.floor(sum / score_list.length);
        return {
            min: min,
            max: max,
            med: avg
        };
    },
});