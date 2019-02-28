//++++++++++++++++++++++++++++++++++++++//
//           Grid View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GridView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('grid', frame, {'left': tables.left, 'right': tables.right},
              canvas, database, tooltip, GridMapPainter);

        // set left table properties
        this.tables.left.filterByDirection('output');

        // set right table properties
        this.tables.right.snap = 'bottom';
        this.tables.right.filterByDirection('input');

        // set global table properties
        for (var i in this.tables) {
            let t = this.tables[i];
            t.showDetail(false);
            t.expand = true;
            t.scrolled = 0;
            t.zoomed = 1;
        }

        let self = this;
        this.database.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        this.map_pane;
        this.escaped = false;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;


        this.tables.left.collapseHandler = function() {
            if (self.tables.left.expandWidth != self.leftExpandWidth) {
                self.leftExpandWidth = self.tables.left.expandWidth;
                self.resize(null, 500);
            }
            self.drawMaps();
        };
        this.tables.right.collapseHandler = function() {
            if (self.tables.right.expandWidth != self.rightExpandWidth) {
                self.rightExpandWidth = self.tables.right.expandWidth;
                self.resize(null, 500);
            }
            self.drawMaps();
        };

        this.update();
        this.leftExpandWidth = 200;
        this.rightExpandWidth = 200;
        this.resize(null, 500);

        // move svg canvas to front
        $('#svgDiv').css({'position': 'relative', 'z-index': 2});
    }

    _resize(duration) {
        let self = this;
        this.tables.left.adjust(0, this.rightExpandWidth-20, this.leftExpandWidth,
                                this.frame.height - this.rightExpandWidth + 20,
                                0, duration, null, 0, this.frame.width);
        this.tables.right.adjust(this.leftExpandWidth-20, this.rightExpandWidth,
                                 this.rightExpandWidth,
                                 this.frame.width - this.leftExpandWidth + 20,
                                 -Math.PI * 0.5, duration,
                                 function() {self.draw(500)},
                                 this.rightExpandWidth-this.frame.height,
                                 this.frame.height);
        this.mapPane.left = this.leftExpandWidth;
        this.mapPane.width = this.frame.width - this.leftExpandWidth;
        this.mapPane.top = this.rightExpandWidth;
        this.mapPane.height = this.frame.height - this.rightExpandWidth;
        this.mapPane.cx = this.mapPane.left + this.mapPane.width * 0.5;
        this.mapPane.cy = this.mapPane.top + this.mapPane.height * 0.5;

        $('#svgDiv').css({'left': this.mapPane.left,
                          'top': this.mapPane.top});
        $('svg').css({'left': -this.mapPane.left,
                      'top': -this.mapPane.top});
    }

    draw(duration) {
        this.drawMaps(duration);
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'maps'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        let updated = false;
        if (elements.indexOf('devices') >= 0) {
            this.updateDevices();
            let grow = false;
            if (this.tables.left.expandWidth != this.leftExpandWidth) {
                this.leftExpandWidth = this.tables.left.expandWidth;
                grow = true;
            }
            if (this.tables.right.expandWidth != this.rightExpandWidth) {
                this.rightExpandWidth = this.tables.right.expandWidth;
                grow = true;
            }
            if (grow)
                this.resize(null, 500);
            updated = true;
        }
        if (elements.indexOf('maps') >= 0) {
            this.updateMaps();
            updated = true;
        }
        if (updated)
            this.draw(500);
    }

    cleanup() {
        super.cleanup();

        // reposition svg canvas and send to back
        $('#svgDiv').css({'z-index': 0,
                          'left': 0,
                          'top': 0});
        $('svg').css({'left': 0,
                      'top': 0});

        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });
    }
}

class GridMapPainter extends ListMapPainter
{
    constructor(map, canvas) {super(map, canvas);}

    betweenTables(src, dst)
    {
        let srctodst = src.vx == 1;
        let mid = srctodst ? {x: dst.x, y: src.y} : {x: src.x, y: dst.y};
        let end = srctodst ? {x: dst.x, y: dst.y < src.y ? dst.y : src.y}
                           : {x: dst.x < src.x ? dst.x : src.x, y: dst.y};

        this.pathspecs[0] = [['M', src.x, src.y],
                            ['L', mid.x, mid.y],
                            ['L', end.x, end.y],
                            ['L', mid.x, mid.y],
                            ['Z']];

        if (typeof dst.left === 'undefined') // dst is not a table row
        {
            this.pathspecs[1] = null;
            return;
        }

        let stroke = this.attributes[1]['stroke-width'];
        if (srctodst) this.pathspecs[1] = 
            [['M', dst.x, src.top + stroke + 1],
             ['L', dst.left + stroke, src.top + src.height - stroke + 2],
             ['l', dst.width - stroke - 2, 0],
             ['Z']]

        else this.pathspecs[1] =
            [['M', src.left + stroke, dst.y],
             ['L', src.left + src.width - stroke + 2, dst.top + stroke],
             ['l', 0, dst.height - stroke - 2],
             ['Z']];
    }

    updateAttributes()
    {
        this._defaultAttributes(2);
        this.attributes[0]['stroke-width'] = 2;

        this.attributes[1]['arrow-end'] = 'none';
        this.attributes[1]['stroke-linejoin'] = 'round';
        this.attributes[1]['fill'] = this.map.selected ? 'red' : 'white';
        this.attributes[1]['fill-opacity'] = '100%';

        let src = this.map.src.position;
        let dst = this.map.dst.position;
        if (src.x == dst.x || src.y == dst.y) return;
        else this.attributes[0]['arrow-end'] = 'none';
    }
}
