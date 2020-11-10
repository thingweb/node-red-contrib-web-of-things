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
                const uriVariables = (config.uriVariables)? JSON.parse(config.uriVariables) : undefined;
                consumedThing.invokeAction(config.action, msg.payload, {"uriVariables": uriVariables})
                    .then((resp) => {
                        const payload = (resp)? resp : "";
                        node.send({payload: payload, topic: config.topic});
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