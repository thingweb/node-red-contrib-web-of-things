"use strict"

module.exports = function(RED) {
    function subscribeEventNode(config) {
        RED.nodes.createNode(this,config);
        let node = this;

        this.subscription = undefined;
        this.status({});

        if (!config.thing) {
            this.status({fill:"red",shape:"dot",text:"Error: Thing undefined"});
            return;
        } else if (!config.event) {
            this.status({fill:"red",shape:"dot",text:"Error: Choose an event"});
            return;
        };

        
        RED.nodes.getNode(config.thing).consumedThing.then((consumedThing) => {
            node.subscription = consumedThing.subscribeEvent(config.event,
                (resp) => {
                    if (resp) node.send({payload: resp, topic: config.topic})
                    node.status({
                        fill:"green",
                        shape:"dot",
                        text:"Subscribed"
                    });
                },
                (err) => {
                    node.warn(err);
                    node.status({
                        fill:"red",
                        shape:"ring",
                        text: "Subscription error"
                    });
                },
                () => {
                    node.warn("Subscription ended.");
                    node.status({});
                    node.subscription = undefined;
                }
            )

            if (node.subscription) {
                node.status({
                    fill:"green",
                    shape:"dot",
                    text:"Subscribed"
                });
            }
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
    RED.nodes.registerType("subscribe-event",subscribeEventNode);
}