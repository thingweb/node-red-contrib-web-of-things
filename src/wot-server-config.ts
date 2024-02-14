import { ExposedThing } from '@node-wot/core'
import ServientManager from './servients/servient-manager'
import ServientWrapper from './servients/servient-wrapper'

module.exports = function (RED) {
  function WoTServerConfig(config) {
    RED.nodes.createNode(this, config)
    const node = this
    const userNodes = []
    // Delete thingDescriptions in globalContext (to avoid having them remain if the wot-server-config node is deleted)
    // Deleting them here may cause the deletion of thingsDescriptions added to globalContext that should not be deleted, due to timing.
    node.context().global.set('thingDescriptions', {})
    const servientManager = ServientManager.getInstance()
    node.running = false

    node.addUserNode = (n) => {
      n.setServientStatus(node.running)
      const foundUserNodes = userNodes.filter((userNode) => userNode.id === n.id)
      if (foundUserNodes.length === 0) {
        userNodes.push(n)
      }
    }

    async function waitForFinishPrepareRelatedNodes(userNodes: any[], userNodeIds: string[]) {
      const MAX_CHECK_COUNT = 50
      const WAIT_MILLI_SEC = 100 //ms
      for (let i = 0; i < MAX_CHECK_COUNT; i++) {
        // Confirm that all user nodes have been added
        let prepareAllNodesFlg = true
        for (const id of userNodeIds) {
          let foundFlg = false
          for (const node of userNodes) {
            if (node.id === id) {
              foundFlg = true
            }
          }
          if (!foundFlg) {
            // Returns false if no matching user node exists
            prepareAllNodesFlg = false
            break
          }
        }
        if (prepareAllNodesFlg) {
          // End because all nodes have been added
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
        return new Promise<any>((resolve, reject) => {
          const finish = (payload) => {
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
          return new Promise<void>((resolve, reject) => {
            const finish = (payload) => {
              if (props.content.observable) {
                thing
                  .emitPropertyChange(props.name)
                  .then(() => {
                    resolve()
                  })
                  .catch((err) => {
                    node.error(`[error] emit property change error. error: ${err.toString()}`)
                    console.error(`[error] emit property change error. error: `, err)
                    reject(err)
                  })
              } else {
                resolve()
              }
            }
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
        return new Promise<any>((resolve, reject) => {
          const finish = (payload) => {
            resolve(payload)
          }
          userNode.send({
            _wot: { finish },
            [props.outputArgs]: args,
          })
        })
      })
    }

    async function createWoTScriptAndExpose(
      thingProps: { title: string; description: string },
      servientWrapper: ServientWrapper,
      userNodes: any[]
    ) {
      // create TD
      let td = { ...thingProps }
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        td[props.attrType] = {
          ...td[props.attrType],
          [props.name]: props.content,
        }
      }
      const thing = await servientWrapper.createThing(td)
      // get elements of TD from each node
      for (const userNode of userNodes) {
        const props = userNode.getProps()
        if (!props.name) {
          node.warn(`[warn] Not enough settings for td. props.name not specified.`)
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
      thingDescriptions[`${config.name}::${thingProps.title}`] = thingDescription
      node.context().global.set('thingDescriptions', thingDescriptions)
      console.debug(`[info] servient started. ${config.name}::${thingProps.title}`)
    }

    async function launchServient() {
      node.bindingType = node.credentials.bindingType
      if (config.bindingConfigConstValue && config.bindingConfigType) {
        node.bindingConfig = RED.util.evaluateNodeProperty(
          config.bindingConfigConstValue,
          config.bindingConfigType,
          node
        )
      }

      // create thing
      const bindingType = config.bindingType
      const bindingConfig = node.bindingConfig
      console.debug('[debug] createServient ', node.id, bindingType, bindingConfig)
      const servientWrapper = servientManager.createServientWrapper(node.id, bindingType, bindingConfig)
      try {
        await waitForFinishPrepareRelatedNodes(userNodes, config._users)
        await servientWrapper.startServient()
        // make thing name list
        const thingNamesObj = {}
        for (const userNode of userNodes) {
          thingNamesObj[userNode.getThingProps().title] = true
        }
        const thingNames = Object.keys(thingNamesObj)
        // Generate and Expose a Thing for each Thing name
        for (const thingName of thingNames) {
          const targetNodes = userNodes.filter((n) => n.getThingProps().title === thingName)
          const thingProps = targetNodes[0]?.getThingProps() || {}
          await createWoTScriptAndExpose(thingProps, servientWrapper, targetNodes)
        }
        node.running = true
        userNodes.forEach((n) => {
          n.setServientStatus(node.running)
        })
      } catch (err) {
        throw err
      }
    }

    if (servientManager.existServienetWrapper(node.id)) {
      // Exit if already servient.
      console.debug('[debug] endServient. node.id: ', node.id)
      servientManager
        .removeServientWrapper(node.id)
        .then(() => {
          // end servient
          console.debug('[debug] servient ended. config.id: ', config.id)
          launchServient()
            .then(() => {
              node.debug('[debug] success to end and launch thing. name: ' + config.name + ' id: ' + config.id)
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
          node.error('[error] failed to remove server. name: ' + config.name + ' id: ' + config.id + ' err: ' + err)
          console.error('[error] failed to remove server. name: ' + config.name + ' id: ' + config.id + ' err: ', err)
        })
    } else {
      console.debug('[debug] launch servient. node.id: ', node.id)
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
