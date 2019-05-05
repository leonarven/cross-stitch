var DEFAULTS = {
	colors: [ "ffffff", "000000" ],
	col_size: 32
};


angular.module("app", [])
.run(function( $rootScope, $window, $timeout ){
	var colors = $rootScope.colors = {};
	colors["ffffff"] = new Color( "ffffff" );
	colors["000000"] = new Color( "000000" );

	onResize();
	$rootScope.$watch(function(){ return document.body.clientWidth;  }, onResize );
	$rootScope.$watch(function(){ return document.body.clientHeight; }, onResize );
	document.body.onscroll = ()=>{
		console.log( "onScroll", $rootScope.windowWidth, document.body.clientWidth, $rootScope.windowHeight, document.body.clientHeight );
		onResize();
	};
	setInterval( onResize, 1000 );

	function onResize(){
		var _nw = $rootScope.windowWidth;
		var _nh = $rootScope.windowHeight;
		$rootScope.windowWidth  = document.body.clientWidth;
		$rootScope.windowHeight = document.body.clientHeight;
		if( $rootScope.windowWidth != _nw || $rootScope.windowHeight != _nh ){
			console.log( "onResize() ::", _nw+"x"+_nh, "->", $rootScope.windowWidth+"x"+$rootScope.windowHeight );
			$timeout();
		}
	}
})
.controller("appController", function( $scope, $rootScope, $element, $timeout, $q ){

	$scope.editingColors = false;
	$scope.bg_image = null;
	$scope.localStorage = window.localStorage;

	var settings = window.settings = $scope.settings = {};
	var ctx;
	var colors = $scope.colors = {};
	var loopTimeout;

	/*************************************/

	$scope.selectImage = function( img, offset_x, offset_y, callback ){
		return $q(function( resolve, reject ){
			if( typeof img == "string" ){
				var nimg = new Image();
				nimg.onload = function(){
					resolve( nimg );
				};
				nimg.src = img;
				return;
			} else if( img instanceof Image ){
				resolve( img );
			} else if( img == null & confirm( "Are you sure you want to unselect current background image? (Not saved until next saveable act)" )){
				resolve( null );
			} else reject( "Invalid arguments" );
		}).then(function( img ){
			offset_x = offset_x || 0;
			offset_y = offset_y || 0;

			if( img ){
				$scope.bg_image = $scope.bg_image || {};
				$scope.bg_image.img = img;
				$scope.bg_image.x   = offset_x;
				$scope.bg_image.y   = offset_y;

				try {
					delete $scope.bg_image.base64;
					toDataURL( img.src, function( base64 ){
						$scope.bg_image.base64 = base64;
					});
				} catch( err ){
					console.error( err );
				}
			} else {
				$scope.bg_image = null;
			}

			return $scope.bg_image;
		});
	};

	$scope.toggleColorSelection = function( color ){
		if( !color || $scope.selected_color == color ) return $scope.selected_color = null;
		return $scope.selected_color = color;
	};

	$scope.toggleLock = function( val ){
		val = arguments.length == 1 ? !!val : !$scope.locked;
		$scope.locked = val;
	};

	/*************************************/
	$scope.doClearStitches = function(){
		if(!confirm( "Are you sure you want to clear current stitches? (Not saved until next saveable act)" )) return;
		for( var y in settings.grid )
		for( var x in settings.grid[ y ]){
			settings.grid[ y ][ x ] = null;
		}
	}

	$scope.doSelectImage = function(){
		inputFile.click();
		var changeFunction = function(){
			window.removeEventListener( 'change', changeFunction, false );
			var file = inputFile.files[0];
			var reader = new FileReader();
			reader.onload = function (event) {
				var base64 = event.target.result
				$scope.selectImage( base64 );
			}
			reader.readAsDataURL( file );
		};
		window.addEventListener("change", changeFunction, false);
	};
	$scope.addColor = function( color ){
		inputColor.click();
		var changeFunction = function(){
			window.removeEventListener( 'change', changeFunction, false );
			var color = inputColor.value;
			$scope._addColor( color );
		};
		window.addEventListener("change", changeFunction, false);
	};
	$scope._addColor = function( color ){
		var ncolor = new Color( color );
		$scope.selected_color = $scope.colors[ ncolor.key ] = $scope.colors[ ncolor.key ] || ncolor;
		$scope.editingColors = false;
		$scope.$digest();
	}
	$scope.rmColor = function( color ){
		var key = color;
		if( typeof color == "object" ) key = color.key;
		if( $scope.selected_color == $scope.colors[ key ]) $scope.selected_color = null;
		delete $scope.colors[ key ];
		$scope.editingColors = false;
	};
	$scope.changeColor = function( oldColor, newColor ){
		console.log( "changeColor", oldColor, newColor );
	};

	/*************************************/

	$timeout(function(){
		var settings = loadSavedSettings();
		settings.bg_img = { img: "kissa.jpg" };

		return $scope.loadSettings( settings );
	}).then(function(){

		$scope.toggleLock( false );

		$timeout( loop );
	});

	/*************************************/

	function render(){
		ctx.clearRect( 0, 0, ctx.canvas.width, ctx.canvas.height );

		if( $scope.bg_image ){
			ctx.globalAlpha = settings.bg_opacity;
			ctx.drawImage( $scope.bg_image.img, 0, 0 );
			ctx.globalAlpha = 1;
		}

		var col_size = settings.col_size;

		for( var y in settings.grid )
		for( var x in settings.grid[ y ]){
			if( !settings.grid[ y ][ x ]) continue;
			ctx.fillStyle = settings.grid[ y ][ x ].toRGBStr( settings.fg_opacity );
			ctx.fillRect( x * col_size, y * col_size, col_size, col_size );
		}
		
		if( settings.grid_opacity > 0 ){
			ctx.beginPath();
			for( var x = col_size; x < ctx.canvas.width;  x += col_size ){
				ctx.moveTo( x, 0 );
				ctx.lineTo( x, ctx.canvas.height );
			}
			for( var y = col_size; y < ctx.canvas.height; y += col_size ){
				ctx.moveTo( 0, y );
				ctx.lineTo( ctx.canvas.width, y );
			}
			ctx.strokeStyle = "rgba(0,0,0,"+settings.grid_opacity+")";
			ctx.stroke();
		}

	}
	
	function loop(){
		try {
			render();
			loopTimeout = setTimeout( loop, 200 );
		} catch( err ){
			console.error( err );
			debugger;
		}
	}
	function requestLoop(){
		
	}
	function onClick( event ){
		if( !$scope.locked ){
			var x = event.offsetX;
			var y = event.offsetY;

			var Gx = parseInt( x / settings.col_size );
			var Gy = parseInt( y / settings.col_size );

			settings.grid[ Gy ][ Gx ] = settings.grid[ Gy ][ Gx ] == $scope.selected_color ? null : $scope.selected_color;

			$scope.saveSettings();

			clearTimeout( loopTimeout );
			loop();
		}
	}
	$scope.onClick = onClick;

	/***********************************************************************/

	$scope.saveSettings = function(){
		saveSettings( settings );
	};

	$scope.loadSettings = function( _settings ){
		window.settings = $scope.settings = settings = _settings || {};

		settings.grid_lines = settings.grid_lines || {};
		settings.grid_lines.enabled = settings.grid_lines.enabled == null ? true : !!settings.grid_lines.enabled;


		settings.grid_opacity = Math.min( 1, Math.max( 0, settings.grid_opacity || 1 ));

		settings.fg_opacity = Math.min( 1, Math.max( 0, settings.fg_opacity || 1 ));
		settings.bg_opacity = Math.min( 1, Math.max( 0, settings.bg_opacity || 1 ));

		var col_size = parseInt(settings.col_size) || 0;
		if( isNaN( settings.col_size ) || settings.col_size <= 0) col_size = 32;
		settings.col_size = col_size;

		return $q(function( resolve, reject ){
		
			if( settings.bg_base64 ){
				$scope.selectImage( settings.bg_base64 ).then(resolve).catch(reject);
			} else if( settings.bg_img ){
				$scope.selectImage( settings.bg_img.img, settings.bg_img.x, settings.bg_img.y ).then(resolve).catch(reject);
			} else resolve();
		}).then(function( bg_image ){
			var min_w = window.innerWidth;
			var min_h = window.innerHeight;
			if( bg_image ){
				settings.bg_image = bg_image;

				min_w = Math.max( min_w, bg_image.img.width  );
				min_h = Math.max( min_h, bg_image.img.height );
			}
			

			var w = canvas.width  = min_w += min_w % col_size && ( col_size - min_w % col_size );
			var h = canvas.height = min_h += min_w % col_size && ( col_size - min_h % col_size );

			settings.cols = Math.round( w / settings.col_size );
			settings.rows = Math.round( h / settings.col_size );

			ctx = canvas.getContext("2d");

			var _grid = new Array( settings.rows ).fill( null ).map(v=>new Array( settings.cols ).fill( null ));
			
			var _colors = {};
			if( Array.isArray( settings.colors )){
				for( var color of settings.colors ){
					if( !color ) continue;
					_colors[ color ] = new Color( color );
				}
			}
			var clr, x, y;

			for( y in settings.grid || [])
			for( x in settings.grid[ y ] || []){

				if( !(clr = settings.grid[ y ][ x ] || null )) continue;
				
				if( typeof clr == "object" ) clr = clr.key;

				if( !_colors[ clr ]) {
					_colors[ clr ] = new Color( clr );
				}

				_grid[ y ][ x ] = _colors[ clr ];
			}

			if( Object.keys( _colors ).length == 0 ) _colors = Color.build( DEFAULTS.colors );

			window.colors = $scope.colors = settings.colors = colors = _colors;
			window.grid   = $scope.grid   = settings.grid            = _grid;
			
			console.log( "Using colors:",   settings.colors );
			console.log( "Using grid:",     settings.grid );
			console.log( "Using settings:", settings );
		});
	};
});




function Color( key ){
	if( typeof key == "object" ) key = key.key;
	if( key[0] == "#" ) key = key.substr(1);

	this.key      = key;
	this.hex      = "#"+key;
	this.btnStyle = { "background": this.hex };
	
	this.rgb = [ key[0]+key[1], key[2]+key[3], key[4]+key[5] ].map(v=>parseInt(v, 16));
	this.rgbStr = this.rgb.join(",");
}
Color.prototype.toString = function(){ return this.key; }
Color.prototype.toRGBStr = function( opacity ){ return "rgba("+ this.rgbStr +","+ (opacity||1) +")"; }
Color.build = function( arr ){
	var data = {}, v;
	for( var i in arr ){
		v = new Color( arr[ i ]);
		data[ v.key ] = v;
	}
	return data;
}

function loadSavedSettings(){
	var load = JSON.parse(localStorage.getItem( "ristipisto_save" )) || {};
	return load;
};
function saveSettings( settings ){
	var save        = {}, grid;
	save.colors     = Object.keys( settings.colors ) || DEFAULTS.colors;
	save.grid       = [];
	save.col_size   = settings.col_size || DEFAULTS.col_size;
	save.grid_opacity = Math.min( 1, Math.max( 0, settings.grid_opacity || 1 ));
	save.fg_opacity   = Math.min( 1, Math.max( 0, settings.fg_opacity   || 1 ));
	save.bg_opacity   = Math.min( 1, Math.max( 0, settings.bg_opacity   || 1 ));

	settings.bg_image && settings.bg_image.base64 && (save.bg_base64 = settings.bg_image.base64);

	for( var y in settings.grid ){
		save.grid[ y ] = [];
		for( var x in settings.grid[ y ])
			if( settings.grid[ y ][ x ]) save.grid[ y ][ x ] = settings.grid[ y ][ x ].key;
	}

	localStorage.setItem( "ristipisto_save", JSON.stringify( save ));

	console.log( "Saved scene:", save );
}
function toDataURL( url, callback ){
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		var reader = new FileReader();
		reader.onloadend = function(){
			callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	};
	xhr.open('GET', url);
	xhr.responseType = 'blob';
	xhr.send();
}

