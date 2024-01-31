'use strict'

module.exports = function (RED) {
  function subscribeEventNode(config) {
    RED.nodes.createNode(this, config)
    let node = this

    this.subscription = undefined
    this.status({})

    if (!config.thing) {
      this.status({ fill: 'red', shape: 'dot', text: 'Error: Thing undefined' })
      return
    } else if (!config.event) {
      this.status({ fill: 'red', shape: 'dot', text: 'Error: Choose an event' })
      return
    }

    RED.nodes
      .getNode(config.thing)
      .consumedThing.then(async (consumedThing) => {
        let subscription
        // Repeat until event subscription succeeds.
        try {
          while (true) {
            subscription = await consumedThing
              .subscribeEvent(
                config.event,
                async (resp) => {
                  if (resp) {
                    let payload
                    try {
                      payload = await resp.value()
                    } catch (err) {
                      node.error(`[error] failed to get event. err: ${err.toString()}`)
                      console.error(`[error] failed to get event. err: `, err)
                    }
                    node.send({ payload, topic: config.topic })
                  }
                  node.status({
                    fill: 'green',
                    shape: 'dot',
                    text: 'Subscribed',
                  })
                },
                (err) => {
                  console.error('[error] subscribe events.', err)
                  node.error(`[error] subscribe events. err: ${err.toString()}`)
                  node.status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'Subscription error',
                  })
                },
                () => {
                  console.error('[warn] Subscription ended.')
                  node.warn('[warn] Subscription ended.')
                  node.status({})
                  node.subscription = undefined
                }
              )
              .catch((err) => {
                console.warn('[warn] event subscribe error. try again. error: ' + err)
              })
            if (subscription) {
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
        } catch (err) {
          node.status({
            fill: 'red',
            shape: 'ring',
            text: 'Subscription error',
          })
          node.error(`[error] failed to subscribe events. error: ${err.toString()}`)
        }
        node.subscription = subscription

        if (node.subscription) {
          node.status({
            fill: 'green',
            shape: 'dot',
            text: 'Subscribed',
          })
        }
      })
      .catch((err) => {
        node.status({
          fill: 'red',
          shape: 'ring',
          text: 'Subscription error',
        })
        node.error(`[error] Failed to create consumed thing for enents. err: ${err.toString()}`)
      })

    this.on('close', function (removed, done) {
      if (removed) {
        // This node has been deleted
      } else {
        // This node is being restarted
      }
      done()
    })
  }
  RED.nodes.registerType('subscribe-event', subscribeEventNode)
}
