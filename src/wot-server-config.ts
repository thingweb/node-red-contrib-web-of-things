import { ExposedThing } from '@node-wot/core'
import ServientManager, { ServientWrapper } from './servients/servient-manager'

module.exports = function (RED) {
  function WoTServerConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    const userNodes = []
    const servientManager = ServientManager.getInstance()

    node.addUserNode = (n) => {
      console.log('*** addUserNode', n)
      const foundUserNodes = userNodes.filter((userNode) => userNode.id === n.id)
      console.log('*** foundUserNodes.length', foundUserNodes.length)
      if (foundUserNodes.length === 0) {
        console.log('*** addUserNode executed')
        userNodes.push(n)
      }
    }

    async function waitForFinishPrepareRelatedNodes(userNodes: any[], userNodeIds: string[]) {
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

    async function registerPropertiesProcess(userNode: any, thing: ExposedThing, props: any) {
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
              _wot: { finish },
            },
            null,
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
                _wot: { finish },
                [props.outputAttr]: v,
              },
            ])
          })
        })
      }
    }

    async function registerActionsProcess(userNode: any, thing: ExposedThing, props: any) {
      thing.setActionHandler(props.name, async (params) => {
        const args = await params.value()
        console.log('*** call actionHandler')
        console.log('*** actionHandler userNodes.length', userNodes.length)
        return new Promise<any>((resolve, reject) => {
          const finish = (payload) => {
            console.log('*** actionHandler finish', props, payload)
            resolve(payload)
          }
          console.log('*** actionHandler userNode', userNode)
          userNode.send({
            _wot: { finish },
            [props.outputArgs]: args,
          })
        })
      })
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
          [props.name]: props.content,
        }
      }
      console.log('*** created td', td)
      const thing = await servientWrapper.createThing(td)
      console.log('*** thing', thing)
      // 処理を行うために対応するノードにメッセージ送信
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        console.log('*** props', props)
        if (!props.name) {
          console.warn('[warn] Not enough settings for td. props: ', props)
          continue
        }
        if (props.attrType === 'properties') {
          registerPropertiesProcess(userNode, thing, props)
        } else if (props.attrType === 'actions') {
          registerActionsProcess(userNode, thing, props)
        } else if (props.attrType === 'events') {
          // Nothing to do
        }
      }
      await servientWrapper.exposeThing()
      console.log('*** servient started')
    }

    async function launchServient() {
      node.bindingType = node.credentials.bindingType
      console.log('***** thing config', config)
      console.log('***** thing node', node)
      // if (node.bindingTypeConstValue && node.bindingTypeType) {
      //   node.bindingType = RED.util.evaluateNodeProperty(config.bindingTypeConstValue, config.bindingTypeType, node)
      // }
      if (config.bindingConfigConstValue && config.bindingConfigType) {
        node.bindingConfig = RED.util.evaluateNodeProperty(
          config.bindingConfigConstValue,
          config.bindingConfigType,
          node
        )
      }

      // Thingの生成
      const bindingType = config.bindingType
      const bindingConfig = node.bindingConfig
      /*let type: string, params: any
      if (bindingType === 'http') {
      } else if (bindingType === 'coap') {
        //TODO
      }*/
      console.log('*** createServient', node.id, bindingType, bindingConfig)
      //console.log('*** servientManager', servientManager)
      if (bindingType !== 'http') return //test
      const servientWrapper = servientManager.createServientWrapper(node.id, bindingType, bindingConfig)
      try {
        await waitForFinishPrepareRelatedNodes(userNodes, config._users)
        await createWoTScriptAndStart(config.name, '', servientWrapper, userNodes)
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
        launchServient()
          .then(() => {
            node.log('[info] success to end and launch thing. name: ' + config.name + ' id: ' + config.id)
          })
          .catch((err) => {
            node.error('[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err:' + err)
          })
      })
    } else {
      console.log('*** launch servient.')
      launchServient()
        .then(() => {
          node.log('[info] success to launch thing. name: ' + config.name + ' id: ' + config.id)
        })
        .catch((err) => {
          node.error('[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err:' + err)
        })
    }
  }

  RED.nodes.registerType('wot-server-config', WoTServerConfig, {
    credentials: {
      bindingConfig: { type: 'object' },
    },
  })
}
