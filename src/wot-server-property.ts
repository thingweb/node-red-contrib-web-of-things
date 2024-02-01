import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerProperty(config) {
    RED.nodes.createNode(this, config)
    const node = this
    node.status({ fill: 'red', shape: 'dot', text: 'not prepared' })

    // for wot-server-config
    node.getProps = () => {
      return {
        attrType: 'properties',
        name: config.propertyName,
        outputAttr: config.outParams2_writingValueConstValue,
        content: {
          description: config.propertyDescription,
          type: config.propertyDataType,
          readOnly: config.propertyReadOnlyFlag,
          observable: config.propertyObservableFlag,
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

    node.on('input', async (msg, send, done) => {
      try {
        const woTServerConfig = RED.nodes.getNode(config.woTServerConfig)

        await ServientManager.getInstance()
          .getThing(woTServerConfig.id, node.getThingName())
          .emitPropertyChange(config.propertyName)
        console.debug('[debug] emitPropertyChange finished. propertyName: ', config.propertyName)

        // No output if changed property value is entered
        done()
      } catch (err) {
        done(err)
      }
    })

    node.on('close', function (removed, done) {
      if (removed) {
        // This node has been disabled/deleted
      } else {
        // This node is being restarted
      }
      done()
    })

    const woTServerConfig = RED.nodes.getNode(config.woTServerConfig) //test
    woTServerConfig?.addUserNode(node)
  }
  RED.nodes.registerType('wot-server-property', WoTServerProperty, {
    credentials: {
      inParams_propertyName: { type: 'text' },
    },
  })

  const setOutput = (type, valueName, msg, context, value) => {
    if (type === 'msg') {
      const names = valueName.split('.')
      let target = msg
      for (let i = 0; i < names.length - 1; i++) {
        let n = names[i]
        if (target[n] && target[n] instanceof Object) {
          target = target[n]
        } else {
          target[n] = {}
          target = target[n]
        }
      }
      target[names[names.length - 1]] = value
    } else if (type === 'node') {
      context.set(valueName, value)
    } else if (type === 'flow') {
      context.flow.set(valueName, value)
    } else if (type === 'global') {
      context.global.set(valueName, value)
    }
  }
}
