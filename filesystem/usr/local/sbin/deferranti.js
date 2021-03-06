#!/usr/local/bin/shjs
require('shelljs/global');
require('/var/www/html/region.js');

var fs = require('fs');

var mainDir='/var/www';
var styleDir='/var/www/mapnik-style';

var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var unzip = require('unzip');
var files;
var osm = '/var/www/osm/';
var polyFilename = env.region+'.poly';
var pbfFilename =  env.region+'-latest.osm.pbf';

var inside = require('point-in-polygon');

var postgresDir = mainDir+'/postgresql';

mkdir('-p', osm+env.region);

files = getFileList(osmpoly.geometry.coordinates);
console.log('The following files are required:');
deFerranti = files.deFerranti;
console.dir(deFerranti);

for(var file in deFerranti){
	var dirname = mainDir+'/deferranti/'+file;
	if(test('-d', dirname)){
		console.log('Directory',dirname,'already present');
		createSymlinks(file);
	}
	else{
		downloadDeFerranti(file);
	}
}
	
function downloadDeFerranti(file){
	var target = 'http://www.viewfinderpanoramas.org/dem3/'+file+'.zip';
	console.log('Downloading', target);
	request(target)
	.pipe(fs.createWriteStream(file+'.zip'))
	.on('close', function(){
		console.log('Downloaded file', file);
		extract(file);
	});
}

function extract(file){
	fs.createReadStream(file+'.zip')
	.pipe(unzip.Extract({ path: '/var/www/deferranti' }))
	.on('close', function(){
		console.log('Unzipping of',file,'complete, removing zip file');
		rm(file+'.zip');
		createSymlinks(file);
	});
}

function createSymlinks(folder){
	console.log('Creating symlinks for', folder);
	for(var file in files.deFerranti[folder]){
		var source = '/var/www/deferranti/'+folder+'/'+file;
		if(test('-f', source)){
			ln('-sf', source, '/var/www/'+file);
		}
	}
}

function getBB(poly){
	var bbox = {
		xmax: -360,
		ymax: -360,
		xmin: 360,
		ymin: 360
	};
	
	poly.forEach(function(point){
		bbox.xmax = Math.max(bbox.xmax, point[0]);
		bbox.ymax = Math.max(bbox.ymax, point[1]);
		bbox.xmin = Math.min(bbox.xmin, point[0]);
		bbox.ymin = Math.min(bbox.ymin, point[1]);
	});
	return bbox;
}

function getFileList(poly){
	var bb = getBB(poly);
	console.log('Bounding Box:');
	console.dir(bb);
	console.log('DEM_BOUNDING_BOX: '+env.DEM_BOUNDING_BOX);
	var deFerranti = {};
	var hgtList = {};
	for(var x=Math.floor(bb.xmin); x<=Math.floor(bb.xmax); x++){
		for(var y=Math.floor(bb.ymin); y<=Math.floor(bb.ymax); y++){
			var tilePoly = [[x,y],[x,y+1],[x+1,y],[x+1,y+1]];
			// check if one of the four corners of a given 
			// tile is inside the polygon or one of the points
			// of the polygon is inside the four courners of the tile
			var useBB = env.DEM_BOUNDING_BOX===true || env.DEM_BOUNDING_BOX==="true";
			var required = useBB || polyOverlap(tilePoly, poly);
			if(required){
				var zipName = getDeFerrantiName([x,y]);
				var fileName = coorToName([x,y]);
				if(!deFerranti[zipName]){
					deFerranti[zipName]={};
				}
				deFerranti[zipName][fileName]=true;
				hgtList[fileName]=true;
			}
		}
	}
	return({
		deFerranti: deFerranti,
		hgtFiles: hgtList
	});
}

function polyOverlap(a,b){
	return pointOfFirstInSecond(a,b) || pointOfFirstInSecond(b,a);
}
function pointOfFirstInSecond(first, second){
	for (var i=0; i<first.length; i++){
		if(inside(first[i], second)){
			return true;
		}
	}
}

function coorToName(coor){
	return (coor[1]>0?'N':'S')+pad(coor[1],2)+(coor[0]>0?'E':'W')+pad(coor[0],3)+'.hgt';
}
function pad(num, size) {
    var s = "00" + Math.abs(num);
    return s.substr(s.length-size);
}
function getDeFerrantiName(coor){
	var x=Math.floor(1+Math.floor(180+coor[0])/6);
	var y=String.fromCharCode(65+Math.floor(Math.abs(coor[1]/4)));
	return (coor[1]<0?'S':'')+y+x;
}
	
