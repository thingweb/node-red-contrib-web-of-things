module.exports = function (RED) {
  function WoTThingConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    node.getThingName = () => {
      return config.name
    }
  }

  RED.nodes.registerType('wot-thing-config', WoTThingConfig, {
    credentials: {},
  })
}
