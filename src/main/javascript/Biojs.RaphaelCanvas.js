/** 
 * This is the description of the RaphaelCanvas component. This component provides pan/zoom functionality over Raphael's paper object,
 * and saves repitition of development effort involved in pan/zoom in other components.
 * 
 * @class
 * @extends Biojs
 * 
 * @author <a href="mailto:swanand@gmail.com">Swanand Gore</a>
 * @version 1.0.0
 * @category 0
 *
 * @requires <a href='http://raphaeljs.com'>Raphael 2.1.0</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/graphics/raphael-2.1.0.js"></script>
 * 
 * @requires <a href='http://code.jquery.com/jquery-1.7.2.js'>jQuery Core 1.7.2</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.7.2.min.js"></script>
 * 
 * @param {Object} options An object with the options for RaphaelCanvas component.
 *    
 * @option {String} target
 *    the div in which the canvas should be created.
 *
 * @option {Number} dimension
 *    the side of the square canvas
 *    
 * @example 
 * var instance = new Biojs.RaphaelCanvas({
 *          target:"YourOwnDivId",   dimension:500
 * });	
 * instance.testSetup();
 * 
 */

( function() {
	jQuery.fn.Zoom_Pan_Dial = function(given_options) {
		// *** Consolidate the options provided
		var default_options = {};
		var opts = jQuery.extend(default_options, this.data(), given_options);
		console.log("Zoom_Pan_Dial options", opts);
		this.css("width", opts.size+"px");
		this.css("height", opts.size+"px");
		var raphadiv = "Zoom_Pan_Dial_" + Math.random();
		this.html("<div id='"+raphadiv+"'></div>");
		// *** Create raphael canvas and draw shapes
		this.rapha = Raphael(raphadiv, opts.size, opts.size);
		var os = opts.size;
		var halfbase = os*0.18, height = os*0.18, // triangles for up down left right
			margin = os*0.1, halfsize = 0.5*os, // general
			halfwidth = 0.12*os, rheight = 0.15*os, rsep = 0.03*os; // rectangles for zoom in and out
		var text_attr = {'text-anchor':'middle', stroke:"white", font:(rheight*0.8)+"px Courier"};
		var shape_attr = {stroke:'none', fill:"lightgrey"};
		var shape_attr_mouseenter = {stroke:'none', fill:"grey"};
		var up = this.rapha.path(["M",
			halfsize,margin, "L", halfsize-halfbase, margin+height, "L", halfsize+halfbase, margin+height
		, "Z"]).attr(shape_attr);
		var left = this.rapha.path(["M",
			margin,halfsize, "L", margin+height, halfsize-halfbase, "L", margin+height, halfsize+halfbase
		, "Z"]).attr(shape_attr);
		var right = this.rapha.path(["M",
			os-margin,halfsize, "L", os-(margin+height), halfsize-halfbase, "L", os-(margin+height), halfsize+halfbase
		, "Z"]).attr(shape_attr);
		var down = this.rapha.path(["M",
			halfsize,os-margin, "L", halfsize-halfbase, os-(margin+height), "L", halfsize+halfbase, os-(margin+height)
		, "Z"]).attr(shape_attr);
		var zoomout = this.rapha.path(["M",
			halfsize-halfwidth,halfsize+rheight+rsep, "L", halfsize+halfwidth,halfsize+rheight+rsep, "L",
			halfsize+halfwidth,halfsize+rsep, "L", halfsize-halfwidth,halfsize+rsep, "L",
		, "Z"]).attr(shape_attr);
		var zoomout_text  = this.rapha.text(halfsize, halfsize+rheight/2+rsep, "-").attr(text_attr);
		var zoomin = this.rapha.path(["M",
			halfsize-halfwidth,halfsize-rheight-rsep, "L", halfsize+halfwidth,halfsize-rheight-rsep, "L",
			halfsize+halfwidth,halfsize-rsep, "L", halfsize-halfwidth,halfsize-rsep, "L",
		, "Z"]).attr(shape_attr);
		var zoomin_text  = this.rapha.text(halfsize, halfsize-rheight/2-rsep, "+").attr(text_attr);
		// *** Add mouse click events and fire handlers if any given
		button_name_to_shapes = {
			"up":[up], "down":[down], "left":[left], "right":[right],
			"zoomin":[zoomin,zoomin_text], "zoomout":[zoomout,zoomout_text]
		};
		opts.click_handlers && jQuery.each(opts.click_handlers, function(button_name, handler) {
			if(!button_name_to_shapes[button_name])
				console.warn("Zoom_Pan_Dial does not have button called " + button_name);
			else {
				jQuery.each(button_name_to_shapes[button_name], function(asi,ashape) {
					jQuery(ashape.node).css("cursor", "pointer");
					jQuery(ashape.node).click(handler);
				});
			}
		});
		// *** Disallow text selection on mouse clicking on +/- buttons
		this.css("-webkit-touch-callout", "none"); this.css("-webkit-user-select", "none");
		this.css("-khtml-user-select", "none"); this.css("-moz-user-select", "none");
		this.css("-ms-user-select", "none"); this.css("user-select", "none");
		// *** Add mouse in/out behaviour for whole rapha div
		var elems_to_highlight = [left, right, up, down, zoomin, zoomout];
		jQuery(this).on("mouseenter", function(ev) {
			jQuery.each(elems_to_highlight, function(asi,ashape) {
				ashape.attr(shape_attr_mouseenter);
			});
		} );
		jQuery(this).on("mouseleave", function(ev) {
			jQuery.each(elems_to_highlight, function(asi,ashape) {
				ashape.attr(shape_attr);
			});
		} );
		// *** All done, return
		return this;
	};
} () );

Biojs.RaphaelCanvas = Biojs.extend (
/** @lends Biojs.RaphaelCanvas# */
{
  /**
   *  Default values for the options
   *  @name Biojs.RaphaelCanvas-opt
   */
	opt: { target:"YourOwnDivId",   dimension:500 },
  
	constructor: function (options) {
		var self = this;
		self.dim = options.dimension;
		self.target = options.target;
		self.jq = jQuery('#'+self.target);
		self.mousedownEvent = null;
		self.init();
	},
	init: function() {
		var self = this;
		self.rapha = Raphael(self.target, self.dim, self.dim);
		self.fullbox = self.rapha.rect(0,0,self.dim,self.dim).attr({fill:'green',stroke:'black', opacity:0.01});
		self.jq.mousedown( function(e) { self.recordMousedown(e); } );
		self.makeZoomPannable();
		self.setVbox(0,0,self.dim);
	},
	testSetup: function() {
		var self = this;
		for(var x=0; x < self.dim; x+=self.dim/10) {
			for(var y=0; y < self.dim; y+=self.dim/10) {
				self.rapha.text(x, y, x+","+y).attr({'text-anchor':'start'});
				self.rapha.circle(x, y, self.dim/50);
			}
		}
	},
	makeZoomPannable: function() {
		var self = this;
		self.jq.mouseup( function(e) { self.zoompan(e); self.zoompanstarted = null; } );
		self.jq.mousemove( function(e) { self.zoompan(e) ;} );
	},
	setVbox: function(x,y,dim) {
		var self = this;
		self.rapha.setViewBox(x,y,dim,dim,true);
		self.curVbox = [x,y,dim];
	},
	zoompan: function(e) {
		var self = this;
		e.preventDefault();
		if(!self.zoompanMouseactivity(e)) return;
		if(self.zoompanstarted != 1) return;
		//console.log("zoompan event", e.button, e.buttons, e.which);
		var pxy = self.event2paperxy(e);
		var pxy1 = self.event2paperxy(self.mousedownEvent);
		var dx = e.clientX - self.mousedownEvent.clientX;
		var pdx = pxy[0] - pxy1[0];
		var dy = e.clientY - self.mousedownEvent.clientY;
		var pdy = pxy[1] - pxy1[1];
		//console.log("zoompan", pdx.toFixed(1), dx.toFixed(1), self.zoom);
		if(Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
		if(e.shiftKey) { // zoom i.e. enlarge viewbox when zoomed in, and make it small when when zoomed out
			dd = self.curVbox[2] - pdx;
			decr = (dd-self.curVbox[2])/2;
			//console.log("viewbox", pxy1, dd);
			self.setVbox(self.curVbox[0]-decr, self.curVbox[1]-decr, dd);
		}
		else { // if(e.ctrlKey) { // pan i.e. change viewbox in such a way that pxy1 goes onto pxy
			//console.log("viewbox", pxy1, self.curVbox[2]);
			dx = pxy1[0]-pxy[0];
			dy = pxy1[1]-pxy[1];
			self.setVbox(self.curVbox[0]+dx, self.curVbox[1]+dy, self.curVbox[2]);
		}
		self.mousedownEvent = e;
	},
	get_standard_vbox_ratios: function() {
		return {'dim_delta':10, 'xy_delta':10};
	},
	pan_down: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0], self.curVbox[1]-delta.xy_delta, self.curVbox[2]);
	},
	pan_left: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0]+delta.xy_delta, self.curVbox[1], self.curVbox[2]);
	},
	pan_right: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0]-delta.xy_delta, self.curVbox[1], self.curVbox[2]);
	},
	pan_up: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0], self.curVbox[1]+delta.xy_delta, self.curVbox[2]);
	},
	zoom_out: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0], self.curVbox[1], self.curVbox[2]+delta.xy_delta);
	},
	zoom_in: function(e) {
		var self = this;
		var delta = self.get_standard_vbox_ratios();
		self.setVbox(self.curVbox[0], self.curVbox[1], self.curVbox[2]-delta.xy_delta);
	},
	zoompanMouseactivity: function(e) {
		var self = this;
		//if(!e.shiftKey && !e.ctrlKey) return false;
		if(e.which != 1) return false;
		return true;
	},
	recordMousedown: function(e) {
		var self = this;
		if(!self.zoompanMouseactivity(e)) return;
		//console.log("mousedown", e);
		e.preventDefault();
		self.mousedownEvent = e;
		self.zoompanstarted = 1;
	},
	event2paperxy: function(e) {
		var self = this;
		// gratefully copied from a http://stackoverflow.com/questions/15257059/how-do-i-get-an-event-in-raphaels-paper-coordinates
		var rect = self.fullbox;
		var bnds = self.jq[0].getBoundingClientRect();
		// adjust mouse x/y
		var mx = e.clientX - bnds.left;
		var my = e.clientY - bnds.top;
		// divide x/y by the bounding w/h to get location %s and apply factor by actual paper w/h
		var fx = mx/bnds.width * rect.attrs.width;
		var fy = my/bnds.height * rect.attrs.height;
		//console.log("event2paper", mx.toFixed(1), my.toFixed(1), fx.toFixed(1), fy.toFixed(1));
		return [fx,fy];
		// TODO make this work even when clicked outside raphael in the divid
	},

  /**
   * Array containing the supported event names
   * @name Biojs.RaphaelCanvas-eventTypes
   */
  eventTypes : [
	/**
	 * @name Biojs.RaphaelCanvas#onClick
	 * @event
	 * @param {function} actionPerformed A function which receives an {@link Biojs.Event} object as argument.
	 * @eventData {Object} source The component which did triggered the event.
	 * @eventData {string} type The name of the event.
	 * @eventData {int} selected Selected character.
	 * @example 
	 * instance.onClick(
	 *    function( objEvent ) {
	 *       alert("The character " + objEvent.selected + " was clicked.");
	 *    }
	 * ); 
	 * 
	 * */
	 "onClick",
	 
	/**
	 * @name Biojs.RaphaelCanvas#onHelloSelected
	 * @event
	 * @param {function} actionPerformed A function which receives an {@link Biojs.Event} object as argument.
	 * @eventData {Object} source The component which did triggered the event.
	 * @eventData {string} type The name of the event.
	 * @eventData {int} textSelected Selected text, will be 'Hello' obviously.
	 * @example 
	 * instance.onHelloSelected(
	 *    function( objEvent ) {
	 *       alert("The word " + objEvent.textSelected + " was selected.");
	 *    }
	 * ); 
	 * 
	 * */
     "onHelloSelected"      
  ] 
});

