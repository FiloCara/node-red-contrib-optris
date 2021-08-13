const optris = require("node-optris")

module.exports = function(RED) {
    
    function OptrisNode(config) {
        RED.nodes.createNode(this, config);
        var node  = this;
        
        node.dllPath = config.dllPath; // Path to libirimager.ddl file
        node.configPath = config.configPath; // Path to config file
        node.formatPath = config.formatPath; // Path to "Formats.def" file
        node.imageType = config.imageType; // Image Type --> Palette (w, h, 3) or Thermal (w, h)

        node.status({fill:"red",shape:"dot",text:"Not recording"});

        node.on('input', function(msg) {
            // If property start, then start recording
            if (msg.hasOwnProperty('start') === true) {
                node.status({fill:"yellow",shape:"dot",text:"Connecting"});

                try {
                    // Try to Load
                    optris.loadDLL(node.dllPath);
                    // Initialize usb communication
                    optris.usb_init(node.configPath, node.formatPath);

                    // Compute image sizes
                    if (node.imageType === "thermal_image") {
                        var w, h = optris.get_thermal_image_size();
                    }
                    else if (node.imageType === "palette_image") {
                        var w, h = optris.get_palette_image_size();
                    }
                    
                    // Remove garbage images
                    for (let i=0; i < 300; i++) {
                        if (node.imageType === "thermal_image") {
                            optris.get_thermal_image(w, h);
                        }
                        else if (node.imageType === "palette_image") {
                            optris.get_palette_image(w, h);
                        }
                    }

                    node.status({fill:"green",shape:"dot",text:"Ready"});

                } catch (e) {
                    // If any error during DLL loading or USB initialisation
                    node.error(e);
                    node.status({fill:"red",shape:"dot",text:"Error"});
                }
            }
            // If property reset, then close and release capture object
            else if (msg.hasOwnProperty('reset') === true) {

                    optris.terminate();
                    node.status({fill:"red",shape:"dot",text:"Stopped"});
            }
            // If input and no 'start' or 'reset', then take a shot
            else {

                try {

                    if (node.imageType === "thermal_image") {
                        var frame = optris.get_thermal_image(w, h);
                    }
                    else if (node.imageType === "palette_image") {
                        var frame = optris.get_palette_image(w, h);
                    }
    
                    // Prepare payload     
                    msg.payload = {"image":frame, "w":w, "h":h};
                    node.send(msg);

                } catch (e) {
                    node.error(e);
                    node.status({fill:"red",shape:"dot",text:"Error"});
                }   
            }
        })
        node.on('close', function() {
            optris.terminate();
            node.status({fill:"red",shape:"dot",text:"Not recording"});
        })
    }
    RED.nodes.registerType("optris",OptrisNode);
};