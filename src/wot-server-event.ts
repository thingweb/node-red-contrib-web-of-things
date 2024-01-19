import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerEvent(config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.status({ fill: 'red', shape: 'dot', text: 'not prepared' })
    console.log('*** this', this)
    console.log('*** config', config)

    // WoTServerConfigノードからイベントの定義を取得する際に呼び出す
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

    // statusを変更
    node.setServientStatus = (running: boolean) => {
      if (running) {
        node.status({ fill: 'green', shape: 'dot', text: 'running' })
      } else {
        node.status({ fill: 'red', shape: 'dot', text: 'not prepared' })
      }
    }

    // thing名の取得
    node.getThingName = () => {
      const woTThingConfig = RED.nodes.getNode(config.woTThingConfig)
      return woTThingConfig.getThingName()
    }

    // inputイベント
    node.on('input', async (msg, send, done) => {
      // configノードを取得
      const woTServerConfig = RED.nodes.getNode(config.woTServerConfig)
      console.log('*** servientWrapper', woTServerConfig.servientWrapper)

      // 入力パラメータを取得
      node.inParams_eventValue = node.credentials.inParams_eventValue
      if (config.inParams_eventValueConstValue && config.inParams_eventValueType) {
        node.inParams_eventValue = RED.util.evaluateNodeProperty(
          config.inParams_eventValueConstValue,
          config.inParams_eventValueType,
          node,
          msg
        )
      }
      console.log('node.inParams_eventValue:', node.inParams_eventValue)
      await ServientManager.getInstance()
        .getThing(woTServerConfig.id, node.getThingName())
        .emitEvent(config.eventName, node.inParams_eventValue)
      console.log('*** emitEvent finished')

      // イベント通知の場合は出力なし
      done()
    })
    // closeイベント
    node.on('close', function (removed, done) {
      if (removed) {
        // This node has been disabled/deleted
      } else {
        // This node is being restarted
      }
      // 処理終了通知
      done()
    })

    const woTServerConfig = RED.nodes.getNode(config.woTServerConfig) //test
    //console.log('*** RED', RED)
    //console.log('*** RED.nodes', RED.nodes)
    woTServerConfig?.addUserNode(node)
    console.log('*** addUserNode finished.', node.id)
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
