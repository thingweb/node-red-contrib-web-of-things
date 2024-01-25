'use strict'

module.exports = function (RED) {
  function readPropertyNode(config) {
    RED.nodes.createNode(this, config)
    let node = this

    this.interval_id = null
    this.status({})

    if (!config.thing) {
      this.status({ fill: 'red', shape: 'dot', text: 'Error: Thing undefined' })
      return
    } else if (!config.property) {
      this.status({
        fill: 'red',
        shape: 'dot',
        text: 'Error: Choose a property',
      })
      return
    } else if (!config.interval) {
      this.status({
        fill: 'red',
        shape: 'dot',
        text: 'Error: Choose an interval',
      })
      return
    }

    RED.nodes.getNode(config.thing).consumedThing.then(async (consumedThing) => {
      if (config.observe === true) {
        // observePropertyが成功するまで繰り返す
        let ob
        while (true) {
          try {
            console.log('***** setup for observe property change')
            ob = await consumedThing.observeProperty(config.property, async (resp) => {
              console.log('***** property changed')
              let payload
              try {
                payload = await resp.value()
              } catch (err) {
                node.error(`[error] failed to get property change. err: ${err.toString()}`)
                console.error(`[error] failed to get property change. err:`, err)
              }
              node.send({ payload, topic: config.topic })
            })
          } catch (err) {
            console.warn('[warn] property observe error. try again. error: ' + err)
            node.status({
              fill: 'red',
              shape: 'ring',
              text: 'Observe error',
            })
          }
          if (ob) {
            node.status({
              fill: 'green',
              shape: 'dot',
              text: 'connected',
            })
            break
          }
          await (() => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 500)
            })
          })()
        }
      } else {
        console.log('*** observe false', config.property)
        this.interval_id = setInterval(
          (function readProperty() {
            console.log('*** observe false readProperty', config.property)
            const uriVariables = config.uriVariables ? JSON.parse(config.uriVariables) : undefined
            consumedThing
              .readProperty(config.property, { uriVariables: uriVariables })
              .then(async (resp) => {
                console.log('*** observe false readProperty then', config.property)
                let payload
                try {
                  payload = await resp.value()
                } catch (err) {
                  node.error(`[error] failed to get value. name: ${config.property}, error: ${err.toString()}`)
                  console.error(`[error] failed to get value. name: ${config.property}, error: `, err.toString())
                }
                node.send({ payload, topic: config.topic })
                node.status({
                  fill: 'green',
                  shape: 'dot',
                  text: 'connected',
                })
              })
              .catch((err) => {
                console.log('*** observe false readProperty catch', config.property)
                node.warn(err)
                node.status({
                  fill: 'red',
                  shape: 'ring',
                  text: 'Response error',
                })
              })
            return readProperty
          })(),
          config.interval * 1000
        )
      }
    })

    node.on('close', function () {
      if (node.interval_id != null) {
        clearInterval(node.interval_id)
      }
    })
  }
  RED.nodes.registerType('read-property', readPropertyNode)

  function writePropertyNode(config) {
    RED.nodes.createNode(this, config)
    let node = this

    this.status({})

    if (!config.thing) {
      this.status({ fill: 'red', shape: 'dot', text: 'Error: Thing undefined' })
      return
    } else if (!config.property) {
      this.status({
        fill: 'red',
        shape: 'dot',
        text: 'Error: Choose a property',
      })
      return
    }

    RED.nodes.getNode(config.thing).consumedThing.then((consumedThing) => {
      node.on('input', function (msg, send, done) {
        const uriVariables = config.uriVariables ? JSON.parse(config.uriVariables) : undefined
        consumedThing
          .writeProperty(config.property, msg.payload, {
            uriVariables: uriVariables,
          })
          .then((resp) => {
            if (resp) node.send({ payload: resp, topic: config.topic })
            node.status({
              fill: 'green',
              shape: 'dot',
              text: 'connected',
            })
            done()
          })
          .catch((err) => {
            node.warn(err)
            node.status({
              fill: 'red',
              shape: 'ring',
              text: err.message,
            })
            done(err)
          })
      })
    })
  }
  RED.nodes.registerType('write-property', writePropertyNode)
}
