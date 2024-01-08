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
      /*node.inParams_changedValue = node.credentials.inParams_changedValue
      if (
        config.inParams_changedValueConstValue &&
        config.inParams_changedValueType
      ) {
        node.inParams_changedValue = RED.util.evaluateNodeProperty(
          config.inParams_changedValueConstValue,
          config.inParams_changedValueType,
          node,
          msg
        )
      }
      console.log('node.inParams_changedValue:', node.inParams_changedValue)*/
      console.log(
        '*** woTServerConfig.emitPropertyChange:',
        config.propertyName
      )
      const servientWrapper = ServientManager.getInstance().getServientWrapper(
        woTServerConfig.id
      )
      await servientWrapper.emitPropertyChange(config.propertyName)
      console.log('*** woTServerConfig.emitPropertyChange finished')

      // 出力の作成
      // 出力の出力を返す場合
      /*setOutput(
        config.outParams2_wriitingValueType,
        config.outParams2_wriitingValueConstValue,
        msg,
        this.context(),
        '[value of outParams1_wriitingValue]'
      )
      // ここまで

      send(msg)*/

      // 変更されたプロパティ値を入力された場合は出力なし
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
