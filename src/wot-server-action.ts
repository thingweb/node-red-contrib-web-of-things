module.exports = function (RED) {
  function WoTServerAction(config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.status({ fill: 'red', shape: 'dot', text: 'not prepared' })

    // for wot-server-config
    node.getProps = () => {
      return {
        attrType: 'actions',
        name: config.actionName,
        outputArgs: config.outParams1_actionArgsConstValue,
        content: {
          description: config.actionDescription,
          input: {
            type: config.actionInputDataType,
          },
          output: {
            type: config.actionOutputDataType,
          },
        },
      }
    }

    node.setServientStatus = (running: boolean) => {
      if (running) {
        node.status({ fill: 'green', shape: 'dot', text: 'running' })
      } else {
        node.status({ fill: 'red', shape: 'dot', text: 'not prepared' })
      }
    }

    // for wot-server-config
    node.getThingName = () => {
      const woTThingConfig = RED.nodes.getNode(config.woTThingConfig)
      return woTThingConfig.getThingName()
    }

    node.on('close', function (removed, done) {
      if (removed) {
        // This node has been disabled/deleted
      } else {
        // This node is being restarted
      }
      done()
    })

    const woTServerConfig = RED.nodes.getNode(config.woTServerConfig) //test
    woTServerConfig.addUserNode(node)
  }
  RED.nodes.registerType('wot-server-action', WoTServerAction, {
    credentials: {
      inParams_actionName: { type: 'text' },
    },
  })
}
