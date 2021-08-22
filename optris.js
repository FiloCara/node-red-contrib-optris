const optris = require("node-optris")
const png = require("fast-png")

// // Function to postprocess palette image to a base64 string
var rawBuff2PNGString = function(buff, w, h) {
    return Buffer.from(png.encode({
        width:w,
        height:h,
        data:buff,
        channels:3
      })).toString("base64")
}

module.exports = function(RED) {
    
    function OptrisNode(config) {
        RED.nodes.createNode(this, config);
        var node  = this;
        node.dllPath = config.dllPath; // Path to libirimager.ddl file
        node.configPath = config.configPath; // Path to config file
        node.formatPath = config.formatPath; // Path to "Formats.def" file
        node.imageType = config.imageType; // Image Type --> Palette (w, h, 3) or Thermal (w, h)
        node.colorPalette = config.colorPalette;
        node.shutterMode = config.shutterMode;
        var running = false;
        var w;
        var h;

        // Try to load the DLL
        try {
            optris.loadDLL(node.dllPath);
        } catch(error) {
            node.error(e);
        }
        
        node.status({fill:"red",shape:"dot",text:"Not recording"});

        node.on('input', function(msg) {

            // Check weather msg has more than 1 "special" attributes
            let msgProps = Object.keys(msg).filter(element => ["start", "stop", "trigger"].includes(element))
            if (msgProps.length > 1) {
                throw new Error("Input message has more than 1 special attributes (start, trigger, reset), please provide only one attribute at a time")
            }
            
            // If property start, then start recording
            if (msg.hasOwnProperty('start') === true) {
                node.status({fill:"red",shape:"yellow",text:"Connecting"})
                try {
                    // Initialize usb communication
                    optris.usb_init(node.configPath, node.formatPath);
                    // Set shutter mode
                    // console.log(optris.set_shutter_mode({"manual":0, "auto":1}[node.shutterMode]))
                    // Load palette (NOT WORKING)
                    // optris.set_palette(optris.colorPalette[node.colorPalette])

                    // Compute image sizes
                    if (node.imageType === "thermal") {
                        [w, h] = optris.get_thermal_image_size();
                    }
                    else if (node.imageType === "palette") {
                        [w, h] = optris.get_palette_image_size();
                    }
                    
                    // Remove garbage images
                    for (let i=0; i < 600; i++) {
                        if (node.imageType === "thermal") {
                            optris.get_thermal_image(w, h);
                        }
                        else if (node.imageType === "palette") {
                            optris.get_palette_image(w, h);
                        }
                    }
                    
                    running = true;
                    node.status({fill:"green",shape:"dot",text:"Ready"});

                } catch (e) {
                    // If any error during DLL loading or USB initialisation
                    node.error(e + " (Have a look at the Node-RED log for further information)");
                    running = false;
                    // Make sure to terminate optris communication
                    optris.terminate();
                    node.status({fill:"red",shape:"dot",text:"Error"});
                }
            }

            else if (msg.hasOwnProperty('trigger') === true) {
                if (node.shutterMode === "manual") {
                    // Reset shutter
                    optris.trigger_shutter_flag();
                }
                else{
                    node.warn("Warning: trigger disabled with AUTO shutter mode");
                }
            }

            // If property reset, then close and release capture object
            else if (msg.hasOwnProperty('reset') === true) {

                    optris.terminate();
                    running = false;
                    node.status({fill:"red",shape:"dot",text:"Stopped"});
            }
            // If input and no 'start', 'reset'or 'trigger', then take a shot
            else {

                try {
                    if (running) {
                        if (node.imageType === "thermal") {
                            var frame = optris.get_thermal_image(w, h);
                        }
                        else if (node.imageType === "palette") {
                            var frame = optris.get_palette_image(w, h);
                            frame = rawBuff2PNGString(frame, w, h);
                        }
                        // Prepare payload     
                        msg.payload = {"image":frame, "width":w, "height":h};
                        node.send(msg);
                    }
                    else {
                        // node.warn("Warning: the camera acquisition is not running, impossible to get the frame")
                    }
                } catch (e) {
                    node.error(e);
                    running = false;
                    // Make sure to terminate optris communication
                    optris.terminate();
                    node.status({fill:"red",shape:"dot",text:"Error"});
                }   
            }
        })
        node.on('close', function() {
            optris.terminate();
            running = false;
            node.status({fill:"red",shape:"dot",text:"Not recording"});
        })
    }
    RED.nodes.registerType("optris",OptrisNode);
};