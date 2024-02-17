'use strict'
const Servient = require('@node-wot/core').Servient
const HttpClientFactory = require('@node-wot/binding-http').HttpClientFactory
const HttpsClientFactory = require('@node-wot/binding-http').HttpsClientFactory
const WSClientFactory = require('@node-wot/binding-websockets').WebSocketClientFactory
const CoapClientFactory = require('@node-wot/binding-coap').CoapClientFactory
const CoapsClientFactory = require('@node-wot/binding-coap').CoapsClientFactory
const MqttClientFactory = require('@node-wot/binding-mqtt').MqttClientFactory
const OpcuaClientFactory = require('@node-wot/binding-opcua').OpcuaClientFactory
const ModbusClientFactory = require('@node-wot/binding-modbus').ModbusClientFactory

module.exports = function (RED) {
  function consumedThingNode(config) {
    RED.nodes.createNode(this, config)
    const node = this

    this.tdLink = config.tdLink
    this.td = JSON.parse(config.td)

    this.consumedThing = new Promise((resolve, reject) => {
      let servient = new Servient()

      if (config.basicAuth) {
        servient.addCredentials({ [this.td.id]: { username: config.username.trim(), password: config.password } })
      }

      if (config.http) {
        servient.addClientFactory(new HttpClientFactory())
        servient.addClientFactory(new HttpsClientFactory())
      }
      if (config.ws) {
        servient.addClientFactory(new WSClientFactory())
      }
      if (config.coap) {
        servient.addClientFactory(new CoapClientFactory())
        servient.addClientFactory(new CoapsClientFactory())
      }
      if (config.mqtt) {
        servient.addClientFactory(new MqttClientFactory())
      }
      if (config.opcua) {
        servient.addClientFactory(new OpcuaClientFactory())
      }
      if (config.modbus) {
        servient.addClientFactory(new ModbusClientFactory())
      }

      servient
        .start()
        .then((thingFactory) => {
          let consumedThing = thingFactory.consume(this.td)
          resolve(consumedThing)
        })
        .catch((err) => {
          node.error(`[error] failed to start servient. err: ${err.toString()}`)
          reject(err)
        })
    })
  }
  RED.nodes.registerType('consumed-thing', consumedThingNode)
}
