module.exports = function (RED) {
  function WoTServerEnd(config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.on('input', async (msg, send, done) => {
      try {
        node.inParams_returnValue = node.credentials.inParams_returnValue
        if (config.inParams_returnValueConstValue && config.inParams_returnValueType) {
          node.inParams_returnValue = RED.util.evaluateNodeProperty(
            config.inParams_returnValueConstValue,
            config.inParams_returnValueType,
            node,
            msg
          )
        }
        msg._wot?.finish(node.inParams_returnValue)
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
  }
  RED.nodes.registerType('wot-server-end', WoTServerEnd, {
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
