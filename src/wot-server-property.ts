import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerProperty(config) {
    RED.nodes.createNode(this, config)
    const node = this
    node.status({ fill: 'red', shape: 'dot', text: 'not prepared' })
    console.log('*** this', this)
    console.log('*** config', config)

    // WoTServerConfigノードからプロパティの定義を取得する際に呼び出す
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
      try {
        const woTServerConfig = RED.nodes.getNode(config.woTServerConfig)
        console.log('*** servientWrapper', woTServerConfig.servientWrapper)

        console.log('*** woTServerConfig.emitPropertyChange:', config.propertyName)
        await ServientManager.getInstance()
          .getThing(woTServerConfig.id, node.getThingName())
          .emitPropertyChange(config.propertyName)
        console.log('*** emitPropertyChange finished', config.propertyName)

        // 変更されたプロパティ値を入力された場合は出力なし
        done()
      } catch (err) {
        done(err)
      }
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
