module.exports = function (RED) {
  function WoTThingConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    node.getProps = () => {
      return {
        title: config.name,
        description: config.description,
      }
    }
  }

  RED.nodes.registerType('wot-thing-config', WoTThingConfig, {
    credentials: {},
  })
}
