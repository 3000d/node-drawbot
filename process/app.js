/*
 * Convert jpg to svg to gcode.
 *
 * d3000 - hello@3000d.be
 */

var path = require('path'),
  fs = require('fs'),
  root = require('../root'),
  exec = require('child_process').exec,
  util = require('util'),

  Communication = require(root.communication + '/communication'),
  GcodeConverter = require(root.process + '/GcodeConverter'),
  Watcher = require(root.common + '/Watcher');

var drawbot = new Communication();
var gcodeConverter = new GcodeConverter({});

var gcodeFiles = [];
var currentGcodeFile;

var bmpWatcher = new Watcher({
  folder: path.resolve(root.data_bmp),
  extensions: ['bmp', 'BMP']
});

var jsonWatcher = new Watcher({
  folder: path.resolve(root.data_json),
  extensions: ['json']
});



drawbot.getSerialPortList(function(ports) {
  drawbot.connect(process.argv[2] || ports[0].comName);

  drawbot.on('connected', function() {
  });

  //processGcodeFile();

  bmpWatcher.on('fileAdded', function(evt) {
    var jsonFileName = 'face_' + Math.round(new Date().getTime() / 1000) + '.json';

    // potrace -i -b geojson -k 0.4 -t 60 -o outputXXX.json bitmapXXX.BMP
    var cmd = 'potrace -i -b geojson -k 0.4 -t 60 -o ' + (root.data_json + '/' + jsonFileName) + ' ' + evt.path;

    exec(cmd, function(error, stdout, stderr) {
      if(error && error !== 'null') {
        drawbot.Log.error(error);
        return;
      }
      if(stderr) {
        drawbot.Log.error(error);
        return;
      }
      drawbot.log('-- Json file created: ' + jsonFileName);
    });
  });

  jsonWatcher.on('fileAdded', function(evt) {
    try {
      var json = require(evt.path);
      var gcode = gcodeConverter.convert(json);
      var gcodeFileName = 'face_' + Math.round(new Date().getTime() / 1000) + '.gcode';

      fs.writeFile(root.data_gcode + '/' + gcodeFileName, gcode, function(err) {
        if(err) {
          drawbot.Log.error('Could not save to gcode');
        } else {
          drawbot.log('-- GCode created: ' + gcodeFileName);
          gcodeFiles.push(gcodeFileName);

          if(!drawbot.isDrawing) {
            processGcodeFile();
          }
        }
      });
    } catch(e) {
      drawbot.Log.error('could not convert json to gcode');
    }
  });

  drawbot.on('drawFinished', function() {
    drawbot.log('-- DRAW FINISHED');
    processGcodeFile(true);
  });
});

var processGcodeFile = function(removeLast) {
  if(removeLast && currentGcodeFile) {
    for(var i = 0; i < gcodeFiles.length; i++) {
      if(gcodeFiles[i] === currentGcodeFile) {
        gcodeFiles.splice(i, 1);
      }
    }
    moveGcodeFile(currentGcodeFile);
  }
  var gcodeFile;
  if(gcodeFiles.length) {
    gcodeFile = gcodeFiles[gcodeFiles.length - 1];
    currentGcodeFile = gcodeFile;

    var gcode = fs.readFileSync(root.data_gcode + '/' + gcodeFile, 'utf8');

    if(gcode) {
      console.log('PROCESS ' + gcodeFile);
      //drawbot.isDrawing = true;
      //setTimeout(function() {
      //  drawbot.isDrawing = false;
      //  drawbot.emit('drawFinished');
      //}, 10000);
      drawbot.batch(gcode);
    }
  }
};

//var getGcodeFile = function() {
//  if(!gcodeFiles.length) {
//    var gcodesInFolder = fs.readdirSync(root.data_gcode);
//    for(var i = 0; i < gcodesInFolder.length; i++) {
//      var fileName = gcodesInFolder[i].split('.');
//
//      if(fileName[fileName.length-1] === 'gcode') {
//        gcodeFiles.push(gcodesInFolder[i]);
//      }
//    }
//  }
//
//  if(gcodeFiles.length) {
//    return gcodeFiles[gcodeFiles.length - 1];
//  } else {
//    return null;
//  }
//};

var moveGcodeFile = function(gcodeFileName) {
  fs.renameSync(root.data_gcode + '/' + gcodeFileName, root.data_gcode_processed + '/' + gcodeFileName);
};