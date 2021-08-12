const optris = require("node-optris")

module.exports = function(RED) {
    
    function OptrisNode(config) {
        RED.nodes.createNode(this, config);
        var node  = this;
        node.dllPath = config.dllPath;
        node.configPath = config.configPath;
        node.formatPath = config.formatPath;
        node.imageType = config.imageType;

        node.status({fill:"red",shape:"dot",text:"Not recording"});

        node.on('input', function(msg) {
            // If property start, then start recording
            if (msg.hasOwnProperty('start') === true) {
                node.status({fill:"yellow",shape:"dot",text:"Connecting"});

                try {
                    // Initialize usb communication
                    optris.usb_init(node.configPath, node.formatPath)
                
                } catch (e) {
                    node.error(e)
                }

                // Compute image sizes
                if (node.imageType === "thermal_image") {
                    let w, h = optris.get_thermal_image_size()
                }
                else if (node.imageType === "palette_image") {
                    let w, h = optris.get_palette_image_size()
                }
                
                // Remove garbage images
                for (let i=0; i < 300; i++) {
                    if (node.imageType === "thermal_image") {
                        optris.get_thermal_image(w, h)
                    }
                    else if (node.imageType === "palette_image") {
                        optris.get_palette_image(w, h)
                    }
                }

                node.status({fill:"green",shape:"dot",text:"Ready"});
            }
            // If property reset, then close and release capture object
            else if (msg.hasOwnProperty('reset') === true) {

                    optris.terminate()
                    node.status({fill:"red",shape:"dot",text:"Stopped"});
                 
            }
            // If input and no 'start' or 'reset', then take a shot
            else {

                if (node.imageType === "thermal_image") {
                    let frame = optris.get_thermal_image(w, h)
                }
                else if (node.imageType === "palette_image") {
                    let frame = optris.get_palette_image(w, h)
                }

                // Prepare payload     
                msg.payload = {"image":frame, "w":w, "h":h}
                node.send(msg);
            }
        })
        node.on('close', function() {
            optris.terminate()
            node.status({fill:"red",shape:"dot",text:"Not recording"});
        })
    }
    RED.nodes.registerType("optrisnode",OptrisNode);
};