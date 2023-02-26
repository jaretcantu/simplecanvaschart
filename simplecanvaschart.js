/* simplecanvaschart.js
 * Simple chart creator for HTML5 Canvas
 * Copyright (C) 2022-2023 Jaret Jay Cantu
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
	this.lineStyle = [];
	this.minX = 0;
	this.maxX = 0;
	this.minY = 0;
	this.maxY = 0;
	this.xIndeces = {}; // hold pre-calculated values
	this.highlight = [];
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

SimpleCanvasChart.inRange = function(a,b, p) {
	var min = (a<b ? a:b);
	var max = (a>b ? a:b);
	return (max-min) <= (p*max);
}

SimpleCanvasChart.addRange = function(rng, start, size) {
	var stop = start + size;
	// search for range
	for (var i=0; i<rng.length; i++) {
		var c = rng[i];
		if (stop == c[0]) {
			// Merge ranges
			c[0] = start;
			return start;
		} else if (c[0] <= stop && c[1] > stop) {
			// Readjust before this element
			return SimpleCanvasChart.addRange(rng, start-size,size);
		} else if (stop < c[0]) {
			// Insert range before
			rng.splice(i, 0, [start,stop]);
			return start;
		} else if (start >= c[0] && start < c[1]) {
			// Readjust after this element
			return SimpleCanvasChart.addRange(rng, c[1], size);
		} else if (start == c[1]) {
			var nxt = i+1;
			if (nxt>=rng.length || rng[nxt][0] > stop) {
				// Join after and enough room to append
				c[1] = stop;
				return start;
			} else { // Not enough room to append
				// Account for the space that is here
				size = (stop - rng[nxt][0]);
				// Merge nodes
				c[1] = rng[nxt][1];
				rng.splice(nxt, 1);
				// Try again
				return SimpleCanvasChart.addRange(rng,
								  c[1], size);
			}
		}
	}
	// append new range
	rng.push([start, stop]);
	return start;
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

SimpleCanvasChart.pointSort = function(a, b, level) {
	var va = a[level];
	var vb = b[level];
	if (va < vb) return -1;
	if (va > vb) return  1;
	if (level <= 1) return 0;
	return SimpleCanvasChart.pointSort(a, b, level-1);
}

SimpleCanvasChart.prototype.setData = function(data, minX, maxX) {
	var l, e;

	if (arguments.length > 1) {
		this.minX = minX;
		this.maxX = maxX;
	}	
	this.highlight = [];

	// Determine minimum/maximum vertical values
	// Initialize both to zero instead of +/-Infinity since we always want
	// at least this extent.
	// Also perform other preprocessing.
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
		// Determine the min and max vertical range
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

	var sortedData = data.sort(function(a,b) {
			return SimpleCanvasChart.pointSort(a[2],b[2], 15);
		});

	// Populate points for use in draw and mouseOver
	this.lines = [];
	var bot = this.canvas.height - this.paddingB;
	var vrange = bot - this.padding;
	var vview = maxY-minY;
	var rng = [];
	var rngSz = 10;
	for (e=0; e<sortedData.length; e++) {
		var el = sortedData[e][2];
		var line = [];
		for (l=minX; l<=maxX; l++) {
			line.push(Math.round(bot - vrange*(el[l-minX]-minY)
						/vview));
		}
		this.lines.push(line);
		// Reserve label position
		SimpleCanvasChart.addRange(rng,line[maxX-minX],rngSz);
	}
	// Assign label position completely sorted
	var r = 0;
	var subR = 0;
	rng = rng.sort(function(a,b) { return a[0]-b[0]; });
	for (e=sortedData.length-1; e>=0; e--) { // We want highest to lowest
		var pos = rng[r][0] + subR;
		var nr = pos + rngSz;
		if (nr > rng[r][1]) {
			r++;
			subR = 0;
			e++;
			continue;
		}
		sortedData[e][3] = pos;
		subR+= rngSz;
	}

	this.data = sortedData;

	// Check for overlaps
	var overlap = {};
	for (e=0; e<this.lines.length; e++) {
		var line = this.lines[e];
		for (var e2=e+1; e2<this.lines.length; e2++) {
			var line2 = this.lines[e2];
			for (l=minX; l<maxX; l++) {
				var x = l-minX;
				// check if start/stop of points overlap
				if (!(SimpleCanvasChart.inRange(
						line[x], line2[x], 0.01) &&
				      SimpleCanvasChart.inRange(
						line[x+1], line2[x+1], 0.01)))
					continue;
				var ol1, ol2;
				if (!isDefined(overlap[e]))
					overlap[e] = {};
				if (!isDefined(overlap[e2]))
					overlap[e2] = {};
				// check for pre-existing overlaps
				if (isDefined(overlap[e][x]))
					ol1 = overlap[e][x];
				else
					ol1 = null;
				if (isDefined(overlap[e2][x]))
					ol2 = overlap[e2][x];
				else
					ol2 = null;
				// merge overlaps
				if (ol1 === null && ol2 === null) {
					ol1 = [];
					ol2 = ol1;
				} else if (ol2 === null) {
					ol2 = ol1;
				} else if (ol1 === null) {
					ol1 = ol2;
				} else if (ol1 !== ol2) {
					// if not already the same, combine
					var old = ol1.slice();
					for (var c=0; c<ol2.length; c++) {
						if (ol1.indexOf(ol2[c]) == -1)
							ol1.push(ol2[c]);
					}
					ol2 = ol1;
				}
				// add the points if they aren't already in
				if (ol1.indexOf(e) == -1) ol1.push(e);
				if (ol1.indexOf(e2) == -1) ol1.push(e2);
				// save back into overlap map
				overlap[e][x] = ol1;
				overlap[e2][x] = ol2;
			}
		}
	}

	// Set dashes based on overlap
	this.lineStyle = [];
	for (e=0; e<this.lines.length; e++) {
		var line = this.lines[e];
		var ls = [];
		for (l=minX; l<maxX; l++) {
			var x = l-minX;
			if (!isDefined(overlap[e]) ||
			    !isDefined(overlap[e][x])) {
				ls.push(null);
			} else {
				var ol = overlap[e][x];
				var segCnt = ol.length;
				var segOn = ol.indexOf(e);
				var segSz = Math.ceil(
				     (this.xIndeces[minX+1]-this.xIndeces[minX])
							/ (2*segCnt));
				if (segOn == 0)
					ls.push([segSz, segSz*(segCnt-1)]);
				else if (segOn == (segCnt-1))
					ls.push([0, segSz*(segCnt-1), segSz,0]);
				else // turn off, then on, then off again
					ls.push([0, segSz*segOn, segSz,
						    segSz*(segCnt-segOn-1)]);
			}
		}
		this.lineStyle.push(ls);
	}

	this.draw(); // update to new data set
}

SimpleCanvasChart.prototype.unfocus = function() {
	// Only redraw if there is something to unfocus
	if (this.highlight.length == 0) return;
	this.highlight = [];
	this.draw();
}

SimpleCanvasChart.mouseMove = function(evt) {
	SimpleCanvasChart.mouseMove.ref.mouseMove(evt);
}
SimpleCanvasChart.prototype.mouseMove = function(evt) {
	if (evt) evt = window.event; // IE

	var x = (evt.clientX - this.canvas.offsetLeft
			+ (document.documentElement.scrollLeft ||
			   document.body.scrollLeft) ); // / zoomFactor
	var y = (evt.clientY - this.canvas.offsetTop
			+ (document.documentElement.scrollTop ||
			   document.body.scrollTop) ); // / zoomFactor

	// check if X is over a label
	if (x > this.xIndeces[this.maxX]) {
		this.highlight = [];
		for (var d=0; d<this.data.length; d++) {
			var labelY = this.data[d][3];
			if (y >= labelY && y < labelY+22) {
				this.highlight.push([x, y, d, this.maxX-1]);
				break; // only draw one label
			}
		}
		this.draw();
		return true; // exit no matter what
	}

	// check if X is within a usable range of chart
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
	var overP = false;
	for (var d=0; d<this.lines.length; d++) {
		if (Math.abs(y - this.lines[d][xx]) < this.padding) {
			if (!overP) {
				overP = true;
				this.highlight = [];
			}
			this.highlight.push([x, y, d, xx]);
		}
	}

	if (overP)
		this.draw();
	else
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
		var ls = this.lineStyle[e];
		// check for highlight
		var hl = false;
		for (var hc=0; hc<this.highlight.length; hc++) {
			if (this.highlight[hc][2] == e) {
				hl = true;
				break;
			}
		}
		ctx.strokeStyle = data[1];
		if (hl)
			ctx.lineWidth = 4;
		else
			ctx.lineWidth = 2;
		for (l=minX; l<maxX; l++) {
			var x = l-minX;
			ctx.beginPath();
			ctx.moveTo(xIndeces[l], line[x]);
			if (hl || ls[x] === null)
				ctx.setLineDash([]);
			else
				ctx.setLineDash(ls[x]);
			ctx.lineTo(xIndeces[l+1], line[x+1]);
			ctx.stroke();
		}

		if (hl) continue; // print on top of other labels
		// draw dot next to label
		ctx.fillStyle = data[1];
		ctx.beginPath();
		ctx.arc(xIndeces[maxX]+(pad>>1), data[3]+3, 3, 0, 2*Math.PI);
		ctx.fill();
		// print label
		ctx.fillStyle = this.fgColor;
		ctx.fillText(data[0], xIndeces[maxX]+pad, data[3]);
	}

	for (var hc=0; hc<this.highlight.length; hc++) {
		var hl = this.highlight[hc];
		var data = this.data[hl[2]];
		var pt = Math.round(100*data[2][hl[3]])/100.0;
		var tp = 5;
		var txtW = ctx.measureText(pt).width + (tp<<1);
		var txtH = 12 + (tp<<1);
		var hlX = hl[0] - (txtW>>1);
		var hlY = hl[1] - txtH;
		if (hc == 0) { // only draw this once
			ctx.fillStyle = '#CCCCCC';
			ctx.globalAlpha = 0.5;
			ctx.fillRect(hlX, hlY, txtW, txtH );
			ctx.globalAlpha = 1;
			ctx.fillStyle = this.fgColor;
			ctx.fillText(pt, hlX+tp, hlY+tp);
		}

		// print side label
		ctx.fillStyle = '#CCCCCC';
		var txtX = xIndeces[maxX]+pad;
		var txtY = data[3];
		ctx.fillRect(txtX-2, txtY-2,
			     ctx.measureText(data[0]).width+4, 15);
		ctx.fillStyle = this.fgColor;
		ctx.fillText(data[0], txtX, txtY);
		// draw dot next to label
		ctx.fillStyle = data[1];
		ctx.beginPath();
		ctx.arc(xIndeces[maxX]+(pad>>1), data[3]+3, 3, 0, 2*Math.PI);
		ctx.fill();
	}
	
	ctx.restore();
}
