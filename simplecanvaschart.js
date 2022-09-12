/* simplecanvaschart.js
 * Simple chart creator for HTML5 Canvas
 * Copyright (C) 2022 Jaret Jay Cantu
 * Licensed under the AGPL
 */

function SimpleCanvasChart(id, w, h) {
	// DOM set up
	// XXX Maybe move this into a resize() function
	this.area = SimpleCanvasChart.mustGet(id);

	this.canvas = document.createElement('canvas');
	this.canvas.width = w;
	this.canvas.height = h;
	this.canvas.onmousemove = SimpleCanvasChart.mouseMove;
	// Set up reflexive reference on mouseMove
	SimpleCanvasChart.mouseMove.ref = this;

	this.context = this.canvas.getContext('2d');
	
	this.area.appendChild(this.canvas);

	// bookkeeping setup
	this.padding = Math.floor(Math.min(w,h) * 0.02);
	this.paddingB = this.padding<<1;
	this.paddingR = this.padding<<3;

	this.fgColor = "#000000";
	this.bgColor = "#ffffff";

	this.data = [];
	this.lines = [];
	this.minX = 0;
	this.maxX = 0;
	this.minY = 0;
	this.maxY = 0;
	this.xIndeces = {}; // hold pre-calculated values
	this.highlight = null;
}

// member constants
SimpleCanvasChart.DEFAULT_COLORS = [
		'#C00',
		'#00C',
		'#080',
		'#888',
		'#808',
		'#088',
		'#C80',
		'#600',
		'#006',
		'#040',
		'#333',
		'#404',
		'#840',
		'#044',
	];

// static functions
SimpleCanvasChart.mustGet = function(id) {
	var el = document.getElementById(id);
	if (!el)
		throw("Could not find element " + id);
	return el;
}

// member functions
//  drawing functions
SimpleCanvasChart.prototype.strokeLine = function(x1,y1, x2,y2, style, dash) {
	var ctx = this.context;
	ctx.save();
	ctx.beginPath();
	if (isDefined(style))
		ctx.strokeStyle = style;
	if (isDefined(dash))
		ctx.setLineDash(dash);
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.restore();
}

SimpleCanvasChart.prototype.setData = function(data, minX, maxX) {
	var l, e;

	this.data = data;
	if (arguments.length > 1) {
		this.minX = minX;
		this.maxX = maxX;
	}	
	this.highlight = null;

	// determine minimum/maximum vertical values
	// Initialize both to zero instead of +/-Infinity since we always want
	// at least this extent.
	var minY = 0;
	var maxY = 0;
	var lastX = maxX-minX;
	var defaultColorDex = 0;
	for (e=0; e<data.length; e++) {
		var el = data[e][2];
		// Assign a color if one isn't provided
		if (data[e][1] == '') {
			if (defaultColorDex >=
					SimpleCanvasChart.DEFAULT_COLORS.length)
				// Generate a random color
				data[e][1] = 'rgb(' +
					Math.floor(Math.random()*256) + ',' +
					Math.floor(Math.random()*256) + ',' +
					Math.floor(Math.random()*256) + ')';
			else
				// Use a pre-approved color from a list
				data[e][1] = SimpleCanvasChart.DEFAULT_COLORS[
							defaultColorDex++];
		}
		for (l=0; l<=lastX; l++) {
			var y = el[l];
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}
	// Convert to a nice, round boundary
	minY = Math.floor(minY/10)*10;
	maxY = Math.ceil(maxY/10)*10;
	this.minY = minY;
	this.maxY = maxY;

	// calculate X indeces
	var vw = this.canvas.width - this.paddingR - this.padding;
	var hview = maxX-minX;
	this.xIndeces = {};
	for (l=minX; l<=maxX; l++) {
		this.xIndeces[l] = this.padding +
				Math.floor(vw * (l-minX)/hview);
	}

	// Populate points for use in draw and mouseOver
	this.lines = [];
	var bot = this.canvas.height - this.paddingB;
	var vrange = bot - this.padding;
	var vview = maxY-minY;
	for (e=0; e<data.length; e++) {
		var el = data[e][2];
		var line = [];
		for (l=minX; l<=maxX; l++) {
			line.push(bot - vrange*(el[l-minX]-minY)/vview);
		}
		this.lines.push(line);
	}

	this.draw(); // update to new data set
}

SimpleCanvasChart.prototype.unfocus = function() {
	// Only redraw if there is something to unfocus
	if (this.highlight == null) return;
	this.highlight = null;
	this.draw();
}

SimpleCanvasChart.mouseMove = function(evt) {
	SimpleCanvasChart.mouseMove.ref.mouseMove(evt);
}
SimpleCanvasChart.prototype.mouseMove = function(evt) {
	if (evt) evt = window.event; // IE

	// check if X is within a usable range
	var x = (evt.clientX - this.canvas.offsetLeft
			+ (document.documentElement.scrollLeft ||
			   document.body.scrollLeft) ); // / zoomFactor
	for (var xx=this.minX; xx<=this.maxX; xx++) {
		if (Math.abs(x - this.xIndeces[xx]) < this.padding)
			break;
	}
	if (xx > this.maxX) {
		this.unfocus();
		return true;
	}

	xx-= this.minX;

	// check if Y is on a line
	var y = (evt.clientY - this.canvas.offsetTop
			+ (document.documentElement.scrollTop ||
			   document.body.scrollTop) ); // / zoomFactor
	for (var d=0; d<this.lines.length; d++) {
		if (Math.abs(y - this.lines[d][xx]) < this.padding) {
			this.highlight = [x, y, d, xx];
			this.draw();
			return true;
		}
	}

	this.unfocus();

	return true;
}

SimpleCanvasChart.prototype.draw = function() {
	var ctx = this.context;
	var pad = this.padding;
	var minX = this.minX;
	var maxX = this.maxX;
	var minY = this.minY;
	var maxY = this.maxY;
	var xIndeces = this.xIndeces;
	var tEx = pad>>2; // tick Extend
	var w = this.canvas.width;
	var h = this.canvas.height;
	var bot = h-this.paddingB;
	var botL = bot + (bot-pad) * (minY)/(maxY-minY);
	var l;

	ctx.save();
	// clear
	ctx.fillStyle = this.bgColor;
	ctx.fillRect(0,0, w,h);

	ctx.strokeStyle = this.fgColor;
	ctx.lineWidth = 2;
	ctx.fillStyle = this.fgColor;
	ctx.textBaseline = 'top';
	ctx.font = "12px sans-serif";
	this.strokeLine(pad-tEx,pad, pad+tEx,pad); // left line topper
	ctx.fillText(maxY, (pad*3)>>1,pad); // top label
	var dash = [2, pad];
	for (l=minX; l<=maxX; l++) {
		// draw label
		ctx.fillText(l, xIndeces[l]-tEx, bot+(tEx<<1));
		if (l == minX) continue;
		// draw guide lines
		this.strokeLine(xIndeces[l], pad, xIndeces[l], bot,
				"#dddddd", dash);
		// draw a tick for each level
		this.strokeLine(xIndeces[l], botL-tEx, xIndeces[l], botL+tEx);
	}

	// draw legend under guide lines
	this.strokeLine(pad,pad, pad,bot); // left line
	this.strokeLine(pad,botL, w-this.paddingR,botL); // bottom line

	// draw lines
	for (var e=0; e<this.data.length; e++) {
		var data = this.data[e];
		var line = this.lines[e];
		var hl = (this.highlight && this.highlight[2] == e);
		ctx.strokeStyle = data[1];
		if (hl)
			ctx.lineWidth = 3;
		else
			ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(xIndeces[minX], line[0]);
		for (l=minX+1; l<=maxX; l++) {
			ctx.lineTo(xIndeces[l], line[l-minX]);
		}
		ctx.stroke();

		if (hl) continue; // print on top of other labels
		ctx.fillStyle = this.fgColor;
		ctx.fillText(data[0], xIndeces[maxX]+(pad>>2), line[maxX-minX]);
	}

	if (this.highlight) {
		var hl = this.highlight;
		var data = this.data[hl[2]];
		var pt = Math.round(100*data[2][hl[3]])/100.0;
		var tp = 5;
		var txtW = ctx.measureText(pt).width + (tp<<1);
		var txtH = 12 + (tp<<1);
		var hlX = hl[0] - (txtW>>1);
		var hlY = hl[1] - txtH;
		ctx.fillStyle = '#CCCCCC';
		ctx.globalAlpha = 0.5;
		ctx.fillRect(hlX, hlY, txtW, txtH );
		ctx.globalAlpha = 1;
		ctx.fillStyle = this.fgColor;
		ctx.fillText(pt, hlX+tp, hlY+tp);

		// print side label
		ctx.fillStyle = '#CCCCCC';
		var txtX = xIndeces[maxX]+(pad>>2);
		var txtY = this.lines[hl[2]][maxX-minX];
		ctx.fillRect(txtX-5, txtY-5,
			     ctx.measureText(data[0]).width+10, 22);
		ctx.fillStyle = this.fgColor;
		ctx.fillText(data[0], txtX, txtY);
	}
	
	ctx.restore();
}
