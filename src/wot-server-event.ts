import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerEvent(config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.status({ fill: 'red', shape: 'dot', text: 'not prepared' })

    // for wot-server-config
    node.getProps = () => {
      return {
        attrType: 'events',
        name: config.eventName,
        outputAttr: config.inParams_eventValueConstValue,
        content: {
          description: config.eventDescription,
          data: { type: config.eventDataType },
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

        node.inParams_eventValue = node.credentials.inParams_eventValue
        if (config.inParams_eventValueConstValue && config.inParams_eventValueType) {
          node.inParams_eventValue = RED.util.evaluateNodeProperty(
            config.inParams_eventValueConstValue,
            config.inParams_eventValueType,
            node,
            msg
          )
        }
        await ServientManager.getInstance()
          .getThing(woTServerConfig.id, node.getThingName())
          .emitEvent(config.eventName, node.inParams_eventValue)
        console.debug('[debug] emitEvent finished. eventName: ', config.eventName)

        // no output
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
  RED.nodes.registerType('wot-server-event', WoTServerEvent, {
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
