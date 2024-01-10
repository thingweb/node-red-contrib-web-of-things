/** @format */

import ServientManager, { ServientWrapper } from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    const userNodes = []
    const servientManager = ServientManager.getInstance()

    node.addUserNode = (n) => {
      console.log('*** addUserNode', n)
      const foundUserNodes = userNodes.filter(
        (userNode) => userNode.id === n.id
      )
      console.log('*** foundUserNodes.length', foundUserNodes.length)
      if (foundUserNodes.length === 0) {
        console.log('*** addUserNode executed')
        userNodes.push(n)
      }
    }

    async function waitForFinishPrepareRelatedNodes(
      userNodes: any[],
      userNodeIds: string[]
    ) {
      console.log('*** userNodeIds', userNodeIds)
      console.log('*** userNodes', userNodes)
      const MAX_CHECK_COUNT = 50
      const WAIT_MILLI_SEC = 100 //ms
      for (let i = 0; i < MAX_CHECK_COUNT; i++) {
        // 全てのユーザノードがそろっているか確認
        let prepareAllNodesFlg = true
        for (const id of userNodeIds) {
          let foundFlg = false
          for (const node of userNodes) {
            if (node.id === id) {
              foundFlg = true
            }
          }
          if (!foundFlg) {
            // ユーザノードに一致するノードが存在していなければfalseを返す
            console.log('*** foundFlg', foundFlg)
            prepareAllNodesFlg = false
            break
          }
        }
        if (prepareAllNodesFlg) {
          // ノードが揃ったため処理終了
          return
        }
        // wait
        await ((sec) => {
          return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              resolve()
            }, sec)
          })
        })(WAIT_MILLI_SEC)
      }
      throw new Error('Not enough WoT Nodes settings.')
    }

    async function createWoTScriptAndStart(
      title: string,
      description: string,
      servientWrapper: ServientWrapper,
      userNodes: any[]
    ) {
      // TDを作成
      let td = { title, description }
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        console.log('*** props', props)
        td[props.attrType] = {
          ...td[props.attrType],
          [props.name]: props.content
        }
      }
      console.log('*** created td', td)
      const thing = await servientWrapper.createThing(td)
      console.log('*** thing', thing)
      // 処理を行うために対応するノードにメッセージ送信
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        console.log('*** props', props)
        if (props.attrType === 'properties') {
          thing.setPropertyReadHandler(props.name, () => {
            console.log('*** call propertyReadHandler')
            console.log('*** userNodes.length', userNodes.length)
            return new Promise<any>((resolve, reject) => {
              const finish = (payload) => {
                console.log('*** finish', payload)
                resolve(payload)
              }
              userNode.send([
                {
                  wot: { finish }
                },
                null
              ])
            })
          })
          if (!props.content.readOnly) {
            thing.setPropertyWriteHandler(props.name, async (value: any) => {
              const v = await value.value()
              console.log('*** call propertyWriteHandler', v)
              console.log('*** userNodes.length', userNodes.length)
              return new Promise<void>((resolve, reject) => {
                const finish = (payload) => {
                  console.log('*** finish', props)
                  if (props.content.observable) {
                    console.log('*** emitPropertyChange', props.name)
                    thing.emitPropertyChange(props.name)
                  }
                  resolve()
                }
                console.log('*** userNode', userNode)
                userNode.send([
                  null,
                  {
                    wot: { finish },
                    [props.outputAttr]: v
                  }
                ])
              })
            })
          }
        } else if (props.attrType === 'actions') {
          //TODO: implements
        } else if (props.attrType === 'events') {
          //TODO: implements
        }
      }
      await servientWrapper.exposeThing()
      console.log('*** servient started')
    }

    async function launchServient() {
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
      //console.log('*** servientManager', servientManager)
      const servientWrapper = servientManager.createServientWrapper(
        node.id,
        type,
        params
      )
      try {
        await waitForFinishPrepareRelatedNodes(userNodes, config._users)
        await createWoTScriptAndStart(
          config.name,
          '',
          servientWrapper,
          userNodes
        )
      } catch (err) {
        console.error('[error] ' + err)
      }
    }

    console.log('*** endServient')
    if (servientManager.existServienetWrapper(node.id)) {
      // すでにservientがあれば終了する
      servientManager.removeServientWrapper(node.id).then(() => {
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
