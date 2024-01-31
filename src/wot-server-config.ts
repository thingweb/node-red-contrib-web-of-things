import { ExposedThing } from '@node-wot/core'
import ServientManager from './servients/servient-manager'
import ServientWrapper from './servients/servient-wrapper'

module.exports = function (RED) {
  function WoTServerConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    const userNodes = []
    // globalContextのthingDescriptionsを削除(configノードを消した場合に残り続けることを避けるため)
    // ここで削除するとタイミング的に、globalContextに追加された、削除されてはいけないthingDescriptionが削除される恐れあり
    node.context().global.set('thingDescriptions', {})
    const servientManager = ServientManager.getInstance()
    node.running = false

    node.addUserNode = (n) => {
      console.log('*** addUserNode', n)
      n.setServientStatus(node.running)
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
                thing
                  .emitPropertyChange(props.name)
                  .then(() => {
                    resolve()
                  })
                  .catch((err) => {
                    node.error(`[error] emit property change error. error: ${err.toString()}`)
                    node.error(`[error] emit property change error. error: `, err)
                    reject(err)
                  })
              } else {
                resolve()
              }
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

    async function createWoTScriptAndExpose(
      title: string,
      description: string,
      servientWrapper: ServientWrapper,
      userNodes: any[]
    ) {
      // TDを作成
      let td = { title, description }
      let thingName
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        console.log('*** props', props)
        td[props.attrType] = {
          ...td[props.attrType],
          [props.name]: props.content,
        }
        thingName = userNode.getThingName()
      }
      console.log('*** thingNamae', thingName)
      console.log('*** created td', td)
      const thing = await servientWrapper.createThing(td, thingName)
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
      const thingDescription = await servientWrapper.exposeThing(thing)
      const thingDescriptions = node.context().global.get('thingDescriptions') || {}
      thingDescriptions[`${config.name}::${title}`] = thingDescription
      node.context().global.set('thingDescriptions', thingDescriptions)
      console.log('**** thingDescriptions', thingDescriptions)
      console.log('*** servient started', `${config.name}::${title}`)
    }

    async function launchServient() {
      node.bindingType = node.credentials.bindingType
      console.log('***** thing config', config)
      console.log('***** thing node', node)
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
      console.log('*** createServient', node.id, bindingType, bindingConfig)
      //console.log('*** servientManager', servientManager)
      //if (bindingType !== 'http') return //test
      const servientWrapper = servientManager.createServientWrapper(node.id, bindingType, bindingConfig)
      try {
        await waitForFinishPrepareRelatedNodes(userNodes, config._users)
        // servientの起動
        await servientWrapper.startServient()
        // ThingNameの一覧を作成
        const thingNamesObj = {}
        console.log('*** userNodes', userNodes)
        for (const userNode of userNodes) {
          console.log('*** userNode.getThingName', userNode.getThingName())
          thingNamesObj[userNode.getThingName()] = true
        }
        const thingNames = Object.keys(thingNamesObj)
        console.log('*** thingNames', thingNames)
        // Thing名毎にThingの生成とExposeを実施
        for (const thingName of thingNames) {
          const targetNodes = userNodes.filter((n) => n.getThingName() === thingName)
          await createWoTScriptAndExpose(thingName, '', servientWrapper, targetNodes)
        }
        node.running = true
        userNodes.forEach((n) => {
          n.setServientStatus(node.running)
        })
      } catch (err) {
        //console.error('[error] ' + err)
        throw err
      }
    }

    if (servientManager.existServienetWrapper(node.id)) {
      // すでにservientがあれば終了する
      console.log('*** endServient')
      servientManager
        .removeServientWrapper(node.id)
        .then(() => {
          // servient終了
          console.log('*** servient ended. config node id: ', config.id)
          launchServient()
            .then(() => {
              node.debug('[info] success to end and launch thing. name: ' + config.name + ' id: ' + config.id)
            })
            .catch((err) => {
              node.error('[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err:' + err)
              console.error(
                '[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err: ',
                err
              )
            })
        })
        .catch((err) => {
          node.error('[error] Failed to remove server. name: ' + config.name + ' id: ' + config.id + ' err:' + err)
        })
    } else {
      console.log('*** launch servient.')
      launchServient()
        .then(() => {
          node.debug('[info] success to launch thing. name: ' + config.name + ' id: ' + config.id)
        })
        .catch((err) => {
          node.error('[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err:' + err)
          console.error('[error] Failed to launch thing. name: ' + config.name + ' id: ' + config.id + ' err: ', err)
        })
    }
  }

  RED.nodes.registerType('wot-server-config', WoTServerConfig, {
    credentials: {
      bindingConfig: { type: 'object' },
    },
  })
}
