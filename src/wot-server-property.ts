/** @format */
import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerProperty(config) {
    RED.nodes.createNode(this, config)
    const node = this
    console.log('*** this', this)
    console.log('*** config', config)
    const woTServerConfig = RED.nodes.getNode(config.woTServerConfig) //test
    //console.log('*** RED', RED)
    //console.log('*** RED.nodes', RED.nodes)
    //console.log('*** servientWrapper', woTServerConfig.servientWrapper)
    function addNodeToServientWrapper() {
      const servientWrapper = ServientManager.getInstance().getServientWrapper(
        woTServerConfig.id
      )
      if (servientWrapper) {
        servientWrapper.addUserNode(node)
      } else {
        console.log('*** waiting to prepare servient')
        setTimeout(() => {
          addNodeToServientWrapper()
        }, 100)
      }
    }
    addNodeToServientWrapper()

    // WoTServerConfigノードからプロパティを取得する
    node.getProps = () => {
      return {
        attrType: 'properties',
        name: config.propertyName,
        outputAttr: config.outParams2_writingValueConstValue,
        content: {
          description: config.propertyDescription,
          type: config.propertyDataType,
          readOnly: config.propertyReadOnlyFlag,
          observable: config.propertyObservableFlag
        }
      }
    }

    // inputイベント
    node.on('input', async (msg, send, done) => {
      // configノードを取得
      const woTServerConfig = RED.nodes.getNode(config.woTServerConfig)
      console.log('*** servientWrapper', woTServerConfig.servientWrapper)

      // 入力パラメータを取得
      node.inParams_propertyName = node.credentials.inParams_propertyName
      if (
        config.inParams_propertyNameConstValue &&
        config.inParams_propertyNameType
      ) {
        node.inParams_propertyName = RED.util.evaluateNodeProperty(
          config.inParams_propertyNameConstValue,
          config.inParams_propertyNameType,
          node,
          msg
        )
      }
      console.log('node.inParams_propertyName:', node.inParams_propertyName)

      // 出力の作成
      // 出力の出力を返す場合
      setOutput(
        config.outParams1_output1Type,
        config.outParams1_output1ConstValue,
        msg,
        this.context(),
        '[value of outParams1_output1]'
      )
      // ここまで

      send(msg)
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
  }
  RED.nodes.registerType('wot-server-property', WoTServerProperty, {
    credentials: {
      inParams_propertyName: { type: 'text' }
    }
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
