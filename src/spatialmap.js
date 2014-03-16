/**
 * 在百度地图上实现空间插值，插值算法是反距离加权法
 * @author:谢非
 */

(function(w){
	var SpatialMapFactory = (function(config) {
		//数据池
		var store = function(smap) {
			var _ = {
				data : [],
				spatialmap : smap
			};
			this.max = 1;
			this.unit = "",
			this.get = function(key){
	            return _[key];
	        };
	        this.set = function(key, value){
	            _[key] = value;
	        };
		};
		store.prototype = {
			setDataSet : function(data) {
				var me = this;
				spatialmap = me.get("spatialmap");
				spatialmap.colorize(data);
				spatialmap.get("legend").update(data.max, data.unit);
				this.max = data.max;
				this.unit = data.unit;
			}
		};
		//图例说明：包括文字说明和颜色条
		var legend = function(config) {
			this.config = config;
			var _ = {
				element : null,
				gradient : null
			};
			this.get = function(key){
	            return _[key];
	        };
	        this.set = function(key, value){
	            _[key] = value;
	        };
	        this.init();
		};
		legend.prototype = {
			init : function() {
				var me = this;
				var config = me.config;
				var offset = config.offset || 10;//离边缘的距离
				var positionCss = "top: " + offset/10 + "px;" + "right: " + offset + "px;";
				var title = config.title || "Legend";

				var element = document.createElement("div");
				element.style.cssText = "border-radius:5px;position:absolute;"+positionCss+"font-family:Helvetica; width:150px;z-index:10000000000; background:rgba(255,255,255,1);padding:7px;border:1px solid black;margin:0;";
            	element.innerHTML = "<h3 style='padding:0;margin:0;text-align:center;font-size:12px;'>"+title+"</h3>";

            	var gradient = document.createElement("div");
            	gradient.style.cssText = ["position:absolute;display:block;width:35px;height:250px;bottom:10px;right:20px;background-image:url(",me.createGradientImage(),");"].join("");
            	me.set("element", element);
            	me.set("gradient", gradient);
			},
			getElement : function() {
				return this.get("element");
			},
			createGradientImage : function(max, unit) {
				var me = this;
				var config = me.config;
				var gradient = config.gradient;
				var max = max;
				var len = gradient.length;
				var gradientArr = [];//颜色数组
				for(var key in gradient){
	                if(gradient.hasOwnProperty(key)){
	                    gradientArr.push({ stop: key, value: gradient[key] });
	                }
	            }
	            gradientArr.sort(function(a, b){
	                return (a.stop - b.stop);
	            });

				var length = gradientArr.length;
				var canvas = document.createElement("canvas");
				var ctx = canvas.getContext("2d");
				canvas.width = "35";
				canvas.height = "250";
				ctx.fillStyle = "white";
				ctx.fillRect(0,0,35,250);
				ctx.fillStyle = "black";
				ctx.font = "normal bold 2px sans-serif";
				ctx.textBaseline = "top";
				ctx.fillText("单位:", 0, 0);
				ctx.fillText(unit, 5, 12);
				var grad = ctx.createLinearGradient(20,240,5,25);
				for(var i = 0; i < length; i++) {
					grad.addColorStop(gradientArr[i].stop, gradientArr[i].value);
				}
				ctx.fillStyle = grad;
            	ctx.fillRect(5,25,15,215);
            	//添加刻度值
            	ctx.strokeStyle = "black";
            	ctx.fillStyle = "black";
            	ctx.font = "normal bold 2px serif";
            	ctx.textAlign = "center";
            	ctx.textBaseline = "center";
            	ctx.beginPath();
            	for(var i = 0; i < length; i++) {
            		ctx.moveTo(15, 240 - 215*gradientArr[i].stop);
            		ctx.lineTo(20, 240 - 215*gradientArr[i].stop);//绘制刻度线
            		if(max != undefined)
            			ctx.fillText(Math.ceil(max*gradientArr[i].stop), 25, 240 - 215*gradientArr[i].stop);//绘制刻度值
            	}
            	ctx.closePath();
            	ctx.stroke();
            	return canvas.toDataURL();
			},
			toRGB : function(color) {
				var rgb = "rgb(" + color.r + "," + color.g + "," + color.b + ")";
				return rgb;
			},
			update : function(max, unit) {
				var me = this;
				var gradient = me.get("gradient");
				gradient.style.cssText = ["position:absolute;display:block;width:35px;height:250px;bottom:10px;right:20px;background-image:url(",me.createGradientImage(max, unit),");"].join("");
			}
		};
		var SpatialMap = function(config) {
			var _ = {
				element : {},
				canvas : {},
				ctx : {},
				width : 0,
				height : 0,
				startColor : {},
				endColor : {},
				gradient : {},
				palette : {},
				alpha : 1
			};
			this.store = new store(this);
			this.get = function(key){
	            return _[key];
	        };
	        this.set = function(key, value){
	            _[key] = value;
	        };
	        this.configure(config);
	        this.init();
		};
		SpatialMap.prototype = {
			configure : function(config) {
				var me = this;
				me.set("element", (config.element instanceof Object)?config.element:document.getElementById(config.element));
				me.set("width", config.width || 0);
				me.set("height", config.height || 0);
				me.set("alpha", config.alpha || 1);
				me.set("gradient", config.gradient || { 0: "rgb(0,0,255)", 0.20: "rgb(0,20,255)", 0.40: "rgb(0,255,255)", 0.60: "rgb(0,255,0)", 0.80: "yellow", 1.0: "rgb(255,0,0)"});    // default is the common blue to red gradient
				if(config.legend) {
					config.legend.gradient = me.get("gradient");
					me.set("legend", new legend(config.legend));
				}
			},
			init : function(config) {
				var me = this;
				var element = me.get("element");
				var canvas = document.createElement("canvas");
				var ctx = canvas.getContext("2d");
				me.initPalette();
				me.set("canvas", canvas);
				me.set("ctx", ctx);
				element.appendChild(canvas);
				if(me.get("legend")) {
					element.appendChild(me.get("legend").getElement());
					element.appendChild(me.get("legend").get("gradient"));
				}
			},
			initPalette : function() {
				var me = this;
	            var canvas = document.createElement("canvas");
	            var gradient = me.get("gradient");
	            canvas.width = "1";
	            canvas.height = "256";
	            ctx = canvas.getContext("2d");
	            grad = ctx.createLinearGradient(0,0,1,256);
	            for(var x in gradient){
	                grad.addColorStop(x, gradient[x]);
	            }
	            ctx.fillStyle = grad;
            	ctx.fillRect(0,0,1,256);
            	me.set("palette", ctx.getImageData(0,0,1,256).data);
			},
			colorize : function(data) {
				//IDW插值算法进行着色
				var me = this;
				var ctx = me.get("ctx");
				var width = me.get("width"), height = me.get("height");
				var image = ctx.createImageData(width, height);
				var imageColored = me.interpolate(data, image, me.get("startColor"), me.get("endColor"), width, height);
				ctx.putImageData(imageColored, 0, 0);
			},
			interpolate : function(data, image, startColor, endColor, width, height) {
				var imgData = image.data;
				var d = data.data;
				var dlen = d.length;
				var palette = this.get("palette");
				//得到点值的二维数组
				var matrixData = [];
				for(var i = 0; i < height; i++) {
					matrixData[i] = [];
					for(var j = 0; j < width; j++) {
						matrixData[i][j] = '';
					}
				}
				for(var i = 0; i < dlen; i++) {
					var point  = d[i];
					matrixData[point.y][point.x] = point.count;
				}

				/**
				 * 插值矩阵数据,时间复杂度O(height*width*len) 
				 * 当height = 356, width = 673, len = 26时为6229288
				 */
				for(var i = 0; i < height; i++) {
					for(var j = 0; j < width; j++) {
						if(matrixData[i][j] == '') {
							var sum0 = 0, sum1 = 0;
							for(var k = 0; k < dlen; k++) {
								sum0 += d[k].count*1.0/((i-d[k].y)*(i-d[k].y) + (j-d[k].x)*(j-d[k].x));
								sum1 += 1.0/((i-d[k].y)*(i-d[k].y) + (j-d[k].x)*(j-d[k].x));
							}
							if(sum1 != 0)
								matrixData[i][j] = sum0/sum1;
							else
								matrixData[i][j] = 0;
						}
					}
				}
				
				//计算数据最大值和最小值
				var min = 99999,max = -99999;
				for(var i = 0; i < height; i++) {
					for(var j = 0; j < width; j++) {
						if(min > matrixData[i][j]) min = matrixData[i][j];
						if(max < matrixData[i][j]) max = matrixData[i][j];
					}
				}
				//更新图片数据
				for(var i = 0; i < height; i++) {
					for(var j = 0; j < width; j++) {
						var radio =(matrixData[i][j] - min) / (max - min);
						var alpha = this.get("alpha");
						imgData[4*(i*width+j)] = palette[Math.floor(radio*255+1)*4-4];
						imgData[4*(i*width+j) + 1] = palette[Math.floor(radio*255+1)*4-3];
						imgData[4*(i*width+j) + 2] = palette[Math.floor(radio*255+1)*4-2];
						imgData[4*(i*width+j) + 3] = Math.floor(255*alpha);
					}
				}
				image.data = imgData;
				return image;
			},
			clear : function() {
				var me = this;
				me.store.set("data", []);
				me.get("ctx").clearRect(0,0,this.get("width"),this.get("height"));
			},
			resize : function() {
				var me = this,
                    element = me.get("element"),
                    canvas = me.get("canvas");
                canvas.width =  me.get("width") || element.style.width.replace(/px/, "");
                this.set("width", canvas.width);
                canvas.height =  me.get("height") || element.style.height.replace(/px/, "");
                this.set("height", canvas.height);
			}
		}
		return {
			create : function(config) {
				return new SpatialMap(config);
			}
		}
	})();
	w.SpatialMapFactory = SpatialMapFactory;
})(window);

/**
 * 百度地图上自定义空间插值覆盖物SpatialmapOverlay
 * 
 */
function SpatialmapOverlay(map, cfg) {
	this._map = map;
	this.conf = cfg;
	this.spatialmap = null;
	this.latlngs = [];
	this.bounds = null;
}
SpatialmapOverlay.prototype = new BMap.Overlay();
SpatialmapOverlay.prototype.initialize = function() {
	var map = this._map;
	var el = document.createElement("div");
	el.style.position = "absolute";
	el.style.top = 0;
	el.style.left = 0;
	el.style.border = 0;
	el.style.width = this._map.getSize().width + "px";
	el.style.height = this._map.getSize().height + "px";
	this.conf.element = el;
	map.getPanes().markerPane.appendChild(el);
	this.spatialmap = SpatialMapFactory.create(this.conf);
	this._div = el;
	return el;
}
SpatialmapOverlay.prototype.draw = function() {

	var currentBounds = this._map.getBounds();
	this.bounds = currentBounds;
	var ne = this._map.pointToOverlayPixel(currentBounds.getNorthEast()), sw = this._map
			.pointToOverlayPixel(currentBounds.getSouthWest()), topY = ne.y, leftX = sw.x, h = sw.y
			- ne.y, w = ne.x - sw.x;

	this.conf.element.style.left = leftX + 'px';
	this.conf.element.style.top = topY + 'px';
	this.conf.element.style.width = w + 'px';
	this.conf.element.style.height = h + 'px';
	this.spatialmap.store.get("spatialmap").resize();

	if (this.latlngs.length > 0) {
		this.spatialmap.clear();

		var len = this.latlngs.length;
		d = {
			max : this.spatialmap.store.max,
			unit : this.spatialmap.store.unit,
			data : []
		};

		while (len--) {
			var latlng = this.latlngs[len].latlng;
			if (!BMapLib.GeoUtils.isPointInRect(latlng, currentBounds)) {
				continue;
			}

			var divPixel = this._map.pointToOverlayPixel(latlng), screenPixel = new BMap.Pixel(
					divPixel.x - leftX, divPixel.y - topY);
			var roundedPoint = this.pixelTransform(screenPixel);
			d.data.push({
						x : roundedPoint.x,
						y : roundedPoint.y,
						count : this.latlngs[len].c
					});
		}
		this.spatialmap.store.setDataSet(d);
	}
}
SpatialmapOverlay.prototype.pixelTransform = function(p) {
	var w = this.spatialmap.get("width"), h = this.spatialmap.get("height");

	while (p.x < 0) {
		p.x += w;
	}

	while (p.x > w) {
		p.x -= w;
	}

	while (p.y < 0) {
		p.y += h;
	}

	while (p.y > h) {
		p.y -= h;
	}

	p.x = (p.x >> 0);
	p.y = (p.y >> 0);

	return p;
}
SpatialmapOverlay.prototype.setDataSet = function(data) {
	var mapdata = {
		unit : data.unit,
		max : data.max,
		data : []
	};
	var d = data.data, dlen = d.length;

	this.latlngs = [];

	while (dlen--) {
		var latlng = new BMap.Point(d[dlen].lng, d[dlen].lat);
		this.latlngs.push({
					latlng : latlng,
					c : d[dlen].count
				});
		var point = this.pixelTransform(this._map.pointToOverlayPixel(latlng));
		mapdata.data.push({
					x : point.x,
					y : point.y,
					count : d[dlen].count
				});
	}
	this.spatialmap.clear();
	this.spatialmap.store.setDataSet(mapdata);
	this.draw();
}
