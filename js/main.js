"use strict";
var model = new MapperModel();

var view;                       // holds the current view object
var viewIndex;                  // index of current view
var viewData = new Array(3);    // data specific to the view, change 3 the number of views

var mapProperties;
var devFilter;
var saverLoader;
var viewSelector;

var input;

var doSaveAll;

window.onload = init;           // Kick things off

/* The main program. */
function init() {
    // add the top menu wrapper
    $('body').append("<div class=propertiesDiv id='TopMenuWrapper'></div>");

    // add the view wrapper
    $('body').append("<div id='container'></div>");
    $('body').append("<div id='status'></div>");
    $('body').attr('oncontextmenu',"return false;");     // ?

    // init the top menu
    $('#TopMenuWrapper').empty()
    saverLoader = new SaverLoader(document.getElementById("TopMenuWrapper"));
    saverLoader.init();
    viewSelector = new ViewSelector(document.getElementById("TopMenuWrapper"));
    viewSelector.init();
    devFilter = new SignalFilter(document.getElementById("TopMenuWrapper"), model);
    devFilter.init();
    mapProperties = new MapProperties(document.getElementById("TopMenuWrapper"), model);
    mapProperties.init();

    // init controller
    initMonitorCommands();
    initViewCommands();
    initMapPropertiesCommands();

//    window.onresize = function (e) {
//        console.log('main.on_resize()');
//        view.on_resize();
//    };

    let resizing = false;
    window.onresize = function (e) {
        if (!resizing) {
            window.requestAnimationFrame(function() {
                view.on_resize();
                resizing = false;
            });
            resizing = true;
        }
    }

    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    let index = 0;
    setInterval(
        function() {
            switch (index) {
            case 0:
                switch_mode('new');
                command.start();
                command.send('refresh');
                command.send('get_networks');
                command.send('subscribe', 'all_devices');
                command.send('add_devices');
                break;
            case 1:
                command.send('add_signals');
                command.send('add_links');
                break;
            case 2:
                command.send('add_maps');
                window.clearInterval(this);
            }
            index += 1;
        }, 250);
}

/**
 * initialize the event listeners for events triggered by the monitor
 */
function initMonitorCommands() {
    command.register("available_networks", function(cmd, args) {
        model.networkInterfaces.available = args;
        mapProperties.updateNetworkInterfaces(args);
    });
    command.register("active_network", function(cmd, args) {
        model.networkInterfaces.selected = args
        mapProperties.updateNetworkInterfaces(args);
    });
}

/**
 * initialize the event listeners for events triggered by the views
 */
function initViewCommands()
{
    $('.viewButton').on("mousedown", function(e) {
        switch ($(this)[0].id) {
            case "listButton":
                view.switch_view("list");
                break;
            case "canvasButton":
                view.switch_view("canvas");
                break;
            case "graphButton":
                view.switch_view("graph");
                break;
            case "gridButton":
                view.switch_view("grid");
                break;
            case "hiveButton":
                view.switch_view("hive");
                break;
            case "balloonButton":
                view.switch_view("balloon");
                break;
            case "linkButton":
                view.switch_view("link");
                break;
        }
        $('.viewButton').removeClass("viewButtonsel");
        $(this).addClass("viewButtonsel");
    });

    $('#saveAll').on('change', function(e) {
        if (this.checked) {
            doSaveAll = true;
        }
        else {
            doSaveAll = false;
        }
    });


    // TODO: add "save as" option
    $('#saveButton').on('click', function(e) {

        e.stopPropagation();
        let file = { "fileversion": "2.2",
                     "mapping": { "devices": [], "maps": [] }
                   };

        //if we want to save everything, add devices to mapping file as well.
        if (doSaveAll) {
        model.devices.each(function(dev) {
                let d = {'name' : dev.name, 'signals': []};
                dev.signals.each(function(sig) {
                    d.signals.push(sig.name);
                });
                file.mapping.devices.push(d);
            });
        }

        model.maps.each(function(map) {
            if (!map.view)
                return;
            let m = {'sources': [], 'destinations': []};
            let src = {};
            let dst = {};
            for (var attr in map) {
                switch (attr) {
                    // ignore a few properties
                    case 'view':
                    case 'status':
                    case 'key':
                        break;
                    case 'src':
                        src.name = map.src.key;
                        break;
                    case 'dst':
                        dst.name = map.dst.key;
                    case 'expression':
                        // need to replace x and y variables with signal references
                        // TODO: better regexp to avoid conflicts with user vars
                        let expr = map.expression;
                        expr = expr.replace(/y\[/g, "dst[");
                        expr = expr.replace(/y\s*=/g, "dst=");
                        expr = expr.replace(/x\[/g, "src[");
                        expr = expr.replace(/\bx(?!\w)/g, "src[0]");
                        m.expression = expr;
                        break;
                    case 'process_location':
                        let loc = map[attr];
                        if (loc == 1)
                            m.process_location = 'source';
                        else if (loc == 2)
                            m.process_location = 'destination';
                        break;
                    default:
                        if (!map.hasOwnProperty(attr))
                            break;
                        if (attr.startsWith('src_')) {
                            let key = attr.slice(4);
                            if (key == 'min' || key == 'max')
                                src[key + 'imum'] = map[attr];
                            else
                                src[key] = map[attr];
                        }
                        else if (attr.startsWith('dst_')) {
                            let key = attr.slice(4);
                            if (key == 'min' || key == 'max')
                                dst[key + 'imum'] = map[attr];
                            else
                                dst[key] = map[attr];
                        }
                        else
                            m[attr] = map[attr];
                        break;
                }
            }
            m.sources.push(src);
            m.destinations.push(dst);
            file.mapping.maps.push(m);
        });

        let link = document.createElement('a');
        let blob = new Blob([JSON.stringify(file, null, '\t')]);
        let url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'mapping.json');
        link.click();
    });

    $('#loadButton').click(function(e) {
        e.stopPropagation();
        input.trigger("click"); // open dialog
    });

    $('body').on('keydown.list', function(e) {
        let new_view = null;
        switch (e.which) {
            case 49:
                /* 1 */
                new_view = 'list';
                break;
            case 50:
                /* 2 */
                new_view = 'graph';
                break;
            case 51:
                /* 3 */
                new_view = 'canvas';
                break;
            case 52:
                /* 4 */
                new_view = 'grid';
                break;
            case 53:
                /* 5 */
                new_view = 'hive';
                break;
            case 54:
                /* 6 */
                new_view = 'balloon';
                break;
            case 55:
                /* 7 */
                new_view = 'link';
                break;
            case 79:
                if (e.metaKey == true) {
                    e.preventDefault();
                    input.trigger("click");
                }
                break;
//            default:
//                console.log('key:', e.which);
        }
        if (new_view) {
            view.switch_view(new_view);
            $('.viewButton').removeClass("viewButtonsel");
            $('#'+new_view+'Button').addClass("viewButtonsel");
        }
    });

    $('#container').on('updateView', function(e) {
        view.draw();
    });

    $('#container').on('scrolll', function(e) {
        view.draw(0);
    });

    let wheeling = false;
    let pageX, pageY, deltaX, deltaY, zooming;
    document.addEventListener('wheel', function(e) {
        e.preventDefault();
        if (e.pageY < 107) {
            // not over container
            return;
        }
        pageX = e.pageX;
        pageY = e.pageY;
        deltaX = e.deltaX;
        deltaY = e.deltaY;
        zooming = e.ctrlKey;

        if (!wheeling) {
            window.requestAnimationFrame(function() {
                if (zooming) {
                    view.zoom(pageX, pageY, deltaY);
                }
                else {
                    view.pan(pageX, pageY, deltaX, deltaY);
                }
                wheeling = false;
            });
        }
        wheeling = true;
    });

    // Search function boxes
    $('#srcSearch, #dstSearch').on('input', function(e) {
        e.stopPropagation();
        let id = e.currentTarget.id;
        view.filter_signals(id, $('#'+id).val());
    });

    // from list view
    // requests links and maps from the selected device (tab)
    $("#container").on("tab", function(e, tab){
        if (tab != 'All Devices') {
            // retrieve linked destination devices
            model.links.each(function(link) {
                if (tab == link.src)
                    command.send('subscribe', link.dst);
                else if (tab == link.dst)
                    command.send('subscribe', link.src);
            });
            command.send('subscribe', tab);
        }
    });

    // link command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("link", function(e, src, dst) {
        model.links.add({ 'src' : src, 'dst' : dst, 'num_maps': [0, 0] });
    });

    // unlink command
    // src = "devicename"
    // dst = "devicename"
    $("#container").on("unlink", function(e, src, dst) {
        model.links.remove(src, dst);
    });

    // map command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("map", function(e, src, dst, args) {
        command.send('map', [src, dst, args]);
    });

    // unmap command
    // src = "devicename/signalname"
    // dst = "devicename/signalname"
    $("#container").on("unmap", function(e, src, dst) {
        command.send('unmap', [src, dst]);
    });

    // asks the view for the selected maps and updates the edit bar
    $("#container").on("updateMapProperties", function(e) {
        mapProperties.updateMapProperties();
    });

    // updated the properties for a specific map
    $("#container").on("updateMapPropertiesFor", function(e, key) {
        mapProperties.updateMapPropertiesFor(key);
    });

    // asks the view for the save button link (based on the active device)
    // currently implemented in List view only
    $("#container").on("updateSaveLocation", function(e) {
        mapProperties.updateSaveLocation(view.get_save_location());
    });

    input = $(document.createElement("input"));
    input.attr("type", "file");
    input.on('change', function(e) {
        var f = e.target.files[0];
        let reader = new FileReader();
        reader.onload = (function(file) {
            return function(e) {
                let parsed = tryParseJSON(e.target.result);
                if (!parsed || !parsed.fileversion || !parsed.mapping) {
                    console.log("error: invalid file");
                    reader.abort();
                    return;
                }
                if (parsed.fileversion == "2.2") {
                    if (!parsed.mapping.maps || !parsed.mapping.maps.length) {
                        console.log("error: no maps in file");
                        reader.abort();
                        return;
                    }
                }
                else if (parsed.fileversion == "2.1") {
                    if (   !parsed.mapping.connections
                        || !parsed.mapping.connections.length) {
                        console.log("error: no maps in file");
                        reader.abort();
                        return;
                    }
                }
                else {
                    console.log("error: unsupported fileversion",
                                parsed.fileversion);
                    reader.abort();
                    return;
                }
                console.log("pasred file ", file);
                view.switch_view("link");
                view.parse_file(parsed);
            };
        })(f);
        reader.readAsText(f);
    });
}

function initMapPropertiesCommands()
{
    $("#TopMenuWrapper").on("setMap", function(e, args) {
        command.send('set_map', args);
    });
    $("#TopMenuWrapper").on("refreshAll", function(e) {
        refresh_all();
    });
    $("#TopMenuWrapper").on("selectNetwork", function(e, network) {
        command.send('select_network', network);
    });
}

function refresh_all() {
    model.clearAll();
    command.send('refresh');
}

/**
 * Called by the view selector to change the current view
 */
function switch_mode(newMode)
{
    if (view) {
        // save view settings
        if (typeof view.save_view_settings == 'function')
            viewData[viewIndex] = view.save_view_settings();
        
        // tell the view to cleanup (ex: removing event listeners)
        view.cleanup();
    }
    
    $('#container').empty();
    switch (newMode) {
        case 'classic':
            view = new listView(model);
            viewIndex = 0;
            view.init();
            break;
        case 'new':
            view = new ViewManager(document.getElementById('container'), model);
            viewIndex = 3;
            view.init();
            view.on_resize();
            break;
        default:
            //console.log(newMode);
    }

//    // load view settings (if any)
//    if (viewData[viewIndex]) {
//        if (typeof view.load_view_settings == 'function')
//            view.load_view_settings(viewData[viewIndex]);
//    }

    mapProperties.clearMapProperties();
}

function select_obj(obj) {
    if (obj.view.selected)
        return false;
    obj.view.selected = true;
    obj.view.animate({'stroke': 'red', 'fill': 'red'}, 50);
    obj.view.toFront();
    return true;
}
