/** @format */

import ServientManager from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this

    function launchServient() {
      node.bindingType = node.credentials.bindingType
      console.log('***** thing config', config)
      console.log('***** thing node', node)
      if (node.bindingTypeConstValue && node.bindingTypeType) {
        node.bindingType = RED.util.evaluateNodeProperty(
          config.bindingTypeConstValue,
          config.bindingTypeType,
          node
        )
      }

      // Thingの生成
      const bindingType = config.bindingType
      let type: string, params: any
      if (bindingType.indexOf('http-') === 0) {
        const port = Number(bindingType.replace('http-', ''))
        type = 'http'
        params = { port }
      } else if (bindingType === 'coap') {
        //TODO
      }
      console.log('*** createServient', node.id, type, params)
      const servientManager = ServientManager.getInstance()
      //console.log('*** servientManager', servientManager)
      node.servientWrapper = servientManager.getServientWrapper(node.id)
      if (!node.servientWrapper) {
        node.servientWrapper = servientManager.createServientWrapper(
          node.id,
          type,
          params
        )
      }
      const MAX_COUNT = 100
      let count = 0
      return new Promise<void>((resolve, reject) => {
        const start = (
          title: string,
          description: string,
          userNodeIds: string[],
          c: number
        ) => {
          c = c + 1
          setTimeout(async () => {
            // Servientの起動が成功するまで繰り返す
            console.log('*** startServient', c)
            const success = await node.servientWrapper.startServient(
              title,
              description,
              userNodeIds
            )
            console.log('*** success', success)
            if (success) {
              resolve()
            } else {
              if (c > MAX_COUNT) {
                console.error('[error] Not enough WoT Nodes settings.')
                reject(new Error('Not enough WoT Nodes settings.'))
              }
              start(title, description, userNodeIds, c)
            }
          }, 100)
        }
        start(config.name, '', config._users, count)
      })
    }

    // すでにservientがあれば終了する
    console.log('*** endServient')
    node.servientWrapper = ServientManager.getInstance().getServientWrapper(
      node.id
    )
    if (node.servientWrapper) {
      node.servientWrapper.endServient().then(() => {
        // servient終了
        console.log('*** servient ended. config node id: ', config.id)
        launchServient().then(() => {
          console.log('*** launched 1')
        })
      })
    } else {
      console.log('*** launch servient.')
      launchServient().then(() => {
        console.log('*** launched 2')
      })
    }
  }

  RED.nodes.registerType('wot-server-config', WoTServerConfig, {
    credentials: {
      bindingType: { type: 'text' }
    }
  })
}
