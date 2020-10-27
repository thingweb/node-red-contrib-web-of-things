"use strict"

module.exports = function(RED) {
    function invokeActionNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;

        if (!config.thing) {
            this.status({fill:"red",shape:"dot",text:"Error: Thing undefined"});
            return;
        } else if (!config.action) {
            this.status({fill:"red",shape:"dot",text:"Error: Choose an action"});
            return;
        };

        this.on('input', function(msg) {
            RED.nodes.getNode(config.thing).consumedThing.then((consumedThing) => {
                if (msg.payload["uriVariables"]) {
                    var input = msg.payload["input"];
                    var uriVariables = msg.payload["uriVariables"];
                    uriVariables = {uriVariables};
                } else {
                    var input = msg.payload;
                    var uriVariables = undefined;
                }
                consumedThing.invokeAction(config.action, input, uriVariables)
                    .then((resp) => {
                        if (resp) node.send({payload: resp, topic: config.topic})
                        node.status({
                            fill:"green",
                            shape:"dot",
                            text:"invoked"
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
            })
        });

        this.on('close', function(removed, done) {
            if (removed) {
                // This node has been deleted
            } else {
                // This node is being restarted
            }
            done();
        });
    }
    RED.nodes.registerType("invoke-action", invokeActionNode);
}