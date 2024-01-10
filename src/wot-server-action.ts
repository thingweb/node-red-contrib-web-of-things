/** @format */
import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerAction(config) {
    RED.nodes.createNode(this, config)
    const node = this
    this.status({ fill: 'red', shape: 'dot', text: 'not prepared' })
    console.log('*** this', this)
    console.log('*** config', config)
    const woTServerConfig = RED.nodes.getNode(config.woTServerConfig) //test
    //console.log('*** RED', RED)
    //console.log('*** RED.nodes', RED.nodes)
    woTServerConfig.addUserNode(node)
    console.log('*** addUserNode finished.', node.id)
    this.status({ fill: 'green', shape: 'dot', text: 'running' })

    // WoTServerConfigノードからプロパティを取得する際に呼び出す
    node.getProps = () => {
      return {
        attrType: 'actions',
        name: config.actionName,
        outputArgs: config.outParams1_actionArgsConstValue,
        content: {
          description: config.actionDescription,
          input: {
            type: config.actionInputDataType
          },
          output: {
            type: config.actionOutputDataType
          }
        }
      }
    }

    // inputイベント(インプットなし)
    /*node.on('input', async (msg, send, done) => {
      done()
    })*/
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
  RED.nodes.registerType('wot-server-action', WoTServerAction, {
    credentials: {
      inParams_actionName: { type: 'text' }
    }
  })
}
