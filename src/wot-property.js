"use strict"

module.exports = function(RED) {
    function readPropertyNode(config) {
        RED.nodes.createNode(this,config);
        let node = this;

        this.interval_id = null;
        this.status({});

        if (!config.thing) {
            this.status({fill:"red",shape:"dot",text:"Error: Thing undefined"});
            return;
        } else if (!config.property) {
            this.status({fill:"red",shape:"dot",text:"Error: Choose a property"});
            return;
        } else if (!config.interval) {
            this.status({fill:"red",shape:"dot",text:"Error: Choose an interval"});
            return;
        };

        RED.nodes.getNode(config.thing).consumedThing.then((consumedThing) => {
            this.interval_id = setInterval(
                function readProperty() { 
                    consumedThing.properties[config.property].read()
                        .then((resp) => {
                            node.send({payload: resp, topic: config.topic}) 
                            node.status({
                                fill:"green",
                                shape:"dot",
                                text:"connected"
                            });
                        })
                        .catch((err) => {
                            node.warn(err);
                            node.status({
                                fill:"red",
                                shape:"ring",
                                text: "Response error"
                            });
                        })
                    return readProperty;
                }(),
                config.interval * 1000
            );
        });

        node.on("close", function() {
            if (node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        });

    }
    RED.nodes.registerType("read-property",readPropertyNode);


    function writePropertyNode(config) {
        RED.nodes.createNode(this,config);
        let node = this;

        this.status({});

        if (!config.thing) {
            this.status({fill:"red",shape:"dot",text:"Error: Thing undefined"});
            return;
        } else if (!config.property) {
            this.status({fill:"red",shape:"dot",text:"Error: Choose a property"});
            return;
        };

        RED.nodes.getNode(config.thing).consumedThing.then((consumedThing) => {
            node.on('input', function(msg) {
                consumedThing.properties[config.property].write(msg.payload)
                .then((resp) => {
                    if (resp) node.send({payload: resp, topic: config.topic})
                    node.status({
                        fill:"green",
                        shape:"dot",
                        text:"connected"
                    });
                })
                .catch((err) => {
                    node.warn(err);
                    node.status({
                        fill:"red",
                        shape:"ring",
                        text: err.message
                    });
                })
            });
        })

    }
    RED.nodes.registerType("write-property",writePropertyNode);
}